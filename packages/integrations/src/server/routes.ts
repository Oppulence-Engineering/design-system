import type {
  ActionResult,
  ConnectRequest,
  ConnectResult,
  ConnectionHealth,
  ConnectionHealthRequest,
  IntegrationActionRequest,
  ProductIntegrationConnector,
} from "../support";
import {
  IntegrationAccessDeniedError,
  IntegrationConnectionAccessError,
  IntegrationUnavailableError,
  type ProductIntegrationKit,
} from "../kit";
import type { IntegrationOAuthSubject } from "./runtime";
import type { IntegrationApiKeySubject } from "./api-key-runtime";
import {
  createIntegrationApiKeyRuntime,
  IntegrationApiKeyRuntimeError,
  type IntegrationApiKeyRuntimeConfig,
} from "./api-key-runtime";
import type { IntegrationNoAuthSubject } from "./no-auth-runtime";
import {
  createIntegrationNoAuthRuntime,
  IntegrationNoAuthRuntimeError,
  type IntegrationNoAuthRuntimeConfig,
} from "./no-auth-runtime";
import {
  createIntegrationOAuthRuntime,
  IntegrationRuntimeError,
  type IntegrationOAuthRuntimeConfig,
} from "./runtime";

export interface IntegrationOAuthRoutesConfig extends IntegrationOAuthRuntimeConfig {
  /** Resolves the product's authenticated tenant/actor context for OAuth start. */
  resolveSubject(request: Request): Promise<IntegrationOAuthSubject>;
  /** Required product authorization before an OAuth redirect is created. */
  authorizeStart(
    subject: IntegrationOAuthSubject,
    integrationId: string,
    request: Request,
  ): Promise<void>;
  /** Required authorization recheck immediately before a callback persists a connection. */
  authorizeComplete(
    subject: IntegrationOAuthSubject,
    integrationId: string,
    request: Request,
  ): Promise<void>;
  basePath?: string;
  maxJsonBodyBytes?: number;
}

export interface IntegrationApiKeyRoutesConfig extends IntegrationApiKeyRuntimeConfig {
  /** Resolves the product's authenticated tenant/actor context for API-key setup. */
  resolveSubject(request: Request): Promise<IntegrationApiKeySubject>;
  /** Required authorization immediately before an API key is persisted. */
  authorizeConnect(
    subject: IntegrationApiKeySubject,
    integrationId: string,
    request: Request,
  ): Promise<void>;
  basePath?: string;
  maxJsonBodyBytes?: number;
}

export interface IntegrationNoAuthRoutesConfig extends IntegrationNoAuthRuntimeConfig {
  /** Resolves the product's authenticated tenant/actor context for setup. */
  resolveSubject(request: Request): Promise<IntegrationNoAuthSubject>;
  /** Required authorization immediately before a no-auth connection is persisted. */
  authorizeConnect(
    subject: IntegrationNoAuthSubject,
    integrationId: string,
    request: Request,
  ): Promise<void>;
  basePath?: string;
}

class IntegrationRouteRequestError extends Error {
  readonly code:
    | "INTEGRATION_REQUEST_INVALID"
    | "INTEGRATION_REQUEST_TOO_LARGE";

  constructor(code: IntegrationRouteRequestError["code"]) {
    super("The integration request could not be processed.");
    this.name = "IntegrationRouteRequestError";
    this.code = code;
  }
}

function jsonError(error: unknown): Response {
  const [status, code] =
    error instanceof IntegrationAccessDeniedError
      ? [403, error.code]
      : error instanceof IntegrationRouteRequestError
        ? [
            error.code === "INTEGRATION_REQUEST_TOO_LARGE" ? 413 : 400,
            error.code,
          ]
        : error instanceof IntegrationConnectionAccessError
          ? [404, error.code]
          : error instanceof IntegrationUnavailableError
            ? [404, error.code]
            : error instanceof IntegrationRuntimeError
              ? [400, error.code]
              : error instanceof IntegrationApiKeyRuntimeError
                ? [400, error.code]
                : error instanceof IntegrationNoAuthRuntimeError
                  ? [400, error.code]
                  : [400, "INTEGRATION_REQUEST_INVALID"];
  return Response.json(
    { error: { code, message: "Integration request failed." } },
    { status },
  );
}

function normalizeBasePath(value: string): string {
  const withoutTrailingSlash = value.replace(/\/+$/u, "");
  return withoutTrailingSlash.startsWith("/")
    ? withoutTrailingSlash
    : `/${withoutTrailingSlash}`;
}

