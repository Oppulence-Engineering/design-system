/**
 * Cookie utilities for @oppulence/auth
 *
 * Provides type-safe cookie operations for session management.
 * Works with both Next.js App Router (cookies()) and standard Request/Response.
 */

import { DEFAULT_CONFIG, COOKIE_MAX_AGE, COOKIE_OPTIONS } from "./constants";
import { getEnvVar, debugLog, assertServer } from "./env";

// ============================================================================
// Cookie Configuration
// ============================================================================

/**
 * Gets the configured cookie name.
 */
export function getCookieName(): string {
  return DEFAULT_CONFIG.cookieName;
}

/**
 * Gets the full cookie options for setting the session cookie.
 */
export function getCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge: number;
  domain?: string;
} {
  const cookieDomain = getEnvVar("WORKOS_COOKIE_DOMAIN");

  return {
    ...COOKIE_OPTIONS,
    maxAge: COOKIE_MAX_AGE,
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

// ============================================================================
// Next.js Cookie Operations (App Router)
// ============================================================================

/**
 * Type for Next.js cookies() function return type.
 * This allows the module to work without importing 'next/headers'.
 */
export interface NextCookies {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
}

/**
 * Gets the session token from Next.js cookies.
 *
 * @param cookies - The cookies() object from next/headers
 * @returns Session token or null if not found
 */
export function getSessionFromNextCookies(cookies: NextCookies): string | null {
  const cookie = cookies.get(getCookieName());
  return cookie?.value ?? null;
}

/**
 * Sets the session token in Next.js cookies.
 *
 * @param cookies - The cookies() object from next/headers
 * @param token - Encrypted session token
 */
export function setSessionInNextCookies(
  cookies: NextCookies,
  token: string,
): void {
  const options = getCookieOptions();
  cookies.set(getCookieName(), token, options);
  debugLog("Session cookie set via Next.js cookies()");
}

/**
 * Clears the session cookie in Next.js.
 *
 * @param cookies - The cookies() object from next/headers
 */
export function clearSessionInNextCookies(cookies: NextCookies): void {
  cookies.delete(getCookieName());
  debugLog("Session cookie cleared via Next.js cookies()");
}

// ============================================================================
// Standard Request/Response Cookie Operations
// ============================================================================

/**
 * Gets the session token from a standard Request object.
 *
 * @param request - Standard Request object
 * @returns Session token or null if not found
 */
export function getSessionFromRequest(request: Request): string | null {
  return getCookieFromRequest(request, getCookieName());
}

/**
 * Creates a Set-Cookie header value for the session.
 *
 * @param token - Encrypted session token
 * @returns Set-Cookie header value
 */
export function createSessionCookieHeader(token: string): string {
  const options = getCookieOptions();
  const cookieName = getCookieName();

  const parts = [
    `${cookieName}=${encodeURIComponent(token)}`,
    `Path=${options.path}`,
    `Max-Age=${options.maxAge}`,
    options.httpOnly ? "HttpOnly" : "",
    options.secure ? "Secure" : "",
    `SameSite=${capitalize(options.sameSite)}`,
    options.domain ? `Domain=${options.domain}` : "",
  ].filter(Boolean);

  return parts.join("; ");
}

/**
 * Creates a Set-Cookie header value to clear the session.
 *
 * @returns Set-Cookie header value that clears the cookie
 */
export function createClearSessionCookieHeader(): string {
  const options = getCookieOptions();
  const cookieName = getCookieName();

  const parts = [
    `${cookieName}=`,
    `Path=${options.path}`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    options.httpOnly ? "HttpOnly" : "",
    options.secure ? "Secure" : "",
    `SameSite=${capitalize(options.sameSite)}`,
    options.domain ? `Domain=${options.domain}` : "",
  ].filter(Boolean);

  return parts.join("; ");
}

/**
 * Adds session cookie to a Response object.
 *
 * @param response - Response object to modify
 * @param token - Encrypted session token
 * @returns Response with Set-Cookie header
 */
export function addSessionToResponse(
  response: Response,
  token: string,
): Response {
  const newResponse = new Response(response.body, response);
  newResponse.headers.append("Set-Cookie", createSessionCookieHeader(token));
  debugLog("Session cookie added to response");
  return newResponse;
}

/**
 * Clears session cookie from a Response object.
 *
 * @param response - Response object to modify
 * @returns Response with Set-Cookie header that clears the cookie
 */
export function clearSessionFromResponse(response: Response): Response {
  const newResponse = new Response(response.body, response);
  newResponse.headers.append("Set-Cookie", createClearSessionCookieHeader());
  debugLog("Session cookie cleared from response");
  return newResponse;
}

// ============================================================================
// Next.js Middleware Cookie Operations
// ============================================================================

/**
 * Type for Next.js NextRequest cookies.
 */
interface NextRequestCookies {
  get(name: string): { value: string } | undefined;
}

/**
 * Type for Next.js NextResponse cookies.
 */
interface NextResponseCookies {
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete(name: string): void;
}

/**
 * Gets session token from NextRequest (middleware context).
 */
export function getSessionFromNextRequest(
  requestCookies: NextRequestCookies,
): string | null {
  const cookie = requestCookies.get(getCookieName());
  return cookie?.value ?? null;
}

/**
 * Sets session token in NextResponse (middleware context).
 */
export function setSessionInNextResponse(
  responseCookies: NextResponseCookies,
  token: string,
): void {
  const options = getCookieOptions();
  responseCookies.set(getCookieName(), token, options);
  debugLog("Session cookie set in NextResponse");
}

/**
 * Clears session token from NextResponse (middleware context).
 */
export function clearSessionFromNextResponse(
  responseCookies: NextResponseCookies,
): void {
  responseCookies.delete(getCookieName());
  debugLog("Session cookie cleared from NextResponse");
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Parses a cookie header string into a key-value object.
 *
 * The result has a null prototype, and a cookie whose value is not valid
 * percent-encoding is dropped rather than allowed to throw.
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  /*
   * Null prototype. A plain object inherits from Object.prototype, so a lookup
   * for a cookie the request never sent could return an inherited value —
   * `cookies[sessionCookieName]` would hand back whatever a polluted prototype
   * held, and callers treat that as the session token.
   */
  const cookies: Record<string, string> = Object.create(null);

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (!name) {
      continue;
    }

    try {
      cookies[name] = decodeURIComponent(rest.join("="));
    } catch {
      /*
       * `decodeURIComponent` throws URIError on malformed percent-encoding, and
       * every cookie in the header is decoded — so one junk cookie anywhere on
       * the domain threw straight out of session lookup and CSRF validation,
       * turning "Cookie: foo=%" into a failed request rather than an
       * unauthenticated one. An undecodable cookie is treated as absent, which
       * fails closed: no session, and CSRF validation returns false.
       */
      debugLog("Ignoring cookie with malformed encoding", { name });
    }
  }

  return cookies;
}

/**
 * Reads a single cookie from a standard Request object.
 *
 * @param request - Standard Request object
 * @param name - Cookie name
 * @returns The decoded cookie value, or null if absent or undecodable
 */
export function getCookieFromRequest(
  request: Request,
  name: string,
): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  return parseCookies(cookieHeader)[name] ?? null;
}

