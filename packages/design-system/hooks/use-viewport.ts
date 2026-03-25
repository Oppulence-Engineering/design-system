import { useEffect, useState } from "react";

export interface ViewportSize {
  width: number;
  height: number;
}

export function useViewport(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() => {
    if (typeof window === "undefined") return { width: 0, height: 0 };
    return { width: window.innerWidth, height: window.innerHeight };
  });

  useEffect(() => {
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}
