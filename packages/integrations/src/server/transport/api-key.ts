import type { IntegrationId } from "../../contracts";
import { getIntegration } from "../../registry";
import {
  IntegrationApiKeyCredentialSchema,
  type IntegrationApiKeyCredential,
} from "./credentials";

export interface CredentialFieldSpec {
  name: string;
  /** A request cannot be built without it. */
  required?: boolean;
}

export interface ApiKeyProviderConfiguration {
  integrationId: IntegrationId;
  /**
   * Omit both transport fields for SDK-only providers. Their key is still
   * encrypted and available to a package-owned vendor client, but callers
   * cannot make arbitrary HTTP requests through this generic transport.
   */
  apiBaseUrl?: string;
  /**
   * Names the credential field that carries the base URL, for a provider whose
   * host belongs to the connection rather than to the vendor — a self-hosted
   * Grafana or WordPress, or a regional cloud. The field is required, and its
   * value is validated as a secure URL on every request, so a connection
   * cannot point the transport at an arbitrary host.
   *
   * Supply this or `apiBaseUrl`, not both.
   */
  apiBaseUrlField?: string;
  /** The credential is supplied in this server-side HTTP header. */
  credentialHeader?: string;
  /**
   * Optional scheme placed before the key, for example `Bearer`, joined with a
   * space. A prefix naming `{credential}` instead controls its own separator,
   * which is how schemes like `Token token=<key>` are spelled.
   */
  credentialPrefix?: string;
  /**
   * Placed before every request path, with `{credential}` substituted for the
   * key. For providers whose API takes its credential as a path segment rather
   * than a header — Telegram's Bot API is `/bot<token>/<method>` and rejects
   * header authentication entirely.
   *
   * Supply this or `credentialHeader`, not both: a credential belongs in one
   * place, and sending it twice widens where it can leak.
   */
  credentialPathPrefix?: string;
  /**
   * Extra secrets this provider needs beyond the key — an AWS secret access
   * key, a Datadog application key, a Zendesk subdomain. A provider that
   * declares none may carry none, so a stray field cannot ride along in an
   * encrypted envelope unnoticed.
   */
  credentialFields?: readonly CredentialFieldSpec[];
  /** Defaults to 15 seconds. It bounds provider response headers. */
  requestTimeoutMs?: number;
}

export interface ApiKeyProviderRequest {
  path: string;
  method?: string;
  headers?: HeadersInit;
  body?: BodyInit | null;
}

export interface ApiKeyProviderSdk {
  configuration: ApiKeyProviderConfiguration;
  request(
    credential: Pick<IntegrationApiKeyCredential, "apiKey"> &
      Partial<Pick<IntegrationApiKeyCredential, "fields">>,
    request: ApiKeyProviderRequest,
  ): Promise<Response>;
}

export class ApiKeyProviderError extends Error {
  readonly code:
    | "API_KEY_PROVIDER_CONFIGURATION_INVALID"
    | "API_KEY_PROVIDER_TRANSPORT_UNAVAILABLE"
    | "API_KEY_PROVIDER_INVALID_PATH"
    | "API_KEY_PROVIDER_REQUEST_FAILED";

  constructor(code: ApiKeyProviderError["code"]) {
    super("The provider request could not be completed.");
    this.name = "ApiKeyProviderError";
    this.code = code;
  }
}

const SAFE_HEADER_NAME = /^[A-Za-z0-9-]{1,64}$/u;
const SAFE_FIELD_NAME = /^[A-Za-z][A-Za-z0-9_]{0,63}$/u;

/**
 * A credential allowed to appear in a request path. Deliberately narrower than
 * what a header accepts: no slash, percent, dot, or query character, so the key
 * can only ever be one path segment.
 */
const SAFE_PATH_CREDENTIAL = /^[A-Za-z0-9_:-]{1,256}$/u;
const UNSAFE_ENCODED_PATH_TOKENS = /%(?:2f|5c|3f|23)/iu;
const UNSAFE_CREDENTIAL_HEADERS = new Set([
  "connection",
  "content-length",
  "cookie",
  "host",
  "proxy-authorization",
  "set-cookie",
  "transfer-encoding",
]);

function validateSecureUrl(value: string): void {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password) {
      throw new Error("unsafe URL");
    }
  } catch {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
  }
}

