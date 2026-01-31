"use client";

import { BookIcon, ChevronDownIcon } from "lucide-react";
import type { ComponentProps } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "../atoms/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./collapsible";

export type SourcesProps = Omit<
  ComponentProps<typeof Collapsible>,
  "className"
>;

export const Sources = ({ ...props }: SourcesProps) => (
  <Collapsible className="not-prose mb-4 text-primary text-xs" {...props} />
);

export type SourcesTriggerProps = Omit<
  ComponentProps<typeof CollapsibleTrigger>,
  "className"
> & {
  count: number;
};

export const SourcesTrigger = ({
  count,
  children,
  ...props
}: SourcesTriggerProps) => (
  <CollapsibleTrigger className="flex items-center gap-2" {...props}>
    {children ?? (
      <>
        <p className="font-medium">Used {count} sources</p>
        <ChevronDownIcon className="h-4 w-4" />
      </>
    )}
  </CollapsibleTrigger>
);

export type SourcesContentProps = Omit<
  ComponentProps<typeof CollapsibleContent>,
  "className"
>;

export const SourcesContent = ({ ...props }: SourcesContentProps) => (
  <CollapsibleContent
    className="mt-3 flex w-fit flex-col gap-2 data-[state=closed]:fade-out-0 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2 outline-none data-[state=closed]:animate-out data-[state=open]:animate-in"
    {...props}
  />
);

export type SourceProps = Omit<ComponentProps<"a">, "className"> & {
  domain?: string;
  showAvatar?: boolean;
};

function extractDomainFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const Source = ({
  href,
  title,
  domain,
  showAvatar = true,
  children,
  ...props
}: SourceProps) => {
  const sourceDomain = domain || (href ? extractDomainFromUrl(href) : "");

  return (
    <a
      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
      href={href}
      rel="noreferrer"
      target="_blank"
      {...props}
    >
      {children ?? (
        <>
          {showAvatar && sourceDomain ? (
            <Avatar size="sm">
              <AvatarImage
                src={`https://img.logo.dev/${sourceDomain}?token=pk_BQw8Qo2gQeGk5LGKGGMUxA&format=png&size=24&theme=light`}
                alt={`${sourceDomain} logo`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    `https://${sourceDomain}/favicon.ico`;
                }}
              />
              <AvatarFallback>
                {sourceDomain.split(".")[0]?.charAt(0).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
          ) : (
            <BookIcon className="h-4 w-4 text-muted-foreground" />
          )}
          <div className="flex-1 min-w-0">
            <span className="block font-medium text-sm truncate">{title}</span>
            {sourceDomain && (
              <span className="block text-xs text-muted-foreground truncate">
                {sourceDomain}
              </span>
            )}
          </div>
        </>
      )}
    </a>
  );
};
