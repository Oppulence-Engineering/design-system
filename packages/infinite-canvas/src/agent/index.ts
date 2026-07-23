/**
 * `@oppulence/infinite-canvas/agent` — AI op-authoring surface. High-level, LLM-friendly
 * authoring commands + a compiler to guarded operation batches, JSON-Schema tool
 * contracts, and a canvas describer. yjs-free.
 */

export {
  agentCommandSchema,
  agentCommandsSchema,
  agentCommandsJsonSchema,
  compileAgentCommands,
} from "./commands";
export type { AgentCommand, CompileContext, CompileResult } from "./commands";
export { describeCanvas } from "./describe";
export type { CanvasDescription, DescribedNode } from "./describe";
export { useAgentAuthoring } from "./use-agent-authoring";
export type { AgentAuthoring, AgentRunResult } from "./use-agent-authoring";

// Low-level operation schemas (also re-exported from ./document).
export {
  operationSchema,
  operationArraySchema,
  operationsJsonSchema,
  parseOperations,
  safeParseOperations,
} from "../operations/schema";
