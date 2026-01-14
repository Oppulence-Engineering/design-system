"use client";

import { ArrowDownIcon } from "lucide-react";
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from "react";
import { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { cn } from "../../../lib/utils";
import { buttonVariants } from "../atoms/button";

export type ConversationProps = Omit<
  ComponentProps<typeof StickToBottom>,
  "className"
>;

export const Conversation = ({ ...props }: ConversationProps) => (
  <StickToBottom
    className="relative flex-1 overflow-y-auto [&_div::-webkit-scrollbar]:hidden [&_div]:[scrollbar-width:none] [&_div]:[-ms-overflow-style:none]"
    initial="smooth"
    resize="smooth"
    role="log"
    {...props}
  />
);

export type ConversationContentProps = Omit<
  ComponentProps<typeof StickToBottom.Content>,
  "className"
>;

export const ConversationContent = ({ ...props }: ConversationContentProps) => (
  <StickToBottom.Content className="p-4" {...props} />
);

export type ConversationEmptyStateProps = Omit<
  ComponentProps<"div">,
  "className"
> & {
  title?: string;
  description?: string;
  icon?: ReactNode;
};

export const ConversationEmptyState = ({
  title = "No messages yet",
  description = "Start a conversation to see messages here",
  icon,
  children,
  ...props
}: ConversationEmptyStateProps) => (
  <div
    className="flex size-full flex-col items-center justify-center gap-3 p-8 text-center"
    {...props}
  >
    {children ?? (
      <>
        {icon && <div className="text-muted-foreground">{icon}</div>}
        <div className="space-y-1">
          <h3 className="font-medium text-sm">{title}</h3>
          {description && (
            <p className="text-muted-foreground text-sm">{description}</p>
          )}
        </div>
      </>
    )}
  </div>
);

export type ConversationScrollButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
>;

export const ConversationScrollButton = ({
  ...props
}: ConversationScrollButtonProps) => {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  const handleScrollToBottom = useCallback(() => {
    scrollToBottom();
  }, [scrollToBottom]);

  return (
    !isAtBottom && (
      <button
        className={cn(
          buttonVariants({ variant: "outline", size: "icon" }),
          "absolute bottom-[10.5rem] left-1/2 -translate-x-1/2 rounded-full backdrop-filter backdrop-blur-lg dark:bg-[#1A1A1A]/80 bg-[#F6F6F3]/80",
        )}
        onClick={handleScrollToBottom}
        type="button"
        {...props}
      >
        <ArrowDownIcon className="size-4" />
      </button>
    )
  );
};
