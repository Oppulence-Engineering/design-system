"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertCircleIcon,
  InfoIcon,
  ShieldAlertIcon,
  TriangleAlertIcon,
} from "lucide-react";
import * as React from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../organisms/alert-dialog";

const confirmDialogMediaVariants = cva(
  "flex size-10 shrink-0 items-center justify-center rounded-md [&_svg]:size-5",
  {
    variants: {
      variant: {
        default: "bg-muted text-foreground",
        destructive: "bg-destructive/10 text-destructive",
        warning: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
        info: "bg-blue-500/10 text-blue-600 dark:text-blue-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const defaultIcons = {
  default: <AlertCircleIcon />,
  destructive: <ShieldAlertIcon />,
  warning: <TriangleAlertIcon />,
  info: <InfoIcon />,
};

type ConfirmDialogProps = {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: "default" | "destructive" | "warning" | "info";
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  loading?: boolean;
  icon?: React.ReactNode;
  trigger?: React.ReactNode;
};

function ConfirmDialog({
  open,
  onOpenChange,
  variant = "default",
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  loading = false,
  icon,
  trigger,
}: ConfirmDialogProps) {
  const buttonVariant = variant === "destructive" ? "destructive" : "default";

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      {trigger && <AlertDialogTrigger>{trigger}</AlertDialogTrigger>}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <div className={confirmDialogMediaVariants({ variant })}>
              {icon ?? defaultIcons[variant]}
            </div>
          </AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={(e) => {
              e.stopPropagation();
              onCancel?.();
            }}
          >
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={buttonVariant}
            loading={loading}
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export { ConfirmDialog };
export type { ConfirmDialogProps };
