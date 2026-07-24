import { randomUUID } from "node:crypto";
import { z } from "zod";
import type {
  ExecutorToWorkerMessageCatalog,
  WorkerToExecutorMessageCatalog,
} from "./schemas/messages.js";
import { ZodSchemaParsedError } from "./zodMessageHandler.js";
import type {
  GetSocketCallbackSchema,
  GetSocketMessageSchema,
  GetSocketMessagesWithCallback,
  GetSocketMessagesWithoutCallback,
  MessagesFromSocketCatalog,
  SocketMessageHasCallback,
  ZodSocketMessageCatalogSchema,
} from "./zodSocket.js";

type ZodIpcMessageSender<TEmitCatalog extends ZodSocketMessageCatalogSchema> = {
  send<K extends GetSocketMessagesWithoutCallback<TEmitCatalog>>(
    type: K,
    payload: z.input<GetSocketMessageSchema<TEmitCatalog, K>>,
  ): Promise<void>;

  sendWithAck<K extends GetSocketMessagesWithCallback<TEmitCatalog>>(
    type: K,
    payload: z.input<GetSocketMessageSchema<TEmitCatalog, K>>,
  ): Promise<z.infer<GetSocketCallbackSchema<TEmitCatalog, K>>>;
};

type ZodIpcMessageHandlers<
  TListenCatalog extends ZodSocketMessageCatalogSchema,
  TEmitCatalog extends ZodSocketMessageCatalogSchema,
> = Partial<{
  [K in keyof TListenCatalog]: (
    payload: z.infer<GetSocketMessageSchema<TListenCatalog, K>>,
    sender: ZodIpcMessageSender<TEmitCatalog>,
  ) => Promise<
    SocketMessageHasCallback<TListenCatalog, K> extends true
      ? z.input<GetSocketCallbackSchema<TListenCatalog, K>>
      : void
  >;
}>;

const messageSchema = z.object({
  version: z.literal("v1").default("v1"),
  type: z.string(),
  payload: z.unknown(),
});

type ZodIpcMessageHandlerOptions<
  TListenCatalog extends ZodSocketMessageCatalogSchema,
  TEmitCatalog extends ZodSocketMessageCatalogSchema,
> = {
  schema: TListenCatalog;
  handlers?: ZodIpcMessageHandlers<TListenCatalog, TEmitCatalog>;
  sender: ZodIpcMessageSender<TEmitCatalog>;
};

class ZodIpcMessageHandler<
  TListenCatalog extends ZodSocketMessageCatalogSchema,
  TEmitCatalog extends ZodSocketMessageCatalogSchema,
> {
  readonly #schema: TListenCatalog;
  readonly #handlers:
    | ZodIpcMessageHandlers<TListenCatalog, TEmitCatalog>
    | undefined;
  readonly #sender: ZodIpcMessageSender<TEmitCatalog>;

  constructor(
    options: ZodIpcMessageHandlerOptions<TListenCatalog, TEmitCatalog>,
  ) {
    this.#schema = options.schema;
    this.#handlers = options.handlers;
    this.#sender = options.sender;
  }

  public async handleMessage(message: unknown) {
    const parsedMessage = this.parseMessage(message);

    if (!this.#handlers) {
      throw new Error("No handlers provided");
    }

    const handler = this.#handlers[parsedMessage.type];

    if (!handler) {
      // console.error(`No handler for message type: ${String(parsedMessage.type)}`);
      return;
    }

    const ack = await handler(
      parsedMessage.payload as z.output<
        GetSocketMessageSchema<TListenCatalog, keyof TListenCatalog>
      >,
      this.#sender,
    );

    return ack;
  }

  public parseMessage(
    message: unknown,
  ): MessagesFromSocketCatalog<TListenCatalog> {
    const parsedMessage = messageSchema.safeParse(message);

    if (!parsedMessage.success) {
      throw new Error(
        `Failed to parse message: ${JSON.stringify(parsedMessage.error)}`,
      );
    }
    const schema = this.#schema[parsedMessage.data.type]?.message;

    if (!schema) {
      throw new Error(`Unknown message type: ${parsedMessage.data.type}`);
    }

    const parsedPayload = schema.safeParse(parsedMessage.data.payload);

    if (!parsedPayload.success) {
      throw new Error(
        `Failed to parse message payload: ${JSON.stringify(parsedPayload.error)}`,
      );
    }

    return {
      type: parsedMessage.data.type,
      payload: parsedPayload.data,
    };
  }
}

const Packet = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("CONNECT"),
    sessionId: z.string().optional(),
  }),
  z.object({
    type: z.literal("ACK"),
    message: z.any(),
    id: z.number(),
  }),
  z.object({
    type: z.literal("EVENT"),
    message: z.any(),
    id: z.number().optional(),
  }),
]);

type Packet = z.infer<typeof Packet>;

type ZodIpcConnectionOptions<
  TListenCatalog extends ZodSocketMessageCatalogSchema,
  TEmitCatalog extends ZodSocketMessageCatalogSchema,
> = {
  listenSchema: TListenCatalog;
  emitSchema: TEmitCatalog;
  process: {
    send?: (message: unknown) => unknown;
    on?: (event: "message", listener: (message: unknown) => void) => void;
  };
  handlers?: ZodIpcMessageHandlers<TListenCatalog, TEmitCatalog>;
};

