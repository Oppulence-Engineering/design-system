/**
 * Data-binding resolver (§ templates). Text, attrs, and component props can contain
 * `{{ path }}` (or `{{ path | filter:arg }}`) expressions; with a data context supplied
 * they resolve to real values — turning a design into a template that renders with live
 * invoice/report data. Pure and safe: NO eval — just path lookup + a small filter set
 * (consumers can extend). Without a data context the raw `{{…}}` shows as a placeholder.
 */

import type { JsonValue } from "../document/json";

export type BindingData = Record<string, unknown>;
export type BindingFilter = (value: unknown, ...args: string[]) => unknown;
export type FilterMap = Record<string, BindingFilter>;

const BINDING_RE = /\{\{\s*([^}]+?)\s*\}\}/g;

/** Look up a dotted/indexed path in a data object (safe; forbidden segments rejected). */
export function resolvePath(data: BindingData, path: string): unknown {
  let current: unknown = data;
  for (const rawKey of path.split(".")) {
    const key = rawKey.trim();
    if (key === "__proto__" || key === "constructor" || key === "prototype")
      return undefined;
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Built-in filters — currency/number/date are the load-bearing ones for invoices/reports. */
export const DEFAULT_FILTERS: FilterMap = {
  currency: (v, code = "USD") => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return String(v ?? "");
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
    }).format(n);
  },
  number: (v, digits) => {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n)) return String(v ?? "");
    const opts =
      digits !== undefined
        ? {
            minimumFractionDigits: Number(digits),
            maximumFractionDigits: Number(digits),
          }
        : undefined;
    return new Intl.NumberFormat(undefined, opts).format(n);
  },
  date: (v, style = "medium") => {
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return String(v ?? "");
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: style as "medium",
    }).format(d);
  },
  upper: (v) => String(v ?? "").toUpperCase(),
  lower: (v) => String(v ?? "").toLowerCase(),
  fallback: (v, alt = "") => (v == null || v === "" ? alt : v),
};

function applyExpression(
  expr: string,
  data: BindingData,
  filters: FilterMap,
): unknown {
  const [pathPart, ...filterParts] = expr.split("|");
  let value = resolvePath(data, (pathPart ?? "").trim());
  for (const part of filterParts) {
    const trimmed = part.trim();
    const [name, ...argStr] = trimmed.split(":");
    const filter = filters[(name ?? "").trim()];
    if (filter !== undefined) {
      const args = (argStr.join(":") || "")
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0);
      value = filter(value, ...args);
    }
  }
  return value;
}

/** True if a string contains a `{{…}}` binding. */
export function hasBinding(str: string): boolean {
  BINDING_RE.lastIndex = 0;
  return BINDING_RE.test(str);
}

/** Resolve all `{{…}}` in a string against the data context. */
export function resolveTemplate(
  template: string,
  data: BindingData,
  filters: FilterMap = DEFAULT_FILTERS,
): string {
  return template.replace(BINDING_RE, (_match, expr: string) => {
    const value = applyExpression(expr, data, filters);
    return value == null ? "" : String(value);
  });
}

/**
 * Resolve bindings inside an arbitrary JSON value (component props / attrs). String
 * leaves are template-resolved; a string that is EXACTLY one binding resolves to the raw
 * value (so `{{invoice.total}}` can stay a number for a numeric prop).
 */
export function resolveValue(
  value: JsonValue,
  data: BindingData,
  filters: FilterMap = DEFAULT_FILTERS,
): JsonValue {
  if (typeof value === "string") {
    const exact = /^\{\{\s*([^}]+?)\s*\}\}$/.exec(value);
    if (exact !== null) {
      const resolved = applyExpression(exact[1]!, data, filters);
      return (resolved ?? null) as JsonValue;
    }
    return hasBinding(value) ? resolveTemplate(value, data, filters) : value;
  }
  if (Array.isArray(value))
    return value.map((v) => resolveValue(v, data, filters));
  if (value !== null && typeof value === "object") {
    const out: Record<string, JsonValue> = {};
    for (const k in value)
      out[k] = resolveValue(
        (value as Record<string, JsonValue>)[k]!,
        data,
        filters,
      );
    return out;
  }
  return value;
}

/** Evaluate a `visibleWhen` expression to a boolean (falsy: undefined/null/false/0/""/[]). */
export function resolveCondition(
  expr: string,
  data: BindingData,
  filters: FilterMap = DEFAULT_FILTERS,
): boolean {
  // Support a leading "!" for negation.
  const negate = expr.trim().startsWith("!");
  const clean = negate ? expr.trim().slice(1).trim() : expr.trim();
  const value =
    clean.length === 0 ? undefined : applyExpression(clean, data, filters);
  let truthy: boolean;
  if (Array.isArray(value)) truthy = value.length > 0;
  else truthy = Boolean(value);
  return negate ? !truthy : truthy;
}

/** Resolve a `repeat` array path to a JS array (empty if not an array). */
export function resolveArray(expr: string, data: BindingData): unknown[] {
  const value = resolvePath(data, expr.trim());
  return Array.isArray(value) ? value : [];
}

/** Build the item-scoped data for one repeat iteration (merged with the parent scope). */
export function itemScope(
  parent: BindingData,
  item: unknown,
  index: number,
  as = "item",
): BindingData {
  return { ...parent, [as]: item, item, index, "@index": index };
}

/** Resolve a record of string attrs. */
export function resolveAttrs(
  attrs: Record<string, string>,
  data: BindingData,
  filters: FilterMap = DEFAULT_FILTERS,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k in attrs)
    out[k] = hasBinding(attrs[k]!)
      ? resolveTemplate(attrs[k]!, data, filters)
      : attrs[k]!;
  return out;
}
