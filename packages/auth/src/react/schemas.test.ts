/**
 * Tests for @oppulence/auth form schemas and validation utilities
 */

import { describe, it, expect } from "vitest";
import {
  emailSchema,
  passwordSchema,
  signInPasswordSchema,
  nameSchema,
  otpCodeSchema,
  signInSchema,
  signUpSchema,
  evaluatePasswordStrength,
  getPasswordStrengthMessage,
  getPasswordStrengthColor,
  isValidEmail,
  isValidPassword,
  getPasswordErrors,
} from "./schemas";

describe("emailSchema", () => {
  it("accepts valid emails", () => {
    expect(emailSchema.safeParse("test@example.com").success).toBe(true);
    expect(emailSchema.safeParse("user.name@domain.co.uk").success).toBe(true);
    expect(emailSchema.safeParse("user+tag@example.com").success).toBe(true);
  });

  it("normalizes email to lowercase", () => {
    const result = emailSchema.parse("TEST@EXAMPLE.COM");
    expect(result).toBe("test@example.com");
  });

  it("rejects empty email", () => {
    const result = emailSchema.safeParse("");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Email is required");
  });

  it("rejects invalid email formats", () => {
    expect(emailSchema.safeParse("invalid").success).toBe(false);
    expect(emailSchema.safeParse("@example.com").success).toBe(false);
    expect(emailSchema.safeParse("test@").success).toBe(false);
    expect(emailSchema.safeParse("test@.com").success).toBe(false);
  });

  it("rejects emails that are too long", () => {
    const longEmail = "a".repeat(250) + "@example.com";
    const result = emailSchema.safeParse(longEmail);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Email is too long");
  });
});

describe("passwordSchema (strong)", () => {
  it("accepts a strong password", () => {
    expect(passwordSchema.safeParse("MyP@ssw0rd123!").success).toBe(true);
    expect(passwordSchema.safeParse("Secure#Pass1234").success).toBe(true);
  });

  it("rejects passwords shorter than 12 characters", () => {
    const result = passwordSchema.safeParse("Short1!");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Password must be at least 12 characters"
    );
  });

  it("rejects passwords without uppercase", () => {
    const result = passwordSchema.safeParse("mypassword123!");
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((e) => e.message.includes("uppercase"))).toBe(
      true
    );
  });

  it("rejects passwords without lowercase", () => {
    const result = passwordSchema.safeParse("MYPASSWORD123!");
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((e) => e.message.includes("lowercase"))).toBe(
      true
    );
  });

  it("rejects passwords without numbers", () => {
    const result = passwordSchema.safeParse("MyPasswordHere!");
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((e) => e.message.includes("number"))).toBe(
      true
    );
  });

  it("rejects passwords without special characters", () => {
    const result = passwordSchema.safeParse("MyPassword1234");
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((e) => e.message.includes("special"))).toBe(
      true
    );
  });

  it("rejects passwords that are too long", () => {
    const longPassword = "A".repeat(129) + "a1!";
    const result = passwordSchema.safeParse(longPassword);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Password is too long");
  });
});

describe("signInPasswordSchema", () => {
  it("accepts any non-empty password", () => {
    expect(signInPasswordSchema.safeParse("simple").success).toBe(true);
    expect(signInPasswordSchema.safeParse("12345").success).toBe(true);
  });

  it("rejects empty password", () => {
    const result = signInPasswordSchema.safeParse("");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Password is required");
  });
});

describe("nameSchema", () => {
  it("accepts valid names", () => {
    expect(nameSchema.safeParse("John").success).toBe(true);
    expect(nameSchema.safeParse("Jane Doe").success).toBe(true);
    expect(nameSchema.safeParse("李明").success).toBe(true);
  });

  it("trims whitespace", () => {
    expect(nameSchema.parse("  John  ")).toBe("John");
  });

  it("rejects empty names", () => {
    const result = nameSchema.safeParse("");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Name is required");
  });

  it("rejects names that are too long", () => {
    const longName = "a".repeat(101);
    const result = nameSchema.safeParse(longName);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Name is too long");
  });
});

describe("otpCodeSchema", () => {
  it("accepts 6-digit codes", () => {
    expect(otpCodeSchema.safeParse("123456").success).toBe(true);
    expect(otpCodeSchema.safeParse("000000").success).toBe(true);
  });

  it("rejects codes with wrong length", () => {
    expect(otpCodeSchema.safeParse("12345").success).toBe(false);
    expect(otpCodeSchema.safeParse("1234567").success).toBe(false);
  });

  it("rejects non-numeric codes", () => {
    const result = otpCodeSchema.safeParse("12345a");
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Code must contain only numbers");
  });
});

