import { z } from "zod";

import { getIntegration, resolveIntegrationId } from "../../registry";
import {
  IntegrationIdSchema,
  ProductSchema,
  type IntegrationId,
  type Product,
} from "../../contracts";
import {
  createIntegrationCredentialReference,
  decryptIntegrationCredential,
  encryptIntegrationCredential,
  IntegrationCredentialReferenceSchema,
  type IntegrationCredentialKeyring,
  type IntegrationCredentialReference,
  type IntegrationCredentialVault,
  type IntegrationOAuthCredential,
} from "../transport/credentials";
import {
  createOAuth2ProviderSdk,
  type OAuth2ApiRequest,
  type OAuth2ProviderConfiguration,
  type OAuth2ProviderSdk,
} from "../transport/oauth2";

const SAFE_RELATIVE_PATH = /^\/(?!\/)[A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/;
const UNSAFE_ENCODED_PATH_TOKENS = /%(?:2f|5c|3f|23)/iu;
const OAUTH_STATE_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;

function isSafeRelativePath(value: string): boolean {
  return (
    value.length <= 2_000 &&
    SAFE_RELATIVE_PATH.test(value) &&
    !UNSAFE_ENCODED_PATH_TOKENS.test(value)
  );
}

export interface IntegrationOAuthSubject {
  product: Product;
  subjectId: string;
}

export interface PendingIntegrationOAuthAuthorization extends IntegrationOAuthSubject {
  state: string;
  integrationId: IntegrationId;
  codeVerifier: string;
  returnPath: string;
  expiresAt: string;
}

/** Validated again after reading durable state, never trusted by TypeScript alone. */
export const PendingIntegrationOAuthAuthorizationSchema = z
  .object({
    state: z.string().regex(OAUTH_STATE_PATTERN),
    integrationId: IntegrationIdSchema,
    product: ProductSchema,
    subjectId: z.string().min(1).max(320),
    codeVerifier: z.string().min(43).max(128),
    returnPath: z.string().min(1).max(2_000).refine(isSafeRelativePath),
    expiresAt: z.string().datetime({ offset: true }),
  })
  .strict();

/** The product persists this short-lived state atomically, usually in DB/Redis. */
export interface IntegrationOAuthStateStore {
  /**
   * Atomically purges expired records and rejects a new state when this subject
   * has already reached the supplied active-state limit.
   */
  create(
    authorization: PendingIntegrationOAuthAuthorization,
    options: { maximumPendingPerSubject: number; now: Date },
  ): Promise<boolean>;
  consume(
    state: string,
  ): Promise<PendingIntegrationOAuthAuthorization | undefined>;
  /** Removes abandoned state records before the next OAuth start is accepted. */
  purgeExpired(now: Date): Promise<void>;
}

/** Safe for development and tests only; production must use an atomic durable store. */
export function createInMemoryIntegrationOAuthStateStore(input?: {
  now?: () => Date;
}): IntegrationOAuthStateStore {
  const now = input?.now ?? (() => new Date());
  const records = new Map<string, PendingIntegrationOAuthAuthorization>();

  async function purgeExpired(at: Date): Promise<void> {
    for (const [state, authorization] of records) {
      if (isExpired(authorization.expiresAt, at)) {
        records.delete(state);
      }
    }
  }

  return {
    async create(authorization, options) {
      await purgeExpired(options.now);
      const pendingForSubject = [...records.values()].filter(
        (candidate) =>
          candidate.product === authorization.product &&
          candidate.subjectId === authorization.subjectId,
      ).length;
      if (pendingForSubject >= options.maximumPendingPerSubject) {
        return false;
      }
      records.set(authorization.state, authorization);
      return true;
    },
    async consume(state) {
      const authorization = records.get(state);
      records.delete(state);
      if (!authorization || isExpired(authorization.expiresAt, now())) {
        return undefined;
      }
      return authorization;
    },
    purgeExpired,
  };
}

/**
 * Serializes a refresh for one durable connection. The default lock is local
 * to one process; pass a DB/Redis implementation when requests span replicas.
 */
export interface IntegrationCredentialRefreshLock {
  runExclusive<T>(
    reference: IntegrationCredentialReference,
    operation: () => Promise<T>,
  ): Promise<T>;
}

export interface IntegrationOAuthRuntimeConfig {
  providers: readonly OAuth2ProviderConfiguration[];
  credentialVault: IntegrationCredentialVault;
  credentialKeyring: IntegrationCredentialKeyring;
  oauthStateStore: IntegrationOAuthStateStore;
  /** Defaults to five active OAuth starts per product subject. */
  maximumPendingAuthorizationsPerSubject?: number;
  credentialRefreshLock?: IntegrationCredentialRefreshLock;
  fetcher?: typeof fetch;
  now?: () => Date;
  /** Invoked after an encrypted credential is durably stored. */
  onConnected?(input: {
    connectionId: string;
    integrationId: IntegrationId;
    product: Product;
    subjectId: string;
    providerMetadata: Readonly<Record<string, string>>;
  }): Promise<void>;
}

export interface BeginIntegrationOAuthInput extends IntegrationOAuthSubject {
  integrationId: string;
  returnPath: string;
}

export interface BeginIntegrationOAuthResult {
  authorizationUrl: string;
  expiresAt: string;
  integrationId: IntegrationId;
}

export interface CompleteIntegrationOAuthInput {
  expectedIntegrationId?: string;
  state: string;
  code?: string;
  providerError?: string;
  providerCallbackParameters?: URLSearchParams;
}

export interface CompleteIntegrationOAuthResult {
  connectionId: string;
  integrationId: IntegrationId;
  product: Product;
  subjectId: string;
  returnPath: string;
  providerMetadata: Readonly<Record<string, string>>;
}

/** Revalidates present-tense product authorization just before token exchange. */
export type IntegrationOAuthCompletionAuthorizer = (
  authorization: Pick<
    PendingIntegrationOAuthAuthorization,
    "integrationId" | "product" | "subjectId"
  >,
) => Promise<void>;

export interface IntegrationProviderRequest extends OAuth2ApiRequest {
  reference: IntegrationCredentialReference;
}

export class IntegrationRuntimeError extends Error {
  readonly code:
    | "INTEGRATION_PROVIDER_UNAVAILABLE"
    | "INTEGRATION_OAUTH_STATE_INVALID"
    | "INTEGRATION_OAUTH_STATE_EXPIRED"
    | "INTEGRATION_OAUTH_STATE_LIMIT_REACHED"
    | "INTEGRATION_OAUTH_DENIED"
    | "INTEGRATION_OAUTH_CODE_MISSING"
    | "INTEGRATION_CALLBACK_MISMATCH"
    | "INTEGRATION_CONNECTION_MODE_UNSUPPORTED"
    | "INTEGRATION_CONNECTION_FINALIZATION_FAILED"
    | "INTEGRATION_CREDENTIAL_UNAVAILABLE"
    | "INTEGRATION_CREDENTIAL_REFRESH_UNAVAILABLE"
    | "INTEGRATION_CRYPTO_UNAVAILABLE";

  constructor(code: IntegrationRuntimeError["code"]) {
    super("The integration request could not be completed.");
    this.name = "IntegrationRuntimeError";
    this.code = code;
  }
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new IntegrationRuntimeError("INTEGRATION_CRYPTO_UNAVAILABLE");
  }
  return globalThis.crypto;
}

