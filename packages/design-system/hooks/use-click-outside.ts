import { type RefObject, useEffect, useRef } from "react";

export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: (event: MouseEvent | TouchEvent) => void,
  eventType: "mousedown" | "mouseup" = "mousedown",
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      const el = ref.current;
      if (!el || el.contains(event.target as Node)) return;
      handlerRef.current(event);
    };

    document.addEventListener(eventType, listener);
    document.addEventListener("touchstart", listener);
    return () => {
      document.removeEventListener(eventType, listener);
      document.removeEventListener("touchstart", listener);
    };
  }, [ref, eventType]);
}
