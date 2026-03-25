"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { AlertTriangleIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";

import { Button } from "../atoms/button";

type ErrorBoundaryProps = {
  children: React.ReactNode;
  fallback?:
    | React.ReactNode
    | ((error: Error, reset: () => void) => React.ReactNode);
  onError?: (error: Error, info: React.ErrorInfo) => void;
  onReset?: () => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
  error: Error | null;
};

class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.props.onError?.(error, info);
  }

  reset = () => {
    this.props.onReset?.();
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error, this.reset);
      }
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.reset}
          variant="section"
        />
      );
    }

    return this.props.children;
  }
}

const errorFallbackVariants = cva(
  "flex flex-col items-center justify-center gap-4 text-center",
  {
    variants: {
      variant: {
        page: "min-h-screen p-8",
        section: "rounded-lg border border-dashed p-12",
        inline: "py-6",
      },
    },
    defaultVariants: {
      variant: "section",
    },
  },
);

type ErrorFallbackProps = Omit<React.ComponentProps<"div">, "className"> &
  VariantProps<typeof errorFallbackVariants> & {
    error?: Error;
    onRetry?: () => void;
  };

function ErrorFallback({
  variant = "section",
  error,
  onRetry,
  children,
  ...props
}: ErrorFallbackProps) {
  return (
    <div
      data-slot="error-fallback"
      role="alert"
      className={errorFallbackVariants({ variant })}
      {...props}
    >
      {children ?? (
        <>
          <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangleIcon className="size-6 text-destructive" />
          </div>
          <ErrorFallbackTitle>Something went wrong</ErrorFallbackTitle>
          {error && (
            <ErrorFallbackDescription>{error.message}</ErrorFallbackDescription>
          )}
          {onRetry && (
            <ErrorFallbackActions>
              <Button
                variant="outline"
                onClick={onRetry}
                iconLeft={<RefreshCwIcon />}
              >
                Try again
              </Button>
            </ErrorFallbackActions>
          )}
        </>
      )}
    </div>
  );
}

function ErrorFallbackTitle({
  ...props
}: Omit<React.ComponentProps<"h3">, "className">) {
  return (
    <h3
      data-slot="error-fallback-title"
      className="text-lg font-semibold"
      {...props}
    />
  );
}

function ErrorFallbackDescription({
  ...props
}: Omit<React.ComponentProps<"p">, "className">) {
  return (
    <p
      data-slot="error-fallback-description"
      className="text-sm text-muted-foreground max-w-md text-balance"
      {...props}
    />
  );
}

function ErrorFallbackActions({
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  return (
    <div data-slot="error-fallback-actions" className="flex gap-2" {...props} />
  );
}

export {
  ErrorBoundary,
  ErrorFallback,
  ErrorFallbackActions,
  ErrorFallbackDescription,
  ErrorFallbackTitle,
  errorFallbackVariants,
};
export type { ErrorBoundaryProps, ErrorFallbackProps };
