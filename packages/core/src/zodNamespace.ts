import type {
  DefaultEventsMap,
  DisconnectReason,
  Namespace,
  Server,
  Socket,
} from "socket.io";
import type { z } from "zod";
import {
  SimpleStructuredLogger,
  type StructuredLogger,
} from "./utils/structuredLogger.js";

import { ZodMessageSender } from "./zodMessageHandler.js";
import {
  type GetSocketMessagesWithoutCallback,
  type ZodMessageCatalogToSocketIoEvents,
  type ZodSocketMessageCatalogSchema,
  ZodSocketMessageHandler,
  type ZodSocketMessageHandlers,
} from "./zodSocket.js";

interface ExtendedError extends Error {
  data?: unknown;
}

/**
 * Socket.IO's internal `EventsMap` type is not exported from the package root
 * (it lives in an internal `dist/*` path that is blocked by the package
 * `exports` map). For our purposes we only need the structural constraint:
 * "an object that maps event names to listener signatures".
 */ type SocketIoEventsMap = Record<string, unknown>;

type ZodNamespaceSendableMessageSchema<
  TCatalog extends ZodSocketMessageCatalogSchema,
> = {
  [K in GetSocketMessagesWithoutCallback<TCatalog>]: TCatalog[K]["message"];
};

function createNamespaceMessageSchema<
  TCatalog extends ZodSocketMessageCatalogSchema,
>(schema: TCatalog): ZodNamespaceSendableMessageSchema<TCatalog> {
  const entries = Object.entries(schema).filter(([, value]) => {
    if ("callback" in value) {
      return value.callback === undefined;
    }
    return true;
  });

  return Object.fromEntries(
    entries.map(([key, value]) => [key, value.message]),
  ) as ZodNamespaceSendableMessageSchema<TCatalog>;
}

export type ZodNamespaceSocket<
  TClientMessages extends ZodSocketMessageCatalogSchema,
  TServerMessages extends ZodSocketMessageCatalogSchema,
  TServerSideEvents extends SocketIoEventsMap = DefaultEventsMap,
  // biome-ignore lint/suspicious/noExplicitAny: required for Zod generic inference with Socket.IO
  TSocketData extends z.ZodObject<any> = any,
> = Socket<
  ZodMessageCatalogToSocketIoEvents<TClientMessages>,
  ZodMessageCatalogToSocketIoEvents<TServerMessages>,
  TServerSideEvents,
  z.infer<TSocketData>
>;

type ZodNamespaceOptions<
  TClientMessages extends ZodSocketMessageCatalogSchema,
  TServerMessages extends ZodSocketMessageCatalogSchema,
  TServerSideEvents extends SocketIoEventsMap = DefaultEventsMap,
  // biome-ignore lint/suspicious/noExplicitAny: complex type
  TSocketData extends z.ZodObject<any> = any,
> = {
  io: Server;
  name: string;
  clientMessages: TClientMessages;
  serverMessages: TServerMessages;
  socketData?: TSocketData;
  handlers?: ZodSocketMessageHandlers<TClientMessages>;
  authToken?: string;
  logger?: StructuredLogger;
  logHandlerPayloads?: boolean;
  preAuth?: (
    socket: ZodNamespaceSocket<
      TClientMessages,
      TServerMessages,
      TServerSideEvents,
      TSocketData
    >,
    next: (err?: ExtendedError) => void,
    logger: StructuredLogger,
  ) => Promise<void>;
  postAuth?: (
    socket: ZodNamespaceSocket<
      TClientMessages,
      TServerMessages,
      TServerSideEvents,
      TSocketData
    >,
    next: (err?: ExtendedError) => void,
    logger: StructuredLogger,
  ) => Promise<void>;
  onConnection?: (
    socket: ZodNamespaceSocket<
      TClientMessages,
      TServerMessages,
      TServerSideEvents,
      TSocketData
    >,
    handler: ZodSocketMessageHandler<TClientMessages>,
    sender: ZodMessageSender<
      ZodNamespaceSendableMessageSchema<TServerMessages>
    >,
    logger: StructuredLogger,
  ) => Promise<void>;
  onDisconnect?: (
    socket: ZodNamespaceSocket<
      TClientMessages,
      TServerMessages,
      TServerSideEvents,
      TSocketData
    >,
    reason: DisconnectReason,
    description: unknown,
    logger: StructuredLogger,
  ) => Promise<void>;
  onError?: (
    socket: ZodNamespaceSocket<
      TClientMessages,
      TServerMessages,
      TServerSideEvents,
      TSocketData
    >,
    err: Error,
    logger: StructuredLogger,
  ) => Promise<void>;
};

