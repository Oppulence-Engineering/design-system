import type { IntegrationId } from "../contracts";
import {
  IntegrationOAuthCredentialSchema,
  type IntegrationOAuthCredential,
} from "./credentials";

export interface OAuth2ProviderConfiguration {
  integrationId: IntegrationId;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  apiBaseUrl?: string;
  clientId: string;
  clientSecret?: string;
  redirectUri: string;
  scopes: readonly string[];
  authorizationParameters?: Readonly<Record<string, string>>;
  /** Maps a safe output field to a provider callback query parameter. */
  callbackMetadata?: Readonly<Record<string, string>>;
  tokenParameters?: Readonly<Record<string, string>>;
  clientAuthentication?: "basic" | "body";
  /** Defaults to 15 seconds; it bounds token exchange/refresh and API response headers. */
  requestTimeoutMs?: number;
  /** Defaults to 64 KiB and bounds the provider token JSON response. */
  maxTokenResponseBytes?: number;
}

export interface OAuth2AuthorizationInput {
  state: string;
  codeChallenge: string;
}

export interface OAuth2ApiRequest {
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

export class OAuth2ProviderError extends Error {
  readonly code:
    | "OAUTH2_AUTHORIZATION_FAILED"
    | "OAUTH2_TOKEN_EXCHANGE_FAILED"
    | "OAUTH2_REFRESH_FAILED"
    | "OAUTH2_API_BASE_UNAVAILABLE"
    | "OAUTH2_INVALID_API_PATH"
    | "OAUTH2_API_REQUEST_FAILED"
    | "OAUTH2_CONFIGURATION_INVALID";

  constructor(code: OAuth2ProviderError["code"]) {
    super("The provider authorization could not be completed.");
    this.name = "OAuth2ProviderError";
    this.code = code;
  }
}

function base64(value: string): string {
  return btoa(value);
}

function positiveNumber(value: unknown): number | undefined {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function scopes(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((scope): scope is string => typeof scope === "string")
    : typeof value === "string"
      ? value.split(" ").filter(Boolean)
      : [];
}

function parseTokenResponse(
  value: unknown,
  failureCode: "OAUTH2_TOKEN_EXCHANGE_FAILED" | "OAUTH2_REFRESH_FAILED",
): IntegrationOAuthCredential {
  if (!value || typeof value !== "object") {
    throw new OAuth2ProviderError(failureCode);
  }
  const response = value as Record<string, unknown>;
  if (typeof response.access_token !== "string" || !response.access_token) {
    throw new OAuth2ProviderError(failureCode);
  }
  const expiresIn = positiveNumber(response.expires_in);
  return IntegrationOAuthCredentialSchema.parse({
    accessToken: response.access_token,
    refreshToken:
      typeof response.refresh_token === "string"
        ? response.refresh_token
        : undefined,
    expiresAt: expiresIn
      ? new Date(Date.now() + expiresIn * 1_000).toISOString()
      : undefined,
    scope: scopes(response.scope),
    tokenType:
      typeof response.token_type === "string" ? response.token_type : "Bearer",
  });
}

const RESERVED_AUTHORIZATION_PARAMETERS = new Set([
  "client_id",
  "code_challenge",
  "code_challenge_method",
  "redirect_uri",
  "response_type",
  "scope",
  "state",
]);

function isLoopbackHost(hostname: string): boolean {
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

function validateSecureUrl(value: string, allowLoopbackHttp = false): void {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "https:" &&
        !(
          allowLoopbackHttp &&
          url.protocol === "http:" &&
          isLoopbackHost(url.hostname)
        )) ||
      url.username ||
      url.password
    ) {
      throw new Error("unsafe URL");
    }
  } catch {
    throw new OAuth2ProviderError("OAUTH2_CONFIGURATION_INVALID");
  }
}

function validateAuthorizationParameters(
  parameters: Readonly<Record<string, string>> | undefined,
): void {
  for (const [key, value] of Object.entries(parameters ?? {})) {
    if (
      !key ||
      key.length > 160 ||
      typeof value !== "string" ||
      value.length > 2_000 ||
      RESERVED_AUTHORIZATION_PARAMETERS.has(key.toLocaleLowerCase("en-US"))
    ) {
      throw new OAuth2ProviderError("OAUTH2_CONFIGURATION_INVALID");
    }
  }
}

function ensureRelativeApiPath(path: string): string {
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("#")) {
    throw new OAuth2ProviderError("OAUTH2_INVALID_API_PATH");
  }
  return path;
}

