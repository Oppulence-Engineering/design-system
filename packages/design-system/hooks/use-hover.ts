import {
  type RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

export interface UseHoverOptions {
  enterDelay?: number;
  leaveDelay?: number;
}

export function useHover<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options: UseHoverOptions = {},
): boolean {
  const { enterDelay = 0, leaveDelay = 0 } = options;
  const [isHovered, setIsHovered] = useState(false);
  const enterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (enterTimerRef.current) {
      clearTimeout(enterTimerRef.current);
      enterTimerRef.current = null;
    }
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleEnter = () => {
      clearTimers();
      if (enterDelay > 0) {
        enterTimerRef.current = setTimeout(
          () => setIsHovered(true),
          enterDelay,
        );
      } else {
        setIsHovered(true);
      }
    };

    const handleLeave = () => {
      clearTimers();
      if (leaveDelay > 0) {
        leaveTimerRef.current = setTimeout(
          () => setIsHovered(false),
          leaveDelay,
        );
      } else {
        setIsHovered(false);
      }
    };

    el.addEventListener("mouseenter", handleEnter);
    el.addEventListener("mouseleave", handleLeave);
    return () => {
      el.removeEventListener("mouseenter", handleEnter);
      el.removeEventListener("mouseleave", handleLeave);
      clearTimers();
    };
  }, [ref, enterDelay, leaveDelay, clearTimers]);

  return isHovered;
}
