/**
 * Tests for AuthFormBase component and utilities
 */

import { describe, it, expect, vi } from "vitest";
import * as React from "react";
import { render, screen } from "@testing-library/react";
import {
  AuthFormBase,
  AuthDivider,
  AuthFooterLink,
  AuthBranding,
} from "./AuthFormBase";

describe("AuthFormBase", () => {
  describe("page mode", () => {
    it("renders children in a Card by default", () => {
      render(
        <AuthFormBase>
          <div data-testid="child">Content</div>
        </AuthFormBase>,
      );

      expect(screen.getByTestId("child")).toBeInTheDocument();
    });

    it("renders title and description", () => {
      render(
        <AuthFormBase title="Sign In" description="Welcome back!">
          <div>Content</div>
        </AuthFormBase>,
      );

      expect(screen.getByText("Sign In")).toBeInTheDocument();
      expect(screen.getByText("Welcome back!")).toBeInTheDocument();
    });

    it("renders custom header instead of title/description", () => {
      render(
        <AuthFormBase
          title="Should Not Show"
          header={<div data-testid="custom-header">Custom Header</div>}
        >
          <div>Content</div>
        </AuthFormBase>,
      );

      expect(screen.getByTestId("custom-header")).toBeInTheDocument();
      expect(screen.queryByText("Should Not Show")).not.toBeInTheDocument();
    });

    it("renders footer content", () => {
      render(
        <AuthFormBase footer={<div data-testid="footer">Footer Content</div>}>
          <div>Content</div>
        </AuthFormBase>,
      );

      expect(screen.getByTestId("footer")).toBeInTheDocument();
    });

    it("applies correct width class for sm size", () => {
      const { container } = render(
        <AuthFormBase maxWidth="sm">
          <div>Content</div>
        </AuthFormBase>,
      );

      expect(container.firstChild).toHaveClass("max-w-sm");
    });

    it("applies correct width class for lg size", () => {
      const { container } = render(
        <AuthFormBase maxWidth="lg">
          <div>Content</div>
        </AuthFormBase>,
      );

      expect(container.firstChild).toHaveClass("max-w-lg");
    });

    it("applies md width by default", () => {
      const { container } = render(
        <AuthFormBase>
          <div>Content</div>
        </AuthFormBase>,
      );

      expect(container.firstChild).toHaveClass("max-w-md");
    });
  });

  describe("modal mode", () => {
    it("renders in Dialog when mode is modal and open", () => {
      render(
        <AuthFormBase mode="modal" open={true} title="Modal Title">
          <div data-testid="modal-content">Modal Content</div>
        </AuthFormBase>,
      );

      // Dialog should be in the document when open
      expect(screen.getByText("Modal Title")).toBeInTheDocument();
      expect(screen.getByTestId("modal-content")).toBeInTheDocument();
    });

    it("does not render content when modal is closed", () => {
      render(
        <AuthFormBase mode="modal" open={false}>
          <div data-testid="modal-content">Modal Content</div>
        </AuthFormBase>,
      );

      expect(screen.queryByTestId("modal-content")).not.toBeInTheDocument();
    });
  });
});

describe("AuthDivider", () => {
  it("renders default 'or' text", () => {
    render(<AuthDivider />);
    expect(screen.getByText("or")).toBeInTheDocument();
  });

  it("renders custom text", () => {
    render(<AuthDivider text="or continue with" />);
    expect(screen.getByText("or continue with")).toBeInTheDocument();
  });

  it("renders with border divider", () => {
    const { container } = render(<AuthDivider />);
    const borderElement = container.querySelector(".border-t");
    expect(borderElement).toBeInTheDocument();
  });
});

describe("AuthFooterLink", () => {
  it("renders text and link with href", () => {
    render(
      <AuthFooterLink
        text="Don't have an account?"
        linkText="Sign up"
        href="/sign-up"
      />,
    );

    expect(screen.getByText("Don't have an account?")).toBeInTheDocument();
    const link = screen.getByText("Sign up");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/sign-up");
  });

  it("renders button when onClick is provided instead of href", () => {
    const onClick = vi.fn();
    render(
      <AuthFooterLink
        text="Already have an account?"
        linkText="Sign in"
        onClick={onClick}
      />,
    );

    const button = screen.getByRole("button", { name: /sign in/i });
    expect(button).toBeInTheDocument();
  });
});

describe("AuthBranding", () => {
  it("renders logo when provided", () => {
    render(<AuthBranding logo={<div data-testid="logo">Logo</div>} />);

    expect(screen.getByTestId("logo")).toBeInTheDocument();
  });

  it("renders title", () => {
    render(<AuthBranding title="Welcome" />);
    expect(screen.getByText("Welcome")).toBeInTheDocument();
  });

  it("renders description", () => {
    render(<AuthBranding description="Please sign in to continue" />);
    expect(screen.getByText("Please sign in to continue")).toBeInTheDocument();
  });

  it("renders all elements together", () => {
    render(
      <AuthBranding
        logo={<div data-testid="logo">Logo</div>}
        title="Welcome"
        description="Sign in to continue"
      />,
    );

    expect(screen.getByTestId("logo")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Sign in to continue")).toBeInTheDocument();
  });

  it("renders nothing when no props provided", () => {
    const { container } = render(<AuthBranding />);
    // Should render empty wrapper
    expect(container.firstChild?.childNodes.length).toBe(0);
  });
});
