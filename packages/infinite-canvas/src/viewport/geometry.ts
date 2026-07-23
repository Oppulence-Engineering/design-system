/**
 * Pure 2D geometry primitives shared by the camera, hit-testing, marquee, and snapping.
 * No DOM, no React — fully unit-testable.
 */

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Axis-aligned rectangle in some coordinate space (canvas or screen). */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const rectRight = (r: Rect): number => r.x + r.width;
export const rectBottom = (r: Rect): number => r.y + r.height;
export const rectCenter = (r: Rect): Point => ({
  x: r.x + r.width / 2,
  y: r.y + r.height / 2,
});

/** True if two axis-aligned rects overlap (edge-touching counts as intersecting). */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x <= rectRight(b) &&
    rectRight(a) >= b.x &&
    a.y <= rectBottom(b) &&
    rectBottom(a) >= b.y
  );
}

/** True if `outer` fully contains `inner`. */
export function rectContains(outer: Rect, inner: Rect): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    rectRight(inner) <= rectRight(outer) &&
    rectBottom(inner) <= rectBottom(outer)
  );
}

/** True if a rect contains a point. */
export function rectContainsPoint(r: Rect, p: Point): boolean {
  return (
    p.x >= r.x && p.x <= rectRight(r) && p.y >= r.y && p.y <= rectBottom(r)
  );
}

/** Smallest rect covering all inputs, or null for an empty list. */
export function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (rectRight(r) > maxX) maxX = rectRight(r);
    if (rectBottom(r) > maxY) maxY = rectBottom(r);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Grow a rect by `margin` on every side. */
export function inflateRect(r: Rect, margin: number): Rect {
  return {
    x: r.x - margin,
    y: r.y - margin,
    width: r.width + margin * 2,
    height: r.height + margin * 2,
  };
}

/** Clamp a number to [min, max]. */
export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}
