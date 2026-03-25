import { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";

export function useLockBody(locked: boolean = true): void {
  useIsomorphicLayoutEffect(() => {
    if (!locked) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [locked]);
}
