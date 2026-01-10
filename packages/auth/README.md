# @oppulence/auth

Enterprise-grade authentication package built on WorkOS with custom UI components using `@oppulence/design-system`.

## Features

- **WorkOS Integration**: User management, OAuth, SSO, MFA
- **Custom UI**: Beautiful auth components using your design system
- **Next.js Support**: Middleware, server utilities, API handlers
- **tRPC Integration**: Type-safe procedure builders
- **Multi-tenancy**: Built-in organization support
- **TypeScript**: Full type safety throughout

## Installation

```bash
bun add @oppulence/auth @oppulence/design-system
```

## Quick Start

### 1. Environment Variables

```bash
WORKOS_API_KEY=sk_live_...
WORKOS_CLIENT_ID=client_...
WORKOS_COOKIE_SECRET=your-32-char-secret-key
NEXT_PUBLIC_APP_URL=https://app.example.com
```

### 2. API Route Handler

```ts
// app/api/auth/[...auth]/route.ts
import { createAuthHandler } from "@oppulence/auth/nextjs";

const handler = createAuthHandler({
  onSignIn: async (user, isNewUser) => {
    console.log("User signed in:", user.email);
  },
});

export { handler as GET, handler as POST };
```

### 3. Middleware

```ts
// middleware.ts
import { authMiddleware } from "@oppulence/auth/nextjs";

export default authMiddleware({
  publicRoutes: ["/sign-in", "/sign-up", "/forgot-password"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

### 4. Auth Provider

```tsx
// app/layout.tsx
import { AuthProvider } from "@oppulence/auth";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

### 5. Sign In Page

```tsx
// app/sign-in/page.tsx
import { SignInForm } from "@oppulence/auth";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignInForm
        providers={["google", "github"]}
        showForgotPassword
        showSignUpLink
      />
    </div>
  );
}
```

## React Hooks

```tsx
import {
  useAuth,
  useUser,
  useSession,
  useOrganization,
  useOrganizations,
  usePermissions,
} from "@oppulence/auth";

function MyComponent() {
  const { user, isAuthenticated, signOut } = useAuth();
  const { hasPermission, isAdmin } = usePermissions();

  if (!isAuthenticated) {
    return <p>Please sign in</p>;
  }

  return (
    <div>
      <p>Welcome, {user.email}</p>
      {isAdmin && <AdminPanel />}
      {hasPermission("billing:read") && <BillingInfo />}
      <button onClick={signOut}>Sign Out</button>
    </div>
  );
}
```

## Server-Side (Next.js)

```ts
// Server Component or Route Handler
import { cookies } from "next/headers";
import { getUser, requireAuth, requirePermission } from "@oppulence/auth/nextjs";

// Get user (returns null if not authenticated)
const user = await getUser(cookies());

// Require authentication (throws if not authenticated)
const user = await requireAuth(cookies());

// Require specific permission
const { user, organization } = await requirePermission(cookies(), "billing:read");
```

## tRPC Integration

```ts
// server/trpc/trpc.ts
import { initTRPC } from "@trpc/server";
import { createAuthContext, createAuthProcedures } from "@oppulence/auth/trpc";

export async function createContext({ req }) {
  const auth = await createAuthContext({ headers: req.headers });
  return { auth };
}

const t = initTRPC.context<typeof createContext>().create();

const { protectedProcedure, orgProcedure, adminProcedure, permissionProcedure } =
  createAuthProcedures(t);

// Usage
export const userRouter = router({
  me: protectedProcedure.query(({ ctx }) => ctx.auth.user),
  orgSettings: orgProcedure.query(({ ctx }) => ctx.auth.organization),
  billing: permissionProcedure("billing:read").query(({ ctx }) => {
    // Permission verified
  }),
});
```

## Components

| Component | Description |
|-----------|-------------|
| `SignInForm` | Email/password + OAuth sign-in |
| `SignUpForm` | Registration with password strength |
| `SignOutButton` | Sign out button with loading state |
| `UserMenu` | User dropdown with profile/settings |
| `OrgSwitcher` | Organization selector dropdown |
| `ProtectedRoute` | Auth-gated wrapper with role/permission checks |
| `HasPermission` | Render children based on permission |
| `HasRole` | Render children based on role |
| `ForgotPasswordForm` | Password reset request (coming soon) |
| `ResetPasswordForm` | Set new password (coming soon) |
| `VerifyEmailForm` | OTP verification (coming soon) |

## Form Schemas

All forms use Zod schemas that you can reuse:

```ts
import {
  signInSchema,
  signUpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  evaluatePasswordStrength,
} from "@oppulence/auth";

// Validate password strength
const strength = evaluatePasswordStrength("MyP@ssw0rd123!");
// { strength: 'strong', score: 5, criteria: {...} }
```

## Type Exports

```ts
import type {
  User,
  Session,
  Organization,
  OrganizationMembership,
  Permission,
  OrganizationRole,
  AuthState,
  AuthConfig,
  AuthError,
} from "@oppulence/auth";
```

## API Reference

### createAuthHandler(config)

Creates the API route handler.

```ts
interface AuthHandlerConfig {
  onSignIn?: (user: User, isNewUser: boolean) => Promise<void>;
  onSignOut?: (userId: string) => Promise<void>;
  onOrgSwitch?: (userId: string, orgId: string) => Promise<void>;
  webhookSecret?: string;
  webhooks?: Record<string, (payload) => Promise<void>>;
}
```

### authMiddleware(config)

Creates Next.js middleware.

```ts
interface AuthMiddlewareConfig {
  publicRoutes?: string[];
  protectedRoutes?: string[];
  ignoredRoutes?: string[];
  signInUrl?: string;
  afterAuth?: (auth, request) => Response | void;
}
```

## License

MIT
