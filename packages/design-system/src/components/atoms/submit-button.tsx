import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./button";

type SubmitButtonProps = {
  children: ReactNode;
  isSubmitting: boolean;
  disabled?: boolean;
} & Omit<ButtonProps, "loading">;

export function SubmitButton({
  children,
  isSubmitting,
  disabled,
  ...props
}: SubmitButtonProps) {
  return (
    <Button
      loading={isSubmitting}
      disabled={isSubmitting || disabled}
      {...props}
    >
      {children}
    </Button>
  );
}
