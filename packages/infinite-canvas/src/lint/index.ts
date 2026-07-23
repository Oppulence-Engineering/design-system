/**
 * Design linting (§ a11y) — contrast/alt/font checks. Pure lint fns are yjs-free.
 */

export { contrastRatio, luminance, meetsAA, parseColor } from "./contrast";
export type { Rgb } from "./contrast";
export { lintDocument, lintNode } from "./lint";
export type { LintIssue, LintSeverity } from "./lint";
export { useDesignLint } from "./hooks";
export type { DesignLint } from "./hooks";
