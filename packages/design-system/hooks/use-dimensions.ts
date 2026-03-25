import { useCallback, useEffect, useRef, useState } from "react";

export interface Dimensions {
  width: number;
  height: number;
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export interface UseDimensionsOptions {
  liveMeasure?: boolean;
  onResize?: (dimensions: Dimensions) => void;
}

const EMPTY_DIMENSIONS: Dimensions = {
  width: 0,
  height: 0,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
};

export function useDimensions<T extends HTMLElement>(
  options: UseDimensionsOptions = {},
): {
  ref: (node: T | null) => void;
  dimensions: Dimensions;
} {
  const { liveMeasure = true, onResize } = options;
  const [dimensions, setDimensions] = useState<Dimensions>(EMPTY_DIMENSIONS);
  const nodeRef = useRef<T | null>(null);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  const measure = useCallback(() => {
    if (!nodeRef.current) return;
    const rect = nodeRef.current.getBoundingClientRect();
    const dims: Dimensions = {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
    };
    setDimensions(dims);
    onResizeRef.current?.(dims);
  }, []);

  const ref = useCallback(
    (node: T | null) => {
      nodeRef.current = node;
      if (node) measure();
    },
    [measure],
  );

  useEffect(() => {
    if (!liveMeasure || !nodeRef.current) return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(nodeRef.current);
    return () => observer.disconnect();
  }, [liveMeasure, measure]);

  return { ref, dimensions };
}
