/**
 * Next.js middleware for @oppulence/auth
 *
 * Protects routes and handles session validation at the edge.
 */

import { getSessionMetadata, getValidSession } from "../core/session";
import {
  getSessionFromNextRequest,
  setSessionInNextResponse,
  clearSessionFromNextResponse,
  getCookieName,
} from "../core/cookies";
import { debugLog } from "../core/env";
import { DEFAULT_CONFIG } from "../core/constants";

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for auth middleware.
 */
export interface AuthMiddlewareConfig {
  /**
   * Routes that don't require authentication.
   * Supports glob patterns with * wildcard.
   *
   * @example ['/sign-in', '/sign-up', '/api/public/*']
   */
  publicRoutes?: string[];

  /**
   * Routes that are always protected regardless of other settings.
   * Supports glob patterns.
   *
   * @example ['/dashboard/*', '/api/admin/*']
   */
  protectedRoutes?: string[];

  /**
   * Paths to ignore entirely (no auth checking).
   * Defaults to static assets and auth routes.
   */
  ignoredRoutes?: string[];

  /**
   * Custom matcher function for fine-grained control.
   * Return true if the route should be protected.
   */
  matcher?: (pathname: string) => boolean;

  /**
   * Callback after auth check completes.
   * Can return a Response to override default behavior.
   */
  afterAuth?: (auth: MiddlewareAuth, request: NextRequest) => Response | void;

  /**
   * URL to redirect unauthenticated users.
   */
  signInUrl?: string;

  /**
   * Enable debug logging.
   */
  debug?: boolean;
}

/**
 * Auth state available in middleware.
 */
export interface MiddlewareAuth {
  /** User ID if authenticated */
  userId: string | null;
  /** Session ID if authenticated */
  sessionId: string | null;
  /** Organization ID if selected */
  orgId: string | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Redirect to sign-in page with return URL */
  redirectToSignIn: () => Response;
  /** Redirect to a specific URL */
  redirect: (url: string) => Response;
}

/**
 * Next.js request type (from next/server).
 */
interface NextRequest {
  url: string;
  nextUrl: {
    pathname: string;
    searchParams: URLSearchParams;
    clone: () => NextURL;
  };
  cookies: {
    get(name: string): { value: string } | undefined;
  };
  headers: Headers;
}

/**
 * Next.js URL type.
 */
interface NextURL {
  pathname: string;
  searchParams: URLSearchParams;
  toString: () => string;
}

/**
 * Next.js response type (from next/server).
 */
interface NextResponse extends Response {
  cookies: {
    set(name: string, value: string, options?: Record<string, unknown>): void;
    delete(name: string): void;
  };
}

// ============================================================================
// Pattern Matching
// ============================================================================

/**
 * Converts a glob pattern to a regex.
 * Supports * wildcard.
 */
function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // Escape special chars
    .replace(/\*/g, ".*"); // Convert * to .*
  return new RegExp(`^${escaped}$`);
}

/**
 * Checks if a pathname matches any of the patterns.
 */
function matchesPatterns(pathname: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    if (pattern.includes("*")) {
      return globToRegex(pattern).test(pathname);
    }
    return pathname === pattern || pathname.startsWith(pattern + "/");
  });
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_IGNORED_ROUTES = [
  "/_next",
  "/favicon.ico",
  "/api/auth",
  "/_vercel",
  "/static",
];

const DEFAULT_PUBLIC_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
];

// ============================================================================
// Middleware Factory
// ============================================================================

/**
 * Creates auth middleware for Next.js.
 *
 * @param config - Middleware configuration
 * @returns Middleware function
 *
 * @example
 * ```ts
 * // middleware.ts
 * import { authMiddleware } from '@oppulence/auth/nextjs';
 *
 * export default authMiddleware({
 *   publicRoutes: ['/sign-in', '/sign-up', '/api/public/*'],
 *   afterAuth: (auth, req) => {
 *     if (!auth.isAuthenticated && req.nextUrl.pathname.startsWith('/dashboard')) {
 *       return auth.redirectToSignIn();
 *     }
 *   },
 * });
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
 * };
 * ```
 */