/**
 * Hosts a connection may never point a request at.
 *
 * A literal `apiBaseUrl` in a provider profile is written in this package and
 * is trusted. A host taken from `apiBaseUrlField` is not: it arrives in a
 * credential field that whoever creates the connection controls. Without this,
 * the scheme check alone would let a connection aim the server at anything it
 * could reach — a link-local metadata endpoint, a service on the cluster
 * network, another tenant's internal host — and the executor returns the
 * response body to the caller, so it reads as well as reaches.
 *
 * IPv4-mapped and IPv6-embedded forms are covered because the check runs on the
 * bracket-stripped hostname, and `0x7f.1`-style shorthands never parse as a
 * hostname `URL` will accept alongside these patterns.
 *
 * This does not defeat a hostname that resolves to a private address: DNS is
 * consulted by `fetch`, after this runs. Closing that needs resolve-then-pin,
 * which the platform `fetch` does not expose. Treat this as the first line, and
 * put egress control in the network for the rest.
 */
const BLOCKED_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/iu,
  /\.localhost$/iu,
  /^127\./u,
  /^0\./u,
  /^10\./u,
  /^169\.254\./u,
  /^192\.168\./u,
  /^172\.(?:1[6-9]|2\d|3[01])\./u,
  /^100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./u,
  /^::1$/u,
  /^::$/u,
  /^fe[89ab][0-9a-f]:/iu,
  /^f[cd][0-9a-f]{2}:/iu,
  /^::ffff:/iu,
  /\.internal$/iu,
  /\.local$/iu,
];

/**
 * Validates a base URL supplied by a connection rather than by this package.
 */
function validateConnectionSuppliedUrl(value: string): void {
  validateSecureUrl(value);

  let hostname: string;
  try {
    // IPv6 hostnames arrive bracketed; the patterns above expect them bare.
    hostname = new URL(value).hostname.replace(/^\[|\]$/gu, "");
  } catch {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
  }

  if (BLOCKED_HOST_PATTERNS.some((pattern) => pattern.test(hostname))) {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
  }
}

