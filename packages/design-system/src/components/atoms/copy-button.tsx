"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import * as React from "react";

import { useCopyToClipboard } from "../../../hooks/use-copy-to-clipboard";
import { Button, type ButtonProps } from "./button";

type CopyButtonProps = Omit<ButtonProps, "onClick" | "children"> & {
  value: string;
  copiedDuration?: number;
};

const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      value,
      copiedDuration = 2000,
      variant = "ghost",
      size = "icon-sm",
      ...props
    },
    ref,
  ) => {
    const { copy, isCopied } = useCopyToClipboard({ timeout: copiedDuration });

    return (
      <Button
        ref={ref}
        data-slot="copy-button"
        variant={variant}
        size={size}
        onClick={() => copy(value)}
        aria-label={isCopied ? "Copied" : "Copy to clipboard"}
        {...props}
      >
        {isCopied ? (
          <CheckIcon className="size-3.5 text-emerald-500" />
        ) : (
          <CopyIcon className="size-3.5" />
        )}
      </Button>
    );
  },
);

CopyButton.displayName = "CopyButton";

export { CopyButton };
export type { CopyButtonProps };