export function authMiddleware(config: AuthMiddlewareConfig = {}) {
  const {
    publicRoutes = DEFAULT_PUBLIC_ROUTES,
    protectedRoutes = [],
    ignoredRoutes = DEFAULT_IGNORED_ROUTES,
    matcher,
    afterAuth,
    signInUrl = DEFAULT_CONFIG.signInUrl,
    debug = false,
  } = config;

  return async function middleware(request: NextRequest): Promise<Response> {
    const { pathname } = request.nextUrl;

    // Debug logging
    if (debug) {
      debugLog("Middleware processing", { pathname });
    }

    // Check if route should be ignored
    if (matchesPatterns(pathname, ignoredRoutes)) {
      if (debug) debugLog("Route ignored", { pathname });
      return nextResponse();
    }

    // Get session from cookie
    const sessionToken = request.cookies.get(getCookieName())?.value ?? null;

    // Validate session
    let userId: string | null = null;
    let sessionId: string | null = null;
    let orgId: string | null = null;
    let newToken: string | null = null;

    if (sessionToken) {
      try {
        const result = await getValidSession(sessionToken);
        if (result) {
          userId = result.session.userId;
          sessionId = result.session.sessionId;
          orgId = result.session.organizationId;
          newToken = result.newToken;
        }
      } catch (error) {
        if (debug) debugLog("Session validation failed", { error });
      }
    }

    const isAuthenticated = !!userId;

    // Create auth object for callbacks
    const auth: MiddlewareAuth = {
      userId,
      sessionId,
      orgId,
      isAuthenticated,
      redirectToSignIn: () => {
        const url = request.nextUrl.clone();
        url.pathname = signInUrl;
        url.searchParams.set("redirect", pathname);
        return nextRedirect(url.toString());
      },
      redirect: (url: string) => nextRedirect(url),
    };

    // Custom matcher takes precedence
    if (matcher) {
      const isProtected = matcher(pathname);
      if (isProtected && !isAuthenticated) {
        if (debug) debugLog("Custom matcher: protected route, not authenticated");
        return auth.redirectToSignIn();
      }
    } else {
      // Check explicit protected routes
      if (matchesPatterns(pathname, protectedRoutes)) {
        if (!isAuthenticated) {
          if (debug) debugLog("Protected route, not authenticated", { pathname });
          return auth.redirectToSignIn();
        }
      }

      // Check public routes - allow through
      if (matchesPatterns(pathname, publicRoutes)) {
        if (debug) debugLog("Public route", { pathname });
        // Allow through, but run afterAuth if provided
      } else if (!isAuthenticated) {
        // Not public and not authenticated
        if (debug) debugLog("Not public, not authenticated", { pathname });
        return auth.redirectToSignIn();
      }
    }

    // Run afterAuth callback
    if (afterAuth) {
      const response = afterAuth(auth, request);
      if (response) {
        // If callback returned a response, use it
        if (newToken) {
          // Still update the cookie if token was refreshed
          const cookies = (response as NextResponse).cookies;
          if (cookies && typeof cookies.set === "function") {
            setSessionInNextResponse(cookies, newToken);
          }
        }
        return response;
      }
    }

    // Create response
    let response = nextResponse();

    // Update cookie if token was refreshed
    if (newToken) {
      response = nextResponseWithCookies();
      setSessionInNextResponse((response as NextResponse).cookies, newToken);
      if (debug) debugLog("Session token refreshed");
    }

    return response;
  };
}

// ============================================================================
// Response Helpers
// ============================================================================

/**
 * Creates a NextResponse.next() equivalent.
 * This is a simple pass-through response.
 */
function nextResponse(): Response {
  return new Response(null, {
    status: 200,
    headers: {
      "x-middleware-next": "1",
    },
  });
}

/**
 * Creates a NextResponse with cookie support.
 */
function nextResponseWithCookies(): Response & {
  cookies: {
    set(name: string, value: string, options?: Record<string, unknown>): void;
    delete(name: string): void;
  };
} {
  const cookieStore: string[] = [];

  const response = new Response(null, {
    status: 200,
    headers: {
      "x-middleware-next": "1",
    },
  }) as Response & {
    cookies: {
      set(name: string, value: string, options?: Record<string, unknown>): void;
      delete(name: string): void;
    };
  };

  response.cookies = {
    set(name: string, value: string, options?: Record<string, unknown>) {
      let cookie = `${name}=${encodeURIComponent(value)}`;
      if (options) {
        if (options.path) cookie += `; Path=${options.path}`;
        if (options.maxAge) cookie += `; Max-Age=${options.maxAge}`;
        if (options.httpOnly) cookie += "; HttpOnly";
        if (options.secure) cookie += "; Secure";
        if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
        if (options.domain) cookie += `; Domain=${options.domain}`;
      }
      response.headers.append("Set-Cookie", cookie);
    },
    delete(name: string) {
      response.headers.append(
        "Set-Cookie",
        `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
      );
    },
  };

  return response;
}

/**
 * Creates a redirect response.
 */
function nextRedirect(url: string): Response {
  return new Response(null, {
    status: 307,
    headers: {
      Location: url,
      "x-middleware-next": "1",
    },
  }) as NextResponse;
}
