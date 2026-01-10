"use client";

/**
 * Sign-in page demonstrating @oppulence/auth SignInForm component
 */

import { SignInForm } from "@oppulence/auth";

export default function SignInPage() {
  return (
    <SignInForm
      providers={["google", "github", "microsoft"]}
      showForgotPassword
      showSignUpLink
      signUpUrl="/sign-up"
      forgotPasswordUrl="/forgot-password"
      onSuccess={(user) => {
        console.log("Signed in as:", user.email);
      }}
      onError={(error) => {
        console.error("Sign-in failed:", error);
      }}
    />
  );
}
