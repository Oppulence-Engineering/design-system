import { useCallback, useRef } from "react";

export interface UseLongPressOptions {
  threshold?: number;
  onStart?: (
    event: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  ) => void;
  onFinish?: (
    event: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  ) => void;
  onCancel?: (
    event: React.PointerEvent | React.MouseEvent | React.TouchEvent,
  ) => void;
  cancelOnMovement?: boolean | number;
}

export interface LongPressHandlers {
  onPointerDown: (event: React.PointerEvent) => void;
  onPointerUp: (event: React.PointerEvent) => void;
  onPointerLeave: (event: React.PointerEvent) => void;
  onPointerMove: (event: React.PointerEvent) => void;
}

export function useLongPress(
  callback: ((event: React.PointerEvent) => void) | null,
  options: UseLongPressOptions = {},
): LongPressHandlers {
  const {
    threshold = 400,
    onStart,
    onFinish,
    onCancel,
    cancelOnMovement = false,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPressActive = useRef(false);
  const isPressed = useRef(false);
  const startPosition = useRef<{ x: number; y: number } | null>(null);

  const start = useCallback(
    (event: React.PointerEvent) => {
      if (isPressed.current) return;
      isPressed.current = true;
      startPosition.current = { x: event.clientX, y: event.clientY };
      onStart?.(event);

      timerRef.current = setTimeout(() => {
        isLongPressActive.current = true;
        callback?.(event);
      }, threshold);
    },
    [callback, threshold, onStart],
  );

  const cancel = useCallback(
    (event: React.PointerEvent) => {
      if (!isPressed.current) return;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      if (isLongPressActive.current) {
        onFinish?.(event);
      } else if (isPressed.current) {
        onCancel?.(event);
      }

      isLongPressActive.current = false;
      isPressed.current = false;
      startPosition.current = null;
    },
    [onFinish, onCancel],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!cancelOnMovement || !isPressed.current || !startPosition.current)
        return;

      const moveThreshold =
        typeof cancelOnMovement === "number" ? cancelOnMovement : 25;
      const dx = Math.abs(event.clientX - startPosition.current.x);
      const dy = Math.abs(event.clientY - startPosition.current.y);

      if (dx > moveThreshold || dy > moveThreshold) {
        cancel(event);
      }
    },
    [cancelOnMovement, cancel],
  );

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerMove,
  };
}
