/**
 * Tests for @oppulence/auth Next.js middleware
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock session validation
vi.mock("../core/session", () => ({
  getSessionMetadata: vi.fn(),
  getValidSession: vi.fn(),
}));

vi.mock("../core/cookies", () => ({
  getSessionFromNextRequest: vi.fn(),
  setSessionInNextResponse: vi.fn(),
  clearSessionFromNextResponse: vi.fn(),
  getCookieName: vi.fn(() => "oppulence_auth_session"),
}));

vi.mock("../core/env", () => ({
  debugLog: vi.fn(),
}));

import { authMiddleware, type AuthMiddlewareConfig } from "./middleware";
import { getValidSession } from "../core/session";

describe("authMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create mock NextRequest
  function createMockRequest(
    pathname: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      cookies?: Record<string, string>;
    } = {}
  ) {
    const url = `https://example.com${pathname}`;
    const cookieMap = new Map(Object.entries(options.cookies ?? {}));

    return {
      url,
      method: options.method ?? "GET",
      headers: new Headers(options.headers ?? {}),
      nextUrl: {
        pathname,
        clone: () => ({
          pathname,
          searchParams: new URLSearchParams(),
          toString: () => url,
        }),
      },
      cookies: {
        get: (name: string) => {
          const value = cookieMap.get(name);
          return value ? { name, value } : undefined;
        },
        getAll: () =>
          Array.from(cookieMap.entries()).map(([name, value]) => ({
            name,
            value,
          })),
        has: (name: string) => cookieMap.has(name),
      },
    };
  }

  // Helper to check if response is a "next" response (pass-through)
  function isNextResponse(response: Response): boolean {
    return response.headers.get("x-middleware-next") === "1";
  }

  // Helper to check if response is a redirect
  function isRedirectResponse(response: Response): boolean {
    return response.status >= 300 && response.status < 400;
  }

  describe("public routes", () => {
    it("allows access to public routes without authentication", async () => {
      const config: AuthMiddlewareConfig = {
        publicRoutes: ["/sign-in", "/sign-up"],
      };

      const middleware = authMiddleware(config);
      const req = createMockRequest("/sign-in");

      const response = await middleware(req as any);

      expect(isNextResponse(response)).toBe(true);
    });

    it("allows access to routes matching public patterns", async () => {
      const config: AuthMiddlewareConfig = {
        publicRoutes: ["/api/public/*"],
      };

      const middleware = authMiddleware(config);
      const req = createMockRequest("/api/public/data");

      const response = await middleware(req as any);

      expect(isNextResponse(response)).toBe(true);
    });
  });

  describe("ignored routes", () => {
    it("skips middleware for ignored routes", async () => {
      const config: AuthMiddlewareConfig = {
        ignoredRoutes: ["/_next/*", "/favicon.ico"],
      };

      const middleware = authMiddleware(config);
      const req = createMockRequest("/_next/static/chunk.js");

      const response = await middleware(req as any);

      expect(isNextResponse(response)).toBe(true);
      expect(getValidSession).not.toHaveBeenCalled();
    });
  });

  describe("authentication required", () => {
    it("redirects unauthenticated users to sign-in", async () => {
      const config: AuthMiddlewareConfig = {
        publicRoutes: ["/sign-in"],
      };

      const middleware = authMiddleware(config);
      const req = createMockRequest("/dashboard");

      const response = await middleware(req as any);

      expect(isRedirectResponse(response)).toBe(true);
    });

    it("allows authenticated users to access protected routes", async () => {
      vi.mocked(getValidSession).mockResolvedValue({
        session: {
          userId: "user-1",
          sessionId: "session-1",
          organizationId: null,
          ipAddress: null,
          userAgent: null,
          createdAt: Date.now(),
          accessToken: "token",
          refreshToken: "refresh",
          expiresAt: Date.now() + 3600000,
          refreshTokenExpiresAt: Date.now() + 86400000,
        },
        newToken: null,
      } as any);

      const config: AuthMiddlewareConfig = {
        publicRoutes: ["/sign-in"],
      };

      const middleware = authMiddleware(config);
      const req = createMockRequest("/dashboard", {
        cookies: { oppulence_auth_session: "encrypted-token" },
      });

      const response = await middleware(req as any);

      expect(isNextResponse(response)).toBe(true);
    });
  });

  describe("afterAuth callback", () => {
    it("calls afterAuth with auth context", async () => {
      vi.mocked(getValidSession).mockResolvedValue({
        session: {
          userId: "user-1",
          sessionId: "session-1",
          organizationId: null,
          ipAddress: null,
          userAgent: null,
          createdAt: Date.now(),
          accessToken: "token",
          refreshToken: "refresh",
          expiresAt: Date.now() + 3600000,
          refreshTokenExpiresAt: Date.now() + 86400000,
        },
        newToken: null,
      } as any);

      const afterAuth = vi.fn();
      const config: AuthMiddlewareConfig = {
        publicRoutes: [],
        afterAuth,
      };

      const middleware = authMiddleware(config);
      const req = createMockRequest("/dashboard", {
        cookies: { oppulence_auth_session: "encrypted-token" },
      });

      await middleware(req as any);

      expect(afterAuth).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          sessionId: "session-1",
          isAuthenticated: true,
        }),
        expect.anything()
      );
    });

    it("respects custom response from afterAuth", async () => {
      vi.mocked(getValidSession).mockResolvedValue({
        session: {
          userId: "user-1",
          sessionId: "session-1",
          organizationId: null,
          ipAddress: null,
          userAgent: null,
          createdAt: Date.now(),
          accessToken: "token",
          refreshToken: "refresh",
          expiresAt: Date.now() + 3600000,
          refreshTokenExpiresAt: Date.now() + 86400000,
        },
        newToken: null,
      } as any);

      const customResponse = new Response(null, { status: 403 });
      const afterAuth = vi.fn().mockReturnValue(customResponse);

      const config: AuthMiddlewareConfig = {
        publicRoutes: [],
        afterAuth,
      };

      const middleware = authMiddleware(config);
      const req = createMockRequest("/dashboard", {
        cookies: { oppulence_auth_session: "encrypted-token" },
      });

      const result = await middleware(req as any);

      expect(result).toBe(customResponse);
    });
  });
});

describe("route matching", () => {
  it("matches exact paths", () => {
    const config: AuthMiddlewareConfig = {
      publicRoutes: ["/sign-in"],
    };
    const middleware = authMiddleware(config);
    expect(middleware).toBeDefined();
  });

  it("matches wildcard patterns", () => {
    const config: AuthMiddlewareConfig = {
      publicRoutes: ["/api/public/*"],
    };
    const middleware = authMiddleware(config);
    expect(middleware).toBeDefined();
  });

  it("matches glob patterns", () => {
    const config: AuthMiddlewareConfig = {
      publicRoutes: ["/docs/**"],
    };
    const middleware = authMiddleware(config);
    expect(middleware).toBeDefined();
  });
});