function providerApiUrl(apiBaseUrl: string, path: string): URL {
  try {
    const base = new URL(apiBaseUrl);
    const relative = new URL(
      ensureRelativeApiPath(path),
      "https://integration.invalid",
    );
    const basePath = base.pathname.replace(/\/+$/u, "");
    const relativePath = relative.pathname.replace(/^\/+/, "");
    base.pathname = `${basePath}/${relativePath}`.replace(/\/+/gu, "/");
    base.search = relative.search;
    base.hash = "";
    return base;
  } catch (error) {
    if (error instanceof OAuth2ProviderError) {
      throw error;
    }
    throw new OAuth2ProviderError("OAUTH2_INVALID_API_PATH");
  }
}

async function withTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Provider request timed out."));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function readJsonBody(
  response: Response,
  maximumBytes: number,
): Promise<unknown> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) {
    throw new Error("Token response exceeds configured size.");
  }
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Token response body is missing.");
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.byteLength;
    if (length > maximumBytes) {
      void reader.cancel().catch(() => undefined);
      throw new Error("Token response exceeds configured size.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export interface OAuth2ProviderSdk {
  configuration: OAuth2ProviderConfiguration;
  createAuthorizationUrl(input: OAuth2AuthorizationInput): string;
  extractCallbackMetadata(
    parameters: URLSearchParams,
  ): Readonly<Record<string, string>>;
  exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
  ): Promise<IntegrationOAuthCredential>;
  refresh(
    refreshToken: string,
    previousCredential: IntegrationOAuthCredential,
  ): Promise<IntegrationOAuthCredential>;
  request(
    credential: IntegrationOAuthCredential,
    request: OAuth2ApiRequest,
  ): Promise<Response>;
}

const UNSAFE_CALLBACK_PARAMETERS = new Set([
  "access_token",
  "code",
  "error",
  "error_description",
  "id_token",
  "refresh_token",
  "state",
]);
const CALLBACK_METADATA_KEY = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u;

function extractCallbackMetadata(
  configuration: OAuth2ProviderConfiguration,
  parameters: URLSearchParams,
): Readonly<Record<string, string>> {
  const metadata: Record<string, string> = {};
  for (const [field, parameter] of Object.entries(
    configuration.callbackMetadata ?? {},
  )) {
    if (
      !CALLBACK_METADATA_KEY.test(field) ||
      UNSAFE_CALLBACK_PARAMETERS.has(parameter.toLowerCase())
    ) {
      continue;
    }
    const value = parameters.get(parameter);
    if (value && value.length <= 512) {
      metadata[field] = value;
    }
  }
  return metadata;
}

