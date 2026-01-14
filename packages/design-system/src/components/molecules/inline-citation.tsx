"use client";

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import {
  type ComponentProps,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { cn } from "../../../lib/utils";
import { badgeVariants } from "../atoms/badge";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "../organisms/carousel";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "./hover-card";

export type InlineCitationProps = Omit<
  ComponentProps<"span">,
  "className"
>;

export const InlineCitation = ({ ...props }: InlineCitationProps) => (
  <span className="group inline items-center gap-1" {...props} />
);

export type InlineCitationTextProps = Omit<
  ComponentProps<"span">,
  "className"
>;

export const InlineCitationText = ({ ...props }: InlineCitationTextProps) => (
  <span className="transition-colors group-hover:bg-accent" {...props} />
);

export type InlineCitationCardProps = ComponentProps<typeof HoverCard>;

export const InlineCitationCard = (props: InlineCitationCardProps) => (
  <HoverCard closeDelay={0} openDelay={0} {...props} />
);

export type InlineCitationCardTriggerProps =
  Omit<ComponentProps<"span">, "className"> & {
    sources: string[];
  };

export const InlineCitationCardTrigger = ({
  sources,
  ...props
}: InlineCitationCardTriggerProps) => (
  <HoverCardTrigger
    render={
      <span
        className={cn(
          badgeVariants({ variant: "secondary" }),
          "ml-1 rounded-full",
        )}
        {...props}
      />
    }
  >
    {sources.length ? (
      <>
        {new URL(sources[0]!).hostname} {sources.length > 1 && `+${sources.length - 1}`}
      </>
    ) : (
      "unknown"
    )}
  </HoverCardTrigger>
);

export type InlineCitationCardBodyProps = Omit<
  ComponentProps<"div">,
  "className"
>;

export const InlineCitationCardBody = ({
  children,
  ...props
}: InlineCitationCardBodyProps) => (
  <HoverCardContent>
    <div className="relative w-80 p-0" {...props}>
      {children}
    </div>
  </HoverCardContent>
);

const CarouselApiContext = createContext<CarouselApi | undefined>(undefined);

const useCarouselApi = () => {
  const context = useContext(CarouselApiContext);
  return context;
};

export type InlineCitationCarouselProps = ComponentProps<typeof Carousel>;

export const InlineCitationCarousel = ({
  children,
  ...props
}: InlineCitationCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();

  return (
    <CarouselApiContext.Provider value={api}>
      <div className="w-full">
        <Carousel setApi={setApi} {...props}>
          {children}
        </Carousel>
      </div>
    </CarouselApiContext.Provider>
  );
};

export type InlineCitationCarouselContentProps = ComponentProps<
  typeof CarouselContent
>;

export const InlineCitationCarouselContent = (
  props: InlineCitationCarouselContentProps,
) => <CarouselContent {...props} />;

export type InlineCitationCarouselItemProps = ComponentProps<
  typeof CarouselItem
>;

export const InlineCitationCarouselItem = ({
  children,
  ...props
}: InlineCitationCarouselItemProps) => (
  <CarouselItem {...props}>
    <div className="w-full space-y-2 p-4 pl-8">{children}</div>
  </CarouselItem>
);

export type InlineCitationCarouselHeaderProps = Omit<
  ComponentProps<"div">,
  "className"
>;

export const InlineCitationCarouselHeader = ({
  ...props
}: InlineCitationCarouselHeaderProps) => (
  <div
    className="flex items-center justify-between gap-2 rounded-t-md bg-secondary p-2"
    {...props}
  />
);

export type InlineCitationCarouselIndexProps = Omit<
  ComponentProps<"div">,
  "className"
>;

export const InlineCitationCarouselIndex = ({
  children,
  ...props
}: InlineCitationCarouselIndexProps) => {
  const api = useCarouselApi();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap() + 1);
    });
  }, [api]);

  return (
    <div
      className="flex flex-1 items-center justify-end px-3 py-1 text-muted-foreground text-xs"
      {...props}
    >
      {children ?? `${current}/${count}`}
    </div>
  );
};

export type InlineCitationCarouselPrevProps = Omit<
  ComponentProps<"button">,
  "className"
>;

export const InlineCitationCarouselPrev = ({
  ...props
}: InlineCitationCarouselPrevProps) => {
  const api = useCarouselApi();

  const handleClick = useCallback(() => {
    if (api) {
      api.scrollPrev();
    }
  }, [api]);

  return (
    <button
      aria-label="Previous"
      className="shrink-0"
      onClick={handleClick}
      type="button"
      {...props}
    >
      <ArrowLeftIcon className="size-4 text-muted-foreground" />
    </button>
  );
};

export type InlineCitationCarouselNextProps = Omit<
  ComponentProps<"button">,
  "className"
>;

export const InlineCitationCarouselNext = ({
  ...props
}: InlineCitationCarouselNextProps) => {
  const api = useCarouselApi();

  const handleClick = useCallback(() => {
    if (api) {
      api.scrollNext();
    }
  }, [api]);

  return (
    <button
      aria-label="Next"
      className="shrink-0"
      onClick={handleClick}
      type="button"
      {...props}
    >
      <ArrowRightIcon className="size-4 text-muted-foreground" />
    </button>
  );
};

export type InlineCitationSourceProps = Omit<
  ComponentProps<"div">,
  "className"
> & {
  title?: string;
  url?: string;
  description?: string;
};

export const InlineCitationSource = ({
  title,
  url,
  description,
  children,
  ...props
}: InlineCitationSourceProps) => (
  <div className="space-y-1" {...props}>
    {title && (
      <h4 className="truncate font-medium text-sm leading-tight">{title}</h4>
    )}
    {url && (
      <p className="truncate break-all text-muted-foreground text-xs">{url}</p>
    )}
    {description && (
      <p className="line-clamp-3 text-muted-foreground text-sm leading-relaxed">
        {description}
      </p>
    )}
    {children}
  </div>
);

export type InlineCitationQuoteProps = Omit<
  ComponentProps<"blockquote">,
  "className"
>;

export const InlineCitationQuote = ({
  children,
  ...props
}: InlineCitationQuoteProps) => (
  <blockquote
    className="border-muted border-l-2 pl-3 text-muted-foreground text-sm italic"
    {...props}
  >
    {children}
  </blockquote>
);
