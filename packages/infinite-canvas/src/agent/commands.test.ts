import { describe, expect, it } from "vitest";
import { createSeededIdFactory, ROOT_PARENT } from "../document/ids";
import { createState } from "../operations/apply";
import { applyBatch } from "../operations/apply";
import { buildChildrenIndex, childrenOf } from "../operations/children-index";
import { makeDocument } from "../testing/factories";
import {
  agentCommandsSchema,
  agentCommandsJsonSchema,
  compileAgentCommands,
  type AgentCommand,
} from "./commands";

function compile(commands: AgentCommand[]) {
  const idf = createSeededIdFactory("a");
  const state = createState(makeDocument([]));
  return compileAgentCommands(commands, {
    state,
    createNodeId: () => idf.nodeId(),
  });
}

describe("compileAgentCommands", () => {
  it("builds a nested design from ref-based commands", () => {
    const { ops, refs } = compile([
      {
        op: "add-frame",
        ref: "card",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        layout: "column",
        background: "#fff",
      },
      {
        op: "add-text",
        ref: "title",
        parent: "card",
        text: "Invoice",
        fontSize: 24,
      },
      { op: "add-text", ref: "total", parent: "card", text: "$0.00" },
    ]);
    expect(ops).toHaveLength(3);
    expect(refs.card).toBeDefined();
    // Children resolve to the frame's id and keep insertion order.
    let state = createState(makeDocument([]));
    state = applyBatch(state, ops);
    const index = buildChildrenIndex(state.document.nodes);
    const kids = childrenOf(index, refs.card!);
    expect(kids).toEqual([refs.title, refs.total]);
    const frame = state.document.nodes[refs.card!];
    expect(frame?.type).toBe("frame");
    if (frame?.type === "frame") {
      expect(frame.style.display).toBe("flex");
      expect(frame.style.background).toEqual({ type: "solid", color: "#fff" });
    }
  });

  it("targets existing nodes by id for set-style / set-text", () => {
    const idf = createSeededIdFactory("a");
    const first = compileAgentCommands(
      [{ op: "add-text", ref: "t", text: "hi" }],
      {
        state: createState(makeDocument([])),
        createNodeId: () => idf.nodeId(),
      },
    );
    let state = createState(makeDocument([]));
    state = applyBatch(state, first.ops);
    const nodeId = first.refs.t!;
    // Now target it by its real id.
    const second = compileAgentCommands(
      [{ op: "set-text", ref: nodeId, text: "bye" }],
      {
        state,
        createNodeId: () => idf.nodeId(),
      },
    );
    expect(second.ops).toEqual([{ type: "set-text", nodeId, text: "bye" }]);
  });

  it("validates commands via the zod schema", () => {
    const ok = agentCommandsSchema.safeParse([{ op: "add-text", text: "x" }]);
    expect(ok.success).toBe(true);
    const bad = agentCommandsSchema.safeParse([{ op: "add-text" }]); // missing text
    expect(bad.success).toBe(false);
    const badTag = agentCommandsSchema.safeParse([
      { op: "add-element", tag: "script" },
    ]);
    expect(badTag.success).toBe(false); // script not in the safe tag enum
  });

  it("emits a JSON schema for the tool contract", () => {
    const schema = agentCommandsJsonSchema();
    expect(schema).toBeTypeOf("object");
    expect(JSON.stringify(schema)).toContain("add-frame");
  });
});
