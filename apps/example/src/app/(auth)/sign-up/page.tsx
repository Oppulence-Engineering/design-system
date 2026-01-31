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
      showTerms
      showNameFields
      onSuccess={() => {
        console.log("Account created");
      }}
      onError={(error) => {
        console.error("Sign-up failed:", error);
      }}
    />
  );
}
