import { cva, type VariantProps } from "class-variance-authority";

import { Spinner } from "../atoms/spinner";

const loadingOverlayVariants = cva(
  "flex items-center justify-center gap-2 bg-background/80",
  {
    variants: {
      variant: {
        fullscreen: "fixed inset-0 z-50",
        section: "absolute inset-0 z-10",
        inline: "relative w-full py-12",
      },
      blur: {
        true: "backdrop-blur-sm",
        false: "",
      },
    },
    defaultVariants: {
      variant: "section",
      blur: false,
    },
  },
);

type LoadingOverlayProps = Omit<React.ComponentProps<"div">, "className"> &
  VariantProps<typeof loadingOverlayVariants> & {
    label?: string;
    showLabel?: boolean;
  };

function LoadingOverlay({
  variant = "section",
  blur = false,
  label = "Loading...",
  showLabel = true,
  ...props
}: LoadingOverlayProps) {
  return (
    <div
      data-slot="loading-overlay"
      role="status"
      aria-label={label}
      className={loadingOverlayVariants({ variant, blur })}
      {...props}
    >
      <Spinner />
      {showLabel && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
}

export { LoadingOverlay, loadingOverlayVariants };
export type { LoadingOverlayProps };
