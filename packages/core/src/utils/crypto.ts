/**
 * Cached reference to the uncrypto module to avoid repeated dynamic imports.
 * This significantly improves performance for repeated crypto operations.
 */
let cryptoModule: typeof import("uncrypto") | null = null;

/**
 * Gets the cached crypto module, importing it if necessary.
 * This internal helper ensures we only perform the dynamic import once.
 *
 * @returns {Promise<typeof import("uncrypto")>} The uncrypto module
 */
async function getCrypto(): Promise<typeof import("uncrypto")> {
  if (!cryptoModule) {
    cryptoModule = await import("uncrypto");
  }
  return cryptoModule;
}

/**
 * Generates a cryptographically secure random UUID (Universally Unique Identifier).
 *
 * This function uses the `uncrypto` library to generate a v4 UUID that is
 * cryptographically secure and suitable for use in production environments.
 * The UUID follows the RFC 4122 standard format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
 * where x is any hexadecimal digit and y is one of 8, 9, A, or B.
 *
 * @returns {Promise<string>} A promise that resolves to a cryptographically secure UUID string
 *
 * @example
 * ```typescript
 * const uuid = await randomUUID();
 * console.log(uuid); // "550e8400-e29b-41d4-a716-446655440000"
 * ```
 *
 * @throws {Error} If the underlying crypto implementation fails to generate a UUID
 */
export async function randomUUID(): Promise<string> {
  const crypto = await getCrypto();
  return crypto.randomUUID();
}

/**
 * Computes a SHA-256 cryptographic hash of the provided data string.
 *
 * This function performs a SHA-256 hash operation on the input data using the
 * Web Crypto API through the `uncrypto` library. The hash is returned as a
 * hexadecimal string representation, making it suitable for storage, comparison,
 * and transmission.
 *
 * SHA-256 is a cryptographic hash function that produces a 256-bit (32-byte)
 * hash value. It is widely used for data integrity verification, digital
 * signatures, and password hashing (though additional security measures like
 * salting should be used for password storage).
 *
 * @param {string} data - The string data to be hashed. Can be any UTF-8 encoded string.
 *
 * @returns {Promise<string>} A promise that resolves to a 64-character hexadecimal string
 * representing the SHA-256 hash of the input data
 *
 * @example
 * ```typescript
 * const hash = await digestSHA256("Hello, World!");
 * console.log(hash); // "dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f"
 *
 * // Verify data integrity
 * const originalData = "sensitive data";
 * const hash1 = await digestSHA256(originalData);
 * const hash2 = await digestSHA256(originalData);
 * console.log(hash1 === hash2); // true
 * ```
 *
 * @throws {Error} If the underlying crypto implementation fails to compute the hash
 *
 * @security Note: SHA-256 is cryptographically secure but deterministic. For password
 * hashing, consider using specialized password hashing algorithms like bcrypt or Argon2.
 */
export async function digestSHA256(data: string): Promise<string> {
  const crypto = await getCrypto();

  const encoded = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest("SHA-256", encoded);

  return bufferToHex(hash);
}

/**
 * Computes a SHA-512 cryptographic hash of the provided data string.
 *
 * SHA-512 produces a 512-bit (64-byte) hash value, offering higher security
 * than SHA-256. It's useful when maximum security is needed and performance
 * is less critical.
 *
 * @param {string} data - The string data to be hashed. Can be any UTF-8 encoded string.
 *
 * @returns {Promise<string>} A promise that resolves to a 128-character hexadecimal string
 * representing the SHA-512 hash of the input data
 *
 * @example
 * ```typescript
 * const hash = await digestSHA512("Hello, World!");
 * console.log(hash.length); // 128
 * ```
 *
 * @throws {Error} If the underlying crypto implementation fails to compute the hash
 */
export async function digestSHA512(data: string): Promise<string> {
  const crypto = await getCrypto();

  const encoded = new TextEncoder().encode(data);
  const hash = await crypto.subtle.digest("SHA-512", encoded);

  return bufferToHex(hash);
}

/**
 * Computes an HMAC-SHA256 message authentication code.
 *
 * HMAC (Hash-based Message Authentication Code) provides both data integrity
 * and authenticity verification. Unlike plain hashing, HMAC uses a secret key,
 * making it suitable for verifying that data hasn't been tampered with.
 *
 * Common use cases:
 * - API request signing
 * - Webhook signature verification
 * - Token generation and verification
 * - Session integrity checks
 *
 * @param {string} key - The secret key for HMAC computation
 * @param {string} data - The data to authenticate
 *
 * @returns {Promise<string>} A promise that resolves to a 64-character hexadecimal HMAC
 *
 * @example
 * ```typescript
 * // Sign an API request
 * const signature = await hmacSHA256(apiSecret, requestBody);
 *
 * // Verify a webhook signature
 * const expectedSig = await hmacSHA256(webhookSecret, payload);
 * const isValid = constantTimeCompare(receivedSig, expectedSig);
 * ```
 *
 * @throws {Error} If the key or data cannot be processed
 */
