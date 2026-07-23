/**
 * Prototype-pollution guard (§3c security boundary).
 *
 * Documents are untrusted: in collaboration, node ids, style keys, component-prop
 * keys and attribute names all originate from other users' clients. A hostile peer
 * that sets a dotted Y.Map key like `componentProps.__proto__.polluted` would, when
 * un-flattened with a naive `target[a][b] = v`, walk through `__proto__` and mutate
 * `Object.prototype` inside the CONSUMER's app — a cross-tenant XSS gadget.
 *
 * The defense is BY SHAPE, not by enumerating known-dangerous locations (an
 * enumerated list drifts from the real set of un-flattened namespaces). A single
 * `hasForbiddenSegment` runs on every segment of every dotted key, everywhere.
 */

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "constructor", "prototype"]);

/** True if a single (already-split) key segment is unsafe to use as an object key. */
export function isForbiddenSegment(segment: string): boolean {
  return FORBIDDEN_SEGMENTS.has(segment);
}

/**
 * True if a dotted key contains any forbidden segment. Applied to every dotted
 * Y.Map / JSON key before un-flattening, and to raw nodeId / parentId strings.
 */
export function hasForbiddenSegment(dottedKey: string): boolean {
  const segments = dottedKey.split(".");
  for (const segment of segments) {
    if (isForbiddenSegment(segment)) return true;
  }
  return false;
}

/**
 * Create a null-prototype record. Used for the node map and childrenIndex so that
 * even if a forbidden key ever slipped through, there is no prototype chain to
 * pollute. Note: immutable-update helpers must RE-ESTABLISH the null prototype —
 * a bare `{ ...old, [id]: n }` spread silently reintroduces `Object.prototype`.
 */
export function nullRecord<V>(): Record<string, V> {
  return Object.create(null) as Record<string, V>;
}

/**
 * Immutable single-key update that preserves a null prototype (unlike object spread).
 * `{ ...old, [key]: value }` produces an `Object.prototype`-backed object; this does not.
 */
export function withKey<V>(
  record: Record<string, V>,
  key: string,
  value: V,
): Record<string, V> {
  const next = Object.assign(nullRecord<V>(), record);
  next[key] = value;
  return next;
}

/** Immutable single-key delete that preserves a null prototype. */
export function withoutKey<V>(
  record: Record<string, V>,
  key: string,
): Record<string, V> {
  const next = Object.assign(nullRecord<V>(), record);
  delete next[key];
  return next;
}
