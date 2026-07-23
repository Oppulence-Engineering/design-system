/* Executable proof of the pure P0 core (run: node scripts/smoke.cjs).
   Stands in for vitest until dev deps are installed; exercises the same invariants. */
const assert = require("node:assert");
const D = "../dist-smoke";

const { generateKeyBetween, generateNKeysBetween } = require(`${D}/document/fractional-index.js`);
const { applyBatch, createState } = require(`${D}/operations/apply.js`);
const { invertBatch } = require(`${D}/operations/invert.js`);
const { buildChildrenIndex, childrenOf } = require(`${D}/operations/children-index.js`);
const { createHistory, pushLocal, popUndo, willCoalesce } = require(`${D}/operations/history.js`);
const { sanitizeNode, isSafeUrl, isSafeCustomCss } = require(`${D}/document/sanitize.js`);
const { ROOT_PARENT } = require(`${D}/document/ids.js`);
const { zoomAtPoint, screenToCanvas, cameraToFit } = require(`${D}/viewport/camera.js`);
const f = require(`${D}/testing/factories.js`);

let passed = 0;
const check = (name, fn) => {
  fn();
  passed++;
  console.log("  ok -", name);
};

// --- fractional index ---
check("fractional keys stay strictly ordered under 300 subdivisions", () => {
  let lo = generateKeyBetween(null, null);
  let hi = generateKeyBetween(lo, null);
  for (let i = 0; i < 300; i++) {
    const mid = generateKeyBetween(lo, hi);
    assert.ok(lo < mid && mid < hi, `order broken at ${i}: ${lo} ${mid} ${hi}`);
    if (i % 2 === 0) hi = mid;
    else lo = mid;
  }
});
check("generateNKeysBetween returns increasing keys", () => {
  const keys = generateNKeysBetween(null, null, 30);
  assert.strictEqual(keys.length, 30);
  for (let i = 1; i < keys.length; i++) assert.ok(keys[i - 1] < keys[i]);
});
check("no trailing zero digit", () => {
  for (let i = 0; i < 100; i++) {
    const a = generateKeyBetween(null, null);
    assert.ok(!generateKeyBetween(null, a).endsWith("0"));
  }
});

// --- apply / invert round-trip incl JSON ---
check("apply∘invert restores prior document across op types", () => {
  const frame = f.makeFrame({ id: "f1" });
  const el = f.makeElement(frame.id, { id: "e1" });
  const state = createState(f.makeDocument([frame, el]));
  const batches = [
    [{ type: "set-node-style", nodeId: el.id, set: { opacity: 0.5, color: "#f00" }, unset: [] }],
    [{ type: "set-node-geometry", nodeId: frame.id, x: 100, y: 50, width: 800 }],
    [{ type: "set-node-flags", nodeId: el.id, name: "renamed", visible: false }],
    [{ type: "remove-node", nodeId: el.id }],
    [{ type: "move-node", nodeId: frame.id, parentId: null, sortKey: "z9" }],
  ];
  for (const ops of batches) {
    const inverse = invertBatch(state, ops);
    const after = applyBatch(state, ops);
    const restored = applyBatch(after, inverse);
    assert.deepStrictEqual(restored.document.nodes, state.document.nodes);
  }
});
check("inverse survives JSON round-trip (add-key inverts to unset)", () => {
  const frame = f.makeFrame({ id: "f1" });
  const el = f.makeElement(frame.id, { id: "e1" });
  const state = createState(f.makeDocument([frame, el]));
  const ops = [{ type: "set-node-style", nodeId: el.id, set: { color: "#abc" }, unset: [] }];
  const inverse = JSON.parse(JSON.stringify(invertBatch(state, ops)));
  const after = applyBatch(state, JSON.parse(JSON.stringify(ops)));
  assert.strictEqual(after.document.nodes[el.id].style.color, "#abc");
  const restored = applyBatch(after, inverse);
  assert.ok(!("color" in restored.document.nodes[el.id].style), "color should be gone after undo");
});
check("structural sharing: untouched node keeps reference; non-structural keeps index", () => {
  const frame = f.makeFrame({ id: "f1" });
  const a = f.makeElement(frame.id, { id: "a" });
  const b = f.makeElement(frame.id, { id: "b" });
  const state = createState(f.makeDocument([frame, a, b]));
  const after = applyBatch(state, [{ type: "set-node-style", nodeId: a.id, set: { opacity: 0.2 }, unset: [] }]);
  assert.notStrictEqual(after.document.nodes.a, state.document.nodes.a);
  assert.strictEqual(after.document.nodes.b, state.document.nodes.b);
  assert.strictEqual(after.childrenIndex, state.childrenIndex);
});

