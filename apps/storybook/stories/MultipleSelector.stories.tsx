import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  MultipleSelector,
  type Option,
  Stack,
  Text,
} from "@oppulence/design-system";
import { useState } from "react";

const meta = {
  title: "Organisms/MultipleSelector",
  component: MultipleSelector,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof MultipleSelector>;

export default meta;
type Story = StoryObj<typeof meta>;

const options: Option[] = [
  { value: "research", label: "Research" },
  { value: "design", label: "Design" },
  { value: "engineering", label: "Engineering" },
  { value: "marketing", label: "Marketing" },
  { value: "sales", label: "Sales" },
];

export const Default: Story = {
  render: () => {
    const [selected, setSelected] = useState<Option[]>([options[1]]);

    return (
      <Stack gap="3">
        <div className="w-[360px]">
          <MultipleSelector
            options={options}
            value={selected}
            onChange={setSelected}
            placeholder="Select teams"
          />
        </div>
        <Text size="sm" variant="muted">
          Selected: {selected.map((item) => item.label).join(", ") || "None"}
        </Text>
      </Stack>
    );
  },
};