function maxJsonBodyBytes(value: number | undefined): number {
  const maximum = value ?? 64 * 1024;
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1_024 ||
    maximum > 1_048_576
  ) {
    throw new Error("Integration maxJsonBodyBytes must be 1024–1048576.");
  }
  return maximum;
}

async function returnPath(
  request: Request,
  maximumBodyBytes: number,
): Promise<string> {
  const queryValue = new URL(request.url).searchParams.get("returnPath");
  if (queryValue) {
    return queryValue;
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return "/integrations";
  }
  const body = await requestJsonObject(request, maximumBodyBytes);
  return typeof body.returnPath === "string"
    ? body.returnPath
    : "/integrations";
}

async function requestJsonObject(
  request: Request,
  maximumBodyBytes: number,
): Promise<Record<string, unknown>> {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    throw new IntegrationRouteRequestError("INTEGRATION_REQUEST_INVALID");
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBodyBytes) {
    throw new IntegrationRouteRequestError("INTEGRATION_REQUEST_TOO_LARGE");
  }
  const reader = request.body?.getReader();
  if (!reader) {
    throw new IntegrationRouteRequestError("INTEGRATION_REQUEST_INVALID");
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.byteLength;
    if (length > maximumBodyBytes) {
      await reader.cancel();
      throw new IntegrationRouteRequestError("INTEGRATION_REQUEST_TOO_LARGE");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new IntegrationRouteRequestError("INTEGRATION_REQUEST_INVALID");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationRouteRequestError("INTEGRATION_REQUEST_INVALID");
  }
  return value as Record<string, unknown>;
}

export interface IntegrationProductRoutesConfig<TContext> {
  /** The product kit owns canonical IDs, entitlements, and command validation. */
  kit: ProductIntegrationKit<TContext>;
  /** The product resolves its authenticated request context once per command. */
  resolveContext(request: Request): Promise<TContext>;
  basePath?: string;
  maxJsonBodyBytes?: number;
}

/**
 * Fetch-standard product API routes. This removes duplicated controller glue
 * while keeping the authenticated context and actual product policy/data work
 * in the consuming service.
 */
export function createIntegrationProductRoutes<TContext>(
  config: IntegrationProductRoutesConfig<TContext>,
) {
  const basePath = normalizeBasePath(config.basePath ?? "/integrations");
  const maximumBodyBytes = maxJsonBodyBytes(config.maxJsonBodyBytes);
  const escapedBasePath = basePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const connectPattern = new RegExp(
    `^${escapedBasePath}/([^/]+)/connect$`,
    "u",
  );
  const actionPattern = new RegExp(
    `^${escapedBasePath}/connections/([^/]+)/actions$`,
    "u",
  );
  const healthPattern = new RegExp(
    `^${escapedBasePath}/connections/([^/]+)/health$`,
    "u",
  );

  return {
    async handle(request: Request): Promise<Response | undefined> {
      const url = new URL(request.url);
      try {
        if (url.pathname === basePath && request.method === "GET") {
          return Response.json(
            await config.kit.getDirectory(await config.resolveContext(request)),
          );
        }

        const connect = connectPattern.exec(url.pathname);
        if (connect && request.method === "POST") {
          const body = await requestJsonObject(request, maximumBodyBytes);
          return Response.json(
            await config.kit.beginConnection(
              await config.resolveContext(request),
              {
                ...body,
                integrationId: decodeURIComponent(connect[1] ?? ""),
              },
            ),
          );
        }

        const action = actionPattern.exec(url.pathname);
        if (action && request.method === "POST") {
          const body = await requestJsonObject(request, maximumBodyBytes);
          return Response.json(
            await config.kit.performAction(
              await config.resolveContext(request),
              {
                ...body,
                connectionId: decodeURIComponent(action[1] ?? ""),
              },
            ),
          );
        }

        const health = healthPattern.exec(url.pathname);
        if (health && request.method === "GET") {
          return Response.json(
            await config.kit.getConnectionHealth(
              await config.resolveContext(request),
              { connectionId: decodeURIComponent(health[1] ?? "") },
            ),
          );
        }
      } catch (error) {
        return jsonError(error);
      }
      return undefined;
    },
  };
}

export interface IntegrationRouteHandler {
  handle(request: Request): Promise<Response | undefined>;
}

