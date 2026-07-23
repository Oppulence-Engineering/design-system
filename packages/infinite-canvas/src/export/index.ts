/**
 * `@oppulence/infinite-canvas/export` — turn a design into shippable HTML/React or a PDF.
 * The pure serializers are yjs-free and unit-testable; the hook wires them to the live
 * document + the current data-binding context.
 */

"use client";

import * as React from "react";
import type { NodeId } from "../document/ids";
import { useBinding } from "../binding/context";
import { useCanvas } from "../store/context";
import { exportToHtml, type HtmlExportOptions } from "./to-html";
import {
  exportToReact,
  type ReactExportOptions,
  type ReactExportResult,
} from "./to-react";
import { downloadTextFile, printHtmlDocument } from "./print";

export { exportToHtml, escapeHtml, cssToInline } from "./to-html";
export type { HtmlExportOptions } from "./to-html";
export { exportToReact } from "./to-react";
export type { ReactExportOptions, ReactExportResult } from "./to-react";
export { printHtmlDocument, downloadTextFile } from "./print";

export interface CanvasExport {
  toHtml: (artboardId?: NodeId, opts?: HtmlExportOptions) => string;
  toReact: (
    artboardId?: NodeId,
    opts?: ReactExportOptions,
  ) => ReactExportResult;
  /** Print the artboard as a PDF (native browser print), binding-resolved with live data. */
  printPdf: (artboardId?: NodeId) => void;
  downloadHtml: (artboardId?: NodeId, filename?: string) => void;
  downloadReact: (artboardId?: NodeId, filename?: string) => void;
}

/** Export the current document (respecting the active data-binding context). */
export function useCanvasExport(): CanvasExport {
  const { documentStore } = useCanvas();
  const binding = useBinding();

  return React.useMemo<CanvasExport>(() => {
    const withData = (opts?: HtmlExportOptions): HtmlExportOptions => ({
      data: binding?.data,
      filters: binding?.filters,
      ...opts,
    });
    return {
      toHtml: (artboardId, opts) =>
        exportToHtml(
          documentStore.getState().document,
          artboardId,
          withData(opts),
        ),
      toReact: (artboardId, opts) =>
        exportToReact(documentStore.getState().document, artboardId, opts),
      printPdf: (artboardId) => {
        const html = exportToHtml(
          documentStore.getState().document,
          artboardId,
          withData({ fullDocument: true }),
        );
        printHtmlDocument(html);
      },
      downloadHtml: (artboardId, filename = "design.html") => {
        const html = exportToHtml(
          documentStore.getState().document,
          artboardId,
          withData({ fullDocument: true }),
        );
        downloadTextFile(filename, html, "text/html");
      },
      downloadReact: (artboardId, filename = "Design.tsx") => {
        const { code } = exportToReact(
          documentStore.getState().document,
          artboardId,
        );
        downloadTextFile(filename, code, "text/plain");
      },
    };
  }, [documentStore, binding]);
}
