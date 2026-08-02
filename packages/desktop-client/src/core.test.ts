import { describe, expect, it } from "vitest";

import { openExternalUrl } from "./core";

/**
 * Only the rejection path is exercised. It runs entirely before the Tauri
 * opener is called, so it works outside a webview; the accepting path does not.
 */
describe("openExternalUrl", () => {
  const blocked = [
    "javascript:alert(1)",
    "file:///etc/passwd",
    "data:text/html,x",
  ];

  for (const url of blocked) {
    it(`refuses ${url.split(":")[0]}:`, async () => {
      const result = await openExternalUrl(url);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toContain("Invalid URL protocol");
      }
    });
  }

  it("refuses a value that is not a URL", async () => {
    const result = await openExternalUrl("not a url");

    expect(result.success).toBe(false);
  });

  /*
   * The message named only HTTP and HTTPS while the code also permitted
   * mailto: and tel:, so a caller reading it could not tell which of its links
   * this rule would actually reject.
   */
  it("names every protocol it allows", async () => {
    const result = await openExternalUrl("javascript:alert(1)");

    expect(result.success).toBe(false);
    if (!result.success) {
      for (const protocol of ["http:", "https:", "mailto:", "tel:"]) {
        expect(result.error.message).toContain(protocol);
      }
      expect(result.error.context).toMatchObject({ protocol: "javascript:" });
    }
  });
});
