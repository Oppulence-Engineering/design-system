import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import {
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
} from "jose";
import {
  Configuration as PlaidConfiguration,
  PlaidApi,
  PlaidEnvironments,
} from "plaid";
import { z } from "zod";

import { ProductSchema, type Product } from "../../contracts";

export type IntegrationWebhookProvider = "plaid" | "merge";

export interface IntegrationWebhookConnection {
  connectionId: string;
  product: Product;
  subjectId: string;
}

export interface IntegrationWebhookSyncRequest extends IntegrationWebhookConnection {
  integrationId: IntegrationWebhookProvider;
  /** Safe event name, not the provider request payload. */
  providerEvent: string;
  /** Stable SHA-256 key; products use it to make queueing idempotent. */
  idempotencyKey: string;
  receivedAt: string;
}

export interface PlaidWebhookSdk {
  webhookVerificationKeyGet(input: { key_id: string }): Promise<{
    data: { key: JWK & { expired_at?: number | null } };
  }>;
}

export interface PlaidIntegrationWebhookConfig {
  clientId: string;
  secret: string;
  environment?: "sandbox" | "development" | "production";
  /**
   * Product database lookup only. It maps a non-secret Plaid item ID to an
   * authorized product connection; the package never exposes its access token.
   */
  resolveConnection(input: {
    itemId: string;
    webhookType?: string;
    webhookCode?: string;
  }): Promise<IntegrationWebhookConnection | undefined>;
  clientFactory?: () => PlaidWebhookSdk;
  /** 5 minutes by default; a fresh key is retried if cached verification fails. */
  verificationKeyCacheTtlMs?: number;
}

export interface MergeIntegrationWebhookConfig {
  /** Signature key from Merge's Webhooks configuration. */
  signatureKey: string;
  /** Maps safe linked-account metadata to a product connection record. */
  resolveConnection(input: {
    linkedAccountId: string;
    endUserOriginId?: string;
    integrationSlug?: string;
    event?: string;
  }): Promise<IntegrationWebhookConnection | undefined>;
}

export interface IntegrationWebhookRuntimeConfig {
  plaid?: PlaidIntegrationWebhookConfig;
  merge?: MergeIntegrationWebhookConfig;
  /**
   * Product queue/database seam. Receives no raw payloads, headers, access
   * tokens, Merge account tokens, or provider credentials.
   */
  onSyncRequired(input: IntegrationWebhookSyncRequest): Promise<void>;
  now?: () => Date;
}

export interface ProcessIntegrationWebhookResult {
  integrationId: IntegrationWebhookProvider;
  accepted: true;
  enqueued: boolean;
}

export interface IntegrationWebhookRuntime {
  processPlaid(input: {
    rawBody: Uint8Array;
    verificationHeader: string | null;
  }): Promise<ProcessIntegrationWebhookResult>;
  processMerge(input: {
    rawBody: Uint8Array;
    signatureHeader: string | null;
  }): Promise<ProcessIntegrationWebhookResult>;
}

export class IntegrationWebhookError extends Error {
  readonly code:
    | "INTEGRATION_WEBHOOK_PROVIDER_UNAVAILABLE"
    | "INTEGRATION_WEBHOOK_SIGNATURE_INVALID"
    | "INTEGRATION_WEBHOOK_PAYLOAD_INVALID"
    | "INTEGRATION_WEBHOOK_SYNC_ENQUEUE_FAILED";

  constructor(code: IntegrationWebhookError["code"]) {
    super("The integration webhook could not be processed.");
    this.name = "IntegrationWebhookError";
    this.code = code;
  }
}

const ConnectionSchema = z
  .object({
    connectionId: z.string().min(1).max(320),
    product: ProductSchema,
    subjectId: z.string().min(1).max(320),
  })
  .strict();

const MINIMUM_WEBHOOK_KEY_CACHE_TTL_MS = 60_000;
const MAXIMUM_WEBHOOK_KEY_CACHE_TTL_MS = 3_600_000;

function optionalString(value: unknown, maximum = 512): string | undefined {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum
    ? value
    : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function parsePayload(rawBody: Uint8Array): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    throw new IntegrationWebhookError("INTEGRATION_WEBHOOK_PAYLOAD_INVALID");
  }
  const payload = asRecord(value);
  if (!payload) {
    throw new IntegrationWebhookError("INTEGRATION_WEBHOOK_PAYLOAD_INVALID");
  }
  return payload;
}

