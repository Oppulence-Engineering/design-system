// Existing hooks
export { useIsMobile } from "./use-mobile";
export { useResizeObserver } from "./use-resize-observer";

// Tier 0 — Foundational
export { useIsomorphicLayoutEffect } from "./use-isomorphic-layout-effect";
export { useMounted } from "./use-mounted";
export { useUnmount } from "./use-unmount";

// Tier 1 — Core utilities
export { useEventListener } from "./use-event-listener";
export { useDebounce } from "./use-debounce";
export {
  useDebounceCallback,
  type DebounceOptions,
  type DebouncedFunction,
} from "./use-debounce-callback";
export { useMediaQuery } from "./use-media-query";
export { useLocalStorage } from "./use-local-storage";
export {
  useCopyToClipboard,
  type UseCopyToClipboardOptions,
} from "./use-copy-to-clipboard";
export { useEnterSubmit } from "./use-enter-submit";
export { useLockBody } from "./use-lock-body";
export { useViewport, type ViewportSize } from "./use-viewport";
export {
  useWarnIfUnsavedChanges,
  type UseWarnIfUnsavedChangesOptions,
} from "./use-warn-if-unsaved-changes";

// Tier 2 — Built on Tier 1
export { useClickOutside } from "./use-click-outside";
export { useHover, type UseHoverOptions } from "./use-hover";
export {
  useIntersectionObserver,
  type UseIntersectionObserverOptions,
} from "./use-intersection-observer";
export {
  useScrollDirection,
  type ScrollDirection,
  type ScrollDirectionState,
  type UseScrollDirectionOptions,
} from "./use-scroll-direction";
export {
  useDimensions,
  type Dimensions,
  type UseDimensionsOptions,
} from "./use-dimensions";

// Tier 3 — Built on Tier 2
export {
  useInfiniteScroll,
  type UseInfiniteScrollOptions,
} from "./use-infinite-scroll";
export { useAutoScroll, type UseAutoScrollOptions } from "./use-auto-scroll";
export {
  useLongPress,
  type UseLongPressOptions,
  type LongPressHandlers,
} from "./use-long-press";
