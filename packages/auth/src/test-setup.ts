/**
 * Test setup file for @oppulence/auth
 * Sets up jest-dom matchers and other test utilities
 *
 * Environment variables live in test-env.ts, which is loaded first — the import
 * below needs a DOM and throws under `@vitest-environment node`, so anything
 * placed after it would not run for server-side tests.
 */

import "@testing-library/jest-dom/vitest";