/** Mount product and OAuth routes as a single Fetch handler. */
export function composeIntegrationRoutes(
  ...handlers: readonly IntegrationRouteHandler[]
): IntegrationRouteHandler {
  return {
    async handle(request) {
      for (const handler of handlers) {
        const response = await handler.handle(request);
        if (response) {
          return response;
        }
      }
      return undefined;
    },
  };
}

/**
 * Fetch-standard OAuth routes. Hono, Next, and other products mount `handle`
 * at one path; the package owns state, PKCE, redirects, token exchange, and
 * encrypted credential persistence.
 */
export function createIntegrationOAuthRoutes(
  config: IntegrationOAuthRoutesConfig,
) {
  const runtime = createIntegrationOAuthRuntime(config);
  const basePath = normalizeBasePath(config.basePath ?? "/integrations");
  const maximumBodyBytes = maxJsonBodyBytes(config.maxJsonBodyBytes);
  const escapedBasePath = basePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const startPattern = new RegExp(
    `^${escapedBasePath}/([^/]+)/oauth/start$`,
    "u",
  );
  const callbackPattern = new RegExp(
    `^${escapedBasePath}/([^/]+)/oauth/callback$`,
    "u",
  );

  return {
    async handle(request: Request): Promise<Response | undefined> {
      const url = new URL(request.url);
      const start = startPattern.exec(url.pathname);
      if (start && (request.method === "POST" || request.method === "GET")) {
        try {
          const subject = await config.resolveSubject(request);
          const integrationId = decodeURIComponent(start[1] ?? "");
          await config.authorizeStart(subject, integrationId, request);
          const authorization = await runtime.beginAuthorization({
            ...subject,
            integrationId,
            returnPath: await returnPath(request, maximumBodyBytes),
          });
          return new Response(null, {
            status: 302,
            headers: { Location: authorization.authorizationUrl },
          });
        } catch (error) {
          return jsonError(error);
        }
      }

      const callback = callbackPattern.exec(url.pathname);
      if (callback && request.method === "GET") {
        try {
          const result = await runtime.completeAuthorization(
            {
              expectedIntegrationId: decodeURIComponent(callback[1] ?? ""),
              state: url.searchParams.get("state") ?? "",
              code: url.searchParams.get("code") ?? undefined,
              providerError: url.searchParams.get("error") ?? undefined,
              providerCallbackParameters: url.searchParams,
            },
            (authorization) =>
              config.authorizeComplete(
                {
                  product: authorization.product,
                  subjectId: authorization.subjectId,
                },
                authorization.integrationId,
                request,
              ),
          );
          return new Response(null, {
            status: 302,
            headers: { Location: result.returnPath },
          });
        } catch (error) {
          return jsonError(error);
        }
      }

      return undefined;
    },
  };
}

/**
 * Fetch-standard API-key setup route. It accepts the key only in the request
 * body, encrypts it before the product callback runs, and never reflects it in
 * a response, browser projection, or redirect URL.
 */
export function createIntegrationApiKeyRoutes(
  config: IntegrationApiKeyRoutesConfig,
) {
  const runtime = createIntegrationApiKeyRuntime(config);
  const basePath = normalizeBasePath(config.basePath ?? "/integrations");
  const maximumBodyBytes = maxJsonBodyBytes(config.maxJsonBodyBytes);
  const escapedBasePath = basePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const connectPattern = new RegExp(
    `^${escapedBasePath}/([^/]+)/api-key$`,
    "u",
  );

  return {
    async handle(request: Request): Promise<Response | undefined> {
      const url = new URL(request.url);
      const connect = connectPattern.exec(url.pathname);
      if (!connect || request.method !== "POST") {
        return undefined;
      }
      try {
        const body = await requestJsonObject(request, maximumBodyBytes);
        const subject = await config.resolveSubject(request);
        const integrationId = decodeURIComponent(connect[1] ?? "");
        const result = await runtime.connect(
          {
            ...subject,
            integrationId,
            apiKey: typeof body.apiKey === "string" ? body.apiKey : "",
          },
          (authorization) =>
            config.authorizeConnect(
              {
                product: authorization.product,
                subjectId: authorization.subjectId,
              },
              authorization.integrationId,
              request,
            ),
        );
        return Response.json({
          connectionId: result.connectionId,
          state: "connected",
          safeNextStep: "The API key was connected securely.",
        });
      } catch (error) {
        return jsonError(error);
      }
    },
  };
}