function providerApiUrl(apiBaseUrl: string, path: string): URL {
  if (
    path.length > 2_000 ||
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.includes("#") ||
    UNSAFE_ENCODED_PATH_TOKENS.test(path)
  ) {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_INVALID_PATH");
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
    if (error instanceof ApiKeyProviderError) {
      throw error;
    }
    throw new ApiKeyProviderError("API_KEY_PROVIDER_INVALID_PATH");
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

/**
 * Holds a decrypted credential to what its provider declared. Without this the
 * `fields` map is a free-form bag: a provider that needs no extra secret could
 * still be handed several, and one that needs an application key would only
 * discover it was missing when a request failed.
 */
export function assertCredentialFields(
  configuration: Pick<ApiKeyProviderConfiguration, "credentialFields">,
  credential: Pick<IntegrationApiKeyCredential, "fields">,
): void {
  const declared = configuration.credentialFields ?? [];
  const allowed = new Set(declared.map((field) => field.name));
  const present = Object.keys(credential.fields ?? {});
  for (const name of present) {
    if (!allowed.has(name)) {
      throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
    }
  }
  for (const field of declared) {
    if (field.required && !credential.fields?.[field.name]) {
      throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
    }
  }
}

function credentialValue(
  credential: Pick<IntegrationApiKeyCredential, "apiKey">,
  prefix: string | undefined,
): string {
  if (!prefix) {
    return credential.apiKey;
  }
  // A prefix naming its placeholder controls its own separator. PagerDuty wants
  // `Token token=<key>` with no space, which a space-joined prefix cannot spell.
  if (prefix.includes("{credential}")) {
    return prefix.replace("{credential}", credential.apiKey);
  }
  return `${prefix} ${credential.apiKey}`;
}

/**
 * Shared API-key provider transport. A provider profile supplies only its
 * public API base URL and header convention; products never receive the raw
 * key after this server-side client has been created.
 */
export function createApiKeyProviderSdk(
  configuration: ApiKeyProviderConfiguration,
  fetcher: typeof fetch = fetch,
): ApiKeyProviderSdk {
  const requestTimeoutMs = configuration.requestTimeoutMs ?? 15_000;
  const pathPrefix = configuration.credentialPathPrefix;
  /*
   * A profile names its host either literally or by the credential field that
   * carries it. `apiBaseUrlField` was missing from both this and the guard
   * below, so any profile that used it — the whole point of the field, a
   * self-hosted or regional provider that has no single literal host — failed
   * construction with CONFIGURATION_INVALID. The request path that reads the
   * field was unreachable, which is why no provider adopted it.
   */
  const hasHost =
    configuration.apiBaseUrl !== undefined ||
    configuration.apiBaseUrlField !== undefined;
  const hasTransport =
    hasHost ||
    configuration.credentialHeader !== undefined ||
    pathPrefix !== undefined;
  const headerName = configuration.credentialHeader?.toLocaleLowerCase("en-US");
  if (
    !Number.isSafeInteger(requestTimeoutMs) ||
    requestTimeoutMs < 100 ||
    requestTimeoutMs > 120_000 ||
    // A transport needs a host and exactly one place to put the credential.
    (hasTransport &&
      (!hasHost ||
        Boolean(configuration.credentialHeader) === Boolean(pathPrefix))) ||
    // Naming both a literal host and a field to read one from is ambiguous;
    // the request path would silently prefer the field.
    (configuration.apiBaseUrl !== undefined &&
      configuration.apiBaseUrlField !== undefined) ||
    (configuration.credentialHeader !== undefined &&
      (!SAFE_HEADER_NAME.test(configuration.credentialHeader) ||
        !headerName ||
        UNSAFE_CREDENTIAL_HEADERS.has(headerName))) ||
    // The prefix must be a single rooted path segment carrying one placeholder,
    // so a profile cannot smuggle a query, a fragment, or a second host into it.
    (pathPrefix !== undefined &&
      (!pathPrefix.startsWith("/") ||
        pathPrefix.startsWith("//") ||
        pathPrefix.length > 160 ||
        pathPrefix.endsWith("/") ||
        /[?#\s]/u.test(pathPrefix) ||
        pathPrefix.split("{credential}").length !== 2)) ||
    (configuration.credentialPrefix !== undefined &&
      (!configuration.credentialPrefix ||
        configuration.credentialPrefix.length > 160 ||
        /[\r\n]/u.test(configuration.credentialPrefix) ||
        configuration.credentialPrefix.split("{credential}").length > 2)) ||
    // A static prefix only means anything for the header form.
    (configuration.credentialPrefix !== undefined &&
      (!hasTransport || Boolean(pathPrefix))) ||
    (configuration.credentialFields !== undefined &&
      (configuration.credentialFields.length > 8 ||
        configuration.credentialFields.some(
          (field) => !SAFE_FIELD_NAME.test(field.name),
        ) ||
        new Set(configuration.credentialFields.map((field) => field.name))
          .size !== configuration.credentialFields.length))
  ) {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
  }
  if (configuration.apiBaseUrl) {
    validateSecureUrl(configuration.apiBaseUrl);
  }
  if (
    !getIntegration(configuration.integrationId)?.products.some((product) =>
      product.authMethods.includes("api_key"),
    )
  ) {
    throw new ApiKeyProviderError("API_KEY_PROVIDER_CONFIGURATION_INVALID");
  }

  return {
    configuration,

    async request(rawCredential, request) {
      if (
        (!configuration.apiBaseUrl && !configuration.apiBaseUrlField) ||
        (!configuration.credentialHeader && !pathPrefix)
      ) {
        throw new ApiKeyProviderError("API_KEY_PROVIDER_TRANSPORT_UNAVAILABLE");
      }
      const credential = IntegrationApiKeyCredentialSchema.parse(rawCredential);
      assertCredentialFields(configuration, credential);
      let path = request.path;
      if (pathPrefix) {
        // The key becomes part of the URL, so it must be a single safe segment.
        // A key containing a slash or an escape would otherwise choose the
        // resource, which is the one thing the relative-path rule prevents.
        if (!SAFE_PATH_CREDENTIAL.test(credential.apiKey)) {
          throw new ApiKeyProviderError(
            "API_KEY_PROVIDER_CONFIGURATION_INVALID",
          );
        }
        path = `${pathPrefix.replace("{credential}", credential.apiKey)}${request.path}`;
      }
      // A provider whose host is per-tenant — a self-hosted Grafana, a
      // regional cloud, a customer's own WordPress — cannot name one literal
      // host here. `apiBaseUrlField` says which credential field carries it,
      // and the value is validated exactly like a configured host so a
      // connection cannot redirect a request anywhere it likes.
      const configuredBase = configuration.apiBaseUrlField
        ? credential.fields?.[configuration.apiBaseUrlField]
        : configuration.apiBaseUrl;
      if (!configuredBase) {
        throw new ApiKeyProviderError("API_KEY_PROVIDER_TRANSPORT_UNAVAILABLE");
      }
      if (configuration.apiBaseUrlField) {
        // The connection chose this host, so it is checked against the blocked
        // ranges too, not only for scheme.
        validateConnectionSuppliedUrl(configuredBase);
      }
      const url = providerApiUrl(configuredBase, path);
      const headers = new Headers(request.headers);
      if (configuration.credentialHeader) {
        headers.set(
          configuration.credentialHeader,
          credentialValue(credential, configuration.credentialPrefix),
        );
      }
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
        throw new ApiKeyProviderError("API_KEY_PROVIDER_REQUEST_FAILED");
      }
    },
  };
}