export async function hmacSHA256(key: string, data: string): Promise<string> {
  const crypto = await getCrypto();

  const keyData = new TextEncoder().encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const dataBuffer = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);

  return bufferToHex(signature);
}

/**
 * Computes an HMAC-SHA512 message authentication code.
 *
 * Similar to HMAC-SHA256 but uses SHA-512 for the underlying hash,
 * providing a larger output and potentially higher security margin.
 *
 * @param {string} key - The secret key for HMAC computation
 * @param {string} data - The data to authenticate
 *
 * @returns {Promise<string>} A promise that resolves to a 128-character hexadecimal HMAC
 *
 * @example
 * ```typescript
 * const signature = await hmacSHA512(secretKey, message);
 * console.log(signature.length); // 128
 * ```
 */
export async function hmacSHA512(key: string, data: string): Promise<string> {
  const crypto = await getCrypto();

  const keyData = new TextEncoder().encode(key);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );

  const dataBuffer = new TextEncoder().encode(data);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, dataBuffer);

  return bufferToHex(signature);
}

/**
 * Generates cryptographically secure random bytes.
 *
 * This function generates random bytes using a cryptographically secure
 * pseudo-random number generator (CSPRNG). The output is suitable for
 * generating tokens, initialization vectors, salts, and other security-sensitive
 * random values.
 *
 * @param {number} length - The number of random bytes to generate
 *
 * @returns {Promise<Uint8Array>} A promise that resolves to a Uint8Array of random bytes
 *
 * @example
 * ```typescript
 * // Generate a 32-byte random key
 * const key = await generateRandomBytes(32);
 *
 * // Generate a 16-byte IV for encryption
 * const iv = await generateRandomBytes(16);
 *
 * // Convert to hex string
 * const tokenBytes = await generateRandomBytes(24);
 * const token = bufferToHex(tokenBytes);
 * ```
 *
 * @throws {Error} If random byte generation fails
 */