// --- children index: order, ties, orphan, cycle ---
check("siblings ordered by (sortKey, id) with id tie-break", () => {
  const frame = f.makeFrame({ id: "f1" });
  const a = f.makeElement(frame.id, { id: "y", sortKey: "same" });
  const b = f.makeElement(frame.id, { id: "x", sortKey: "same" });
  const index = buildChildrenIndex(f.makeDocument([frame, a, b]).nodes);
  assert.deepStrictEqual(childrenOf(index, frame.id), ["x", "y"]);
});
check("orphan repairs to root", () => {
  const frame = f.makeFrame({ id: "f1" });
  const orphan = f.makeElement("ghost", { id: "o" });
  const index = buildChildrenIndex(f.makeDocument([frame, orphan]).nodes);
  assert.ok(childrenOf(index, ROOT_PARENT).includes("o"));
});
check("parent cycle broken deterministically (largest id → root)", () => {
  const a = { ...f.makeFrame({ id: "a" }), parentId: "b" };
  const b = { ...f.makeFrame({ id: "b" }), parentId: "a" };
  const index = buildChildrenIndex(f.makeDocument([a, b]).nodes);
  assert.ok(childrenOf(index, ROOT_PARENT).includes("b"));
  assert.ok(childrenOf(index, "b").includes("a"));
});

// --- history ---
check("gesture coalescing ignores time; key coalescing respects window", () => {
  const fwd = [{ type: "set-text", nodeId: "n", text: "a" }];
  const inv = [{ type: "set-text", nodeId: "n", text: "b" }];
  let h = createHistory();
  h = pushLocal(h, { undo: inv, redo: fwd, gestureId: "g", timestamp: 0 });
  h = pushLocal(h, { undo: inv, redo: fwd, gestureId: "g", timestamp: 999999 });
  assert.strictEqual(h.undoStack.length, 1);
  let h2 = createHistory();
  h2 = pushLocal(h2, { undo: inv, redo: fwd, coalesceKey: "k", timestamp: 0 });
  h2 = pushLocal(h2, { undo: inv, redo: fwd, coalesceKey: "k", timestamp: 1000 });
  assert.strictEqual(h2.undoStack.length, 2);
  assert.strictEqual(willCoalesce(h, { undo: inv, redo: fwd, gestureId: "g", timestamp: 5 }), true);
});

// --- sanitize (security) ---
check("NaN geometry flagged invalid and repaired finite", () => {
  const r = sanitizeNode(f.makeFrame({ id: "x", x: NaN }));
  assert.strictEqual(r.invalid, true);
  assert.ok(Number.isFinite(r.node.x));
});
check("prototype pollution blocked across namespaces (no Object.prototype mutation)", () => {
  const cmp = f.makeComponent("p", { id: "c", props: JSON.parse('{"__proto__":{"polluted":1},"ok":"v"}') });
  const r = sanitizeNode(cmp);
  assert.ok(!Object.prototype.hasOwnProperty.call(r.node.props, "__proto__"));
  assert.strictEqual({}.polluted, undefined);
});
check("css allowlist + url schemes", () => {
  assert.strictEqual(isSafeCustomCss("position", "fixed"), false);
  assert.strictEqual(isSafeCustomCss("background", 'url("https://evil")'), false);
  assert.strictEqual(isSafeCustomCss("color", "red"), true);
  assert.strictEqual(isSafeUrl("javascript:alert(1)"), false);
  assert.strictEqual(isSafeUrl("data:text/html,x"), false);
  assert.strictEqual(isSafeUrl("https://ok/x"), true);
  assert.strictEqual(isSafeUrl("/rel"), true);
});

// --- camera ---
check("zoomAtPoint keeps the cursor-anchored canvas point invariant", () => {
  const cam = { x: 10, y: 20, zoom: 1 };
  const screenPoint = { x: 200, y: 150 };
  const before = screenToCanvas(screenPoint, cam);
  const next = zoomAtPoint(cam, screenPoint, 2.5);
  const after = screenToCanvas(screenPoint, next);
  assert.ok(Math.abs(before.x - after.x) < 1e-9 && Math.abs(before.y - after.y) < 1e-9);
});
check("cameraToFit never yields NaN/∞ and handles empty content", () => {
  const empty = cameraToFit(null, { width: 800, height: 600 });
  assert.ok(Number.isFinite(empty.zoom) && empty.zoom > 0);
  const fit = cameraToFit({ x: 0, y: 0, width: 400, height: 300 }, { width: 800, height: 600 });
  assert.ok(Number.isFinite(fit.zoom) && Number.isFinite(fit.x) && Number.isFinite(fit.y));
});

console.log(`\nAll ${passed} smoke checks passed.`);
