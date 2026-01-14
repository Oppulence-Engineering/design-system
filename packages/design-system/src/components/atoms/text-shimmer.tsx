"use client";

import { motion } from "framer-motion";
import React, { useMemo, type JSX } from "react";
import { cn } from "../../../lib/utils";

type TextShimmerSize = "xs" | "sm" | "md" | "lg";

export type TextShimmerProps = {
  children: string;
  as?: React.ElementType;
  duration?: number;
  spread?: number;
  size?: TextShimmerSize;
  baseColor?: string;
  gradientColor?: string;
};

const sizeClasses: Record<TextShimmerSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
  lg: "text-lg",
};

function TextShimmerComponent({
  children,
  as: Component = "p",
  duration = 2,
  spread = 2,
  size = "sm",
  baseColor,
  gradientColor,
}: TextShimmerProps) {
  const MotionComponent = motion.create(
    Component as keyof JSX.IntrinsicElements,
  );

  const dynamicSpread = useMemo(() => {
    return children.length * spread;
  }, [children, spread]);

  const style = {
    "--spread": `${dynamicSpread}px`,
    backgroundImage:
      "var(--bg), linear-gradient(var(--base-color), var(--base-color))",
    ...(baseColor ? { "--base-color": baseColor } : null),
    ...(gradientColor ? { "--base-gradient-color": gradientColor } : null),
  } as React.CSSProperties;

  return (
    <MotionComponent
      className={cn(
        "relative inline-block bg-[length:250%_100%,auto] bg-clip-text",
        "text-transparent [--base-color:#a1a1aa] [--base-gradient-color:#000]",
        "[background-repeat:no-repeat,padding-box] [--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]",
        "dark:[--base-color:#71717a] dark:[--base-gradient-color:#ffffff] dark:[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--base-gradient-color),#0000_calc(50%+var(--spread)))]",
        sizeClasses[size],
      )}
      initial={{ backgroundPosition: "100% center" }}
      animate={{ backgroundPosition: "0% center" }}
      transition={{
        repeat: Number.POSITIVE_INFINITY,
        duration,
        ease: "linear",
      }}
      style={style}
    >
      {children}
    </MotionComponent>
  );
}

export const TextShimmer = React.memo(TextShimmerComponent);
