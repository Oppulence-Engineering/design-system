"use client";

import type { ButtonHTMLAttributes, ComponentProps } from "react";

import { cn } from "../../../lib/utils";
import { type ButtonProps, buttonVariants } from "../atoms/button";

export type SuggestionsProps = Omit<ComponentProps<"div">, "className">;

export const Suggestions = ({ children, ...props }: SuggestionsProps) => (
  <div className="w-full overflow-x-auto whitespace-nowrap" {...props}>
    <div className="flex w-max flex-nowrap items-center gap-2">{children}</div>
  </div>
);

export type SuggestionProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "onClick"
> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
};

export const Suggestion = ({
  suggestion,
  onClick,
  variant = "outline",
  size = "sm",
  children,
  ...props
}: SuggestionProps) => {
  const handleClick = () => {
    onClick?.(suggestion);
  };

  return (
    <button
      className={cn(
        buttonVariants({ variant, size }),
        "cursor-pointer rounded-full px-4",
      )}
      onClick={handleClick}
      type="button"
      {...props}
    >
      {children || suggestion}
    </button>
  );
};
