import { describe, expect, it } from "vitest";
import type { NodeStyle } from "../document/styles";
import { styleToCss } from "./style-to-css";

describe("styleToCss", () => {
  it("compiles dimensions, box edges, and typography", () => {
    const style: NodeStyle = {
      width: 200,
      height: { unit: "%", value: 50 },
      padding: { top: 8, bottom: 8, left: 12, right: 12 },
      fontSize: 14,
      color: "#333",
    };
    const css = styleToCss(style) as Record<string, unknown>;
    expect(css.width).toBe("200px");
    expect(css.height).toBe("50%");
    expect(css.padding).toBe("8px 12px 8px 12px");
    expect(css.fontSize).toBe("14px");
    expect(css.color).toBe("#333");
  });

  it("compiles solid fill background", () => {
    const css = styleToCss({
      background: { type: "solid", color: "#abc" },
    }) as Record<string, unknown>;
    expect(css.background).toBe("#abc");
  });

  it("re-filters unsafe custom css (defense in depth)", () => {
    const css = styleToCss({
      custom: { color: "red", position: "fixed", background: "url(evil)" },
    }) as Record<string, unknown>;
    expect(css.color).toBe("red");
    expect(css.position).toBeUndefined();
    expect(css.background).toBeUndefined();
  });

  it("emits nothing for an empty style", () => {
    expect(Object.keys(styleToCss({}))).toHaveLength(0);
  });
});
