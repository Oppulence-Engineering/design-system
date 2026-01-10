/**
 * Tests for @oppulence/auth crypto utilities
 */

import { describe, it, expect } from "vitest";
import {
  generateToken,
  generateOAuthState,
  validateOAuthState,
  constantTimeCompare,
  hash,
} from "./crypto";

describe("generateToken", () => {
  it("generates a base64url-encoded token", () => {
    const token = generateToken();
    // Base64url uses only these characters
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("generates tokens of consistent length for same byte input", () => {
    const token1 = generateToken(16);
    const token2 = generateToken(16);
    // 16 bytes = 22 base64 chars (rounded up)
    expect(token1.length).toBe(token2.length);
  });

  it("generates unique tokens", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      tokens.add(generateToken());
    }
    // All 100 tokens should be unique
    expect(tokens.size).toBe(100);
  });

  it("respects custom length parameter", () => {
    const short = generateToken(8);
    const long = generateToken(64);
    // Longer byte input = longer token
    expect(long.length).toBeGreaterThan(short.length);
  });
});

describe("generateOAuthState", () => {
  it("generates a state with timestamp and random parts", () => {
    const state = generateOAuthState();
    expect(state).toContain(".");
    const [timestamp, random] = state.split(".");
    expect(timestamp).toBeDefined();
    expect(random).toBeDefined();
    expect(random!.length).toBeGreaterThan(0);
  });

  it("generates unique states", () => {
    const states = new Set<string>();
    for (let i = 0; i < 100; i++) {
      states.add(generateOAuthState());
    }
    expect(states.size).toBe(100);
  });

  it("includes a parseable timestamp", () => {
    const state = generateOAuthState();
    const [timestampStr] = state.split(".");
    const timestamp = parseInt(timestampStr!, 36);
    // Timestamp should be close to now
    const now = Date.now();
    expect(timestamp).toBeGreaterThan(now - 1000);
    expect(timestamp).toBeLessThanOrEqual(now);
  });
});

describe("validateOAuthState", () => {
  // Helper to create a state with a specific timestamp
  function createStateWithTimestamp(timestampMs: number): string {
    const timestamp = timestampMs.toString(36);
    const random = generateToken(16);
    return `${timestamp}.${random}`;
  }

  it("validates a fresh state", () => {
    const state = generateOAuthState();
    expect(validateOAuthState(state)).toBe(true);
  });

  it("validates a state within the max age", () => {
    // Create state from 5 minutes ago
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    const state = createStateWithTimestamp(fiveMinutesAgo);
    expect(validateOAuthState(state)).toBe(true);
  });

  it("rejects a state older than max age", () => {
    // Create state from 11 minutes ago (default max is 10)
    const elevenMinutesAgo = Date.now() - 11 * 60 * 1000;
    const state = createStateWithTimestamp(elevenMinutesAgo);
    expect(validateOAuthState(state)).toBe(false);
  });

  it("respects custom max age", () => {
    // Create state from 2 minutes ago
    const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
    const state = createStateWithTimestamp(twoMinutesAgo);
    // 1 minute max = should be invalid
    expect(validateOAuthState(state, 60 * 1000)).toBe(false);
  });

  it("rejects malformed state", () => {
    expect(validateOAuthState("")).toBe(false);
    expect(validateOAuthState("invalid")).toBe(false);
    expect(validateOAuthState("not.valid.format")).toBe(false);
  });

  it("rejects state from the future", () => {
    // Create state 10 minutes in the future
    const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;
    const state = createStateWithTimestamp(tenMinutesFromNow);
    expect(validateOAuthState(state)).toBe(false);
  });
});

describe("constantTimeCompare", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeCompare("abc", "abc")).toBe(true);
    expect(constantTimeCompare("", "")).toBe(true);
    expect(constantTimeCompare("longstring123", "longstring123")).toBe(true);
  });

  it("returns false for different strings", () => {
    expect(constantTimeCompare("abc", "abd")).toBe(false);
    expect(constantTimeCompare("abc", "ABC")).toBe(false);
  });

  it("returns false for different length strings", () => {
    expect(constantTimeCompare("abc", "ab")).toBe(false);
    expect(constantTimeCompare("ab", "abc")).toBe(false);
    expect(constantTimeCompare("", "a")).toBe(false);
  });

  it("handles unicode characters", () => {
    expect(constantTimeCompare("héllo", "héllo")).toBe(true);
    expect(constantTimeCompare("héllo", "hello")).toBe(false);
  });

  it("handles special characters", () => {
    expect(constantTimeCompare("a!@#$%^&*()", "a!@#$%^&*()")).toBe(true);
    expect(constantTimeCompare("a!@#$%^&*()", "a!@#$%^&*()x")).toBe(false);
  });
});

describe("hash", () => {
  it("generates consistent hash for same input", async () => {
    const hash1 = await hash("test");
    const hash2 = await hash("test");
    expect(hash1).toBe(hash2);
  });

  it("generates different hashes for different inputs", async () => {
    const hash1 = await hash("test1");
    const hash2 = await hash("test2");
    expect(hash1).not.toBe(hash2);
  });

  it("generates base64url-encoded hash", async () => {
    const result = await hash("test");
    expect(result).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("handles empty string", async () => {
    const result = await hash("");
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });

  it("handles unicode", async () => {
    const result = await hash("こんにちは");
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});
