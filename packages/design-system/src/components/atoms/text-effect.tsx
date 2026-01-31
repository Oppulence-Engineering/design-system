"use client";

import { AnimatePresence, motion } from "framer-motion";
import type {
  TargetAndTransition,
  Transition,
  Variant,
  Variants,
} from "framer-motion";
import React from "react";

export type PresetType = "blur" | "fade-in-blur" | "scale" | "fade" | "slide";

export type PerType = "word" | "char" | "line";

export type TextEffectProps = {
  children: string;
  per?: PerType;
  as?: keyof React.JSX.IntrinsicElements;
  variants?: {
    container?: Variants;
    item?: Variants;
  };
  preset?: PresetType;
  delay?: number;
  speedReveal?: number;
  speedSegment?: number;
  trigger?: boolean;
  onAnimationComplete?: () => void;
  onAnimationStart?: () => void;
  containerTransition?: Transition;
  segmentTransition?: Transition;
  style?: React.CSSProperties;
};

const defaultStaggerTimes: Record<PerType, number> = {
  char: 0.03,
  word: 0.05,
  line: 0.1,
};

const defaultContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
  exit: {
    transition: { staggerChildren: 0.05, staggerDirection: -1 },
  },
};

const defaultItemVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
  },
  exit: { opacity: 0 },
};

const presetVariants: Record<
  PresetType,
  { container: Variants; item: Variants }
> = {
  blur: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, filter: "blur(12px)" },
      visible: { opacity: 1, filter: "blur(0px)" },
      exit: { opacity: 0, filter: "blur(12px)" },
    },
  },
  "fade-in-blur": {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20, filter: "blur(12px)" },
      visible: { opacity: 1, y: 0, filter: "blur(0px)" },
      exit: { opacity: 0, y: 20, filter: "blur(12px)" },
    },
  },
  scale: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, scale: 0 },
      visible: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0 },
    },
  },
  fade: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0 },
      visible: { opacity: 1 },
      exit: { opacity: 0 },
    },
  },
  slide: {
    container: defaultContainerVariants,
    item: {
      hidden: { opacity: 0, y: 20 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 20 },
    },
  },
};

const AnimationComponent: React.FC<{
  segment: string;
  variants: Variants;
  per: "line" | "word" | "char";
}> = React.memo(({ segment, variants, per }) => {
  return per === "line" ? (
    <motion.span variants={variants} className="block">
      {segment}
    </motion.span>
  ) : per === "word" ? (
    <motion.span
      aria-hidden="true"
      variants={variants}
      className="inline-block whitespace-pre"
    >
      {segment}
    </motion.span>
  ) : (
    <motion.span className="inline-block whitespace-pre">
      {segment.split("").map((char, charIndex) => (
        <motion.span
          key={`char-${charIndex.toString()}`}
          aria-hidden="true"
          variants={variants}
          className="inline-block whitespace-pre"
        >
          {char}
        </motion.span>
      ))}
    </motion.span>
  );
});

AnimationComponent.displayName = "AnimationComponent";

const splitText = (text: string, per: PerType) => {
  if (per === "line") return text.split("\n");
  return text.split(/(\s+)/);
};

const hasTransition = (
  variant?: Variant,
): variant is TargetAndTransition & { transition?: Transition } => {
  if (!variant) return false;
  return typeof variant === "object" && "transition" in variant;
};

const createVariantsWithTransition = (
  baseVariants: Variants,
  transition?: Transition & { exit?: Transition },
): Variants => {
  if (!transition) return baseVariants;

  const { exit: _, ...mainTransition } = transition;

  return {
    ...baseVariants,
    visible: {
      ...baseVariants.visible,
      transition: {
        ...(hasTransition(baseVariants.visible)
          ? baseVariants.visible.transition
          : {}),
        ...mainTransition,
      },
    },
    exit: {
      ...baseVariants.exit,
      transition: {
        ...(hasTransition(baseVariants.exit)
          ? baseVariants.exit.transition
          : {}),
        ...mainTransition,
        staggerDirection: -1,
      },
    },
  };
};

export const TextEffect = ({
  children,
  per = "word",
  as = "p",
  variants,
  preset,
  delay = 0,
  speedReveal,
  speedSegment,
  trigger = true,
  onAnimationComplete,
  onAnimationStart,
  containerTransition,
  segmentTransition,
  style,
}: TextEffectProps) => {
  const Component = motion.create(as);
  const segments = splitText(children, per);

  const baseContainer = preset
    ? presetVariants[preset].container
    : (variants?.container ?? defaultContainerVariants);
  const baseItem = preset
    ? presetVariants[preset].item
    : (variants?.item ?? defaultItemVariants);

  const staggerChildren = speedSegment ?? defaultStaggerTimes[per];

  const containerVariants = createVariantsWithTransition(baseContainer, {
    ...containerTransition,
    staggerChildren,
    delayChildren: delay,
  });

  const itemVariants = createVariantsWithTransition(baseItem, {
    ...segmentTransition,
    duration: speedReveal,
  });

  return (
    <AnimatePresence>
      {trigger && (
        <Component
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          onAnimationComplete={onAnimationComplete}
          onAnimationStart={onAnimationStart}
          style={style}
        >
          {segments.map((segment, index) => (
            <AnimationComponent
              key={`segment-${index.toString()}`}
              segment={segment}
              variants={itemVariants}
              per={per}
            />
          ))}
        </Component>
      )}
    </AnimatePresence>
  );
};
