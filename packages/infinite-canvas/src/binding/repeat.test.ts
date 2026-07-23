import { describe, expect, it } from "vitest";
import { asNodeId } from "../document/ids";
import type { SceneNode } from "../document/nodes";
import { makeDocument, makeFrame } from "../testing/factories";
import { exportToHtml } from "../export/to-html";
import { itemScope, resolveArray, resolveCondition } from "./resolve";

describe("binding: conditions + repeat helpers", () => {
  const data = {
    discount: 0,
    items: [{ name: "A" }, { name: "B" }],
    status: "overdue",
  };

  it("resolveCondition handles truthiness, arrays, and negation", () => {
    expect(resolveCondition("discount", data)).toBe(false); // 0
    expect(resolveCondition("items", data)).toBe(true); // non-empty array
    expect(resolveCondition("!discount", data)).toBe(true);
    expect(resolveCondition("status", data)).toBe(true);
  });

  it("resolveArray returns the array or empty", () => {
    expect(resolveArray("items", data)).toHaveLength(2);
    expect(resolveArray("missing", data)).toEqual([]);
  });

  it("itemScope merges parent + item + index", () => {
    const scope = itemScope(data, { name: "A" }, 3, "row");
    expect(scope.row).toEqual({ name: "A" });
    expect(scope.item).toEqual({ name: "A" });
    expect(scope.index).toBe(3);
    expect(scope.status).toBe("overdue"); // parent preserved
  });
});

describe("export renders repeaters + conditionals with data", () => {
  function invoiceTemplate() {
    const frame = makeFrame({ id: "inv", x: 0, y: 0, width: 400, height: 500 });
    // A row node that repeats over `items`.
    const row: SceneNode = {
      type: "frame",
      id: asNodeId("row"),
      parentId: frame.id,
      sortKey: "b",
      name: "Row",
      visible: true,
      locked: false,
      rotation: 0,
      repeat: "items",
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      clipsContent: false,
      style: { display: "flex" },
    };
    const cell: SceneNode = {
      type: "text",
      id: asNodeId("cell"),
      parentId: row.id,
      sortKey: "a",
      name: "cell",
      visible: true,
      locked: false,
      rotation: 0,
      text: "{{item.name}} — {{item.amount | currency}}",
      style: {},
    };
    // A conditional discount line.
    const discount: SceneNode = {
      type: "text",
      id: asNodeId("disc"),
      parentId: frame.id,
      sortKey: "c",
      name: "discount",
      visible: true,
      locked: false,
      rotation: 0,
      visibleWhen: "discount",
      text: "Discount: {{discount | currency}}",
      style: {},
    };
    return {
      doc: makeDocument([frame, row, cell, discount]),
      frameId: frame.id,
    };
  }

  it("clones the row per item and resolves item-scoped bindings", () => {
    const { doc, frameId } = invoiceTemplate();
    const html = exportToHtml(doc, frameId, {
      data: {
        items: [
          { name: "Widget", amount: 100 },
          { name: "Gadget", amount: 250 },
        ],
        discount: 0,
      },
    });
    expect(html).toContain("Widget — $100.00");
    expect(html).toContain("Gadget — $250.00");
    // Conditional discount is hidden (0 → falsy).
    expect(html).not.toContain("Discount:");
  });

  it("shows the conditional line when the condition is truthy", () => {
    const { doc, frameId } = invoiceTemplate();
    const html = exportToHtml(doc, frameId, {
      data: { items: [], discount: 50 },
    });
    expect(html).toContain("Discount: $50.00");
  });

  it("without data, keeps the template static (no expansion)", () => {
    const { doc, frameId } = invoiceTemplate();
    const html = exportToHtml(doc, frameId);
    expect(html).toContain("{{item.name}}");
    expect(html).toContain("Discount:"); // visibleWhen ignored without data
  });
});
