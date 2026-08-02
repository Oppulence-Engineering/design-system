/*
 * This module was a second, independently maintained copy of
 * `src/flattenAttributes.ts`. Both were reachable from the package root — the
 * root index re-exports these names explicitly *and* star-exports `./utils` —
 * so the two implementations could drift apart while callers had no way to
 * tell which one they had. They had already drifted, and a fix applied to one
 * left the other untouched.
 *
 * The implementation now lives in one place; this file forwards to it so the
 * `./utils` entry point keeps the same exports.
 */
export {
  CIRCULAR_REFERENCE_SENTINEL,
  DEPTH_LIMIT_SENTINEL,
  flattenAttributes,
  MAX_FLATTEN_DEPTH,
  MAX_UNFLATTEN_ARRAY_LENGTH,
  NULL_SENTINEL,
  primitiveValueOrflattenedAttributes,
  unflattenAttributes,
} from "../flattenAttributes.ts";
export type { Attributes } from "../flattenAttributes.ts";