/**
 * Capitalizes the first letter of a string.
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ============================================================================
// CSRF Protection
// ============================================================================

/*
 * These two functions are a complete double-submit CSRF implementation, and
 * NOTHING IN THIS PACKAGE CALLS EITHER OF THEM. No route issues the cookie and
 * no route checks the header, so the auth endpoints — sign-in, sign-up,
 * sign-out, password reset, organization switch — perform no CSRF validation.
 *
 * They are correct and ready; what is missing is the wiring, and switching it
 * on is a coordinated change rather than a fix. Validation cannot be enabled
 * before the cookie is issued and clients are sending the header, or every
 * request from every existing client is rejected at once.
 *
 * Meanwhile the session cookie is SameSite=Lax, which stops a cross-site form
 * post from carrying it. That blocks the classic attack in current browsers
 * but does not cover same-site attackers or subdomain takeover, so treat it as
 * mitigation, not as this feature being unnecessary.
 *
 * See the note at the validateCSRFToken import in nextjs/handler.ts for the
 * order to turn it on in.
 */
const CSRF_COOKIE_NAME = "__oppulence_csrf";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Generates a CSRF token and returns the cookie header.
 *
 * Not called anywhere in this package — see the note above.
 */
export function generateCSRFToken(): { token: string; cookie: string } {
  assertServer("generateCSRFToken()");

  const token = crypto.getRandomValues(new Uint8Array(32));
  const tokenStr = Array.from(token)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const cookie = [
    `${CSRF_COOKIE_NAME}=${tokenStr}`,
    "Path=/",
    "SameSite=Strict",
    process.env.NODE_ENV === "production" ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return { token: tokenStr, cookie };
}

/**
 * Validates a CSRF token from request headers against the cookie.
 *
 * Not called anywhere in this package — see the note above. Callers wiring
 * this up must issue the cookie first; with no cookie present it returns
 * false, which is the safe answer but would reject everything.
 */
export function validateCSRFToken(
  request: Request,
  cookieHeader: string | null,
): boolean {
  if (!cookieHeader) {
    return false;
  }

  const cookies = parseCookies(cookieHeader);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = request.headers.get(CSRF_HEADER_NAME);

  if (!cookieToken || !headerToken) {
    return false;
  }

  // Constant-time comparison
  if (cookieToken.length !== headerToken.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < cookieToken.length; i++) {
    result |= cookieToken.charCodeAt(i) ^ headerToken.charCodeAt(i);
  }

  return result === 0;
}