describe("signInSchema", () => {
  it("validates complete sign-in data", () => {
    const result = signInSchema.safeParse({
      email: "test@example.com",
      password: "mypassword",
      rememberMe: true,
    });
    expect(result.success).toBe(true);
  });

  it("applies default for rememberMe", () => {
    const result = signInSchema.parse({
      email: "test@example.com",
      password: "mypassword",
    });
    expect(result.rememberMe).toBe(false);
  });

  it("normalizes email to lowercase", () => {
    const result = signInSchema.parse({
      email: "TEST@EXAMPLE.COM",
      password: "mypassword",
    });
    expect(result.email).toBe("test@example.com");
  });
});

describe("signUpSchema", () => {
  it("validates complete sign-up data", () => {
    const result = signUpSchema.safeParse({
      email: "test@example.com",
      password: "MyStr0ngP@ss!",
      confirmPassword: "MyStr0ngP@ss!",
      firstName: "John",
      lastName: "Doe",
      acceptTerms: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-matching passwords", () => {
    const result = signUpSchema.safeParse({
      email: "test@example.com",
      password: "MyStr0ngP@ss!",
      confirmPassword: "DifferentP@ss1",
      acceptTerms: true,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Passwords do not match");
  });

  it("rejects when terms not accepted", () => {
    const result = signUpSchema.safeParse({
      email: "test@example.com",
      password: "MyStr0ngP@ss!",
      confirmPassword: "MyStr0ngP@ss!",
      acceptTerms: false,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "You must accept the terms and conditions"
    );
  });
});

describe("evaluatePasswordStrength", () => {
  it("returns weak for very weak passwords", () => {
    const result = evaluatePasswordStrength("aaa");
    expect(result.strength).toBe("weak");
    expect(result.score).toBe(1);
  });

  it("returns fair for passwords with 2 criteria", () => {
    const result = evaluatePasswordStrength("abcdefghijklm"); // 12+ chars + lowercase
    expect(result.strength).toBe("fair");
    expect(result.score).toBe(2);
    expect(result.criteria.minLength).toBe(true);
    expect(result.criteria.hasLowercase).toBe(true);
  });

  it("returns good for passwords with 3 criteria", () => {
    const result = evaluatePasswordStrength("Abcdefghijklm"); // 12+ + upper + lower
    expect(result.strength).toBe("good");
    expect(result.score).toBe(3);
  });

  it("returns strong for passwords with all criteria", () => {
    const result = evaluatePasswordStrength("Abcdefghijk1!");
    expect(result.strength).toBe("strong");
    expect(result.score).toBe(5);
    expect(result.criteria.minLength).toBe(true);
    expect(result.criteria.hasUppercase).toBe(true);
    expect(result.criteria.hasLowercase).toBe(true);
    expect(result.criteria.hasNumber).toBe(true);
    expect(result.criteria.hasSpecial).toBe(true);
  });

  it("returns correct criteria breakdown", () => {
    const result = evaluatePasswordStrength("short");
    expect(result.criteria.minLength).toBe(false);
    expect(result.criteria.hasUppercase).toBe(false);
    expect(result.criteria.hasLowercase).toBe(true);
    expect(result.criteria.hasNumber).toBe(false);
    expect(result.criteria.hasSpecial).toBe(false);
  });
});

describe("getPasswordStrengthMessage", () => {
  it("returns appropriate messages", () => {
    expect(getPasswordStrengthMessage("weak")).toBe("Weak - add more character types");
    expect(getPasswordStrengthMessage("fair")).toBe(
      "Fair - consider adding more variety"
    );
    expect(getPasswordStrengthMessage("good")).toBe("Good - almost there");
    expect(getPasswordStrengthMessage("strong")).toBe("Strong - excellent password");
  });
});

describe("getPasswordStrengthColor", () => {
  it("returns appropriate colors", () => {
    expect(getPasswordStrengthColor("weak")).toBe("destructive");
    expect(getPasswordStrengthColor("fair")).toBe("warning");
    expect(getPasswordStrengthColor("good")).toBe("secondary");
    expect(getPasswordStrengthColor("strong")).toBe("success");
  });
});

describe("isValidEmail", () => {
  it("returns true for valid emails", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
  });

  it("returns false for invalid emails", () => {
    expect(isValidEmail("invalid")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("isValidPassword", () => {
  it("returns true for strong passwords", () => {
    expect(isValidPassword("MyStr0ngP@ss!")).toBe(true);
  });

  it("returns false for weak passwords", () => {
    expect(isValidPassword("weak")).toBe(false);
    expect(isValidPassword("12345678901")).toBe(false);
  });
});

describe("getPasswordErrors", () => {
  it("returns empty array for valid password", () => {
    expect(getPasswordErrors("MyStr0ngP@ss!")).toEqual([]);
  });

  it("returns all applicable errors", () => {
    const errors = getPasswordErrors("short");
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("12 characters"))).toBe(true);
    expect(errors.some((e) => e.includes("uppercase"))).toBe(true);
  });
});
