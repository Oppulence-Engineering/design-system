import type { IntegrationId } from "../../contracts";
import { getIntegration } from "../../registry";

export interface UnauthenticatedProviderConfiguration {
  integrationId: IntegrationId;
  apiBaseUrl: string;
  /** Defaults to 15 seconds. It bounds provider response headers. */
  requestTimeoutMs?: number;
}

export interface UnauthenticatedProviderRequest {
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

export interface UnauthenticatedProviderSdk {
  configuration: UnauthenticatedProviderConfiguration;
  request(request: UnauthenticatedProviderRequest): Promise<Response>;
}

export class UnauthenticatedProviderError extends Error {
  readonly code:
    | "UNAUTHENTICATED_PROVIDER_CONFIGURATION_INVALID"
    | "UNAUTHENTICATED_PROVIDER_INVALID_PATH"
    | "UNAUTHENTICATED_PROVIDER_REQUEST_FAILED";

  constructor(code: UnauthenticatedProviderError["code"]) {
    super("The provider request could not be completed.");
    this.name = "UnauthenticatedProviderError";
    this.code = code;
  }
}

function validateSecureUrl(value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("unsafe URL");
    }
  } catch {
    throw new UnauthenticatedProviderError(
      "UNAUTHENTICATED_PROVIDER_CONFIGURATION_INVALID",
    );
  }
}

function providerApiUrl(apiBaseUrl: string, path: string): URL {
  if (
    path.length > 2_000 ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("#") ||
    /%(?:2f|5c|3f|23)/iu.test(path)
  ) {
    throw new UnauthenticatedProviderError(
      "UNAUTHENTICATED_PROVIDER_INVALID_PATH",
    );
  }
  try {
    const base = new URL(apiBaseUrl);
    const relative = new URL(path, "https://integration.invalid");
    const basePath = base.pathname.replace(/\/+$/u, "");
    const relativePath = relative.pathname.replace(/^\/+/, "");
    base.pathname = `${basePath}/${relativePath}`.replace(/\/+/gu, "/");
    base.search = relative.search;
    base.hash = "";
    return base;
  } catch (error) {
    if (error instanceof UnauthenticatedProviderError) {
      throw error;
    }
    throw new UnauthenticatedProviderError(
      "UNAUTHENTICATED_PROVIDER_INVALID_PATH",
    );
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

/** Shared HTTPS transport for Sim Studio's no-auth provider class. */
export function createUnauthenticatedProviderSdk(
  configuration: UnauthenticatedProviderConfiguration,
  fetcher: typeof fetch = fetch,
): UnauthenticatedProviderSdk {
  const requestTimeoutMs = configuration.requestTimeoutMs ?? 15_000;
  if (
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 100 ||
    requestTimeoutMs > 120_000
  ) {
    throw new UnauthenticatedProviderError(
      "UNAUTHENTICATED_PROVIDER_CONFIGURATION_INVALID",
    );
  }
  validateSecureUrl(configuration.apiBaseUrl);
  if (
    !getIntegration(configuration.integrationId)?.products.some((product) =>
      product.authMethods.includes("none"),
    )
  ) {
    throw new UnauthenticatedProviderError(
      "UNAUTHENTICATED_PROVIDER_CONFIGURATION_INVALID",
    );
  }

  return {
    configuration,

    async request(request) {
      const url = providerApiUrl(configuration.apiBaseUrl, request.path);
      try {
        return await withTimeout(requestTimeoutMs, (signal) =>
          fetcher(url, {
            method: request.method ?? "GET",
            headers: request.headers,
            body: request.body,
            signal,
          }),
        );
      } catch {
        throw new UnauthenticatedProviderError(
          "UNAUTHENTICATED_PROVIDER_REQUEST_FAILED",
        );
      }
    },
  };
}
