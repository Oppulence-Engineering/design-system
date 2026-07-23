import { describe, expect, it } from "vitest";
import { asNodeId } from "./ids";
import type { ComponentNode, ElementNode, FrameNode, TextNode } from "./nodes";
import { isSafeCustomCss, isSafeUrl, sanitizeNode } from "./sanitize";
import { hasForbiddenSegment } from "./keys";

function frame(overrides: Partial<FrameNode> = {}): FrameNode {
  return {
    type: "frame",
    id: asNodeId("f"),
    parentId: null,
    sortKey: "a",
    name: "f",
    visible: true,
    locked: false,
    rotation: 0,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    clipsContent: true,
    style: {},
    ...overrides,
  };
}

describe("sanitizeNode — finite guard", () => {
  it("flags NaN/Infinity geometry as invalid (would wedge culling)", () => {
    const bad = frame({ x: NaN, width: Infinity });
    const result = sanitizeNode(bad);
    expect(result.invalid).toBe(true);
    expect(
      Number.isFinite(result.node.type === "frame" ? result.node.x : 0),
    ).toBe(true);
  });

  it("drops non-finite numeric style values", () => {
    const bad = frame({ style: { opacity: NaN, fontSize: Infinity } });
    const result = sanitizeNode(bad);
    expect(result.node.style.opacity).toBeUndefined();
    expect(result.node.style.fontSize).toBeUndefined();
  });
});

describe("sanitizeNode — prototype pollution (by shape, all namespaces)", () => {
  it("guards component prop keys (the namespace an enumerated guard missed)", () => {
    const node: ComponentNode = {
      type: "component",
      id: asNodeId("c"),
      parentId: null,
      sortKey: "a",
      name: "c",
      visible: true,
      locked: false,
      rotation: 0,
      componentKey: "card",
      props: { __proto__: "polluted", ok: "kept" } as Record<string, string>,
      style: {},
    };
    const result = sanitizeNode(node);
    const props = (result.node as ComponentNode).props;
    expect(Object.prototype.hasOwnProperty.call(props, "__proto__")).toBe(
      false,
    );
    expect(props.ok).toBe("kept");
    // Object.prototype was not polluted
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("resets a forbidden parentId to root", () => {
    const node = frame({ parentId: asNodeId("__proto__") });
    const result = sanitizeNode(node);
    expect(result.node.parentId).toBeNull();
  });

  it("hasForbiddenSegment catches dotted keys", () => {
    expect(hasForbiddenSegment("style.__proto__.x")).toBe(true);
    expect(hasForbiddenSegment("componentProps.constructor")).toBe(true);
    expect(hasForbiddenSegment("style.padding.top")).toBe(false);
  });
});

describe("sanitizeNode — style.custom CSS allowlist", () => {
  it("drops position:fixed/sticky and url()/expression values", () => {
    expect(isSafeCustomCss("position", "fixed")).toBe(false);
    expect(isSafeCustomCss("position", "sticky")).toBe(false);
    expect(isSafeCustomCss("background", 'url("https://evil/beacon")')).toBe(
      false,
    );
    expect(isSafeCustomCss("cursor", "url(x)")).toBe(false);
    expect(isSafeCustomCss("content", '"x"')).toBe(false);
    expect(isSafeCustomCss("color", "red")).toBe(true);
    expect(isSafeCustomCss("gap", "8px")).toBe(true);
  });

  it("filters unsafe entries out of a node's custom styles", () => {
    const node = frame({
      style: {
        custom: { color: "red", position: "fixed", background: "url(evil)" },
      },
    });
    const result = sanitizeNode(node);
    expect(result.node.style.custom).toEqual({ color: "red" });
    expect(result.changed).toBe(true);
  });
});

describe("sanitizeNode — attrs allowlist + url schemes", () => {
  it("rejects javascript:/data: urls, allows https/relative", () => {
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeUrl("data:text/html,<script>")).toBe(false);
    expect(isSafeUrl("vbscript:x")).toBe(false);
    expect(isSafeUrl("https://ok.example/x")).toBe(true);
    expect(isSafeUrl("/relative/path")).toBe(true);
    expect(isSafeUrl("#anchor")).toBe(true);
    expect(isSafeUrl("mailto:a@b.com")).toBe(true);
  });

  it("strips event handlers, target/ping, and unsafe hrefs", () => {
    const node: ElementNode = {
      type: "element",
      id: asNodeId("a"),
      parentId: asNodeId("p"),
      sortKey: "a",
      name: "a",
      visible: true,
      locked: false,
      rotation: 0,
      tag: "a",
      attrs: {
        href: "javascript:alert(1)",
        onclick: "steal()",
        target: "_blank",
        title: "ok",
        "data-x": "kept",
      },
      style: {},
    };
    const result = sanitizeNode(node);
    const attrs = (result.node as ElementNode).attrs;
    expect(attrs.href).toBeUndefined();
    expect(attrs.onclick).toBeUndefined();
    expect(attrs.target).toBeUndefined();
    expect(attrs.title).toBe("ok");
    expect(attrs["data-x"]).toBe("kept");
  });
});

describe("sanitizeNode — bounds", () => {
  it("clamps oversized text", () => {
    const node: TextNode = {
      type: "text",
      id: asNodeId("t"),
      parentId: asNodeId("p"),
      sortKey: "a",
      name: "t",
      visible: true,
      locked: false,
      rotation: 0,
      text: "x".repeat(50),
      style: {},
    };
    const result = sanitizeNode(node, {
      maxTextLength: 10,
      maxCustomStyleEntries: 10,
      maxAttrs: 10,
      maxAttrValueLength: 100,
    });
    expect((result.node as TextNode).text).toHaveLength(10);
    expect(result.changed).toBe(true);
  });
});