function safeEqual(left: Uint8Array, right: Uint8Array): boolean {
  return left.byteLength === right.byteLength && timingSafeEqual(left, right);
}

function rawBodyHash(rawBody: Uint8Array): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

function eventName(parts: readonly (string | undefined)[]): string {
  const value = parts.filter((part): part is string => Boolean(part)).join(".");
  return value || "provider.webhook";
}

function createPlaidClient(
  config: PlaidIntegrationWebhookConfig,
): PlaidWebhookSdk {
  const environment = config.environment ?? "production";
  return new PlaidApi(
    new PlaidConfiguration({
      basePath: PlaidEnvironments[environment],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": config.clientId,
          "PLAID-SECRET": config.secret,
        },
      },
    }),
  ) as unknown as PlaidWebhookSdk;
}

function keyCacheTtl(config: PlaidIntegrationWebhookConfig): number {
  const value = config.verificationKeyCacheTtlMs ?? 5 * 60_000;
  if (
    !Number.isSafeInteger(value) ||
    value < MINIMUM_WEBHOOK_KEY_CACHE_TTL_MS ||
    value > MAXIMUM_WEBHOOK_KEY_CACHE_TTL_MS
  ) {
    throw new Error(
      "Plaid verificationKeyCacheTtlMs must be 60000–3600000 milliseconds.",
    );
  }
  return value;
}

function mergeSignatureBytes(value: string | null): Uint8Array | undefined {
  if (!value || value.length > 256 || !/^[A-Za-z0-9_-]+={0,2}$/u.test(value)) {
    return undefined;
  }
  const decoded = Buffer.from(value, "base64url");
  return decoded.byteLength > 0 ? decoded : undefined;
}

function plaidHashClaim(payload: JWTPayload): string | undefined {
  const claim = payload.request_body_sha256;
  return typeof claim === "string" && /^[a-f0-9]{64}$/iu.test(claim)
    ? claim.toLowerCase()
    : undefined;
}

/**
 * Verifies provider signatures against the original request bytes and emits a
 * small, credential-free sync signal. Products only supply connection lookup
 * and idempotent queue persistence; they never implement provider cryptography.
 */
