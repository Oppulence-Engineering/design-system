/**
 * Image export (§14b) — rasterize/vectorize an artboard to a shareable image (an invoice
 * PNG, a design thumbnail). Because the canvas renders real DOM, an artboard serializes to
 * an SVG `<foreignObject>` wrapping the exported HTML — `exportToSvg` is pure and
 * server-safe (string only); `rasterizeSvg`/`exportToPng` are browser-only (canvas).
 *
 * Known limits (DOM-to-image is genuinely hard): fonts must be available in the rendering
 * context (embed @font-face data-URIs via `fontCss` for a headless renderer). External
 * `http(s)` images are inlined as `data:` URIs before rasterizing (`inlineAssets`, default
 * on) so fetchable (same-origin / CORS) images no longer taint the PNG canvas — only images
 * that can't be fetched at all still taint it (SVG export is unaffected regardless). Consumer
 * React components are NOT included (they're runtime — use the live canvas or `exportToReact`).
 * SVG is lossless and the recommended default.
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
  /**
   * Inline external `http(s)` assets (`<img src>`, CSS `url(...)`) referenced in the SVG as
   * `data:` URIs before rasterizing (default **true**). This is what lets PNG export succeed:
   * a cross-origin resource loaded straight into the offscreen canvas taints it and makes
   * `toBlob` return null. Fetchable assets (same-origin or CORS-enabled) inline and export
   * cleanly; unfetchable ones are left as-is (that PNG is still tainted — a browser security
   * limit, not a bug). Set `false` to skip the fetch round-trip when you know every asset is
   * already a data URI. SVG export itself is unaffected either way.
   */
  inlineAssets?: boolean;
}

/**
 * Fetch a URL and resolve it to a `data:` URI, or `null` if it can't be fetched (cross-origin
 * without CORS, network/decoding error). Best-effort by design — callers keep the original URL
 * on `null` rather than failing the whole export.
 */
async function urlToDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/**
 * Replace external `http(s)` asset references in an SVG string with `data:` URIs so canvas
 * rasterization is not tainted by cross-origin resources. Scans both HTML attributes
 * (`src`/`href`) and CSS `url(...)` inside the foreignObject. Browser-only (uses `fetch`).
 * Returns a new SVG string; assets that can't be fetched are left untouched.
 */
export async function inlineSvgAssets(svg: string): Promise<string> {
  const urls = new Set<string>();
  const patterns = [
    /(?:src|href)\s*=\s*["'](https?:\/\/[^"']+)["']/gi,
    /url\(\s*['"]?(https?:\/\/[^'")]+?)['"]?\s*\)/gi,
  ];
  for (const re of patterns) {
    for (const match of svg.matchAll(re)) {
      const u = match[1];
      if (u !== undefined) urls.add(u);
    }
  }
  if (urls.size === 0) return svg;

  const replacements = new Map<string, string>();
  await Promise.all(
    [...urls].map(async (u) => {
      const data = await urlToDataUri(u);
      if (data !== null) replacements.set(u, data);
    }),
  );

  let out = svg;
  for (const [url, data] of replacements) out = out.split(url).join(data);
  return out;
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
export async function rasterizeSvg(
  svg: string,
  opts: RasterOptions = {},
): Promise<Blob> {
  if (typeof document === "undefined")
    throw new Error("rasterizeSvg requires a browser (canvas)");
  const { scale = 2, type = "image/png", quality } = opts;
  // Inline cross-origin assets first (default on) so the offscreen canvas isn't tainted.
  const prepared =
    opts.inlineAssets === false ? svg : await inlineSvgAssets(svg);
  const { width, height } = svgDimensions(prepared);
  if (width === 0 || height === 0)
    throw new Error("SVG has no measurable size");

  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(prepared)}`;
  return await new Promise<Blob>((resolve, reject) => {
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
