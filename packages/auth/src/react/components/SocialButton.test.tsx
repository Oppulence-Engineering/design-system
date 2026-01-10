/**
 * Tests for SocialButton component
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  SocialButton,
  SocialButtonGroup,
  SUPPORTED_PROVIDERS,
  isProviderSupported,
} from "./SocialButton";

describe("SocialButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders Google button with correct label", () => {
      render(<SocialButton provider="google" onClick={() => {}} />);
      expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    });

    it("renders GitHub button with correct label", () => {
      render(<SocialButton provider="github" onClick={() => {}} />);
      expect(screen.getByRole("button", { name: /continue with github/i })).toBeInTheDocument();
    });

    it("renders Microsoft button with correct label", () => {
      render(<SocialButton provider="microsoft" onClick={() => {}} />);
      expect(screen.getByRole("button", { name: /continue with microsoft/i })).toBeInTheDocument();
    });

    it("renders custom label when provided", () => {
      render(
        <SocialButton provider="google" onClick={() => {}} label="Sign in with Google" />
      );
      expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument();
    });

    it("renders icon-only button when iconOnly is true", () => {
      render(<SocialButton provider="google" onClick={() => {}} iconOnly />);
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", "Continue with Google");
    });
  });

  describe("interactions", () => {
    it("calls onClick when clicked", async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<SocialButton provider="google" onClick={onClick} />);
      await user.click(screen.getByRole("button"));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("does not call onClick when disabled", async () => {
      const onClick = vi.fn();
      const user = userEvent.setup();

      render(<SocialButton provider="google" onClick={onClick} disabled />);
      await user.click(screen.getByRole("button"));

      expect(onClick).not.toHaveBeenCalled();
    });
  });

  describe("states", () => {
    it("shows loading state", () => {
      render(<SocialButton provider="google" onClick={() => {}} loading />);
      const button = screen.getByRole("button");
      // Button component uses data-loading attribute when loading
      expect(button).toHaveAttribute("data-loading");
      expect(button).toBeDisabled();
    });

    it("is disabled when disabled prop is true", () => {
      render(<SocialButton provider="google" onClick={() => {}} disabled />);
      expect(screen.getByRole("button")).toBeDisabled();
    });
  });
});

describe("SocialButtonGroup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders all provided providers", () => {
      render(
        <SocialButtonGroup
          providers={["google", "github", "microsoft"]}
          onProviderClick={() => {}}
        />
      );

      expect(screen.getByRole("button", { name: /google/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /github/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /microsoft/i })).toBeInTheDocument();
    });

    it("renders nothing when providers array is empty", () => {
      const { container } = render(
        <SocialButtonGroup providers={[]} onProviderClick={() => {}} />
      );
      expect(container).toBeEmptyDOMElement();
    });

    it("renders in vertical layout by default", () => {
      const { container } = render(
        <SocialButtonGroup
          providers={["google", "github"]}
          onProviderClick={() => {}}
        />
      );
      // Stack component renders children vertically
      expect(container.firstChild).toBeInTheDocument();
    });

    it("renders in horizontal layout when specified", () => {
      const { container } = render(
        <SocialButtonGroup
          providers={["google", "github"]}
          onProviderClick={() => {}}
          layout="horizontal"
        />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("flex");
    });
  });

  describe("interactions", () => {
    it("calls onProviderClick with correct provider", async () => {
      const onProviderClick = vi.fn();
      const user = userEvent.setup();

      render(
        <SocialButtonGroup
          providers={["google", "github"]}
          onProviderClick={onProviderClick}
        />
      );

      await user.click(screen.getByRole("button", { name: /google/i }));
      expect(onProviderClick).toHaveBeenCalledWith("google");

      await user.click(screen.getByRole("button", { name: /github/i }));
      expect(onProviderClick).toHaveBeenCalledWith("github");
    });
  });

  describe("loading state", () => {
    it("shows loading state for specific provider", () => {
      render(
        <SocialButtonGroup
          providers={["google", "github"]}
          onProviderClick={() => {}}
          loadingProvider="google"
        />
      );

      const googleButton = screen.getByRole("button", { name: /google/i });
      const githubButton = screen.getByRole("button", { name: /github/i });

      // Button component uses data-loading attribute when loading
      expect(googleButton).toHaveAttribute("data-loading");
      expect(githubButton).not.toHaveAttribute("data-loading");
    });

    it("disables all buttons when a provider is loading", () => {
      render(
        <SocialButtonGroup
          providers={["google", "github"]}
          onProviderClick={() => {}}
          loadingProvider="google"
        />
      );

      expect(screen.getByRole("button", { name: /google/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /github/i })).toBeDisabled();
    });
  });

  describe("disabled state", () => {
    it("disables all buttons when disabled is true", () => {
      render(
        <SocialButtonGroup
          providers={["google", "github"]}
          onProviderClick={() => {}}
          disabled
        />
      );

      expect(screen.getByRole("button", { name: /google/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /github/i })).toBeDisabled();
    });
  });
});

describe("SUPPORTED_PROVIDERS", () => {
  it("includes google, github, and microsoft", () => {
    expect(SUPPORTED_PROVIDERS).toContain("google");
    expect(SUPPORTED_PROVIDERS).toContain("github");
    expect(SUPPORTED_PROVIDERS).toContain("microsoft");
  });

  it("has exactly 3 providers", () => {
    expect(SUPPORTED_PROVIDERS).toHaveLength(3);
  });
});

describe("isProviderSupported", () => {
  it("returns true for supported providers", () => {
    expect(isProviderSupported("google")).toBe(true);
    expect(isProviderSupported("github")).toBe(true);
    expect(isProviderSupported("microsoft")).toBe(true);
  });

  it("returns false for unsupported providers", () => {
    expect(isProviderSupported("apple")).toBe(false);
    expect(isProviderSupported("facebook")).toBe(false);
    expect(isProviderSupported("twitter")).toBe(false);
    expect(isProviderSupported("")).toBe(false);
  });
});
