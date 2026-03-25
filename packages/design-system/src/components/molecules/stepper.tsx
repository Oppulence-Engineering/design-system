"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { CheckIcon } from "lucide-react";
import * as React from "react";

const StepperContext = React.createContext<{
  activeStep: number;
  orientation: "horizontal" | "vertical";
}>({ activeStep: 0, orientation: "horizontal" });

type StepperProps = Omit<React.ComponentProps<"div">, "className"> & {
  activeStep: number;
  orientation?: "horizontal" | "vertical";
  onStepChange?: (step: number) => void;
};

function Stepper({
  activeStep,
  orientation = "horizontal",
  children,
  ...props
}: StepperProps) {
  return (
    <StepperContext.Provider value={{ activeStep, orientation }}>
      <div
        data-slot="stepper"
        data-orientation={orientation}
        className={
          orientation === "horizontal"
            ? "flex items-start gap-2"
            : "flex flex-col gap-2"
        }
        {...props}
      >
        {children}
      </div>
    </StepperContext.Provider>
  );
}

const StepperItemContext = React.createContext<{
  step: number;
  state: "active" | "completed" | "upcoming" | "disabled";
}>({ step: 0, state: "upcoming" });

type StepperItemProps = Omit<React.ComponentProps<"div">, "className"> & {
  step: number;
  completed?: boolean;
  disabled?: boolean;
};

function StepperItem({
  step,
  completed,
  disabled = false,
  children,
  ...props
}: StepperItemProps) {
  const { activeStep, orientation } = React.useContext(StepperContext);
  const state: "active" | "completed" | "upcoming" | "disabled" = disabled
    ? "disabled"
    : (completed ?? step < activeStep)
      ? "completed"
      : step === activeStep
        ? "active"
        : "upcoming";

  return (
    <StepperItemContext.Provider value={{ step, state }}>
      <div
        data-slot="stepper-item"
        data-state={state}
        data-orientation={orientation}
        className={
          orientation === "horizontal"
            ? "flex flex-1 items-center gap-2 last:[&>[data-slot=stepper-separator]]:hidden"
            : "flex flex-col gap-2 last:[&>[data-slot=stepper-separator]]:hidden"
        }
        {...props}
      >
        {children}
      </div>
    </StepperItemContext.Provider>
  );
}

function StepperTrigger({
  ...props
}: Omit<React.ComponentProps<"button">, "className">) {
  const { state } = React.useContext(StepperItemContext);
  return (
    <button
      data-slot="stepper-trigger"
      data-state={state}
      disabled={state === "disabled"}
      className="flex items-center gap-2 outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] rounded-lg disabled:pointer-events-none disabled:opacity-50"
      {...props}
    />
  );
}

const stepperIndicatorVariants = cva(
  "flex size-8 shrink-0 items-center justify-center rounded-full border text-sm font-medium transition-colors [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      state: {
        active: "bg-primary text-primary-foreground border-primary",
        completed: "bg-primary text-primary-foreground border-primary",
        upcoming: "bg-background text-muted-foreground border-border",
        disabled: "bg-muted text-muted-foreground/50 border-border/50",
      },
    },
    defaultVariants: {
      state: "upcoming",
    },
  },
);

function StepperIndicator({
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  const { step, state } = React.useContext(StepperItemContext);
  return (
    <div
      data-slot="stepper-indicator"
      data-state={state}
      className={stepperIndicatorVariants({ state })}
      {...props}
    >
      {state === "completed" ? <CheckIcon /> : (props.children ?? step + 1)}
    </div>
  );
}

function StepperTitle({
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  const { state } = React.useContext(StepperItemContext);
  return (
    <div
      data-slot="stepper-title"
      data-state={state}
      className="text-sm font-medium data-[state=upcoming]:text-muted-foreground data-[state=disabled]:text-muted-foreground/50"
      {...props}
    />
  );
}

function StepperDescription({
  ...props
}: Omit<React.ComponentProps<"p">, "className">) {
  return (
    <p
      data-slot="stepper-description"
      className="text-xs text-muted-foreground"
      {...props}
    />
  );
}

function StepperSeparator({
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  const { state } = React.useContext(StepperItemContext);
  const { orientation } = React.useContext(StepperContext);
  return (
    <div
      data-slot="stepper-separator"
      data-state={state}
      className={
        orientation === "horizontal"
          ? "h-px flex-1 bg-border data-[state=completed]:bg-primary"
          : "ml-4 w-px min-h-4 bg-border data-[state=completed]:bg-primary"
      }
      {...props}
    />
  );
}

function StepperContent({
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  const { state } = React.useContext(StepperItemContext);
  if (state !== "active") return null;
  return <div data-slot="stepper-content" className="pt-2" {...props} />;
}

export {
  Stepper,
  StepperContent,
  StepperDescription,
  StepperIndicator,
  stepperIndicatorVariants,
  StepperItem,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
};
export type { StepperProps, StepperItemProps };