export function createIntegrationWebhookRuntime(
  config: IntegrationWebhookRuntimeConfig,
): IntegrationWebhookRuntime {
  const now = config.now ?? (() => new Date());
  const plaidConfig = config.plaid;
  const mergeConfig = config.merge;
  const plaidKeyCache = new Map<string, { key: JWK; expiresAt: number }>();

  async function enqueue(
    integrationId: IntegrationWebhookProvider,
    connection: IntegrationWebhookConnection,
    providerEvent: string,
    rawBody: Uint8Array,
  ): Promise<void> {
    const parsedConnection = ConnectionSchema.safeParse(connection);
    if (!parsedConnection.success) {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_SYNC_ENQUEUE_FAILED",
      );
    }
    try {
      await config.onSyncRequired({
        ...parsedConnection.data,
        integrationId,
        providerEvent,
        idempotencyKey: `${integrationId}:${rawBodyHash(rawBody)}`,
        receivedAt: now().toISOString(),
      });
    } catch {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_SYNC_ENQUEUE_FAILED",
      );
    }
  }

  async function plaidVerificationKey(
    keyId: string,
    forceRefresh = false,
  ): Promise<JWK> {
    if (!plaidConfig) {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_PROVIDER_UNAVAILABLE",
      );
    }
    const cached = plaidKeyCache.get(keyId);
    if (!forceRefresh && cached && cached.expiresAt > now().getTime()) {
      return cached.key;
    }
    let key: JWK & { expired_at?: number | null };
    try {
      key = (
        await (
          plaidConfig.clientFactory ?? (() => createPlaidClient(plaidConfig))
        )().webhookVerificationKeyGet({ key_id: keyId })
      ).data.key;
    } catch {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_PROVIDER_UNAVAILABLE",
      );
    }
    if (key.alg !== "ES256" || key.kid !== keyId || key.kty !== "EC") {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_SIGNATURE_INVALID",
      );
    }
    const current = now().getTime();
    const providerExpiry =
      typeof key.expired_at === "number" ? key.expired_at * 1_000 : undefined;
    if (providerExpiry !== undefined && providerExpiry <= current) {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_SIGNATURE_INVALID",
      );
    }
    plaidKeyCache.set(keyId, {
      key,
      expiresAt: Math.min(
        current + keyCacheTtl(plaidConfig),
        providerExpiry ?? Number.MAX_SAFE_INTEGER,
      ),
    });
    return key;
  }

  async function verifyPlaid(
    rawBody: Uint8Array,
    verificationHeader: string | null,
  ): Promise<void> {
    if (!plaidConfig) {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_PROVIDER_UNAVAILABLE",
      );
    }
    if (!verificationHeader || verificationHeader.length > 16_384) {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_SIGNATURE_INVALID",
      );
    }
    const signedToken = verificationHeader;
    let header: ReturnType<typeof decodeProtectedHeader>;
    try {
      header = decodeProtectedHeader(signedToken);
    } catch {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_SIGNATURE_INVALID",
      );
    }
    if (
      header.alg !== "ES256" ||
      typeof header.kid !== "string" ||
      !header.kid
    ) {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_SIGNATURE_INVALID",
      );
    }

    async function verify(forceRefresh = false): Promise<JWTPayload> {
      const key = await plaidVerificationKey(header.kid!, forceRefresh);
      const keyLike = await importJWK(key, "ES256");
      const verified = await jwtVerify(signedToken, keyLike, {
        algorithms: ["ES256"],
        maxTokenAge: "5 min",
        clockTolerance: "30s",
        currentDate: now(),
      });
      return verified.payload;
    }

    let payload: JWTPayload;
    try {
      payload = await verify();
    } catch (error) {
      if (error instanceof IntegrationWebhookError) {
        throw error;
      }
      try {
        payload = await verify(true);
      } catch (retryError) {
        if (retryError instanceof IntegrationWebhookError) {
          throw retryError;
        }
        throw new IntegrationWebhookError(
          "INTEGRATION_WEBHOOK_SIGNATURE_INVALID",
        );
      }
    }
    const expectedBodyHash = plaidHashClaim(payload);
    const actualBodyHash = rawBodyHash(rawBody);
    if (
      !expectedBodyHash ||
      !safeEqual(
        new TextEncoder().encode(actualBodyHash),
        new TextEncoder().encode(expectedBodyHash),
      )
    ) {
      throw new IntegrationWebhookError(
        "INTEGRATION_WEBHOOK_SIGNATURE_INVALID",
      );
    }
  }

  return {
    async processPlaid({ rawBody, verificationHeader }) {
      await verifyPlaid(rawBody, verificationHeader);
      const payload = parsePayload(rawBody);
      const itemId = optionalString(payload.item_id);
      if (!itemId || !plaidConfig) {
        return { integrationId: "plaid", accepted: true, enqueued: false };
      }
      const webhookType = optionalString(payload.webhook_type);
      const webhookCode = optionalString(payload.webhook_code);
      let connection: IntegrationWebhookConnection | undefined;
      try {
        connection = await plaidConfig.resolveConnection({
          itemId,
          webhookType,
          webhookCode,
        });
      } catch {
        throw new IntegrationWebhookError(
          "INTEGRATION_WEBHOOK_SYNC_ENQUEUE_FAILED",
        );
      }
      if (!connection) {
        return { integrationId: "plaid", accepted: true, enqueued: false };
      }
      await enqueue(
        "plaid",
        connection,
        eventName([webhookType, webhookCode]),
        rawBody,
      );
      return { integrationId: "plaid", accepted: true, enqueued: true };
    },

    async processMerge({ rawBody, signatureHeader }) {
      if (!mergeConfig) {
        throw new IntegrationWebhookError(
          "INTEGRATION_WEBHOOK_PROVIDER_UNAVAILABLE",
        );
      }
      const providedSignature = mergeSignatureBytes(signatureHeader);
      const expectedSignature = createHmac("sha256", mergeConfig.signatureKey)
        .update(rawBody)
        .digest();
      if (
        !providedSignature ||
        !safeEqual(expectedSignature, providedSignature)
      ) {
        throw new IntegrationWebhookError(
          "INTEGRATION_WEBHOOK_SIGNATURE_INVALID",
        );
      }
      const payload = parsePayload(rawBody);
      const linkedAccount = asRecord(payload.linked_account);
      const hook = asRecord(payload.hook);
      const linkedAccountId = optionalString(linkedAccount?.id);
      if (!linkedAccountId) {
        return { integrationId: "merge", accepted: true, enqueued: false };
      }
      const event = optionalString(hook?.event);
      let connection: IntegrationWebhookConnection | undefined;
      try {
        connection = await mergeConfig.resolveConnection({
          linkedAccountId,
          endUserOriginId: optionalString(linkedAccount?.end_user_origin_id),
          integrationSlug: optionalString(linkedAccount?.integration_slug),
          event,
        });
      } catch {
        throw new IntegrationWebhookError(
          "INTEGRATION_WEBHOOK_SYNC_ENQUEUE_FAILED",
        );
      }
      if (!connection) {
        return { integrationId: "merge", accepted: true, enqueued: false };
      }
      await enqueue("merge", connection, eventName([event]), rawBody);
      return { integrationId: "merge", accepted: true, enqueued: true };
    },
  };
}

