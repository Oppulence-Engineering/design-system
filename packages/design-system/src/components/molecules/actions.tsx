"use client";

import type { ComponentProps } from "react";

import { Button, type ButtonProps } from "../atoms/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

export type ActionsProps = Omit<ComponentProps<"div">, "className">;

export const Actions = ({ children, ...props }: ActionsProps) => (
  <div className="flex items-center gap-1 text-muted-foreground" {...props}>
    {children}
  </div>
);

export type ActionProps = Omit<ButtonProps, "className"> & {
  tooltip?: string;
  label?: string;
};

export const Action = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-lg",
  ...props
}: ActionProps) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Button size={size} type="button" variant={variant} {...props} />
          }
        >
          {children}
          <span className="sr-only">{label || tooltip}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return button;
};
