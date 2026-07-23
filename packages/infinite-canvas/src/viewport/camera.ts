/**
 * Camera math (§6). The camera maps canvas space → screen space:
 *   screen = canvas * zoom + {x, y}
 * All functions are pure; the renderer applies the resulting transform imperatively
 * (pan/zoom never re-render React).
 */

import { clamp, type Point, type Rect } from "./geometry";

export interface Camera {
  x: number;
  y: number;
  zoom: number;
}

/** Zoom is clamped to this range so `zoomToFit` over odd content can never yield 0/∞. */
export const MIN_ZOOM = 0.02;
export const MAX_ZOOM = 64;

export function clampZoom(zoom: number): number {
  // Guard against NaN/Infinity from degenerate fit math (the camera has no finite-guard otherwise).
  if (!Number.isFinite(zoom) || zoom <= 0) return 1;
  return clamp(zoom, MIN_ZOOM, MAX_ZOOM);
}

export function screenToCanvas(p: Point, camera: Camera): Point {
  return {
    x: (p.x - camera.x) / camera.zoom,
    y: (p.y - camera.y) / camera.zoom,
  };
}

export function canvasToScreen(p: Point, camera: Camera): Point {
  return {
    x: p.x * camera.zoom + camera.x,
    y: p.y * camera.zoom + camera.y,
  };
}

/** Convert a canvas-space rect to screen space (used to position overlays). */
export function canvasRectToScreen(r: Rect, camera: Camera): Rect {
  const topLeft = canvasToScreen({ x: r.x, y: r.y }, camera);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: r.width * camera.zoom,
    height: r.height * camera.zoom,
  };
}

/**
 * Zoom toward a fixed screen point (cursor-invariant zoom): the canvas point under
 * `screenPoint` stays under it after the zoom change.
 */
export function zoomAtPoint(
  camera: Camera,
  screenPoint: Point,
  nextZoom: number,
): Camera {
  const zoom = clampZoom(nextZoom);
  const canvasPoint = screenToCanvas(screenPoint, camera);
  return {
    zoom,
    x: screenPoint.x - canvasPoint.x * zoom,
    y: screenPoint.y - canvasPoint.y * zoom,
  };
}

/** Pan by a screen-space delta. */
export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy };
}

/** The visible canvas-space rectangle for a viewport of `viewportSize` screen pixels. */
export function visibleCanvasRect(
  camera: Camera,
  viewportSize: { width: number; height: number },
): Rect {
  const topLeft = screenToCanvas({ x: 0, y: 0 }, camera);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: viewportSize.width / camera.zoom,
    height: viewportSize.height / camera.zoom,
  };
}

/**
 * Camera that fits `contentBounds` (canvas space) into `viewportSize` (screen) with
 * `padding` screen px on each side. Returns a safe default when content is empty or
 * degenerate (zero/negative extent) — never NaN/∞.
 */
export function cameraToFit(
  contentBounds: Rect | null,
  viewportSize: { width: number; height: number },
  padding = 48,
): Camera {
  if (
    contentBounds === null ||
    contentBounds.width <= 0 ||
    contentBounds.height <= 0 ||
    viewportSize.width <= 0 ||
    viewportSize.height <= 0
  ) {
    return { x: 0, y: 0, zoom: 1 };
  }
  const availW = Math.max(1, viewportSize.width - padding * 2);
  const availH = Math.max(1, viewportSize.height - padding * 2);
  const zoom = clampZoom(
    Math.min(availW / contentBounds.width, availH / contentBounds.height),
  );
  // Center the content in the viewport.
  const contentCenterX = contentBounds.x + contentBounds.width / 2;
  const contentCenterY = contentBounds.y + contentBounds.height / 2;
  return {
    zoom,
    x: viewportSize.width / 2 - contentCenterX * zoom,
    y: viewportSize.height / 2 - contentCenterY * zoom,
  };
}
