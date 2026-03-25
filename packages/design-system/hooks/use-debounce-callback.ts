import { useCallback, useEffect, useRef } from "react";

export interface DebounceOptions {
  leading?: boolean;
  trailing?: boolean;
  maxWait?: number;
}

export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): void;
  cancel: () => void;
  flush: () => void;
  isPending: () => boolean;
}

export function useDebounceCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number,
  options: DebounceOptions = {},
): DebouncedFunction<T> {
  const { leading = false, trailing = true, maxWait } = options;
  const callbackRef = useRef(callback);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<Parameters<T> | null>(null);
  const lastCallTimeRef = useRef<number | null>(null);
  const leadingInvokedRef = useRef(false);

  callbackRef.current = callback;

  const invoke = useCallback(() => {
    if (lastArgsRef.current !== null) {
      callbackRef.current(...lastArgsRef.current);
      lastArgsRef.current = null;
    }
    leadingInvokedRef.current = false;
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    timerRef.current = null;
    maxTimerRef.current = null;
    lastArgsRef.current = null;
    lastCallTimeRef.current = null;
    leadingInvokedRef.current = false;
  }, []);

  const flush = useCallback(() => {
    if (timerRef.current || maxTimerRef.current) {
      invoke();
      cancel();
    }
  }, [invoke, cancel]);

  const isPending = useCallback(() => {
    return timerRef.current !== null;
  }, []);

  const debounced = useCallback(
    (...args: Parameters<T>) => {
      lastArgsRef.current = args;
      lastCallTimeRef.current = Date.now();

      if (timerRef.current) clearTimeout(timerRef.current);

      if (leading && !leadingInvokedRef.current) {
        leadingInvokedRef.current = true;
        invoke();
      }

      if (trailing) {
        timerRef.current = setTimeout(() => {
          invoke();
          if (maxTimerRef.current) {
            clearTimeout(maxTimerRef.current);
            maxTimerRef.current = null;
          }
          timerRef.current = null;
        }, delay);
      }

      if (maxWait !== undefined && !maxTimerRef.current) {
        maxTimerRef.current = setTimeout(() => {
          invoke();
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
          maxTimerRef.current = null;
        }, maxWait);
      }
    },
    [delay, leading, trailing, maxWait, invoke],
  ) as DebouncedFunction<T>;

  debounced.cancel = cancel;
  debounced.flush = flush;
  debounced.isPending = isPending;

  useEffect(() => {
    return cancel;
  }, [cancel]);

  return debounced;
}
