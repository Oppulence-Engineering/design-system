/**
 * Fractional indexing for sibling order (§3 document model).
 *
 * Sibling order is a per-node `sortKey` STRING, not a `children: NodeId[]` array —
 * arrays are the classic CRDT trap (concurrent inserts at the same index conflict),
 * whereas a per-node string merges as a trivial last-writer-wins register. To insert
 * a node between two siblings we generate a key strictly lexicographically between
 * their keys; order is `(sortKey, nodeId)` so exact concurrent-tie keys still resolve
 * identically on every client.
 *
 * Keys are fractions over a base-62 alphabet whose characters are already in ascending
 * char-code order, so plain string comparison equals fractional order. The algorithm
 * never emits a trailing "0" digit (which would break lexicographic==fractional), and
 * keys may grow in length under adversarial interleaving — the `rebalance-sort-keys`
 * operation exists to reset growth.
 *
 * Self-contained (no `fractional-indexing` dependency) so the ordering core is testable
 * in isolation and carries jitter, which the upstream package does not.
 */

// Ascending char-code order: '0'..'9' < 'A'..'Z' < 'a'..'z'.
const DIGITS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const BASE = DIGITS.length; // 62
const MID = Math.floor(BASE / 2);

function digitAt(key: string, i: number): number {
  if (i >= key.length) return 0;
  const idx = DIGITS.indexOf(key.charAt(i));
  if (idx < 0)
    throw new Error(`invalid sortKey digit: ${JSON.stringify(key.charAt(i))}`);
  return idx;
}

/** Smallest canonical key strictly greater than `a`, with no upper bound. */
function keyAfter(a: string): string {
  // Strip trailing max digits, then increment the last non-max digit.
  let i = a.length - 1;
  while (i >= 0 && digitAt(a, i) === BASE - 1) i--;
  if (i < 0) {
    // `a` is empty or all-max: must grow by one middle digit.
    return a + DIGITS.charAt(MID);
  }
  return a.slice(0, i) + DIGITS.charAt(digitAt(a, i) + 1);
}

/**
 * Shortest canonical key strictly between `a` and `b` (exclusive), where `a` is the
 * low bound ("" = fraction 0) and `b` is the high bound (null = +infinity). Requires
 * `a < b` lexicographically when `b` is non-null.
 */
function keyBetweenBounded(a: string, b: string | null): string {
  if (b !== null && a >= b) {
    throw new Error(
      `sortKey bounds out of order: ${JSON.stringify(a)} >= ${JSON.stringify(b)}`,
    );
  }
  let prefix = "";
  let i = 0;
  for (;;) {
    const da = digitAt(a, i);
    const db = b === null ? BASE : i < b.length ? digitAt(b, i) : 0;
    if (da === db) {
      // Shared digit — descend, carrying it into the prefix.
      prefix += DIGITS.charAt(da);
      i += 1;
      continue;
    }
    if (db - da >= 2) {
      // Room for a strictly-between digit at this position; any suffix is valid.
      return prefix + DIGITS.charAt(da + Math.floor((db - da) / 2));
    }
    // db - da === 1: no room here. Fix this digit to `da` (keeps result < b) and
    // find any key strictly greater than a's tail (b is already satisfied).
    return prefix + DIGITS.charAt(da) + keyAfter(a.slice(i + 1));
  }
}

/**
 * Generate a key strictly between `before` and `after` (either may be null for an
 * open bound). `before` must sort before `after`.
 */
export function generateKeyBetween(
  before: string | null,
  after: string | null,
): string {
  if (before !== null && after !== null && before >= after) {
    throw new Error(
      `generateKeyBetween: before must sort before after (${JSON.stringify(before)} >= ${JSON.stringify(after)})`,
    );
  }
  if (before === null && after === null) return DIGITS.charAt(MID);
  if (before === null) return keyBetweenBounded("", after);
  return keyBetweenBounded(before, after);
}

/**
 * A jitter suffix reduces (but does not eliminate) identical keys from two clients
 * inserting between the same neighbors; the `(sortKey, nodeId)` tie-break is the
 * hard guarantee. Injectable RNG so callers/tests stay deterministic.
 */
export function jitterSuffix(
  rng: () => number = Math.random,
  length = 3,
): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    // Avoid a trailing "0" so canonicality (lexicographic==fractional) holds; use 1..BASE-1.
    out += DIGITS.charAt(1 + Math.floor(rng() * (BASE - 1)));
  }
  return out;
}

/** `generateKeyBetween` plus a jitter suffix appended (still strictly between bounds). */
export function generateJitteredKeyBetween(
  before: string | null,
  after: string | null,
  rng: () => number = Math.random,
): string {
  const base = generateKeyBetween(before, after);
  const jittered = base + jitterSuffix(rng);
  // Appending digits keeps `jittered > base >= before`; and `jittered < after` because
  // `base < after` already differs at some position <= base.length.
  return jittered;
}

/**
 * Generate `count` evenly-ordered keys between two bounds (used for seeding and for
 * `rebalance-sort-keys`). Returned keys are strictly increasing and within bounds.
 */
export function generateNKeysBetween(
  before: string | null,
  after: string | null,
  count: number,
): string[] {
  if (count <= 0) return [];
  if (count === 1) return [generateKeyBetween(before, after)];
  const mid = generateKeyBetween(before, after);
  const half = Math.floor(count / 2);
  return [
    ...generateNKeysBetween(before, mid, half),
    mid,
    ...generateNKeysBetween(mid, after, count - half - 1),
  ];
}
