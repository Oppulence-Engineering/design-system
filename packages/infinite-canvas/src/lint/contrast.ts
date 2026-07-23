/**
 * WCAG color-contrast math (§ a11y). Pure — parses CSS colors and computes the
 * relative-luminance contrast ratio used by the design linter.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const NAMED: Record<string, string> = {
  black: "#000000",
  white: "#ffffff",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  transparent: "#00000000",
};

/** Parse a hex / rgb(a) / basic named color to RGB (returns null if unparseable). */
export function parseColor(input: string): Rgb | null {
  let str = input.trim().toLowerCase();
  if (NAMED[str] !== undefined) str = NAMED[str]!;

  if (str.startsWith("#")) {
    let hex = str.slice(1);
    if (hex.length === 3)
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].every((n) => Number.isFinite(n))) return { r, g, b };
    }
    return null;
  }

  const rgbMatch = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(str);
  if (rgbMatch !== null) {
    return {
      r: Number(rgbMatch[1]),
      g: Number(rgbMatch[2]),
      b: Number(rgbMatch[3]),
    };
  }
  return null;
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (WCAG). */
export function luminance(color: Rgb): number {
  return (
    0.2126 * channel(color.r) +
    0.7152 * channel(color.g) +
    0.0722 * channel(color.b)
  );
}

/** WCAG contrast ratio between two colors (1..21). */
export function contrastRatio(fg: Rgb, bg: Rgb): number {
  const l1 = luminance(fg);
  const l2 = luminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA pass for normal text (4.5) or large text (3.0). */
export function meetsAA(ratio: number, largeText: boolean): boolean {
  return ratio >= (largeText ? 3 : 4.5);
}
