/**
 * @vitest-environment node
 */
import { afterEach, describe, expect, it } from "vitest";

import {
  getCookieFromRequest,
  getSessionFromRequest,
  validateCSRFToken,
} from "./cookies";

const SESSION_COOKIE = "__oppulence_session";
const CSRF_COOKIE = "__oppulence_csrf";

const withCookies = (cookie: string, headers: Record<string, string> = {}) =>
  new Request("https://example.test/", { headers: { cookie, ...headers } });

describe("getSessionFromRequest", () => {
  it("reads the session cookie", () => {
    expect(getSessionFromRequest(withCookies(`${SESSION_COOKIE}=abc`))).toBe(
      "abc",
    );
  });

  it("returns null when the cookie is absent", () => {
    expect(getSessionFromRequest(withCookies("other=1"))).toBeNull();
    expect(
      getSessionFromRequest(new Request("https://example.test/")),
    ).toBeNull();
  });

  it("keeps a value containing =", () => {
    expect(getSessionFromRequest(withCookies(`${SESSION_COOKIE}=a=b`))).toBe(
      "a=b",
    );
  });

  it("decodes a percent-encoded value", () => {
    expect(getSessionFromRequest(withCookies(`${SESSION_COOKIE}=a%20b`))).toBe(
      "a b",
    );
  });

  it("reads the right cookie among several", () => {
    expect(
      getSessionFromRequest(withCookies(`a=1; ${SESSION_COOKIE}=tok; b=2`)),
    ).toBe("tok");
  });

  /*
   * Every cookie in the header is decoded, so one junk cookie anywhere on the
   * domain threw URIError straight out of session lookup — turning
   * "Cookie: foo=%" into a failed request rather than an unauthenticated one.
   */
  describe("malformed percent-encoding", () => {
    const malformed = ["foo=%", "foo=%zz", "foo=%E0%A4%A", "foo=100%"];

    for (const cookie of malformed) {
      it(`survives ${JSON.stringify(cookie)}`, () => {
        expect(() => getSessionFromRequest(withCookies(cookie))).not.toThrow();
        expect(getSessionFromRequest(withCookies(cookie))).toBeNull();
      });
    }

    it("still reads a good session cookie alongside a bad one", () => {
      expect(
        getSessionFromRequest(withCookies(`junk=%; ${SESSION_COOKIE}=tok`)),
      ).toBe("tok");
    });

    it("treats an undecodable session cookie as absent", () => {
      expect(
        getSessionFromRequest(withCookies(`${SESSION_COOKIE}=%`)),
      ).toBeNull();
    });
  });

  /*
   * The parsed bag used to inherit from Object.prototype, so a lookup for a
   * cookie the request never sent could return an inherited value — and callers
   * treat whatever comes back as the session token.
   */
  describe("prototype chain", () => {
    afterEach(() => {
      delete (Object.prototype as Record<string, unknown>)[SESSION_COOKIE];
      delete (Object.prototype as Record<string, unknown>)["injected"];
    });

    it("does not return a value off a polluted prototype", () => {
      (Object.prototype as Record<string, unknown>)[SESSION_COOKIE] =
        "forged-token";

      expect(getSessionFromRequest(withCookies("unrelated=1"))).toBeNull();
    });

    it("does not return inherited values for arbitrary names", () => {
      (Object.prototype as Record<string, unknown>)["injected"] = "forged";

      expect(getCookieFromRequest(withCookies("a=1"), "injected")).toBeNull();
    });

    it("does not confuse a cookie named after a prototype member", () => {
      expect(getCookieFromRequest(withCookies("toString=x"), "toString")).toBe(
        "x",
      );
      expect(getCookieFromRequest(withCookies("a=1"), "toString")).toBeNull();
    });
  });
});

describe("validateCSRFToken", () => {
  const token = "a".repeat(64);
  const withHeader = (value: string) =>
    new Request("https://example.test/", {
      headers: { "x-csrf-token": value },
    });

  it("accepts a matching pair", () => {
    expect(
      validateCSRFToken(withHeader(token), `${CSRF_COOKIE}=${token}`),
    ).toBe(true);
  });

  it("rejects a mismatch", () => {
    expect(
      validateCSRFToken(withHeader("b".repeat(64)), `${CSRF_COOKIE}=${token}`),
    ).toBe(false);
  });

  it("rejects a length mismatch", () => {
    expect(
      validateCSRFToken(withHeader("short"), `${CSRF_COOKIE}=${token}`),
    ).toBe(false);
  });

  it("rejects when either side is missing", () => {
    expect(validateCSRFToken(withHeader(token), null)).toBe(false);
    expect(validateCSRFToken(withHeader(token), "other=1")).toBe(false);
    expect(
      validateCSRFToken(
        new Request("https://example.test/"),
        `${CSRF_COOKIE}=${token}`,
      ),
    ).toBe(false);
  });

  // The same URIError reached CSRF validation, so a junk cookie turned a
  // rejectable request into a thrown one.
  it("fails closed on a malformed cookie header", () => {
    expect(() => validateCSRFToken(withHeader(token), "junk=%")).not.toThrow();
    expect(validateCSRFToken(withHeader(token), "junk=%")).toBe(false);
  });
});
