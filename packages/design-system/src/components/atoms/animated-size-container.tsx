"use client";

import { motion } from "framer-motion";
import {
  type ComponentPropsWithoutRef,
  type PropsWithChildren,
  type RefObject,
  forwardRef,
  useRef,
} from "react";

import { useResizeObserver } from "../../../hooks/use-resize-observer";
import { cn } from "../../../lib/utils";

type AnimatedSizeContainerProps = PropsWithChildren<{
  width?: boolean;
  height?: boolean;
}> &
  Omit<ComponentPropsWithoutRef<typeof motion.div>, "animate" | "children" | "className">;

/**
 * A container with animated width and height (each optional) based on children dimensions.
 */
const AnimatedSizeContainer = forwardRef<
  HTMLDivElement,
  AnimatedSizeContainerProps
>(({ width = false, height = false, transition, children, ...rest }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverEntry = useResizeObserver(containerRef as RefObject<Element>);

  return (
    <motion.div
      ref={ref}
      className="overflow-hidden"
      animate={{
        width: width
          ? (resizeObserverEntry?.contentRect?.width ?? "auto")
          : "auto",
        height: height
          ? (resizeObserverEntry?.contentRect?.height ?? "auto")
          : "auto",
      }}
      transition={transition ?? { type: "spring", duration: 0.3 }}
      {...rest}
    >
      <div
        ref={containerRef}
        className={cn(height && "h-max", width && "w-max")}
      >
        {children}
      </div>
    </motion.div>
  );
});

AnimatedSizeContainer.displayName = "AnimatedSizeContainer";

export { AnimatedSizeContainer };
export type { AnimatedSizeContainerProps };
