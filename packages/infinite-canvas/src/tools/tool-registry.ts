/**
 * Tool registry (§7). A plain map seeded with built-ins; consumers add custom tools.
 */

import { createFrameTool } from "./frame-tool";
import { createHandTool } from "./hand-tool";
import { createSelectTool } from "./select-tool";
import { createTextTool } from "./text-tool";
import type { Tool, ToolId } from "./tool";
import { TOOL_SELECT } from "./tool";

export class ToolRegistry {
  private tools = new Map<ToolId, Tool>();

  constructor(tools: readonly Tool[] = []) {
    for (const tool of builtInTools()) this.tools.set(tool.id, tool);
    for (const tool of tools) this.tools.set(tool.id, tool);
  }

  get(id: ToolId): Tool | undefined {
    return this.tools.get(id);
  }

  has(id: ToolId): boolean {
    return this.tools.has(id);
  }

  ids(): ToolId[] {
    return [...this.tools.keys()];
  }

  get defaultToolId(): ToolId {
    return TOOL_SELECT;
  }
}

/** The built-in tool set. */
export function builtInTools(): Tool[] {
  return [
    createSelectTool(),
    createHandTool(),
    createFrameTool(),
    createTextTool(),
  ];
}