/**
 * Fetch-standard confirmation route for providers that need no customer
 * credential. It still establishes an authorized, auditable connection record
 * instead of allowing product code to treat a catalogue card as connected.
 */
export function createIntegrationNoAuthRoutes(
  config: IntegrationNoAuthRoutesConfig,
) {
  const runtime = createIntegrationNoAuthRuntime(config);
  const basePath = normalizeBasePath(config.basePath ?? "/integrations");
  const escapedBasePath = basePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const connectPattern = new RegExp(
    `^${escapedBasePath}/([^/]+)/no-auth$`,
    "u",
  );

  return {
    async handle(request: Request): Promise<Response | undefined> {
      const url = new URL(request.url);
      const connect = connectPattern.exec(url.pathname);
      if (!connect || request.method !== "POST") {
        return undefined;
      }
      try {
        const subject = await config.resolveSubject(request);
        const integrationId = decodeURIComponent(connect[1] ?? "");
        const result = await runtime.connect(
          { ...subject, integrationId },
          (authorization) =>
            config.authorizeConnect(
              {
                product: authorization.product,
                subjectId: authorization.subjectId,
              },
              authorization.integrationId,
              request,
            ),
        );
        return Response.json({
          connectionId: result.connectionId,
          state: "connected",
          safeNextStep: "The provider connection was confirmed.",
        });
      } catch (error) {
        return jsonError(error);
      }
    },
  };
}

export interface OAuthRouteConnectorActions<TContext> {
  performAction(
    context: TContext,
    request: IntegrationActionRequest,
  ): Promise<ActionResult>;
  getConnectionHealth(
    context: TContext,
    request: ConnectionHealthRequest,
  ): Promise<ConnectionHealth>;
}

/**
 * Plug this into `createProductIntegrationKit` to give a product the shared
 * OAuth start route. The product only supplies its domain actions and health
 * behavior; this package owns the OAuth protocol, callback, and credentials.
 */
export function createOAuthRouteConnector<TContext>(input: {
  actions: OAuthRouteConnectorActions<TContext>;
  basePath?: string;
}): ProductIntegrationConnector<TContext> {
  const basePath = normalizeBasePath(input.basePath ?? "/integrations");
  return {
    async beginConnection(
      _context: TContext,
      request: ConnectRequest,
    ): Promise<ConnectResult> {
      if (request.mode !== "oauth2") {
        throw new IntegrationRuntimeError(
          "INTEGRATION_CONNECTION_MODE_UNSUPPORTED",
        );
      }
      return {
        state: "redirect",
        safeNextStep: "Continue to the secure provider connection.",
        redirectPath: `${basePath}/${encodeURIComponent(request.integrationId)}/oauth/start`,
      };
    },
    performAction: input.actions.performAction,
    getConnectionHealth: input.actions.getConnectionHealth,
  };
}

/**
 * Plug this into `createProductIntegrationKit` for API-key providers. The
 * product presents its setup form; this package owns the mounted API-key route,
 * encrypted credential persistence, and authenticated provider requests.
 */
export function createApiKeyRouteConnector<TContext>(input: {
  actions: OAuthRouteConnectorActions<TContext>;
}): ProductIntegrationConnector<TContext> {
  return {
    async beginConnection(
      _context: TContext,
      request: ConnectRequest,
    ): Promise<ConnectResult> {
      if (request.mode !== "api_key") {
        throw new IntegrationRuntimeError(
          "INTEGRATION_CONNECTION_MODE_UNSUPPORTED",
        );
      }
      return {
        state: "setup_required",
        safeNextStep: "Enter the provider API key in the secure setup form.",
      };
    },
    performAction: input.actions.performAction,
    getConnectionHealth: input.actions.getConnectionHealth,
  };
}

/** Shared kit connector for the no-auth confirmation route. */
export function createNoAuthRouteConnector<TContext>(input: {
  actions: OAuthRouteConnectorActions<TContext>;
}): ProductIntegrationConnector<TContext> {
  return {
    async beginConnection(
      _context: TContext,
      request: ConnectRequest,
    ): Promise<ConnectResult> {
      if (request.mode !== "none") {
        throw new IntegrationRuntimeError(
          "INTEGRATION_CONNECTION_MODE_UNSUPPORTED",
        );
      }
      return {
        state: "setup_required",
        safeNextStep:
          "Confirm the provider connection in the secure setup flow.",
      };
    },
    performAction: input.actions.performAction,
    getConnectionHealth: input.actions.getConnectionHealth,
  };
}
