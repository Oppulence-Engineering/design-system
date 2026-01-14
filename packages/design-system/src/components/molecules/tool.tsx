"use client";

import type { ToolUIPart } from "../../../lib/ai";
import { cn } from "../../../lib/utils";
import {
  CheckCircleIcon,
  ChevronDownIcon,
  CircleIcon,
  ClockIcon,
  WrenchIcon,
  XCircleIcon,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { badgeVariants } from "../atoms/badge";
import { CodeBlock } from "./code-block";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

export type ToolProps = Omit<ComponentProps<typeof Collapsible>, "className">;

export const Tool = ({ ...props }: ToolProps) => (
  <Collapsible className="not-prose mb-4 w-full rounded-md border" {...props} />
);

export type ToolHeaderProps = {
  type: ToolUIPart["type"];
  state: ToolUIPart["state"];
};

const getStatusBadge = (status: ToolUIPart["state"]) => {
  const labels = {
    "input-streaming": "Pending",
    "input-available": "Running",
    "output-available": "Completed",
    "output-error": "Error",
  } as const;

  const icons = {
    "input-streaming": <CircleIcon className="size-4" />,
    "input-available": <ClockIcon className="size-4 animate-pulse" />,
    "output-available": <CheckCircleIcon className="size-4 text-green-600" />,
    "output-error": <XCircleIcon className="size-4 text-red-600" />,
  } as const;

  return (
    <span className={cn(badgeVariants({ variant: "secondary" }), "gap-1.5 rounded-full text-xs")}>
      {icons[status]}
      {labels[status]}
    </span>
  );
};

export const ToolHeader = ({ type, state, ...props }: ToolHeaderProps) => (
  <CollapsibleTrigger
    className="flex w-full items-center justify-between gap-4 p-3"
    {...props}
  >
    <div className="flex items-center gap-2">
      <WrenchIcon className="size-4 text-muted-foreground" />
      <span className="font-medium text-sm">{type}</span>
      {getStatusBadge(state)}
    </div>
    <ChevronDownIcon className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
  </CollapsibleTrigger>
);

export type ToolContentProps = Omit<
  ComponentProps<typeof CollapsibleContent>,
  "className"
>;

export const ToolContent = ({ ...props }: ToolContentProps) => (
  <CollapsibleContent
    className="data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in"
    {...props}
  />
);

export type ToolInputProps = Omit<ComponentProps<"div">, "className"> & {
  input: ToolUIPart["input"];
};

export const ToolInput = ({ input, ...props }: ToolInputProps) => (
  <div className="space-y-2 overflow-hidden p-4" {...props}>
    <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
      Parameters
    </h4>
    <div className="rounded-md bg-muted/50">
      <CodeBlock code={JSON.stringify(input, null, 2)} language="json" />
    </div>
  </div>
);

export type ToolOutputProps = Omit<ComponentProps<"div">, "className"> & {
  output: ReactNode;
  errorText: ToolUIPart["errorText"];
};

export const ToolOutput = ({
  output,
  errorText,
  ...props
}: ToolOutputProps) => {
  if (!(output || errorText)) {
    return null;
  }

  return (
    <div className="space-y-2 p-4" {...props}>
      <h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
        {errorText ? "Error" : "Result"}
      </h4>
      <div
        className={cn(
          "overflow-x-auto rounded-md text-xs [&_table]:w-full",
          errorText
            ? "bg-destructive/10 text-destructive"
            : "bg-muted/50 text-foreground",
        )}
      >
        {errorText && <div>{errorText}</div>}
        {output && <div>{output}</div>}
      </div>
    </div>
  );
};
