import type { Meta, StoryObj } from "@storybook/react-vite";
import { Suggestion, Suggestions, Text } from "@oppulence/design-system";
import { useState } from "react";

const meta = {
  title: "Molecules/Suggestion",
  component: Suggestions,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Suggestions>;

export default meta;
type Story = StoryObj<typeof meta>;

const prompts = [
  "Summarize the highlights",
  "Compare with last quarter",
  "Draft customer update",
  "List top risks",
];

export const Default: Story = {
  render: () => {
    const [selected, setSelected] = useState<string | null>(null);

    return (
      <div className="w-[520px] space-y-3">
        <Suggestions>
          {prompts.map((prompt) => (
            <Suggestion
              key={prompt}
              suggestion={prompt}
              onClick={(value) => setSelected(value)}
              variant={selected === prompt ? "secondary" : "outline"}
              size="sm"
            />
          ))}
        </Suggestions>
        <Text size="sm" variant="muted">
          Selected: {selected ?? "None"}
        </Text>
      </div>
    );
  },
};
