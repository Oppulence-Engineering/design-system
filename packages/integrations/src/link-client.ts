export type IntegrationConnectionLinkProvider = "plaid" | "merge";

export interface IntegrationConnectionLinkToken {
  integrationId: IntegrationConnectionLinkProvider;
  linkToken: string;
  expiresAt?: string;
  magicLinkUrl?: string;
}

export interface IntegrationConnectionLinkCompletion {
  connectionId: string;
  integrationId: IntegrationConnectionLinkProvider;
  state: "connected";
  safeNextStep: string;
}

export type IntegrationConnectionLinkFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class IntegrationConnectionLinkClientError extends Error {
  readonly code:
    | "INTEGRATION_CONNECTION_LINK_CLIENT_REQUEST_FAILED"
    | "INTEGRATION_CONNECTION_LINK_CLIENT_RESPONSE_INVALID";

  constructor(code: IntegrationConnectionLinkClientError["code"]) {
    super("The secure provider connection could not be completed.");
    this.name = "IntegrationConnectionLinkClientError";
    this.code = code;
  }
}

export interface IntegrationConnectionLinkClient {
  createToken(
    integrationId: IntegrationConnectionLinkProvider,
    signal?: AbortSignal,
  ): Promise<IntegrationConnectionLinkToken>;
  complete(
    integrationId: IntegrationConnectionLinkProvider,
    publicToken: string,
    signal?: AbortSignal,
  ): Promise<IntegrationConnectionLinkCompletion>;
}

export interface CreateIntegrationConnectionLinkClientConfig {
  /** Defaults to the package-owned `/integrations` route mount. */
  basePath?: string;
  /** Allows products to supply their authenticated/CSRF-aware fetch wrapper. */
  fetcher?: IntegrationConnectionLinkFetcher;
}

function normalizedBasePath(value: string | undefined): string {
  const path = (value ?? "/integrations").replace(/\/+$/u, "");
  return path.startsWith("/") ? path : `/${path}`;
}

function safeError(): IntegrationConnectionLinkClientError {
  return new IntegrationConnectionLinkClientError(
    "INTEGRATION_CONNECTION_LINK_CLIENT_REQUEST_FAILED",
  );
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw safeError();
  }
  const body = await response.text();
  if (body.length > 64 * 1024) {
    throw new IntegrationConnectionLinkClientError(
      "INTEGRATION_CONNECTION_LINK_CLIENT_RESPONSE_INVALID",
    );
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new IntegrationConnectionLinkClientError(
      "INTEGRATION_CONNECTION_LINK_CLIENT_RESPONSE_INVALID",
    );
  }
}

function asToken(
  integrationId: IntegrationConnectionLinkProvider,
  value: unknown,
): IntegrationConnectionLinkToken {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationConnectionLinkClientError(
      "INTEGRATION_CONNECTION_LINK_CLIENT_RESPONSE_INVALID",
    );
  }
  const response = value as Record<string, unknown>;
  if (
    response.integrationId !== integrationId ||
    typeof response.linkToken !== "string" ||
    !response.linkToken
  ) {
    throw new IntegrationConnectionLinkClientError(
      "INTEGRATION_CONNECTION_LINK_CLIENT_RESPONSE_INVALID",
    );
  }
  return {
    integrationId,
    linkToken: response.linkToken,
    ...(typeof response.expiresAt === "string"
      ? { expiresAt: response.expiresAt }
      : {}),
    ...(typeof response.magicLinkUrl === "string"
      ? { magicLinkUrl: response.magicLinkUrl }
      : {}),
  };
}

function asCompletion(
  integrationId: IntegrationConnectionLinkProvider,
  value: unknown,
): IntegrationConnectionLinkCompletion {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new IntegrationConnectionLinkClientError(
      "INTEGRATION_CONNECTION_LINK_CLIENT_RESPONSE_INVALID",
    );
  }
  const response = value as Record<string, unknown>;
  if (
    response.integrationId !== integrationId ||
    typeof response.connectionId !== "string" ||
    !response.connectionId ||
    response.state !== "connected" ||
    typeof response.safeNextStep !== "string"
  ) {
    throw new IntegrationConnectionLinkClientError(
      "INTEGRATION_CONNECTION_LINK_CLIENT_RESPONSE_INVALID",
    );
  }
  return {
    integrationId,
    connectionId: response.connectionId,
    state: "connected",
    safeNextStep: response.safeNextStep,
  };
}

/**
 * Browser-safe client for the package-owned Link routes. It accepts and returns
 * only short-lived public tokens and safe connection projections—never a
 * provider access token, account token, or deployment credential.
 */
export function createIntegrationConnectionLinkClient(
  config: CreateIntegrationConnectionLinkClientConfig = {},
): IntegrationConnectionLinkClient {
  const basePath = normalizedBasePath(config.basePath);
  const fetcher = config.fetcher ?? globalThis.fetch.bind(globalThis);

  async function post(
    path: string,
    body: Record<string, string>,
    signal: AbortSignal | undefined,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      throw safeError();
    }
    return readJson(response);
  }

  return {
    async createToken(integrationId, signal) {
      return asToken(
        integrationId,
        await post(`${basePath}/${integrationId}/link/token`, {}, signal),
      );
    },
    async complete(integrationId, publicToken, signal) {
      if (!publicToken || publicToken.length > 16_384) {
        throw new IntegrationConnectionLinkClientError(
          "INTEGRATION_CONNECTION_LINK_CLIENT_RESPONSE_INVALID",
        );
      }
      return asCompletion(
        integrationId,
        await post(
          `${basePath}/${integrationId}/link/complete`,
          { publicToken },
          signal,
        ),
      );
    },
  };
}
