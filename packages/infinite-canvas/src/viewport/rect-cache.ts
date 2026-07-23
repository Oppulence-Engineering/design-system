/**
 * Measured-geometry rect cache (§6). Content uses real CSS layout, so child geometry is
 * MEASURED, not stored. `getBoundingClientRect` is in screen space; dividing by the
 * measure-time zoom yields canvas-space rects that are camera-invariant (pan/zoom need
 * no invalidation). Invalidation is scoped to the ARTBOARD SUBTREE — an op touching a
 * node in artboard A, or a ResizeObserver fire on any element in A, marks all of A's
 * rects stale (a flow child that shifted because a sibling grew is covered because the
 * grower fires RO). Excluded from jsdom coverage; exercised by Storybook play tests.
 */

import type { NodeId } from "../document/ids";
import type { Camera } from "./camera";
import { rectContainsPoint, type Point, type Rect } from "./geometry";

interface Registration {
  el: HTMLElement;
  /** The root artboard this element belongs to (for subtree invalidation). */
  artboardId: NodeId | null;
}

export class RectCache {
  private registrations = new Map<NodeId, Registration>();
  private cache = new Map<NodeId, Rect>();
  private observer: ResizeObserver | null = null;
  private rootEl: HTMLElement | null = null;

  setRoot(el: HTMLElement | null): void {
    this.rootEl = el;
  }

  /** Register a node's DOM element. Returns a cleanup that unobserves + evicts. */
  register(id: NodeId, el: HTMLElement, artboardId: NodeId | null): () => void {
    this.registrations.set(id, { el, artboardId });
    this.ensureObserver();
    this.observer?.observe(el);
    return () => {
      this.observer?.unobserve(el);
      this.registrations.delete(id);
      this.cache.delete(id);
    };
  }

  /** Invalidate every cached rect in an artboard subtree (or all if null). */
  invalidateArtboard(artboardId: NodeId | null): void {
    if (artboardId === null) {
      this.cache.clear();
      return;
    }
    for (const [id, reg] of this.registrations) {
      if (reg.artboardId === artboardId) this.cache.delete(id);
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  /** Canvas-space rect for a node, measuring lazily against the current camera. */
  getRect(id: NodeId, camera: Camera): Rect | null {
    const cached = this.cache.get(id);
    if (cached !== undefined) return cached;
    const reg = this.registrations.get(id);
    if (reg === undefined || this.rootEl === null) return null;
    const rect = this.measure(reg.el, camera);
    if (rect !== null) this.cache.set(id, rect);
    return rect;
  }

  /** Node ids whose canvas rect contains the point, deepest (front-most) first. */
  hitTest(canvasPoint: Point, camera: Camera): NodeId[] {
    const hits: { id: NodeId; area: number }[] = [];
    for (const id of this.registrations.keys()) {
      const rect = this.getRect(id, camera);
      if (rect !== null && rectContainsPoint(rect, canvasPoint)) {
        hits.push({ id, area: rect.width * rect.height });
      }
    }
    // Smaller area ≈ deeper/front-most for nested content.
    hits.sort((a, b) => a.area - b.area);
    return hits.map((h) => h.id);
  }

  private measure(el: HTMLElement, camera: Camera): Rect | null {
    if (this.rootEl === null) return null;
    const elBox = el.getBoundingClientRect();
    const rootBox = this.rootEl.getBoundingClientRect();
    // Screen position relative to the canvas root, then invert the camera transform.
    const screenX = elBox.left - rootBox.left;
    const screenY = elBox.top - rootBox.top;
    return {
      x: (screenX - camera.x) / camera.zoom,
      y: (screenY - camera.y) / camera.zoom,
      width: elBox.width / camera.zoom,
      height: elBox.height / camera.zoom,
    };
  }

  private ensureObserver(): void {
    if (this.observer !== null || typeof ResizeObserver === "undefined") return;
    this.observer = new ResizeObserver((entries) => {
      const artboards = new Set<NodeId | null>();
      for (const entry of entries) {
        for (const [id, reg] of this.registrations) {
          if (reg.el === entry.target) {
            artboards.add(reg.artboardId);
            this.cache.delete(id);
          }
        }
      }
      for (const artboardId of artboards) this.invalidateArtboard(artboardId);
    });
  }

  dispose(): void {
    this.observer?.disconnect();
    this.observer = null;
    this.registrations.clear();
    this.cache.clear();
  }
}
