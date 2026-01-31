import { test, expect } from "@playwright/test";

test.describe("Sign In Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-in");
  });

  test("renders sign-in form with email and password fields", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("renders OAuth provider buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    const githubButton = page.getByRole("button", { name: /github/i });
    if (await githubButton.count()) {
      await expect(githubButton).toBeVisible();
    }
    const microsoftButton = page.getByRole("button", { name: /microsoft/i });
    if (await microsoftButton.count()) {
      await expect(microsoftButton).toBeVisible();
    }
  });

  test("shows forgot password link", async ({ page }) => {
    await expect(page.getByText(/forgot password/i)).toBeVisible();
  });

  test("shows sign up link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /sign up/i }).first()).toBeVisible();
  });

  test("navigates to sign-up page when clicking sign up link", async ({ page }) => {
    await page.getByRole("link", { name: /sign up/i }).first().click();
    await expect(page).toHaveURL("/sign-up");
  });

  test("email input has HTML5 validation", async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);

    // Verify email input has proper type for browser validation
    await expect(emailInput).toHaveAttribute("type", "email");
    if (await emailInput.isDisabled()) {
      await expect(page.getByRole("button", { name: /sign in/i })).toBeDisabled();
      return;
    }

    // Test that form doesn't navigate on invalid email (browser blocks submission)
    await emailInput.fill("invalid-email");
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Page should stay on sign-in since browser validation blocks submission
    await expect(page).toHaveURL("/sign-in");
  });

  test("shows validation error for empty password", async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    if (await emailInput.isDisabled()) {
      await expect(page.getByRole("button", { name: /sign in/i })).toBeDisabled();
      return;
    }
    await emailInput.fill("test@example.com");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/password is required/i)).toBeVisible();
  });

  test("has centered layout", async ({ page }) => {
    const container = page.locator(".min-h-screen.items-center.justify-center");
    await expect(container).toBeVisible();
  });
});

test.describe("Sign Up Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/sign-up");
  });

  test("renders sign-up form with required fields", async ({ page }) => {
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/^password$/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up|create account/i })).toBeVisible();
  });

  test("renders OAuth provider buttons", async ({ page }) => {
    await expect(page.getByRole("button", { name: /google/i })).toBeVisible();
    const githubButton = page.getByRole("button", { name: /github/i });
    if (await githubButton.count()) {
      await expect(githubButton).toBeVisible();
    }
  });

  test("shows sign in link", async ({ page }) => {
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
  });

  test("navigates to sign-in page when clicking sign in link", async ({ page }) => {
    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL("/sign-in");
  });

  test("shows terms checkbox when requireTerms is true", async ({ page }) => {
    // The sign-up form has requireTerms enabled
    await expect(page.getByRole("checkbox")).toBeVisible();
  });

  test("email input has HTML5 validation", async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);

    // Verify email input has proper type for browser validation
    await expect(emailInput).toHaveAttribute("type", "email");
    if (await emailInput.isDisabled()) {
      await expect(page.getByRole("button", { name: /sign up|create account/i })).toBeDisabled();
      return;
    }

    // Test that form doesn't navigate on invalid email (browser blocks submission)
    await emailInput.fill("invalid-email");
    await page.getByLabel(/^password$/i).fill("Password123!");
    await page.getByRole("button", { name: /sign up|create account/i }).click();

    // Page should stay on sign-up since browser validation blocks submission
    await expect(page).toHaveURL("/sign-up");
  });

  test("shows validation error for weak password", async ({ page }) => {
    const emailInput = page.getByLabel(/email/i);
    if (await emailInput.isDisabled()) {
      await expect(page.getByRole("button", { name: /sign up|create account/i })).toBeDisabled();
      return;
    }
    await emailInput.fill("test@example.com");
    await page.getByLabel(/^password$/i).fill("weak");
    await page.getByRole("button", { name: /sign up|create account/i }).click();
    
    // Password must be at least 12 characters
    await expect(page.getByText(/at least 12 characters/i)).toBeVisible();
  });

  test("has centered layout", async ({ page }) => {
    const container = page.locator(".min-h-screen.items-center.justify-center");
    await expect(container).toBeVisible();
  });
});

test.describe("Auth Navigation", () => {
  test("can navigate between sign-in and sign-up", async ({ page }) => {
    // Start at sign-in
    await page.goto("/sign-in");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();

    // Go to sign-up
    await page.getByRole("link", { name: /sign up/i }).first().click();
    await expect(page).toHaveURL("/sign-up");
    await expect(page.getByRole("button", { name: /sign up|create account/i })).toBeVisible();

    // Go back to sign-in
    await page.getByRole("link", { name: /sign in/i }).first().click();
    await expect(page).toHaveURL("/sign-in");
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });
});

test.describe("Auth Accessibility", () => {
  test("sign-in form has proper labels", async ({ page }) => {
    await page.goto("/sign-in");
    
    // Check that form fields have associated labels
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("sign-up form has proper labels", async ({ page }) => {
    await page.goto("/sign-up");
    
    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/^password$/i);
    
    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("buttons are properly accessible", async ({ page }) => {
    await page.goto("/sign-in");

    // Check that all interactive elements have proper roles
    const signInButton = page.getByRole("button", { name: /sign in/i });
    const emailInput = page.getByLabel(/email/i);
    if (await emailInput.isDisabled()) {
      await expect(signInButton).toBeDisabled();
      return;
    }
    await emailInput.fill("test@example.com");
    await page.getByLabel(/password/i).fill("password123");
    await expect(signInButton).toBeEnabled();
    await expect(signInButton).toHaveAttribute("type", "submit");

    // OAuth buttons should also be accessible
    const oauthButtons = page.getByRole("button", { name: /continue with/i });
    await expect(oauthButtons.first()).toBeEnabled();
  });
});
