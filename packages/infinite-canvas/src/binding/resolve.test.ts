import { describe, expect, it } from "vitest";
import {
  hasBinding,
  resolvePath,
  resolveTemplate,
  resolveValue,
} from "./resolve";

const data = {
  invoice: { number: "INV-2043", total: 12400, date: "2026-01-15" },
  customer: { name: "Acme Corp" },
};

describe("data binding", () => {
  it("resolves dotted paths", () => {
    expect(resolvePath(data, "customer.name")).toBe("Acme Corp");
    expect(resolvePath(data, "invoice.total")).toBe(12400);
    expect(resolvePath(data, "missing.path")).toBeUndefined();
  });

  it("rejects prototype-polluting paths", () => {
    expect(resolvePath(data, "__proto__.x")).toBeUndefined();
    expect(resolvePath(data, "constructor.prototype")).toBeUndefined();
  });

  it("resolves templates with text interpolation", () => {
    expect(resolveTemplate("Invoice {{invoice.number}}", data)).toBe(
      "Invoice INV-2043",
    );
    expect(resolveTemplate("Hi {{customer.name}}!", data)).toBe(
      "Hi Acme Corp!",
    );
  });

  it("applies the currency filter", () => {
    expect(resolveTemplate("Total: {{invoice.total | currency}}", data)).toBe(
      "Total: $12,400.00",
    );
    expect(resolveTemplate("{{invoice.total | currency:EUR}}", data)).toContain(
      "12,400",
    );
  });

  it("resolveValue keeps a lone binding's raw type (number stays number)", () => {
    expect(resolveValue("{{invoice.total}}", data)).toBe(12400);
    expect(resolveValue("total is {{invoice.total}}", data)).toBe(
      "total is 12400",
    );
  });

  it("resolveValue recurses into objects/arrays", () => {
    const out = resolveValue(
      { a: "{{customer.name}}", b: [1, "{{invoice.number}}"] },
      data,
    );
    expect(out).toEqual({ a: "Acme Corp", b: [1, "INV-2043"] });
  });

  it("hasBinding detects expressions", () => {
    expect(hasBinding("{{x}}")).toBe(true);
    expect(hasBinding("plain")).toBe(false);
  });

  it("missing data resolves to empty string in templates", () => {
    expect(resolveTemplate("x{{nope.here}}y", data)).toBe("xy");
  });
});
