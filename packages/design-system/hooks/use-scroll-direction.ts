import { useEffect, useRef, useState } from "react";

export type ScrollDirection = "up" | "down" | null;

export interface UseScrollDirectionOptions {
  threshold?: number;
  target?: HTMLElement | null;
}

export interface ScrollDirectionState {
  scrollDirection: ScrollDirection;
  isScrollingUp: boolean;
  isScrollingDown: boolean;
  scrollY: number;
}

export function useScrollDirection(
  options: UseScrollDirectionOptions = {},
): ScrollDirectionState {
  const { threshold = 0, target } = options;
  const [state, setState] = useState<ScrollDirectionState>({
    scrollDirection: null,
    isScrollingUp: false,
    isScrollingDown: false,
    scrollY: 0,
  });
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const el = target ?? window;

    const getScrollY = () => (target ? target.scrollTop : window.scrollY);

    const updateDirection = () => {
      const currentScrollY = getScrollY();
      const diff = currentScrollY - lastScrollY.current;

      if (Math.abs(diff) >= threshold) {
        const direction: ScrollDirection = diff > 0 ? "down" : "up";
        setState({
          scrollDirection: direction,
          isScrollingUp: direction === "up",
          isScrollingDown: direction === "down",
          scrollY: currentScrollY,
        });
        lastScrollY.current = currentScrollY;
      }
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(updateDirection);
        ticking.current = true;
      }
    };

    lastScrollY.current = getScrollY();
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [threshold, target]);

  return state;
}
