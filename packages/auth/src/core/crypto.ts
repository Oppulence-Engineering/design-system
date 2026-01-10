/**
 * Cryptography utilities for @oppulence/auth
 *
 * Uses jose library for JWT-style encryption of session data.
 * All sensitive data is encrypted before storing in cookies.
 */

import { EncryptJWT, jwtDecrypt, base64url } from "jose";
import { assertServer, getEnvVar, debugLog } from "./env";
import { AuthError } from "./types";

// ============================================================================
// Key Management
// ============================================================================

let encryptionKey: Uint8Array | null = null;

/**
 * Gets the encryption key derived from WORKOS_COOKIE_SECRET.
 * The key is derived using a simple hash to ensure consistent length.
 */
async function getEncryptionKey(): Promise<Uint8Array> {
  assertServer("getEncryptionKey()");

  if (encryptionKey) {
    return encryptionKey;
  }

  const secret = getEnvVar("WORKOS_COOKIE_SECRET");

  // Use SubtleCrypto to derive a consistent 256-bit key
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveBits", "deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("@oppulence/auth-v1"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );

  // Export the key as raw bytes for jose
  const keyBuffer = await crypto.subtle.exportKey("raw", derivedKey);
  encryptionKey = new Uint8Array(keyBuffer);

  debugLog("Encryption key derived successfully");
  return encryptionKey;
}

// ============================================================================
// Encryption Functions
// ============================================================================

/**
 * Encrypts data as a JWE (JSON Web Encryption) token.
 * Uses A256GCM for encryption with dir key management.
 *
 * @param payload - Data to encrypt (must be JSON-serializable)
 * @param expiresIn - Expiration time (e.g., "30d", "1h")
 * @returns Encrypted JWE token string
 */
export async function encrypt<T extends Record<string, unknown>>(
  payload: T,
  expiresIn: string = "30d"
): Promise<string> {
  assertServer("encrypt()");

  try {
    const key = await getEncryptionKey();

    const jwt = await new EncryptJWT(payload as unknown as Record<string, unknown>)
      .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .setIssuer("@oppulence/auth")
      .encrypt(key);

    debugLog("Data encrypted successfully");
    return jwt;
  } catch (error) {
    debugLog("Encryption failed", { error });
    throw new AuthError("Failed to encrypt data", "UNKNOWN_ERROR", 500, error);
  }
}

/**
 * Decrypts a JWE token and returns the payload.
 *
 * @param token - Encrypted JWE token string
 * @returns Decrypted payload
 * @throws {AuthError} If token is invalid or expired
 */
export async function decrypt<T>(token: string): Promise<T> {
  assertServer("decrypt()");

  try {
    const key = await getEncryptionKey();

    const { payload } = await jwtDecrypt(token, key, {
      issuer: "@oppulence/auth",
    });

    debugLog("Data decrypted successfully");
    return payload as T;
  } catch (error) {
    debugLog("Decryption failed", { error });

    // Check for specific JWT errors
    const message = error instanceof Error ? error.message : "";

    if (message.includes("expired")) {
      throw new AuthError("Session expired", "SESSION_EXPIRED", 401, error);
    }

    if (message.includes("invalid") || message.includes("malformed")) {
      throw new AuthError("Invalid session token", "INVALID_TOKEN", 401, error);
    }

    throw new AuthError("Failed to decrypt session", "INVALID_TOKEN", 401, error);
  }
}

// ============================================================================
// Token Generation
// ============================================================================

/**
 * Generates a cryptographically secure random token.
 *
 * @param length - Length of the token in bytes (default: 32)
 * @returns Base64url-encoded random token
 */
export function generateToken(length: number = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return base64url.encode(bytes);
}

/**
 * Generates a secure state parameter for OAuth flows.
 * Includes timestamp to prevent replay attacks.
 */
export function generateOAuthState(): string {
  const timestamp = Date.now().toString(36);
  const random = generateToken(16);
  return `${timestamp}.${random}`;
}

/**
 * Validates an OAuth state parameter.
 * Checks that it's not too old (max 10 minutes).
 */
export function validateOAuthState(state: string, maxAgeMs: number = 10 * 60 * 1000): boolean {
  try {
    const [timestampStr] = state.split(".");
    if (!timestampStr) return false;

    const timestamp = parseInt(timestampStr, 36);
    const age = Date.now() - timestamp;

    return age >= 0 && age <= maxAgeMs;
  } catch {
    return false;
  }
}

// ============================================================================
// Hashing Utilities
// ============================================================================

/**
 * Creates a SHA-256 hash of a string.
 * Useful for creating cache keys or fingerprints.
 */
export async function hash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return base64url.encode(new Uint8Array(hashBuffer));
}

/**
 * Compares two strings in constant time to prevent timing attacks.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const encoder = new TextEncoder();
  const bufferA = encoder.encode(a);
  const bufferB = encoder.encode(b);

  let result = 0;
  for (let i = 0; i < bufferA.length; i++) {
    result |= (bufferA[i] ?? 0) ^ (bufferB[i] ?? 0);
  }

  return result === 0;
}
