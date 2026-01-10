"use client";

/**
 * Sign-up page demonstrating @oppulence/auth SignUpForm component
 */

import { SignUpForm } from "@oppulence/auth";

export default function SignUpPage() {
  return (
    <SignUpForm
      providers={["google", "github"]}
      showSignInLink
      signInUrl="/sign-in"
      termsUrl="/terms"
      privacyUrl="/privacy"
      requireTerms
      showNameFields
      onSuccess={(user) => {
        console.log("Account created:", user.email);
      }}
      onError={(error) => {
        console.error("Sign-up failed:", error);
      }}
    />
  );
}
