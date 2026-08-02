/**
 * Environment setup for tests, loaded before anything else.
 *
 * `getEnvVar` validates the whole schema and throws when a required variable is
 * missing, so without these no test could touch cookies, sessions, or the route
 * handlers at all. They are fake values shaped to satisfy the schema's prefix
 * and length rules — never real secrets, and never used against a live account.
 *
 * Kept in its own file, ahead of the jest-dom setup: that import needs a DOM
 * and throws under `@vitest-environment node`, which would leave these
 * assignments unreached if they shared a file with it.
 *
 * Assigned only when absent, so a real environment still wins.
 */
process.env.WORKOS_API_KEY ??= "sk_test_placeholder";
process.env.WORKOS_CLIENT_ID ??= "client_test_placeholder";
process.env.WORKOS_COOKIE_SECRET ??=
  "test-cookie-secret-that-is-long-enough-for-the-schema";
process.env.NEXT_PUBLIC_APP_URL ??= "https://app.example.test";
