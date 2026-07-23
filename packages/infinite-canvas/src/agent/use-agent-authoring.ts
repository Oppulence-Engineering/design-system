/**
 * `useAgentAuthoring` (§ AI op-authoring) — the hook a consumer wires to its copilot.
 * Give it the model's high-level commands (or raw JSON) and it validates, compiles to a
 * guarded operation batch, and applies it (one undo entry). Also exposes the JSON-Schema
 * tool contract and a `describe()` of the current canvas for the model's context.
 */

"use client";

import * as React from "react";
import { z } from "zod";
import { asNodeId } from "../document/ids";
import type { CanvasState } from "../operations/apply";
import { safeParseOperations } from "../operations/schema";
import { useCanvas } from "../store/context";
import {
  agentCommandsJsonSchema,
  agentCommandsSchema,
  compileAgentCommands,
  type AgentCommand,
} from "./commands";
import { describeCanvas, type CanvasDescription } from "./describe";

export interface AgentRunResult {
  ok: boolean;
  applied: number;
  refs: Record<string, string>;
  error?: string;
}

export interface AgentAuthoring {
  /** Compile + apply high-level commands. Returns the ref→id map. */
  run: (commands: readonly AgentCommand[]) => AgentRunResult;
  /** Validate + run commands from untrusted JSON (an LLM tool call). */
  runCommandsJson: (json: unknown) => AgentRunResult;
  /** Validate + apply RAW operations from JSON (lower-level tool contract). */
  runOperationsJson: (json: unknown) => AgentRunResult;
  /** JSON Schema for the high-level command tool. */
  commandsJsonSchema: () => Record<string, unknown>;
  /** A compact description of the canvas + selection for the model's context. */
  describe: () => CanvasDescription;
}

export function useAgentAuthoring(): AgentAuthoring {
  const { documentStore, sessionStore, idFactory, registry } = useCanvas();

  return React.useMemo<AgentAuthoring>(() => {
    const currentState = (): CanvasState => {
      const s = documentStore.getState();
      return { document: s.document, childrenIndex: s.childrenIndex };
    };

    const run = (commands: readonly AgentCommand[]): AgentRunResult => {
      try {
        const { ops, refs } = compileAgentCommands(commands, {
          state: currentState(),
          createNodeId: () => asNodeId(idFactory.nodeId()),
        });
        if (ops.length > 0) documentStore.getState().apply(ops);
        return { ok: true, applied: ops.length, refs };
      } catch (error) {
        return { ok: false, applied: 0, refs: {}, error: String(error) };
      }
    };

    return {
      run,
      runCommandsJson: (json) => {
        const parsed = agentCommandsSchema.safeParse(json);
        if (!parsed.success) {
          return {
            ok: false,
            applied: 0,
            refs: {},
            error: z.prettifyError(parsed.error),
          };
        }
        return run(parsed.data);
      },
      runOperationsJson: (json) => {
        const parsed = safeParseOperations(json);
        if (!parsed.success) {
          return {
            ok: false,
            applied: 0,
            refs: {},
            error: z.prettifyError(parsed.error),
          };
        }
        // Raw ops are still sanitized on apply (store boundary).
        documentStore.getState().apply(parsed.data);
        return { ok: true, applied: parsed.data.length, refs: {} };
      },
      commandsJsonSchema: agentCommandsJsonSchema,
      describe: () =>
        describeCanvas(
          currentState(),
          sessionStore.getState().selection,
          registry,
        ),
    };
  }, [documentStore, sessionStore, idFactory, registry]);
}