export async function generateRandomBytes(length: number): Promise<Uint8Array> {
  const crypto = await getCrypto();
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generates a cryptographically secure random hex string.
 *
 * Convenience function that generates random bytes and converts them
 * to a hexadecimal string. Useful for generating tokens, API keys,
 * and other string-based random identifiers.
 *
 * @param {number} byteLength - The number of random bytes (hex string will be 2x this length)
 *
 * @returns {Promise<string>} A promise that resolves to a random hex string
 *
 * @example
 * ```typescript
 * // Generate a 64-character hex token (32 bytes)
 * const token = await generateRandomHex(32);
 * console.log(token.length); // 64
 *
 * // Generate a short verification code
 * const code = await generateRandomHex(4);
 * console.log(code); // e.g., "a1b2c3d4"
 * ```
 */
export async function generateRandomHex(byteLength: number): Promise<string> {
  const bytes = await generateRandomBytes(byteLength);
  return bufferToHex(bytes);
}

/**
 * Performs a constant-time comparison of two strings.
 *
 * This function compares two strings in a way that takes the same amount of time
 * regardless of how many characters match. This prevents timing attacks where
 * an attacker could determine secret values by measuring response times.
 *
 * CRITICAL: Always use this function when comparing:
 * - API keys or tokens
 * - HMAC signatures
 * - Password hashes
 * - Any security-sensitive strings
 *
 * @param {string} a - First string to compare
 * @param {string} b - Second string to compare
 *
 * @returns {boolean} True if the strings are equal, false otherwise
 *
 * @example
 * ```typescript
 * // Verify an API key
 * const isValid = constantTimeCompare(providedKey, storedKey);
 *
 * // Verify a webhook signature
 * const expectedSignature = await hmacSHA256(secret, payload);
 * const isAuthentic = constantTimeCompare(receivedSignature, expectedSignature);
 * ```
 *
 * @security This function should ALWAYS be used for security-sensitive comparisons
 * instead of === or == operators.
 */
export function constantTimeCompare(a: string, b: string): boolean {
  // In Node.js environments, prefer crypto.timingSafeEqual for true constant-time behavior
  if (typeof Buffer !== "undefined") {
    try {
      const bufA = Buffer.from(a, "utf-8");
      const bufB = Buffer.from(b, "utf-8");

      // If lengths differ, we still need to do constant-time work
      // Create equal-length buffers by padding the shorter one
      if (bufA.length !== bufB.length) {
        const maxLen = Math.max(bufA.length, bufB.length);
        const paddedA = Buffer.alloc(maxLen, 0);
        const paddedB = Buffer.alloc(maxLen, 0);
        bufA.copy(paddedA);
        bufB.copy(paddedB);

        // Import crypto synchronously in Node.js
        const nodeCrypto = require("node:crypto");
        // Do the comparison but always return false for length mismatch
        nodeCrypto.timingSafeEqual(paddedA, paddedB);
        return false;
      }

      const nodeCrypto = require("node:crypto");
      return nodeCrypto.timingSafeEqual(bufA, bufB);
    } catch {
      // Fall through to manual implementation if crypto is unavailable
    }
  }

  // Manual constant-time comparison for browser environments
  const maxLen = Math.max(a.length, b.length);
  let result = a.length ^ b.length; // Start with length difference

  for (let i = 0; i < maxLen; i++) {
    // Use 0 for out-of-range indices to ensure both inputs are touched
    const charA = i < a.length ? a.charCodeAt(i) : 0;
    const charB = i < b.length ? b.charCodeAt(i) : 0;
    result |= charA ^ charB;
  }

  return result === 0;
}

/**
 * Converts an ArrayBuffer or Uint8Array to a hexadecimal string.
 *
 * This is a utility function for converting binary data to a human-readable
 * and storage-friendly hexadecimal format.
 *
 * @param {ArrayBuffer | Uint8Array} buffer - The binary data to convert
 *
 * @returns {string} The hexadecimal string representation
 *
 * @example
 * ```typescript
 * const bytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]);
 * const hex = bufferToHex(bytes);
 * console.log(hex); // "48656c6c6f"
 * ```
 */
export function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Converts a hexadecimal string to a Uint8Array.
 *
 * This is the inverse of bufferToHex, useful for converting stored hex
 * strings back to binary format for cryptographic operations.
 *
 * @param {string} hex - The hexadecimal string to convert (must have even length)
 *
 * @returns {Uint8Array} The binary data
 *
 * @throws {Error} If the hex string has an odd length or contains invalid characters
 *
 * @example
 * ```typescript
 * const hex = "48656c6c6f";
 * const bytes = hexToBuffer(hex);
 * console.log(new TextDecoder().decode(bytes)); // "Hello"
 * ```
 */
export function hexToBuffer(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }

  /*
   * Validated up front rather than by testing each parse for NaN.
   * `Number.parseInt` reads as far as it can and stops, so only a pair with no
   * valid leading digit was rejected: "1z", "+1" and " 1" all parsed as 1 and
   * produced a byte the caller never supplied. Corrupt hex now fails instead of
   * decoding to something plausible.
   */
  const invalidAt = hex.search(/[^0-9a-fA-F]/);
  if (invalidAt !== -1) {
    throw new Error(`Invalid hex character at position ${invalidAt}`);
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Encodes a string to base64.
 *
 * Works in both Node.js and browser environments using the appropriate
 * encoding method.
 *
 * @param {string} data - The string to encode
 *
 * @returns {string} The base64 encoded string
 *
 * @example
 * ```typescript
 * const encoded = base64Encode("Hello, World!");
 * console.log(encoded); // "SGVsbG8sIFdvcmxkIQ=="
 * ```
 */
export function base64Encode(data: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data, "utf-8").toString("base64");
  }
  return btoa(
    encodeURIComponent(data).replace(/%([0-9A-F]{2})/g, (_, p1) =>
      String.fromCharCode(Number.parseInt(p1, 16)),
    ),
  );
}

/**
 * Decodes a base64 string.
 *
 * Works in both Node.js and browser environments using the appropriate
 * decoding method.
 *
 * @param {string} data - The base64 string to decode
 *
 * @returns {string} The decoded string
 *
 * @example
 * ```typescript
 * const decoded = base64Decode("SGVsbG8sIFdvcmxkIQ==");
 * console.log(decoded); // "Hello, World!"
 * ```
 */
export function base64Decode(data: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(data, "base64").toString("utf-8");
  }
  return decodeURIComponent(
    atob(data)
      .split("")
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, "0")}`)
      .join(""),
  );
}

/**
 * Encodes data to URL-safe base64 (base64url).
 *
 * Base64url encoding is safe for use in URLs and filenames, replacing
 * + with -, / with _, and removing trailing = padding.
 *
 * @param {string} data - The string to encode
 *
 * @returns {string} The base64url encoded string
 *
 * @example
 * ```typescript
 * const token = base64UrlEncode(JSON.stringify({ sub: "user123" }));
 * // Safe to use in URLs without escaping
 * ```
 */
export function base64UrlEncode(data: string): string {
  return base64Encode(data)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Decodes a URL-safe base64 (base64url) string.
 *
 * @param {string} data - The base64url string to decode
 *
 * @returns {string} The decoded string
 *
 * @example
 * ```typescript
 * const payload = base64UrlDecode(tokenPart);
 * const data = JSON.parse(payload);
 * ```
 */
export function base64UrlDecode(data: string): string {
  // Add back padding if needed
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
  // Convert base64url to base64
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  return base64Decode(base64);
}
