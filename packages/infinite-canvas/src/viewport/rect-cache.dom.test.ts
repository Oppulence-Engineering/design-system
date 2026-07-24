import { describe, expect, it } from "vitest";
import { clientPointToElement, elementScreenScale } from "./rect-cache";

function fixtureElement(params: {
  left: number;
  top: number;
  width: number;
  height: number;
  offsetWidth: number;
  offsetHeight: number;
}): HTMLElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "offsetWidth", { value: params.offsetWidth });
  Object.defineProperty(el, "offsetHeight", { value: params.offsetHeight });
  el.getBoundingClientRect = () =>
    ({
      left: params.left,
      top: params.top,
      width: params.width,
      height: params.height,
      right: params.left + params.width,
      bottom: params.top + params.height,
      x: params.left,
      y: params.top,
      toJSON: () => ({}),
    }) as DOMRect;
  return el;
}

describe("elementScreenScale", () => {
  it("returns the on-screen to layout size ratio for a scaled element", () => {
    const el = fixtureElement({
      left: 0,
      top: 0,
      width: 50,
      height: 25,
      offsetWidth: 100,
      offsetHeight: 50,
    });
    expect(elementScreenScale(el)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("falls back to scale 1 when either measurement is degenerate", () => {
    const el = fixtureElement({
      left: 0,
      top: 0,
      width: 0,
      height: 25,
      offsetWidth: 0,
      offsetHeight: 0,
    });
    expect(elementScreenScale(el)).toEqual({ x: 1, y: 1 });
  });
});

describe("clientPointToElement", () => {
  it("maps a client point into unscaled element-local coordinates", () => {
    const el = fixtureElement({
      left: 100,
      top: 50,
      width: 200,
      height: 100,
      offsetWidth: 200,
      offsetHeight: 100,
    });
    expect(clientPointToElement(el, { x: 110, y: 60 })).toEqual({
      x: 10,
      y: 10,
    });
  });

  it("compensates for a CSS transform scale on the element", () => {
    const el = fixtureElement({
      left: 100,
      top: 50,
      width: 100,
      height: 50,
      offsetWidth: 200,
      offsetHeight: 100,
    });
    expect(clientPointToElement(el, { x: 110, y: 60 })).toEqual({
      x: 20,
      y: 20,
    });
  });
});