export class ZodIpcConnection<
  TListenCatalog extends ZodSocketMessageCatalogSchema,
  TEmitCatalog extends ZodSocketMessageCatalogSchema,
> {
  #sessionId?: string;
  #messageCounter = 0;

  readonly #handler: ZodIpcMessageHandler<TListenCatalog, TEmitCatalog>;

  readonly #acks: Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (reason?: unknown) => void;
      timeout: NodeJS.Timeout;
    }
  > = new Map();

  constructor(
    private readonly opts: ZodIpcConnectionOptions<
      TListenCatalog,
      TEmitCatalog
    >,
  ) {
    this.#handler = new ZodIpcMessageHandler({
      schema: opts.listenSchema,
      handlers: opts.handlers,
      sender: {
        send: this.send.bind(this),
        sendWithAck: this.sendWithAck.bind(this),
      },
    });

    this.#registerHandlers();
    // this.connect();
  }

  #registerHandlers() {
    if (!this.opts.process.on) {
      return;
    }

    this.opts.process.on("message", (message: unknown) => {
      this.#handlePacket(message as Packet);
    });
  }

  connect() {
    this.#sendPacket({ type: "CONNECT" });
  }

  async #handlePacket(packet: Packet): Promise<void> {
    const parsedPacket = Packet.safeParse(packet);

    if (!parsedPacket.success) {
      return;
    }

    switch (parsedPacket.data.type) {
      case "ACK": {
        // Check our list of ACKs and resolve with the message
        const ack = this.#acks.get(parsedPacket.data.id);

        if (!ack) {
          return;
        }

        clearTimeout(ack.timeout);
        this.#acks.delete(parsedPacket.data.id);
        ack.resolve(parsedPacket.data.message);

        break;
      }
      case "CONNECT": {
        if (!parsedPacket.data.sessionId) {
          // This is a client trying to connect, so we generate and send back a session ID
          const id = randomUUID();

          await this.#sendPacket({ type: "CONNECT", sessionId: id });

          return;
        }

        // This is a server replying to our connect message
        if (this.#sessionId) {
          // We're already connected
          return;
        }

        this.#sessionId = parsedPacket.data.sessionId;

        break;
      }
      case "EVENT": {
        const result = await this.#handler.handleMessage(
          parsedPacket.data.message,
        );

        if (typeof parsedPacket.data.id === "undefined") {
          return;
        }

        // There's an ID so we should ACK
        await this.#sendPacket({
          type: "ACK",
          id: parsedPacket.data.id,
          message: result,
        });

        break;
      }
      default: {
        break;
      }
    }
  }

  async #sendPacket(packet: Packet) {
    await this.opts.process.send?.(packet);
  }

  async send<K extends GetSocketMessagesWithoutCallback<TEmitCatalog>>(
    type: K,
    payload: z.input<GetSocketMessageSchema<TEmitCatalog, K>>,
  ): Promise<void> {
    const schema = this.opts.emitSchema[type]?.message;

    if (!schema) {
      throw new Error(`Unknown message type: ${type as string}`);
    }

    const parsedPayload = schema.safeParse(payload);

    if (!parsedPayload.success) {
      throw new ZodSchemaParsedError(parsedPayload.error, payload);
    }

    await this.#sendPacket({
      type: "EVENT",
      message: {
        type,
        payload,
        version: "v1",
      },
    });
  }

  public sendWithAck<K extends GetSocketMessagesWithCallback<TEmitCatalog>>(
    type: K,
    payload: z.input<GetSocketMessageSchema<TEmitCatalog, K>>,
    timeoutInMs?: number,
  ): Promise<z.infer<GetSocketCallbackSchema<TEmitCatalog, K>>> {
    const currentId = this.#messageCounter++;

    return new Promise((resolve, reject) => {
      const defaultTimeoutInMs = 2000;

      // Timeout if the ACK takes too long to get back to us
      const timeout = setTimeout(() => {
        this.#acks.delete(currentId);
        reject(
          JSON.stringify({
            reason: "sendWithAck() timeout",
            timeoutInMs: timeoutInMs ?? defaultTimeoutInMs,
            type,
            payload,
          }),
        );
      }, timeoutInMs ?? defaultTimeoutInMs);

      this.#acks.set(currentId, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });

      // Use IIFE to handle async work and properly route errors to reject
      (async () => {
        const schema = this.opts.emitSchema[type]?.message;

        if (!schema) {
          clearTimeout(timeout);
          this.#acks.delete(currentId);
          reject(`Unknown message type: ${type as string}`);
          return;
        }

        const parsedPayload = schema.safeParse(payload);

        if (!parsedPayload.success) {
          clearTimeout(timeout);
          this.#acks.delete(currentId);
          reject(
            `Failed to parse message payload: ${JSON.stringify(parsedPayload.error)}`,
          );
          return;
        }

        await this.#sendPacket({
          type: "EVENT",
          message: {
            type,
            payload,
            version: "v1",
          },
          id: currentId,
        });
      })().catch((error) => {
        clearTimeout(timeout);
        this.#acks.delete(currentId);
        reject(error);
      });
    });
  }
}

export type WorkerToExecutorProcessConnection = ZodIpcConnection<
  typeof ExecutorToWorkerMessageCatalog,
  typeof WorkerToExecutorMessageCatalog
>;

export type ExecutorToWorkerProcessConnection = ZodIpcConnection<
  typeof WorkerToExecutorMessageCatalog,
  typeof ExecutorToWorkerMessageCatalog
>;
