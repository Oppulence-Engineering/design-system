import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAutoScrollOptions {
  enabled?: boolean;
  threshold?: number;
}

export function useAutoScroll(
  target: HTMLElement | null,
  options: UseAutoScrollOptions = {},
) {
  const { enabled = true, threshold = 50 } = options;
  const [isAtBottom, setIsAtBottom] = useState(true);
  const userScrolledUp = useRef(false);

  const checkIfAtBottom = useCallback(() => {
    if (!target) return true;
    const { scrollTop, scrollHeight, clientHeight } = target;
    return scrollHeight - scrollTop - clientHeight <= threshold;
  }, [target, threshold]);

  const scrollToBottom = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      if (!target) return;
      target.scrollTo({ top: target.scrollHeight, behavior });
      userScrolledUp.current = false;
      setIsAtBottom(true);
    },
    [target],
  );

  useEffect(() => {
    if (!target || !enabled) return;

    const onScroll = () => {
      const atBottom = checkIfAtBottom();
      setIsAtBottom(atBottom);
      if (!atBottom) {
        userScrolledUp.current = true;
      } else {
        userScrolledUp.current = false;
      }
    };

    target.addEventListener("scroll", onScroll, { passive: true });
    return () => target.removeEventListener("scroll", onScroll);
  }, [target, enabled, checkIfAtBottom]);

  useEffect(() => {
    if (!target || !enabled || userScrolledUp.current) return;

    const observer = new MutationObserver(() => {
      if (!userScrolledUp.current) {
        target.scrollTo({ top: target.scrollHeight, behavior: "smooth" });
      }
    });

    observer.observe(target, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [target, enabled]);

  return { isAtBottom, scrollToBottom };
}
