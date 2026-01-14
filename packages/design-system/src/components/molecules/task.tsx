"use client";

import { ChevronDownIcon, SearchIcon } from "lucide-react";
import type { ComponentProps } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

export type TaskItemFileProps = Omit<ComponentProps<"div">, "className">;

export const TaskItemFile = ({ children, ...props }: TaskItemFileProps) => (
  <div
    className="inline-flex items-center gap-1 rounded-md border bg-secondary px-1.5 py-0.5 text-foreground text-xs"
    {...props}
  >
    {children}
  </div>
);

export type TaskItemProps = Omit<ComponentProps<"div">, "className">;

export const TaskItem = ({ children, ...props }: TaskItemProps) => (
  <div className="text-muted-foreground text-sm" {...props}>
    {children}
  </div>
);

export type TaskProps = Omit<ComponentProps<typeof Collapsible>, "className">;

export const Task = ({ defaultOpen = true, ...props }: TaskProps) => (
  <Collapsible
    className="data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=open]:animate-in"
    defaultOpen={defaultOpen}
    {...props}
  />
);

export type TaskTriggerProps = Omit<
  ComponentProps<typeof CollapsibleTrigger>,
  "className"
> & {
  title: string;
};

export const TaskTrigger = ({ children, title, ...props }: TaskTriggerProps) => (
  <CollapsibleTrigger className="group" {...props}>
    {children ?? (
      <div className="flex cursor-pointer items-center gap-2 text-muted-foreground hover:text-foreground">
        <SearchIcon className="size-4" />
        <p className="text-sm">{title}</p>
        <ChevronDownIcon className="size-4 transition-transform group-data-[state=open]:rotate-180" />
      </div>
    )}
  </CollapsibleTrigger>
);

export type TaskContentProps = Omit<
  ComponentProps<typeof CollapsibleContent>,
  "className"
>;

export const TaskContent = ({ children, ...props }: TaskContentProps) => (
  <CollapsibleContent
    className="data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 text-popover-foreground outline-none data-[state=closed]:animate-out data-[state=open]:animate-in"
    {...props}
  >
    <div className="mt-4 space-y-2 border-muted border-l-2 pl-4">
      {children}
    </div>
  </CollapsibleContent>
);