export class ZodNamespace<
  TClientMessages extends ZodSocketMessageCatalogSchema,
  TServerMessages extends ZodSocketMessageCatalogSchema,
  // biome-ignore lint/suspicious/noExplicitAny: required for Zod generic inference with Socket.IO
  TSocketData extends z.ZodObject<any> = any,
  TServerSideEvents extends SocketIoEventsMap = DefaultEventsMap,
> {
  readonly #logger: StructuredLogger;
  readonly #handler: ZodSocketMessageHandler<TClientMessages>;
  sender: ZodMessageSender<ZodNamespaceSendableMessageSchema<TServerMessages>>;

  io: Server;
  namespace: Namespace<
    ZodMessageCatalogToSocketIoEvents<TClientMessages>,
    ZodMessageCatalogToSocketIoEvents<TServerMessages>,
    TServerSideEvents,
    z.infer<TSocketData>
  >;

  constructor(
    opts: ZodNamespaceOptions<
      TClientMessages,
      TServerMessages,
      TServerSideEvents,
      TSocketData
    >,
  ) {
    this.#logger =
      opts.logger ??
      new SimpleStructuredLogger(`ns-${opts.name}`, undefined, {
        namespace: opts.name,
      });

    this.#handler = new ZodSocketMessageHandler({
      schema: opts.clientMessages,
      handlers: opts.handlers,
      logPayloads: opts.logHandlerPayloads,
    });

    this.io = opts.io;

    this.namespace = this.io.of(opts.name);

    const sendableSchema = createNamespaceMessageSchema(opts.serverMessages);
    const excludedMessageTypes = Object.keys(opts.serverMessages).filter(
      (key) => !(key in sendableSchema),
    );
    if (excludedMessageTypes.length > 0) {
      this.#logger.warn(
        "Server message schema includes callbacks; these messages cannot be sent from namespace sender",
        { messageTypes: excludedMessageTypes },
      );
    }

    this.sender = new ZodMessageSender({
      schema: sendableSchema,
      sender: async (message) =>
        new Promise((resolve, reject) => {
          try {
            // biome-ignore lint/suspicious/noExplicitAny: Socket.IO emit requires dynamic event name dispatch
            (this.namespace.emit as any)(message.type, message.payload);
            resolve();
          } catch (err) {
            reject(err);
          }
        }),
    });

    if (opts.preAuth) {
      this.namespace.use(async (socket, next) => {
        const logger = this.#logger.child({
          socketId: socket.id,
          socketStage: "preAuth",
        });

        if (typeof opts.preAuth === "function") {
          await opts.preAuth(socket, next, logger);
        }
      });
    }

    if (opts.authToken) {
      this.namespace.use((socket, next) => {
        const logger = this.#logger.child({
          socketId: socket.id,
          socketStage: "auth",
        });

        const { auth } = socket.handshake;

        if (!("token" in auth)) {
          logger.error("no token");
          return socket.disconnect(true);
        }

        if (auth.token !== opts.authToken) {
          logger.error("invalid token");
          return socket.disconnect(true);
        }

        logger.info("success");

        next();

        return;
      });
    }

    if (opts.postAuth) {
      this.namespace.use(async (socket, next) => {
        const logger = this.#logger.child({
          socketId: socket.id,
          socketStage: "auth",
        });

        if (typeof opts.postAuth === "function") {
          await opts.postAuth(socket, next, logger);
        }
      });
    }

    this.namespace.on("connection", async (socket) => {
      const logger = this.#logger.child({
        socketId: socket.id,
        socketStage: "connection",
      });
      logger.info("connected");

      this.#handler.registerHandlers(socket, logger);

      socket.on("disconnect", async (reason, description) => {
        logger.info("disconnect", { reason, description });

        if (opts.onDisconnect) {
          await opts.onDisconnect(socket, reason, description, logger);
        }
      });

      socket.on("error", async (error) => {
        logger.error("error", { error });

        if (opts.onError) {
          await opts.onError(socket, error, logger);
        }
      });

      if (opts.onConnection) {
        await opts.onConnection(socket, this.#handler, this.sender, logger);
      }
    });
  }

  fetchSockets() {
    return this.namespace.fetchSockets();
  }
}