function randomBase64Url(byteLength: number): string {
  const bytes = cryptoApi().getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

async function sha256Base64Url(value: string): Promise<string> {
  const digest = await cryptoApi().subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function safeReturnPath(value: string): string {
  if (!isSafeRelativePath(value)) {
    throw new IntegrationRuntimeError("INTEGRATION_OAUTH_STATE_INVALID");
  }
  return value;
}

function referenceKey(reference: IntegrationCredentialReference): string {
  return `${reference.product}:${reference.integrationId}:${reference.connectionId}`;
}

export function createInMemoryIntegrationCredentialRefreshLock(): IntegrationCredentialRefreshLock {
  const queues = new Map<string, Promise<void>>();
  return {
    async runExclusive<T>(
      reference: IntegrationCredentialReference,
      operation: () => Promise<T>,
    ): Promise<T> {
      const key = referenceKey(reference);
      const previous = queues.get(key) ?? Promise.resolve();
      let release: (() => void) | undefined;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      const queued = previous.then(() => current);
      queues.set(key, queued);
      await previous;
      try {
        return await operation();
      } finally {
        release?.();
        if (queues.get(key) === queued) {
          queues.delete(key);
        }
      }
    },
  };
}

function isExpired(value: string, now: Date): boolean {
  return Number.isNaN(Date.parse(value)) || Date.parse(value) <= now.getTime();
}

function expiresSoon(
  credential: IntegrationOAuthCredential,
  now: Date,
): boolean {
  if (!credential.expiresAt) {
    return false;
  }
  const expiresAt = Date.parse(credential.expiresAt);
  return Number.isNaN(expiresAt) || expiresAt <= now.getTime() + 60_000;
}

/**
 * Server-only OAuth, credential, refresh, and provider-client runtime. Product
 * applications provide durable state/credential storage and business hooks;
 * this package owns the provider protocol and secret envelope lifecycle.
 */
export function createIntegrationOAuthRuntime(
  config: IntegrationOAuthRuntimeConfig,
) {
  const now = config.now ?? (() => new Date());
  const maximumPendingAuthorizationsPerSubject =
    config.maximumPendingAuthorizationsPerSubject ?? 5;
  if (
    !Number.isSafeInteger(maximumPendingAuthorizationsPerSubject) ||
    maximumPendingAuthorizationsPerSubject < 1 ||
    maximumPendingAuthorizationsPerSubject > 20
  ) {
    throw new Error(
      "Integration maximumPendingAuthorizationsPerSubject must be 1–20.",
    );
  }
  const refreshLock =
    config.credentialRefreshLock ??
    createInMemoryIntegrationCredentialRefreshLock();
  const providers = new Map<IntegrationId, OAuth2ProviderSdk>();
  for (const definition of config.providers) {
    if (providers.has(definition.integrationId)) {
      throw new Error(`Duplicate OAuth provider: ${definition.integrationId}.`);
    }
    providers.set(
      definition.integrationId,
      createOAuth2ProviderSdk(definition, config.fetcher),
    );
  }

  function resolveProvider(value: string): {
    integrationId: IntegrationId;
    provider: OAuth2ProviderSdk;
  } {
    const integrationId = resolveIntegrationId(value);
    if (!integrationId || !getIntegration(integrationId)) {
      throw new IntegrationRuntimeError("INTEGRATION_PROVIDER_UNAVAILABLE");
    }
    const provider = providers.get(integrationId);
    if (!provider) {
      throw new IntegrationRuntimeError("INTEGRATION_PROVIDER_UNAVAILABLE");
    }
    return { integrationId, provider };
  }

  async function saveCredential(
    reference: IntegrationCredentialReference,
    credential: IntegrationOAuthCredential,
  ): Promise<void> {
    const encrypted = await encryptIntegrationCredential({
      reference,
      credential,
      keyring: config.credentialKeyring,
      now: now(),
    });
    await config.credentialVault.save(reference, encrypted);
  }

  async function loadCredential(
    reference: IntegrationCredentialReference,
  ): Promise<IntegrationOAuthCredential> {
    const encrypted = await config.credentialVault.read(reference);
    if (!encrypted) {
      throw new IntegrationRuntimeError("INTEGRATION_CREDENTIAL_UNAVAILABLE");
    }
    try {
      return await decryptIntegrationCredential({
        reference,
        credential: encrypted,
        keyring: config.credentialKeyring,
      });
    } catch {
      throw new IntegrationRuntimeError("INTEGRATION_CREDENTIAL_UNAVAILABLE");
    }
  }

  async function getFreshCredential(
    reference: IntegrationCredentialReference,
  ): Promise<IntegrationOAuthCredential> {
    const credential = await loadCredential(reference);
    if (!expiresSoon(credential, now())) {
      return credential;
    }
    return refreshCredential(reference, credential);
  }

  async function refreshCredential(
    reference: IntegrationCredentialReference,
    observedCredential: IntegrationOAuthCredential,
  ): Promise<IntegrationOAuthCredential> {
    return refreshLock.runExclusive(reference, async () => {
      const latestCredential = await loadCredential(reference);
      // Another request refreshed this connection while this request waited.
      if (
        latestCredential.accessToken !== observedCredential.accessToken ||
        latestCredential.expiresAt !== observedCredential.expiresAt
      ) {
        return latestCredential;
      }
      if (!latestCredential.refreshToken) {
        throw new IntegrationRuntimeError(
          "INTEGRATION_CREDENTIAL_REFRESH_UNAVAILABLE",
        );
      }
      const { provider } = resolveProvider(reference.integrationId);
      const refreshed = await provider.refresh(
        latestCredential.refreshToken,
        latestCredential,
      );
      await saveCredential(reference, refreshed);
      return refreshed;
    });
  }

  return {
    async beginAuthorization(
      input: BeginIntegrationOAuthInput,
    ): Promise<BeginIntegrationOAuthResult> {
      const { integrationId, provider } = resolveProvider(input.integrationId);
      const createdAt = now();
      const codeVerifier = randomBase64Url(48);
      const state = randomBase64Url(32);
      const authorization = PendingIntegrationOAuthAuthorizationSchema.parse({
        state,
        integrationId,
        product: input.product,
        subjectId: input.subjectId,
        codeVerifier,
        returnPath: safeReturnPath(input.returnPath),
        expiresAt: new Date(createdAt.getTime() + 10 * 60_000).toISOString(),
      });
      await config.oauthStateStore.purgeExpired(createdAt);
      const created = await config.oauthStateStore.create(authorization, {
        maximumPendingPerSubject: maximumPendingAuthorizationsPerSubject,
        now: createdAt,
      });
      if (!created) {
        throw new IntegrationRuntimeError(
          "INTEGRATION_OAUTH_STATE_LIMIT_REACHED",
        );
      }
      return {
        integrationId,
        expiresAt: authorization.expiresAt,
        authorizationUrl: provider.createAuthorizationUrl({
          state,
          codeChallenge: await sha256Base64Url(codeVerifier),
        }),
      };
    },

    async completeAuthorization(
      input: CompleteIntegrationOAuthInput,
      authorize: IntegrationOAuthCompletionAuthorizer,
    ): Promise<CompleteIntegrationOAuthResult> {
      if (!OAUTH_STATE_PATTERN.test(input.state)) {
        throw new IntegrationRuntimeError("INTEGRATION_OAUTH_STATE_INVALID");
      }
      const storedAuthorization = await config.oauthStateStore.consume(
        input.state,
      );
      if (!storedAuthorization) {
        throw new IntegrationRuntimeError("INTEGRATION_OAUTH_STATE_INVALID");
      }
      let authorization: PendingIntegrationOAuthAuthorization;
      try {
        authorization =
          PendingIntegrationOAuthAuthorizationSchema.parse(storedAuthorization);
      } catch {
        throw new IntegrationRuntimeError("INTEGRATION_OAUTH_STATE_INVALID");
      }
      if (isExpired(authorization.expiresAt, now())) {
        throw new IntegrationRuntimeError("INTEGRATION_OAUTH_STATE_EXPIRED");
      }
      if (input.providerError) {
        throw new IntegrationRuntimeError("INTEGRATION_OAUTH_DENIED");
      }
      if (!input.code) {
        throw new IntegrationRuntimeError("INTEGRATION_OAUTH_CODE_MISSING");
      }
      const { integrationId, provider } = resolveProvider(
        authorization.integrationId,
      );
      if (
        input.expectedIntegrationId &&
        resolveIntegrationId(input.expectedIntegrationId) !== integrationId
      ) {
        throw new IntegrationRuntimeError("INTEGRATION_CALLBACK_MISMATCH");
      }
      await authorize({
        integrationId,
        product: authorization.product,
        subjectId: authorization.subjectId,
      });
      const credential = await provider.exchangeAuthorizationCode(
        input.code,
        authorization.codeVerifier,
      );
      const connectionId = `connection_${randomBase64Url(18)}`;
      const providerMetadata = provider.extractCallbackMetadata(
        input.providerCallbackParameters ?? new URLSearchParams(),
      );
      const reference = createIntegrationCredentialReference({
        connectionId,
        integrationId,
        product: authorization.product,
      });
      await saveCredential(reference, credential);
      try {
        await config.onConnected?.({
          connectionId,
          integrationId,
          product: authorization.product,
          subjectId: authorization.subjectId,
          providerMetadata,
        });
      } catch {
        await config.credentialVault.revoke(reference).catch(() => undefined);
        throw new IntegrationRuntimeError(
          "INTEGRATION_CONNECTION_FINALIZATION_FAILED",
        );
      }
      return {
        connectionId,
        integrationId,
        product: authorization.product,
        subjectId: authorization.subjectId,
        returnPath: authorization.returnPath,
        providerMetadata,
      };
    },

    async request(input: IntegrationProviderRequest): Promise<Response> {
      const reference = IntegrationCredentialReferenceSchema.parse(
        input.reference,
      );
      const { reference: _reference, ...request } = input;
      const { provider } = resolveProvider(reference.integrationId);
      const credential = await getFreshCredential(reference);
      let response = await provider.request(credential, request);
      if (response.status !== 401 || !credential.refreshToken) {
        return response;
      }
      const refreshed = await refreshCredential(reference, credential);
      response = await provider.request(refreshed, request);
      return response;
    },

    /**
     * Initialises a package-owned vendor SDK with a refreshed OAuth credential
     * without pushing that credential through an Eigenn or Conduitt boundary.
     * The callback is server-only and must never persist or return the token.
     */
    async withCredential<T>(
      rawReference: IntegrationCredentialReference,
      operation: (credential: IntegrationOAuthCredential) => Promise<T>,
    ): Promise<T> {
      const reference =
        IntegrationCredentialReferenceSchema.parse(rawReference);
      resolveProvider(reference.integrationId);
      return operation(await getFreshCredential(reference));
    },

    async revokeCredential(
      reference: IntegrationCredentialReference,
    ): Promise<void> {
      const parsedReference =
        IntegrationCredentialReferenceSchema.parse(reference);
      await refreshLock.runExclusive(parsedReference, async () => {
        await config.credentialVault.revoke(parsedReference);
      });
    },
  };
}

export type IntegrationOAuthRuntime = ReturnType<
  typeof createIntegrationOAuthRuntime
>;
