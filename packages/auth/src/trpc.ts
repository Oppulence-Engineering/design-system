/**
 * @oppulence/auth/trpc - tRPC integration
 *
 * Provides context builders and procedure builders for tRPC.
 *
 * @example
 * ```ts
 * // server/trpc.ts
 * import { createAuthContext, createAuthProcedures } from '@oppulence/auth/trpc';
 *
 * export const createContext = async ({ req }) => {
 *   const auth = await createAuthContext({ headers: req.headers });
 *   return { auth };
 * };
 *
 * const { protectedProcedure, adminProcedure } = createAuthProcedures(t);
 * ```
 */

// ============================================================================
// Context Builder
// ============================================================================

export {
  createAuthContext,
  type AuthContext,
  type CreateAuthContextOptions,
} from "./trpc/context";

// ============================================================================
// Procedure Builders
// ============================================================================

export {
  createAuthProcedures,
  type AuthProcedureBuilders,
} from "./trpc/procedures";

// ============================================================================
// Standalone Middleware
// ============================================================================

export {
  authMiddleware,
  orgMiddleware,
  roleMiddleware,
  permissionMiddleware,
} from "./trpc/middleware";
