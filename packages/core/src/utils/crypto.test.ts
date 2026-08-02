import { describe, expect, it } from "vitest";

import {
  base64Decode,
  base64Encode,
  base64UrlDecode,
  base64UrlEncode,
  bufferToHex,
  constantTimeCompare,
  hexToBuffer,
} from "./crypto";

describe("hexToBuffer", () => {
  it("decodes valid hex", () => {
    expect(Array.from(hexToBuffer("48656c6c6f"))).toEqual([
      72, 101, 108, 108, 111,
    ]);
  });

  it("accepts upper case", () => {
    expect(Array.from(hexToBuffer("00FF10"))).toEqual([0, 255, 16]);
  });

  it("decodes an empty string to no bytes", () => {
    expect(hexToBuffer("")).toHaveLength(0);
  });

  it("rejects an odd length", () => {
    expect(() => hexToBuffer("abc")).toThrow("even length");
  });

  /*
   * `Number.parseInt` reads as far as it can and stops, so only a pair with no
   * valid leading digit was rejected. These decoded to a byte the caller never
   * supplied, in a module whose whole purpose is handling keys and digests.
   */
  const corrupt = ["1z", "+1", " 1", "0 ", "-1", "1.", "g0"];
  for (const value of corrupt) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(() => hexToBuffer(value)).toThrow("Invalid hex character");
    });
  }

  it("reports where the bad character is", () => {
    expect(() => hexToBuffer("00zz")).toThrow(
      "Invalid hex character at position 2",
    );
  });
});

describe("bufferToHex", () => {
  it("encodes bytes", () => {
    expect(bufferToHex(new Uint8Array([0, 255, 16]))).toBe("00ff10");
  });

  it("round-trips with hexToBuffer", () => {
    expect(bufferToHex(hexToBuffer("00ff10deadbeef"))).toBe("00ff10deadbeef");
  });
});

describe("constantTimeCompare", () => {
  it("accepts equal strings", () => {
    expect(constantTimeCompare("secret", "secret")).toBe(true);
    expect(constantTimeCompare("", "")).toBe(true);
    expect(constantTimeCompare("héllo", "héllo")).toBe(true);
  });

  it("rejects different strings", () => {
    expect(constantTimeCompare("secret", "sekret")).toBe(false);
    expect(constantTimeCompare("héllo", "hello")).toBe(false);
  });

  it("rejects different lengths", () => {
    expect(constantTimeCompare("secret", "secretx")).toBe(false);
    expect(constantTimeCompare("", "x")).toBe(false);
  });
});

describe("base64", () => {
  it("round-trips ascii", () => {
    expect(base64Encode("Hello, World!")).toBe("SGVsbG8sIFdvcmxkIQ==");
    expect(base64Decode("SGVsbG8sIFdvcmxkIQ==")).toBe("Hello, World!");
  });

  it("round-trips unicode", () => {
    const value = "héllo ✓ 日本";
    expect(base64Decode(base64Encode(value))).toBe(value);
  });

  it("url encoding drops padding and url-unsafe characters", () => {
    const encoded = base64UrlEncode("??>>~~ÿ");
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("url encoding round-trips", () => {
    const value = '{"sub":"user123"}';
    expect(base64UrlDecode(base64UrlEncode(value))).toBe(value);
    expect(base64UrlDecode(base64UrlEncode("??>>~~ÿ"))).toBe("??>>~~ÿ");
  });
});