export interface IntegrationWebhookRoutesConfig {
  runtime: IntegrationWebhookRuntime;
  basePath?: string;
  maxWebhookBodyBytes?: number;
}

function normalizedBasePath(value: string | undefined): string {
  const path = (value ?? "/integrations").replace(/\/+$/u, "");
  return path.startsWith("/") ? path : `/${path}`;
}

function maximumBodyBytes(value: number | undefined): number {
  const maximum = value ?? 256 * 1024;
  if (
    !Number.isSafeInteger(maximum) ||
    maximum < 1_024 ||
    maximum > 1_048_576
  ) {
    throw new Error("Integration maxWebhookBodyBytes must be 1024–1048576.");
  }
  return maximum;
}

async function readRawBody(
  request: Request,
  maximum: number,
): Promise<Uint8Array> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maximum) {
    throw new IntegrationWebhookError("INTEGRATION_WEBHOOK_PAYLOAD_INVALID");
  }
  const reader = request.body?.getReader();
  if (!reader) {
    throw new IntegrationWebhookError("INTEGRATION_WEBHOOK_PAYLOAD_INVALID");
  }
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > maximum) {
      await reader.cancel();
      throw new IntegrationWebhookError("INTEGRATION_WEBHOOK_PAYLOAD_INVALID");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function webhookErrorResponse(error: unknown): Response {
  const status =
    error instanceof IntegrationWebhookError
      ? error.code === "INTEGRATION_WEBHOOK_SIGNATURE_INVALID"
        ? 401
        : error.code === "INTEGRATION_WEBHOOK_PROVIDER_UNAVAILABLE" ||
            error.code === "INTEGRATION_WEBHOOK_SYNC_ENQUEUE_FAILED"
          ? 503
          : 400
      : 400;
  return Response.json(
    {
      error: {
        code:
          error instanceof IntegrationWebhookError
            ? error.code
            : "INTEGRATION_WEBHOOK_PAYLOAD_INVALID",
      },
    },
    { status },
  );
}

/**
 * Fetch-standard receiver for signed Plaid and Merge webhooks. Providers get a
 * retryable 503 only when the product's connection lookup or sync queue is not
 * available; invalid signatures are never accepted or forwarded.
 */
export function createIntegrationWebhookRoutes(
  config: IntegrationWebhookRoutesConfig,
) {
  const basePath = normalizedBasePath(config.basePath);
  const maximum = maximumBodyBytes(config.maxWebhookBodyBytes);
  const escaped = basePath.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const pattern = new RegExp(`^${escaped}/(plaid|merge)/webhooks$`, "u");

  return {
    async handle(request: Request): Promise<Response | undefined> {
      const match = pattern.exec(new URL(request.url).pathname);
      if (!match || request.method !== "POST") {
        return undefined;
      }
      try {
        const rawBody = await readRawBody(request, maximum);
        if (match[1] === "plaid") {
          await config.runtime.processPlaid({
            rawBody,
            verificationHeader: request.headers.get("plaid-verification"),
          });
        } else {
          await config.runtime.processMerge({
            rawBody,
            signatureHeader: request.headers.get("x-merge-webhook-signature"),
          });
        }
        // Plaid retries every non-200 response, so acknowledge accepted,
        // durably-queued events with 200 rather than a semantically equivalent
        // 202 that would cause an unnecessary delivery retry.
        return new Response(null, { status: 200 });
      } catch (error) {
        return webhookErrorResponse(error);
      }
    },
  };
}
