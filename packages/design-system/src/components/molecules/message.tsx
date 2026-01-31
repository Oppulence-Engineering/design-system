import type { ChatRole } from "../../../lib/ai";
import { cn } from "../../../lib/utils";
import type { ComponentProps, HTMLAttributes } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../atoms/avatar";

export type MessageProps = Omit<HTMLAttributes<HTMLDivElement>, "className"> & {
  from: ChatRole;
};

export const Message = ({ from, ...props }: MessageProps) => (
  <div
    className={cn(
      "group flex w-full items-end justify-end gap-2 py-4",
      from === "user" ? "is-user" : "is-assistant flex-row-reverse justify-end",
      "[&>div]:max-w-[80%]",
    )}
    {...props}
  />
);

export type MessageContentProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className"
>;

export const MessageContent = ({ children, ...props }: MessageContentProps) => (
  <div
    className={cn(
      "flex flex-col gap-2 overflow-hidden rounded-lg px-4 py-3 text-foreground text-sm",
      "group-[.is-user]:!bg-[#F7F7F7] dark:group-[.is-user]:!bg-[#131313] group-[.is-user]:!text-primary group-[.is-user]:!px-4 group-[.is-user]:!py-2 group-[.is-user]:max-w-fit group-[.is-user]:rounded-2xl group-[.is-user]:rounded-br-none",
      "group-[.is-assistant]:!bg-transparent group-[.is-assistant]:!shadow-none group-[.is-assistant]:!border-none group-[.is-assistant]:!px-0 group-[.is-assistant]:!py-0 group-[.is-assistant]:!rounded-none group-[.is-assistant]:!text-[#666666]",
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = Omit<
  ComponentProps<typeof Avatar>,
  "className"
> & {
  src: string;
  name?: string;
  size?: "xs" | "sm" | "default" | "lg" | "xl";
};

export const MessageAvatar = ({
  src,
  name,
  size = "xs",
  ...props
}: MessageAvatarProps) => (
  <Avatar size={size} {...props}>
    <AvatarImage alt="" src={src} />
    <AvatarFallback>{name?.slice(0, 1) || "M"}</AvatarFallback>
  </Avatar>
);
