/**
 * Environment variable validation for @oppulence/auth
 *
 * Validates required environment variables at startup with descriptive errors.
 * This ensures misconfigurations are caught early rather than at runtime.
 */

import { z } from "zod";
import { AuthError } from "./types";

// ============================================================================
// Environment Schema
// ============================================================================

/**
 * Schema for validating environment variables.
 * Uses Zod for runtime validation with custom error messages.
 */
const envSchema = z.object({
  // Required variables
  WORKOS_API_KEY: z
    .string({
      error: "WORKOS_API_KEY is required. Get it from your WorkOS Dashboard.",
    })
    .min(1, "WORKOS_API_KEY cannot be empty")
    .refine((val) => val.startsWith("sk_"), {
      message: "WORKOS_API_KEY must start with 'sk_' (secret key prefix)",
    }),

  WORKOS_CLIENT_ID: z
    .string({
      error: "WORKOS_CLIENT_ID is required. Get it from your WorkOS Dashboard.",
    })
    .min(1, "WORKOS_CLIENT_ID cannot be empty")
    .refine((val) => val.startsWith("client_"), {
      message: "WORKOS_CLIENT_ID must start with 'client_' prefix",
    }),

  WORKOS_COOKIE_SECRET: z
    .string({
      error:
        "WORKOS_COOKIE_SECRET is required. Generate a random 32+ character string.",
    })
    .min(
      32,
      "WORKOS_COOKIE_SECRET must be at least 32 characters for security",
    ),

  // Public URL (required for OAuth redirects)
  NEXT_PUBLIC_APP_URL: z
    .string({
      error:
        "NEXT_PUBLIC_APP_URL is required. Set it to your app's base URL (e.g., https://app.example.com)",
    })
    .url("NEXT_PUBLIC_APP_URL must be a valid URL"),

  // Optional variables
  WORKOS_WEBHOOK_SECRET: z.string().optional(),
  WORKOS_COOKIE_DOMAIN: z.string().optional(),
  WORKOS_DEBUG: z
    .string()
    .optional()
    .transform((val) => val === "true"),
});

/**
 * Type for validated environment variables.
 */
export type AuthEnv = z.infer<typeof envSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

let cachedEnv: AuthEnv | null = null;

/**
 * Validates environment variables and returns typed config.
 * Throws descriptive errors if validation fails.
 *
 * @throws {AuthError} If environment variables are invalid
 */
export function validateEnv(): AuthEnv {
  // Return cached result if already validated
  if (cachedEnv) {
    return cachedEnv;
  }

  const result = envSchema.safeParse({
    WORKOS_API_KEY: process.env.WORKOS_API_KEY,
    WORKOS_CLIENT_ID: process.env.WORKOS_CLIENT_ID,
    WORKOS_COOKIE_SECRET: process.env.WORKOS_COOKIE_SECRET,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    WORKOS_WEBHOOK_SECRET: process.env.WORKOS_WEBHOOK_SECRET,
    WORKOS_COOKIE_DOMAIN: process.env.WORKOS_COOKIE_DOMAIN,
    WORKOS_DEBUG: process.env.WORKOS_DEBUG,
  });

  if (!result.success) {
    const errors = result.error.issues
      .map((err) => `  - ${err.path.join(".")}: ${err.message}`)
      .join("\n");

    throw new AuthError(
      `@oppulence/auth configuration error:\n${errors}\n\nSee https://docs.workos.com for setup instructions.`,
      "CONFIGURATION_ERROR",
      500,
    );
  }

  cachedEnv = result.data;
  return cachedEnv;
}

/**
 * Gets a specific environment variable with validation.
 * Use this for lazy access when full validation isn't needed.
 */
export function getEnvVar<K extends keyof AuthEnv>(key: K): AuthEnv[K] {
  const env = validateEnv();
  return env[key];
}

/**
 * Checks if the auth package is properly configured.
 * Returns false instead of throwing for soft checks.
 */
export function isConfigured(): boolean {
  try {
    validateEnv();
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the OAuth callback URL based on the app URL.
 */
export function getCallbackUrl(): string {
  const appUrl = getEnvVar("NEXT_PUBLIC_APP_URL");
  return `${appUrl}/api/auth/callback`;
}

/**
 * Gets debug mode status.
 */
export function isDebugMode(): boolean {
  return getEnvVar("WORKOS_DEBUG") ?? false;
}

/**
 * Logs debug information if debug mode is enabled.
 */
export function debugLog(message: string, data?: unknown): void {
  if (isDebugMode()) {
    console.log(`[@oppulence/auth] ${message}`, data ?? "");
  }
}

// ============================================================================
// Server-side Guard
// ============================================================================

/**
 * Ensures code is running on the server.
 * Throws if called from client-side code.
 */
export function assertServer(operation: string): void {
  if (typeof window !== "undefined") {
    throw new AuthError(
      `${operation} can only be called on the server. ` +
        "If you need this on the client, use the API route handlers instead.",
      "CONFIGURATION_ERROR",
      500,
    );
  }
}
