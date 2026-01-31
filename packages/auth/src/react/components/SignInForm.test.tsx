/**
 * Tests for SignInForm component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SignInForm } from "./SignInForm";
import { AuthContext, type AuthContextValue } from "../context";

// Mock auth context
const createMockAuthContext = (
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue => ({
  user: null,
  session: null,
  organization: null,
  membership: null,
  organizations: [],
  isAuthenticated: false,
  isLoading: false,
  error: null,
  signIn: vi.fn().mockResolvedValue(undefined),
  signUp: vi.fn().mockResolvedValue(undefined),
  signOut: vi.fn().mockResolvedValue(undefined),
  signInWithOAuth: vi.fn(),
  forgotPassword: vi.fn().mockResolvedValue(undefined),
  resetPassword: vi.fn().mockResolvedValue(undefined),
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  verifyEmail: vi.fn().mockResolvedValue(undefined),
  switchOrganization: vi.fn().mockResolvedValue(undefined),
  clearOrganization: vi.fn().mockResolvedValue(undefined),
  refreshSession: vi.fn().mockResolvedValue(undefined),
  clearError: vi.fn(),
  enrollMFA: vi.fn().mockResolvedValue({ qrCodeUrl: "", secret: "" }),
  verifyMFAEnrollment: vi.fn().mockResolvedValue({ backupCodes: [] }),
  verifyMFA: vi.fn().mockResolvedValue(undefined),
  sendMFASMS: vi.fn().mockResolvedValue(undefined),
  resendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  requestPasswordReset: vi.fn().mockResolvedValue(undefined),
  hasPermission: vi.fn().mockReturnValue(false),
  hasAllPermissions: vi.fn().mockReturnValue(false),
  hasAnyPermission: vi.fn().mockReturnValue(false),
  hasRole: vi.fn().mockReturnValue(false),
  isOwner: false,
  isAdmin: false,
  ...overrides,
});

// Wrapper component for tests
function TestWrapper({
  children,
  authContext,
}: {
  children: React.ReactNode;
  authContext?: Partial<AuthContextValue>;
}) {
  return (
    <AuthContext.Provider value={createMockAuthContext(authContext)}>
      {children}
    </AuthContext.Provider>
  );
}

describe("SignInForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders email and password fields", () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    });

    it("renders sign in button", () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      expect(
        screen.getByRole("button", { name: /sign in/i }),
      ).toBeInTheDocument();
    });

    it("renders OAuth buttons when providers are specified", () => {
      render(
        <TestWrapper>
          <SignInForm providers={["google", "github"]} />
        </TestWrapper>,
      );

      expect(
        screen.getByRole("button", { name: /google/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /github/i }),
      ).toBeInTheDocument();
    });

    it("hides OAuth buttons when providers is empty", () => {
      render(
        <TestWrapper>
          <SignInForm providers={[]} />
        </TestWrapper>,
      );

      expect(
        screen.queryByRole("button", { name: /google/i }),
      ).not.toBeInTheDocument();
    });

    it("shows forgot password link by default", () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      expect(screen.getByText(/forgot password/i)).toBeInTheDocument();
    });

    it("hides forgot password link when disabled", () => {
      render(
        <TestWrapper>
          <SignInForm showForgotPassword={false} />
        </TestWrapper>,
      );

      expect(screen.queryByText(/forgot password/i)).not.toBeInTheDocument();
    });

    it("shows sign up link by default", () => {
      render(
        <TestWrapper>
          <SignInForm />
        </TestWrapper>,
      );

      expect(screen.getByText(/sign up/i)).toBeInTheDocument();
    });

    it("hides sign up link when disabled", () => {
      render(
        <TestWrapper>
          <SignInForm showSignUpLink={false} />
        </TestWrapper>,
      );

      expect(
        screen.queryByText(/don't have an account/i),
      ).not.toBeInTheDocument();
    });
  });

  describe("OAuth buttons", () => {
    it("calls signInWithOAuth when OAuth button is clicked", async () => {
      const signInWithOAuth = vi.fn();
      const user = userEvent.setup();

      render(
        <TestWrapper authContext={{ signInWithOAuth }}>
          <SignInForm providers={["google"]} />
        </TestWrapper>,
      );

      await user.click(screen.getByRole("button", { name: /google/i }));

      expect(signInWithOAuth).toHaveBeenCalledWith("google");
    });
  });

  describe("loading state", () => {
    it("disables form when isLoading is true", () => {
      render(
        <TestWrapper authContext={{ isLoading: true }}>
          <SignInForm />
        </TestWrapper>,
      );

      expect(screen.getByLabelText(/email/i)).toBeDisabled();
      expect(screen.getByLabelText(/password/i)).toBeDisabled();
      expect(screen.getByRole("button", { name: /sign in/i })).toBeDisabled();
    });
  });

  describe("error display", () => {
    it("displays auth error from context", () => {
      // AuthError type structure
      const error = {
        name: "AuthError",
        message: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
        status: 401,
        statusCode: 401,
        toJSON: () => ({
          name: "AuthError",
          message: "Invalid credentials",
          code: "INVALID_CREDENTIALS",
          status: 401,
        }),
      } as any;

      render(
        <TestWrapper authContext={{ error }}>
          <SignInForm />
        </TestWrapper>,
      );

      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });
});
