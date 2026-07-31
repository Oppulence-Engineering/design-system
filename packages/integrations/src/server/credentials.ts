import { z } from "zod";

import {
  IntegrationIdSchema,
  ProductSchema,
  type IntegrationId,
  type Product,
} from "../contracts";

export const IntegrationOAuthCredentialSchema = z
  .object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    scope: z.array(z.string().min(1)).readonly().default([]),
    tokenType: z.string().min(1).default("Bearer"),
  })
  .strict();

export const EncryptedIntegrationCredentialSchema = z
  .object({
    version: z.literal(1),
    algorithm: z.literal("A256GCM"),
    keyId: z.string().min(1).max(160),
    iv: z.string().min(1),
    ciphertext: z.string().min(1),
    createdAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const IntegrationCredentialReferenceSchema = z
  .object({
    connectionId: z.string().min(1).max(160),
    integrationId: IntegrationIdSchema,
    product: ProductSchema,
  })
  .strict();

export type IntegrationOAuthCredential = z.infer<
  typeof IntegrationOAuthCredentialSchema
>;
export type EncryptedIntegrationCredential = z.infer<
  typeof EncryptedIntegrationCredentialSchema
>;
export type IntegrationCredentialReference = z.infer<
  typeof IntegrationCredentialReferenceSchema
>;

/**
 * The owning product chooses where encrypted records live. The package owns
 * the envelope, encryption, decryption, and refresh lifecycle.
 */
export interface IntegrationCredentialVault {
  read(
    reference: IntegrationCredentialReference,
  ): Promise<EncryptedIntegrationCredential | undefined>;
  save(
    reference: IntegrationCredentialReference,
    credential: EncryptedIntegrationCredential,
  ): Promise<void>;
  revoke(reference: IntegrationCredentialReference): Promise<void>;
}

/** A product may back this with KMS, a managed secret, or an HSM. */
export interface IntegrationCredentialKeyring {
  getActiveKey(): Promise<{ id: string; key: CryptoKey }>;
  getKey(keyId: string): Promise<CryptoKey | undefined>;
}

/** A 32-byte Base64URL key supplied by deployment secret configuration. */
export interface IntegrationCredentialKeyDefinition {
  id: string;
  secret: string;
}

export class IntegrationCredentialError extends Error {
  readonly code:
    | "CREDENTIAL_DECRYPT_FAILED"
    | "CREDENTIAL_KEY_UNAVAILABLE"
    | "CREDENTIAL_KEY_INVALID"
    | "CREDENTIAL_CRYPTO_UNAVAILABLE";

  constructor(code: IntegrationCredentialError["code"]) {
    super("The integration credential could not be processed.");
    this.name = "IntegrationCredentialError";
    this.code = code;
  }
}

function cryptoApi(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new IntegrationCredentialError("CREDENTIAL_CRYPTO_UNAVAILABLE");
  }
  return globalThis.crypto;
}

function encodeBase64Url(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const normalized = padded.padEnd(
    padded.length + ((4 - (padded.length % 4)) % 4),
    "=",
  );
  const binary = atob(normalized);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function additionalData(reference: IntegrationCredentialReference): Uint8Array {
  return new TextEncoder().encode(
    `${reference.product}:${reference.integrationId}:${reference.connectionId}`,
  );
}

function asArrayBuffer(value: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function validateReference(
  reference: IntegrationCredentialReference,
): IntegrationCredentialReference {
  return IntegrationCredentialReferenceSchema.parse(reference);
}

async function importCredentialKey(
  definition: IntegrationCredentialKeyDefinition,
): Promise<CryptoKey> {
  if (!definition.id || definition.id.length > 160) {
    throw new IntegrationCredentialError("CREDENTIAL_KEY_INVALID");
  }
  let material: Uint8Array;
  try {
    material = decodeBase64Url(definition.secret);
  } catch {
    throw new IntegrationCredentialError("CREDENTIAL_KEY_INVALID");
  }
  if (material.byteLength !== 32) {
    throw new IntegrationCredentialError("CREDENTIAL_KEY_INVALID");
  }
  try {
    return await cryptoApi().subtle.importKey(
      "raw",
      asArrayBuffer(material),
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    throw new IntegrationCredentialError("CREDENTIAL_KEY_INVALID");
  }
}

/**
 * Creates a rotating keyring from deployment-injected 32-byte Base64URL
 * secrets. Pass prior keys during rotation so existing credentials remain
 * decryptable while new envelopes use `active`.
 */
export async function createIntegrationCredentialKeyring(input: {
  active: IntegrationCredentialKeyDefinition;
  previous?: readonly IntegrationCredentialKeyDefinition[];
}): Promise<IntegrationCredentialKeyring> {
  const definitions = [input.active, ...(input.previous ?? [])];
  if (
    new Set(definitions.map((definition) => definition.id)).size !==
    definitions.length
  ) {
    throw new IntegrationCredentialError("CREDENTIAL_KEY_INVALID");
  }
  const keys = new Map<string, CryptoKey>();
  await Promise.all(
    definitions.map(async (definition) => {
      keys.set(definition.id, await importCredentialKey(definition));
    }),
  );
  const active = keys.get(input.active.id);
  if (!active) {
    throw new IntegrationCredentialError("CREDENTIAL_KEY_INVALID");
  }
  return {
    async getActiveKey() {
      return { id: input.active.id, key: active };
    },
    async getKey(keyId) {
      return keys.get(keyId);
    },
  };
}

export function createIntegrationCredentialReference(input: {
  connectionId: string;
  integrationId: IntegrationId;
  product: Product;
}): IntegrationCredentialReference {
  return validateReference(input);
}

export async function encryptIntegrationCredential(input: {
  reference: IntegrationCredentialReference;
  credential: IntegrationOAuthCredential;
  keyring: IntegrationCredentialKeyring;
  now?: Date;
}): Promise<EncryptedIntegrationCredential> {
  const reference = validateReference(input.reference);
  const credential = IntegrationOAuthCredentialSchema.parse(input.credential);
  const activeKey = await input.keyring.getActiveKey();
  const crypto = cryptoApi();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(credential));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(additionalData(reference)),
      tagLength: 128,
    },
    activeKey.key,
    asArrayBuffer(plaintext),
  );
  return EncryptedIntegrationCredentialSchema.parse({
    version: 1,
    algorithm: "A256GCM",
    keyId: activeKey.id,
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
    createdAt: (input.now ?? new Date()).toISOString(),
  });
}

export async function decryptIntegrationCredential(input: {
  reference: IntegrationCredentialReference;
  credential: EncryptedIntegrationCredential;
  keyring: IntegrationCredentialKeyring;
}): Promise<IntegrationOAuthCredential> {
  const reference = validateReference(input.reference);
  const credential = EncryptedIntegrationCredentialSchema.parse(
    input.credential,
  );
  const key = await input.keyring.getKey(credential.keyId);
  if (!key) {
    throw new IntegrationCredentialError("CREDENTIAL_KEY_UNAVAILABLE");
  }
  try {
    const plaintext = await cryptoApi().subtle.decrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(decodeBase64Url(credential.iv)),
        additionalData: asArrayBuffer(additionalData(reference)),
        tagLength: 128,
      },
      key,
      asArrayBuffer(decodeBase64Url(credential.ciphertext)),
    );
    return IntegrationOAuthCredentialSchema.parse(
      JSON.parse(new TextDecoder().decode(plaintext)),
    );
  } catch {
    throw new IntegrationCredentialError("CREDENTIAL_DECRYPT_FAILED");
  }
}
