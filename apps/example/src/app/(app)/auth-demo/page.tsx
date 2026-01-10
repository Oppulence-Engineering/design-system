"use client";

/**
 * Auth Demo Page
 *
 * Showcases all @oppulence/auth components:
 * - SignInForm, SignUpForm
 * - UserMenu, OrgSwitcher, SignOutButton
 * - ProtectedRoute, HasPermission, HasRole
 */

import {
  SignInForm,
  SignUpForm,
  UserMenu,
  OrgSwitcher,
  SignOutButton,
  ProtectedRoute,
  HasPermission,
  HasRole,
  useAuth,
  usePermissions,
  evaluatePasswordStrength,
  getPasswordStrengthMessage,
} from "@oppulence/auth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Text,
  HStack,
  Stack,
  Badge,
  Input,
  Button,
  Tabs,
  TabList,
  Tab,
  TabPanel,
} from "@oppulence/design-system";
import * as React from "react";

// =============================================================================
// Password Strength Demo
// =============================================================================

function PasswordStrengthDemo() {
  const [password, setPassword] = React.useState("");
  const strength = evaluatePasswordStrength(password);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password Strength</CardTitle>
        <CardDescription>
          Type a password to see real-time strength evaluation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap="md">
          <Input
            type="password"
            placeholder="Enter a password..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password && (
            <Stack gap="sm">
              <HStack gap="sm" align="center">
                <Text size="sm" weight="medium">
                  Strength:
                </Text>
                <Badge
                  variant={
                    strength.strength === "strong"
                      ? "default"
                      : strength.strength === "good"
                        ? "secondary"
                        : strength.strength === "fair"
                          ? "outline"
                          : "destructive"
                  }
                >
                  {strength.strength.toUpperCase()}
                </Badge>
              </HStack>
              <Text size="sm" className="text-muted-foreground">
                {getPasswordStrengthMessage(strength.strength)}
              </Text>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-1.5 flex-1 rounded-full ${
                      i <= strength.score
                        ? strength.strength === "strong"
                          ? "bg-green-500"
                          : strength.strength === "good"
                            ? "bg-yellow-500"
                            : strength.strength === "fair"
                              ? "bg-orange-500"
                              : "bg-red-500"
                        : "bg-muted"
                    }`}
                  />
                ))}
              </div>
              <Stack gap="xs">
                <Text size="xs" weight="medium">
                  Criteria:
                </Text>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <HStack gap="xs">
                    {strength.criteria.minLength ? "✓" : "✗"} 12+ characters
                  </HStack>
                  <HStack gap="xs">
                    {strength.criteria.hasUppercase ? "✓" : "✗"} Uppercase
                  </HStack>
                  <HStack gap="xs">
                    {strength.criteria.hasLowercase ? "✓" : "✗"} Lowercase
                  </HStack>
                  <HStack gap="xs">
                    {strength.criteria.hasNumber ? "✓" : "✗"} Number
                  </HStack>
                  <HStack gap="xs">
                    {strength.criteria.hasSpecial ? "✓" : "✗"} Special char
                  </HStack>
                </div>
              </Stack>
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Auth State Demo
// =============================================================================

function AuthStateDemo() {
  const { user, isAuthenticated, isLoading, organization } = useAuth();
  const { hasPermission, hasRole, isAdmin, isMember } = usePermissions();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Auth State (useAuth)</CardTitle>
        <CardDescription>
          Current authentication state from context
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap="md">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <Text weight="medium">isLoading</Text>
              <Text className="text-muted-foreground">
                {isLoading ? "true" : "false"}
              </Text>
            </div>
            <div>
              <Text weight="medium">isAuthenticated</Text>
              <Text className="text-muted-foreground">
                {isAuthenticated ? "true" : "false"}
              </Text>
            </div>
            <div>
              <Text weight="medium">user</Text>
              <Text className="text-muted-foreground font-mono text-xs">
                {user ? user.email : "null"}
              </Text>
            </div>
            <div>
              <Text weight="medium">organization</Text>
              <Text className="text-muted-foreground font-mono text-xs">
                {organization ? organization.name : "null"}
              </Text>
            </div>
          </div>

          <Stack gap="sm">
            <Text weight="medium" size="sm">
              Permission Checks (usePermissions)
            </Text>
            <div className="flex flex-wrap gap-2">
              <Badge variant={isAdmin ? "default" : "outline"}>
                isAdmin: {isAdmin ? "✓" : "✗"}
              </Badge>
              <Badge variant={isMember ? "default" : "outline"}>
                isMember: {isMember ? "✓" : "✗"}
              </Badge>
              <Badge
                variant={hasPermission("billing:read") ? "default" : "outline"}
              >
                billing:read: {hasPermission("billing:read") ? "✓" : "✗"}
              </Badge>
              <Badge variant={hasRole("admin") ? "default" : "outline"}>
                hasRole(admin): {hasRole("admin") ? "✓" : "✗"}
              </Badge>
            </div>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Components Demo
// =============================================================================

function ComponentsDemo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>UI Components</CardTitle>
        <CardDescription>
          Interactive auth components from @oppulence/auth
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap="lg">
          <Stack gap="sm">
            <Text weight="medium" size="sm">
              UserMenu
            </Text>
            <HStack gap="md">
              <UserMenu avatarSize="default" />
              <UserMenu avatarSize="lg" />
            </HStack>
          </Stack>

          <Stack gap="sm">
            <Text weight="medium" size="sm">
              OrgSwitcher
            </Text>
            <HStack gap="md">
              <OrgSwitcher />
              <OrgSwitcher compact />
            </HStack>
          </Stack>

          <Stack gap="sm">
            <Text weight="medium" size="sm">
              SignOutButton
            </Text>
            <HStack gap="md">
              <SignOutButton variant="outline" />
              <SignOutButton variant="destructive" size="sm">
                Sign out now
              </SignOutButton>
            </HStack>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Access Control Demo
// =============================================================================

function AccessControlDemo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Access Control</CardTitle>
        <CardDescription>
          ProtectedRoute, HasPermission, and HasRole components
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Stack gap="lg">
          <Stack gap="sm">
            <Text weight="medium" size="sm">
              HasPermission
            </Text>
            <HasPermission
              permission="billing:read"
              fallback={
                <Badge variant="outline">No billing:read permission</Badge>
              }
            >
              <Badge variant="default">Has billing:read permission!</Badge>
            </HasPermission>
          </Stack>

          <Stack gap="sm">
            <Text weight="medium" size="sm">
              HasRole
            </Text>
            <HasRole
              role="admin"
              fallback={<Badge variant="outline">Not an admin</Badge>}
            >
              <Badge variant="default">Admin access granted!</Badge>
            </HasRole>
          </Stack>

          <Stack gap="sm">
            <Text weight="medium" size="sm">
              ProtectedRoute
            </Text>
            <ProtectedRoute
              redirectToSignIn={false}
              unauthenticatedFallback={
                <div className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
                  Sign in to see protected content
                </div>
              }
            >
              <div className="rounded-md border bg-primary/5 p-4 text-center text-sm">
                This content is protected!
              </div>
            </ProtectedRoute>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Demo Page
// =============================================================================

export default function AuthDemoPage() {
  return (
    <Stack gap="lg">
      <div>
        <Text as="h1" size="2xl" weight="bold">
          Auth Demo
        </Text>
        <Text className="text-muted-foreground">
          Showcasing @oppulence/auth components and utilities
        </Text>
      </div>

      <Tabs defaultValue="components">
        <TabList>
          <Tab value="components">Components</Tab>
          <Tab value="forms">Forms</Tab>
          <Tab value="utilities">Utilities</Tab>
        </TabList>

        <TabPanel value="components">
          <div className="grid gap-6 pt-6 md:grid-cols-2">
            <AuthStateDemo />
            <ComponentsDemo />
            <AccessControlDemo />
          </div>
        </TabPanel>

        <TabPanel value="forms">
          <div className="grid gap-6 pt-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>SignInForm</CardTitle>
                <CardDescription>
                  Complete sign-in form with OAuth support
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignInForm
                  providers={["google", "github"]}
                  showForgotPassword
                  showSignUpLink
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>SignUpForm</CardTitle>
                <CardDescription>
                  Registration form with password strength
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SignUpForm
                  providers={["google"]}
                  showSignInLink
                  requireTerms
                  showNameFields
                />
              </CardContent>
            </Card>
          </div>
        </TabPanel>

        <TabPanel value="utilities">
          <div className="grid gap-6 pt-6 md:grid-cols-2">
            <PasswordStrengthDemo />
            <Card>
              <CardHeader>
                <CardTitle>Form Schemas</CardTitle>
                <CardDescription>
                  Zod schemas for type-safe form validation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Stack gap="sm">
                  <Text size="sm" className="font-mono">
                    signInSchema
                  </Text>
                  <Text size="sm" className="font-mono">
                    signUpSchema
                  </Text>
                  <Text size="sm" className="font-mono">
                    forgotPasswordSchema
                  </Text>
                  <Text size="sm" className="font-mono">
                    resetPasswordSchema
                  </Text>
                  <Text size="sm" className="font-mono">
                    verifyEmailSchema
                  </Text>
                  <Text size="sm" className="font-mono">
                    mfaChallengeSchema
                  </Text>
                </Stack>
              </CardContent>
            </Card>
          </div>
        </TabPanel>
      </Tabs>
    </Stack>
  );
}
