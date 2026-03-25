import { cva, type VariantProps } from "class-variance-authority";

const statusIndicatorVariants = cva("inline-block shrink-0 rounded-full", {
  variants: {
    status: {
      online: "bg-emerald-500",
      offline: "bg-muted-foreground/40",
      busy: "bg-red-500",
      away: "bg-amber-500",
      error: "bg-destructive",
      success: "bg-emerald-500",
      warning: "bg-amber-500",
    },
    size: {
      sm: "size-1.5",
      default: "size-2.5",
      lg: "size-3.5",
    },
    pulse: {
      true: "animate-pulse",
      false: "",
    },
  },
  defaultVariants: {
    status: "offline",
    size: "default",
    pulse: false,
  },
});

type StatusIndicatorProps = Omit<React.ComponentProps<"span">, "className"> &
  VariantProps<typeof statusIndicatorVariants> & {
    label?: string;
  };

function StatusIndicator({
  status = "offline",
  size = "default",
  pulse = false,
  label,
  ...props
}: StatusIndicatorProps) {
  return (
    <span
      data-slot="status-indicator"
      data-status={status}
      role="status"
      aria-label={label ?? `Status: ${status}`}
      className={statusIndicatorVariants({ status, size, pulse })}
      {...props}
    />
  );
}

export { StatusIndicator, statusIndicatorVariants };
export type { StatusIndicatorProps };
