"use client";

import { Icons } from "../atoms/icons";
import { TextShimmer } from "../atoms/text-shimmer";

export const toolDisplayConfig = {
  getBurnRate: {
    displayText: "Getting Burn Rate Data",
    icon: Icons.TrendingUp,
  },
  web_search: {
    displayText: "Searching the Web",
    icon: Icons.Search,
  },
} as const;

export type SupportedToolName = keyof typeof toolDisplayConfig;

export interface ToolCallIndicatorProps {
  toolName: SupportedToolName;
}

export function ToolCallIndicator({ toolName }: ToolCallIndicatorProps) {
  const config = toolDisplayConfig[toolName];

  if (!config) {
    return null;
  }

  return (
    <div className="flex justify-start mt-3 animate-fade-in">
      <div className="border px-3 py-1 flex items-center gap-2 w-fit">
        <div className="flex items-center justify-center size-3.5">
          <config.icon size={14} />
        </div>
        <TextShimmer
          size="xs"
          baseColor="#707070"
          gradientColor="#111111"
          duration={1}
        >
          {config.displayText}
        </TextShimmer>
      </div>
    </div>
  );
}
