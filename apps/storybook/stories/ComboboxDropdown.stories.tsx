import type { Meta, StoryObj } from "@storybook/react-vite";
import { ComboboxDropdown, Stack, Text } from "@oppulence/design-system";
import { useState } from "react";

type Team = {
  id: string;
  label: string;
  disabled?: boolean;
};

const teams: Team[] = [
  { id: "design", label: "Design" },
  { id: "marketing", label: "Marketing" },
  { id: "sales", label: "Sales" },
  { id: "ops", label: "Operations" },
  { id: "finance", label: "Finance", disabled: true },
];

const meta = {
  title: "Organisms/ComboboxDropdown",
  component: ComboboxDropdown,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ComboboxDropdown>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [selected, setSelected] = useState<Team | undefined>(teams[0]);

    return (
      <Stack gap="3">
        <div className="w-[280px]">
          <ComboboxDropdown
            items={teams}
            selectedItem={selected}
            onSelect={setSelected}
            placeholder="Select a team"
            searchPlaceholder="Search teams"
          />
        </div>
        <Text size="sm" variant="muted">
          Selected: {selected?.label ?? "None"}
        </Text>
      </Stack>
    );
  },
};
