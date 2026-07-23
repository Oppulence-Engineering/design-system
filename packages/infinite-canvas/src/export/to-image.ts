/**
 * Image export (§14b) — rasterize/vectorize an artboard to a shareable image (an invoice
 * PNG, a design thumbnail). Because the canvas renders real DOM, an artboard serializes to
 * an SVG `<foreignObject>` wrapping the exported HTML — `exportToSvg` is pure and
 * server-safe (string only); `rasterizeSvg`/`exportToPng` are browser-only (canvas).
 *
 * Known limits (DOM-to-image is genuinely hard): fonts must be available in the rendering
 * context (embed @font-face data-URIs via `fontCss` for a headless renderer); cross-origin
 * `<img>` without CORS taints the canvas and makes PNG rasterization throw (SVG still
 * works); consumer React components are NOT included (they're runtime — use the live
 * canvas or `exportToReact`). SVG is lossless and the recommended default.
 */

import type { CanvasDocument } from "../document/document";
import { ROOT_PARENT, type NodeId } from "../document/ids";
import { buildChildrenIndex, childrenOf } from "../operations/children-index";
import { exportToHtml, escapeHtml, type HtmlExportOptions } from "./to-html";

export interface SvgExportOptions extends Pick<
  HtmlExportOptions,
  "data" | "filters"
> {
  /** Background behind the artboard (default the artboard's own bg / white). */
  background?: string;
  /** Extra CSS injected into a `<style>` inside the foreignObject — e.g. @font-face data-URIs. */
  fontCss?: string;
}

/** Serialize an artboard (default: the first) to a standalone SVG string. Pure/server-safe. */
export function exportToSvg(
  doc: CanvasDocument,
  artboardId?: NodeId,
  opts: SvgExportOptions = {},
): string {
  const index = buildChildrenIndex(doc.nodes);
  const rootId = artboardId ?? childrenOf(index, ROOT_PARENT)[0];
  const frame = rootId !== undefined ? doc.nodes[rootId] : undefined;
  if (frame === undefined || frame.type !== "frame") return "";
  const w = frame.width;
  const h = frame.height;
  const bg = opts.background ?? "#ffffff";
  // rootWidthOverride renders the root frame as a 0,0-origin relative block sized to w.
  const inner = exportToHtml(doc, rootId, {
    data: opts.data,
    filters: opts.filters,
    rootWidthOverride: w,
  });
  const style =
    opts.fontCss !== undefined ? `<style>${opts.fontCss}</style>` : "";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    `<foreignObject x="0" y="0" width="${w}" height="${h}">`,
    `<div xmlns="http://www.w3.org/1999/xhtml" style="width:${w}px;height:${h}px;overflow:hidden;box-sizing:border-box;background:${escapeHtml(bg)};font-family:system-ui,sans-serif">`,
    style,
    inner,
    `</div>`,
    `</foreignObject>`,
    `</svg>`,
  ].join("");
}

export interface RasterOptions {
  /** Device-pixel scale (default 2 — crisp on retina). */
  scale?: number;
  type?: "image/png" | "image/jpeg" | "image/webp";
  /** 0–1 for jpeg/webp. */
  quality?: number;
}

function svgDimensions(svg: string): { width: number; height: number } {
  const w = /<svg[^>]*\bwidth="([0-9.]+)"/.exec(svg);
  const h = /<svg[^>]*\bheight="([0-9.]+)"/.exec(svg);
  return {
    width: w !== null ? Number(w[1]) : 0,
    height: h !== null ? Number(h[1]) : 0,
  };
}

/**
 * Rasterize an SVG string to a Blob via an offscreen canvas (browser-only). Rejects if the
 * canvas is tainted by a cross-origin image without CORS (a browser security constraint).
 */
export function rasterizeSvg(
  svg: string,
  opts: RasterOptions = {},
): Promise<Blob> {
  if (typeof document === "undefined")
    return Promise.reject(
      new Error("rasterizeSvg requires a browser (canvas)"),
    );
  const { scale = 2, type = "image/png", quality } = opts;
  const { width, height } = svgDimensions(svg);
  if (width === 0 || height === 0)
    return Promise.reject(new Error("SVG has no measurable size"));

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new Promise<Blob>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const cxt = canvas.getContext("2d");
        if (cxt === null) {
          reject(new Error("2d canvas context unavailable"));
          return;
        }
        cxt.scale(scale, scale);
        cxt.drawImage(img, 0, 0);
        canvas.toBlob(
          (blob) =>
            blob !== null
              ? resolve(blob)
              : reject(new Error("canvas.toBlob returned null (tainted?)")),
          type,
          quality,
        );
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    img.onerror = () =>
      reject(new Error("Failed to load SVG image for rasterization"));
    img.src = url;
  });
}
