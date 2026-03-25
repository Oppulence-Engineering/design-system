import { useEffect, useRef } from "react";

import { useIntersectionObserver } from "./use-intersection-observer";

export interface UseInfiniteScrollOptions {
  hasNextPage: boolean;
  isFetching: boolean;
  fetchNextPage: () => void;
  rootMargin?: string;
}

export function useInfiniteScroll(options: UseInfiniteScrollOptions) {
  const {
    hasNextPage,
    isFetching,
    fetchNextPage,
    rootMargin = "200px",
  } = options;
  const sentinelRef = useRef<HTMLDivElement>(null);

  const entry = useIntersectionObserver(sentinelRef, { rootMargin });
  const isVisible = entry?.isIntersecting ?? false;

  useEffect(() => {
    if (isVisible && hasNextPage && !isFetching) {
      fetchNextPage();
    }
  }, [isVisible, hasNextPage, isFetching, fetchNextPage]);

  return { sentinelRef };
}
