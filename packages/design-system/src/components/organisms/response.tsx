"use client";

import { type ComponentProps, memo, type ReactNode } from "react";
import { Streamdown } from "streamdown";

import { Table } from "../molecules/table";

type ResponseProps = Omit<ComponentProps<typeof Streamdown>, "className">;

const CustomUnorderedList = ({
  children,
  ...props
}: {
  node?: unknown;
  children?: ReactNode;
}) => (
  <ul className="list-none m-0 p-0 leading-relaxed" {...props}>
    {children}
  </ul>
);

const CustomOrderedList = ({
  children,
  ...props
}: {
  node?: unknown;
  children?: ReactNode;
}) => (
  <ol
    className="list-none m-0 p-0 leading-relaxed"
    {...props}
    data-streamdown="unordered-list"
  >
    {children}
  </ol>
);

const CustomListItem = ({
  children,
  ...props
}: {
  node?: unknown;
  children?: ReactNode;
}) => (
  <li
    className="py-0 my-0 leading-relaxed"
    {...props}
    data-streamdown="list-item"
  >
    {children}
  </li>
);

const isExternalUrl = (href?: string) => {
  if (!href) return false;
  return /^https?:\/\//i.test(href);
};

export const Response = memo(
  ({ ...props }: ResponseProps) => (
    <Streamdown
      className="size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 space-y-4 [&>h3+ul]:!mt-2 [&>h3+ol]:!mt-2 [&>h4+ul]:!mt-2 [&>h4+ol]:!mt-2 [&>ul]:!my-0 [&>ul]:!-mt-4 [&>*+ul]:!mt-2 [&>ol]:!my-0 [&>ol]:!-mt-4 [&>*+ol]:!mt-2"
      components={{
        ul: (componentProps) => <CustomUnorderedList {...componentProps} />,
        ol: (componentProps) => <CustomOrderedList {...componentProps} />,
        li: (componentProps) => <CustomListItem {...componentProps} />,
        h2: ({ children, ...componentProps }) => (
          <h3
            className="font-medium text-sm text-primary tracking-wide"
            {...componentProps}
          >
            {children}
          </h3>
        ),
        h3: ({ children, ...componentProps }) => (
          <h3
            className="font-medium text-sm text-primary tracking-wide"
            {...componentProps}
          >
            {children}
          </h3>
        ),
        h4: ({ children, ...componentProps }) => (
          <h4
            className="font-medium text-sm text-primary tracking-wide"
            {...componentProps}
          >
            {children}
          </h4>
        ),
        p: ({ children, ...componentProps }) => (
          <p className="leading-relaxed" {...componentProps}>
            {children}
          </p>
        ),
        table: (componentProps) => (
          <div className="relative overflow-x-auto">
            <Table variant="bordered" {...componentProps} />
          </div>
        ),
        a: (componentProps) => {
          if (isExternalUrl(componentProps.href)) {
            return <a {...componentProps} rel="noreferrer" target="_blank" />;
          }

          return <a {...componentProps} />;
        },
      }}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children,
);

Response.displayName = "Response";
