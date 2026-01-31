/**
 * Zod validation schemas for @oppulence/auth forms
 *
 * These schemas are used with react-hook-form for type-safe form validation.
 * All schemas export their inferred types for use in components.
 */

import { z } from "zod";

// ============================================================================
// Field Validators
// ============================================================================

/**
 * Email validation with common checks.
 */
export const emailSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address")
  .max(254, "Email is too long")
  .toLowerCase()
  .trim();

/**
 * Strong password validation.
 * Requirements: 12+ chars, uppercase, lowercase, number, special character.
 */
export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password is too long")
  .refine((val) => /[A-Z]/.test(val), {
    message: "Password must contain at least one uppercase letter",
  })
  .refine((val) => /[a-z]/.test(val), {
    message: "Password must contain at least one lowercase letter",
  })
  .refine((val) => /[0-9]/.test(val), {
    message: "Password must contain at least one number",
  })
  .refine((val) => /[^A-Za-z0-9]/.test(val), {
    message: "Password must contain at least one special character",
  });

/**
 * Less strict password for sign-in (don't reveal password rules on login).
 */
export const signInPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .max(128, "Password is too long");

/**
 * Name validation.
 */
export const nameSchema = z
  .string()
  .min(1, "Name is required")
  .max(100, "Name is too long")
  .trim();

/**
 * Optional name validation.
 */
export const optionalNameSchema = z
  .string()
  .max(100, "Name is too long")
  .trim()
  .optional()
  .transform((val) => (val === "" ? undefined : val));

/**
 * OTP code validation (6 digits).
 */
export const otpCodeSchema = z
  .string()
  .length(6, "Code must be 6 digits")
  .regex(/^\d+$/, "Code must contain only numbers");

/**
 * Password reset token validation.
 */
export const resetTokenSchema = z
  .string()
  .min(1, "Reset token is required");

// ============================================================================
// Form Schemas
// ============================================================================

/**
 * Sign-in form schema.
 */
export const signInSchema = z.object({
  email: emailSchema,
  password: signInPasswordSchema,
  rememberMe: z.boolean().default(false),
});

export type SignInFormData = z.infer<typeof signInSchema>;

/**
 * Sign-up form schema.
 */
export const signUpSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
    firstName: optionalNameSchema,
    lastName: optionalNameSchema,
    acceptTerms: z.boolean().refine((val) => val === true, {
      message: "You must accept the terms and conditions",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type SignUpFormData = z.infer<typeof signUpSchema>;

/**
 * Forgot password form schema.
 */
export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * Reset password form schema.
 */
export const resetPasswordSchema = z
  .object({
    token: resetTokenSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

/**
 * Email verification form schema.
 */
export const verifyEmailSchema = z.object({
  code: otpCodeSchema,
});

export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

/**
 * MFA enrollment form schema.
 */
export const mfaEnrollSchema = z.object({
  code: otpCodeSchema,
});

export type MFAEnrollFormData = z.infer<typeof mfaEnrollSchema>;

/**
 * MFA challenge form schema.
 */
export const mfaChallengeSchema = z.object({
  code: otpCodeSchema,
  rememberDevice: z.boolean().default(false),
});

export type MFAChallengeFormData = z.infer<typeof mfaChallengeSchema>;

/**
 * Magic link form schema.
 */
export const magicLinkSchema = z.object({
  email: emailSchema,
});

export type MagicLinkFormData = z.infer<typeof magicLinkSchema>;

// ============================================================================
// Password Strength Utilities
// ============================================================================

/**
 * Password strength levels.
 */
export type PasswordStrength = "weak" | "fair" | "good" | "strong";

/**
 * Password strength criteria result.
 */
export interface PasswordStrengthResult {
  strength: PasswordStrength;
  score: number; // 0-4
  criteria: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
  };
}

/**
 * Evaluates password strength.
 *
 * @param password - Password to evaluate
 * @returns Strength result with score and criteria breakdown
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const criteria = {
    minLength: password.length >= 12,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(criteria).filter(Boolean).length;

  let strength: PasswordStrength;
  if (score <= 1) {
    strength = "weak";
  } else if (score <= 2) {
    strength = "fair";
  } else if (score <= 3) {
    strength = "good";
  } else {
    strength = "strong";
  }

  return {
    strength,
    score,
    criteria,
  };
}

/**
 * Gets a human-readable message for password strength.
 */
export function getPasswordStrengthMessage(strength: PasswordStrength): string {
  switch (strength) {
    case "weak":
      return "Weak - add more character types";
    case "fair":
      return "Fair - consider adding more variety";
    case "good":
      return "Good - almost there";
    case "strong":
      return "Strong - excellent password";
  }
}

/**
 * Gets the color for password strength indicator.
 */
export function getPasswordStrengthColor(strength: PasswordStrength): string {
  switch (strength) {
    case "weak":
      return "destructive";
    case "fair":
      return "warning";
    case "good":
      return "secondary";
    case "strong":
      return "success";
  }
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validates email format without throwing.
 */
export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}

/**
 * Validates password strength without throwing.
 */
export function isValidPassword(password: string): boolean {
  return passwordSchema.safeParse(password).success;
}

/**
 * Gets password validation errors as an array.
 */
export function getPasswordErrors(password: string): string[] {
  const result = passwordSchema.safeParse(password);
  if (result.success) return [];
  return result.error.issues.map((e) => e.message);
}
