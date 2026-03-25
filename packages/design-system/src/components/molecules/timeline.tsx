import { cva, type VariantProps } from "class-variance-authority";

function Timeline({ ...props }: Omit<React.ComponentProps<"ol">, "className">) {
  return <ol data-slot="timeline" className="flex flex-col" {...props} />;
}

function TimelineItem({
  ...props
}: Omit<React.ComponentProps<"li">, "className">) {
  return (
    <li
      data-slot="timeline-item"
      className="relative flex gap-3 pb-8 last:pb-0"
      {...props}
    />
  );
}

function TimelineConnector({
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  return (
    <div
      data-slot="timeline-connector"
      className="absolute left-[13px] top-7 bottom-0 w-px bg-border"
      {...props}
    />
  );
}

const timelineIconVariants = cva(
  "relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-background border-border text-muted-foreground",
        outline: "bg-background border-border text-foreground",
        success:
          "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-500",
        destructive: "bg-destructive/10 border-destructive/30 text-destructive",
        warning:
          "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-500",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function TimelineIcon({
  variant = "default",
  ...props
}: Omit<React.ComponentProps<"div">, "className"> &
  VariantProps<typeof timelineIconVariants>) {
  return (
    <div
      data-slot="timeline-icon"
      className={timelineIconVariants({ variant })}
      {...props}
    />
  );
}

function TimelineContent({
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  return (
    <div
      data-slot="timeline-content"
      className="flex flex-1 flex-col gap-0.5 pt-0.5"
      {...props}
    />
  );
}

function TimelineTitle({
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  return (
    <div
      data-slot="timeline-title"
      className="text-sm font-medium leading-tight"
      {...props}
    />
  );
}

function TimelineDescription({
  ...props
}: Omit<React.ComponentProps<"p">, "className">) {
  return (
    <p
      data-slot="timeline-description"
      className="text-sm text-muted-foreground"
      {...props}
    />
  );
}

function TimelineTimestamp({
  ...props
}: Omit<React.ComponentProps<"time">, "className">) {
  return (
    <time
      data-slot="timeline-timestamp"
      className="text-xs text-muted-foreground"
      {...props}
    />
  );
}

export {
  Timeline,
  TimelineConnector,
  TimelineContent,
  TimelineDescription,
  TimelineIcon,
  timelineIconVariants,
  TimelineItem,
  TimelineTimestamp,
  TimelineTitle,
};