export function createOAuth2ProviderSdk(
  configuration: OAuth2ProviderConfiguration,
  fetcher: typeof fetch = fetch,
): OAuth2ProviderSdk {
  const clientAuthentication = configuration.clientAuthentication ?? "basic";
  const requestTimeoutMs = configuration.requestTimeoutMs ?? 15_000;
  const maxTokenResponseBytes =
    configuration.maxTokenResponseBytes ?? 64 * 1024;
  if (
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 100 ||
    requestTimeoutMs > 120_000
  ) {
    throw new Error("OAuth2 provider requestTimeoutMs must be 100–120000ms.");
  }
  if (
    !Number.isSafeInteger(maxTokenResponseBytes) ||
    maxTokenResponseBytes < 1_024 ||
    maxTokenResponseBytes > 1_048_576
  ) {
    throw new Error(
      "OAuth2 provider maxTokenResponseBytes must be 1024–1048576.",
    );
  }
  validateSecureUrl(configuration.authorizationEndpoint);
  validateSecureUrl(configuration.tokenEndpoint);
  validateSecureUrl(configuration.redirectUri, true);
  if (configuration.apiBaseUrl) {
    validateSecureUrl(configuration.apiBaseUrl);
  }
  validateAuthorizationParameters(configuration.authorizationParameters);

  async function requestToken(
    parameters: Record<string, string>,
    failureCode: "OAUTH2_TOKEN_EXCHANGE_FAILED" | "OAUTH2_REFRESH_FAILED",
  ): Promise<IntegrationOAuthCredential> {
    const body = new URLSearchParams({
      ...configuration.tokenParameters,
      ...parameters,
    });
    const headers = new Headers({
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    });
    if (clientAuthentication === "basic" && configuration.clientSecret) {
      headers.set(
        "Authorization",
        `Basic ${base64(`${configuration.clientId}:${configuration.clientSecret}`)}`,
      );
    } else {
      body.set("client_id", configuration.clientId);
      if (configuration.clientSecret) {
        body.set("client_secret", configuration.clientSecret);
      }
    }
    try {
      return await withTimeout(requestTimeoutMs, async (signal) => {
        const response = await fetcher(configuration.tokenEndpoint, {
          method: "POST",
          headers,
          body,
          signal,
        });
        if (!response.ok) {
          throw new OAuth2ProviderError(failureCode);
        }
        return parseTokenResponse(
          await readJsonBody(response, maxTokenResponseBytes),
          failureCode,
        );
      });
    } catch (error) {
      if (error instanceof OAuth2ProviderError) {
        throw error;
      }
      throw new OAuth2ProviderError(failureCode);
    }
  }

  return {
    configuration,

    createAuthorizationUrl(input) {
      try {
        const url = new URL(configuration.authorizationEndpoint);
        url.searchParams.set("response_type", "code");
        url.searchParams.set("client_id", configuration.clientId);
        url.searchParams.set("redirect_uri", configuration.redirectUri);
        url.searchParams.set("scope", configuration.scopes.join(" "));
        url.searchParams.set("state", input.state);
        url.searchParams.set("code_challenge", input.codeChallenge);
        url.searchParams.set("code_challenge_method", "S256");
        for (const [key, value] of Object.entries(
          configuration.authorizationParameters ?? {},
        )) {
          url.searchParams.set(key, value);
        }
        return url.toString();
      } catch {
        throw new OAuth2ProviderError("OAUTH2_AUTHORIZATION_FAILED");
      }
    },

    extractCallbackMetadata(parameters) {
      return extractCallbackMetadata(configuration, parameters);
    },

    exchangeAuthorizationCode(code, codeVerifier) {
      return requestToken(
        {
          grant_type: "authorization_code",
          code,
          code_verifier: codeVerifier,
          redirect_uri: configuration.redirectUri,
        },
        "OAUTH2_TOKEN_EXCHANGE_FAILED",
      );
    },

    async refresh(refreshToken, previousCredential) {
      const refreshed = await requestToken(
        { grant_type: "refresh_token", refresh_token: refreshToken },
        "OAUTH2_REFRESH_FAILED",
      );
      return IntegrationOAuthCredentialSchema.parse({
        ...refreshed,
        refreshToken: refreshed.refreshToken ?? previousCredential.refreshToken,
        scope:
          refreshed.scope.length > 0
            ? refreshed.scope
            : previousCredential.scope,
      });
    },

    async request(credential, request) {
      if (!configuration.apiBaseUrl) {
        throw new OAuth2ProviderError("OAUTH2_API_BASE_UNAVAILABLE");
      }
      const url = providerApiUrl(configuration.apiBaseUrl, request.path);
      const headers = new Headers(request.headers);
      headers.set(
        "Authorization",
        `${credential.tokenType} ${credential.accessToken}`,
      );
      try {
        return await withTimeout(requestTimeoutMs, (signal) =>
          fetcher(url, {
            method: request.method ?? "GET",
            headers,
            body: request.body,
            signal,
          }),
        );
      } catch {
        throw new OAuth2ProviderError("OAUTH2_API_REQUEST_FAILED");
      }
    },
  };
}

export function createQuickBooksOAuth2Provider(
  input: Omit<
    OAuth2ProviderConfiguration,
    | "integrationId"
    | "authorizationEndpoint"
    | "tokenEndpoint"
    | "apiBaseUrl"
    | "scopes"
    | "clientAuthentication"
  > & {
    environment?: "sandbox" | "production";
  },
): OAuth2ProviderConfiguration {
  const { environment, ...configuration } = input;
  return {
    ...configuration,
    integrationId: "quickbooks",
    authorizationEndpoint: "https://appcenter.intuit.com/connect/oauth2",
    tokenEndpoint: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    apiBaseUrl:
      environment === "sandbox"
        ? "https://sandbox-quickbooks.api.intuit.com"
        : "https://quickbooks.api.intuit.com",
    scopes: ["com.intuit.quickbooks.accounting", "openid", "profile", "email"],
    callbackMetadata: {
      ...configuration.callbackMetadata,
      companyId: "realmId",
    },
    clientAuthentication: "basic",
  };
}

export function createXeroOAuth2Provider(
  input: Omit<
    OAuth2ProviderConfiguration,
    | "integrationId"
    | "authorizationEndpoint"
    | "tokenEndpoint"
    | "apiBaseUrl"
    | "scopes"
    | "clientAuthentication"
  >,
): OAuth2ProviderConfiguration {
  return {
    ...input,
    integrationId: "xero",
    authorizationEndpoint: "https://login.xero.com/identity/connect/authorize",
    tokenEndpoint: "https://identity.xero.com/connect/token",
    apiBaseUrl: "https://api.xero.com/api.xro/2.0",
    scopes: [
      "openid",
      "profile",
      "email",
      "accounting.transactions",
      "accounting.attachments",
      "accounting.settings",
      "accounting.contacts.read",
      "offline_access",
    ],
    clientAuthentication: "basic",
  };
}
