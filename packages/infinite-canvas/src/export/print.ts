/**
 * Client-side PDF + file download (§ export). PDF uses the browser's native
 * print-to-PDF over the exported standalone HTML — no server, no heavy dep — which is
 * directly useful for Conduitt (designed invoice → PDF). Consumers who need server-side
 * rendering can take the `exportToHtml(..., { fullDocument: true })` string to their own
 * pipeline.
 */

/** Open the exported HTML in a hidden iframe and invoke the print dialog (print → PDF). */
export function printHtmlDocument(html: string): void {
  if (typeof document === "undefined") return;
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cw = iframe.contentWindow;
  const cd = iframe.contentDocument ?? cw?.document;
  if (cw === null || cd == null) {
    iframe.remove();
    return;
  }
  cd.open();
  cd.write(html);
  cd.close();

  const doPrint = () => {
    cw.focus();
    cw.print();
    // Remove after the print dialog is dismissed.
    setTimeout(() => iframe.remove(), 1000);
  };
  if (cd.readyState === "complete") doPrint();
  else iframe.onload = doPrint;
}

/** Trigger a browser download of a text file (HTML/TSX). */
export function downloadTextFile(
  filename: string,
  content: string,
  mime = "text/plain",
): void {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
