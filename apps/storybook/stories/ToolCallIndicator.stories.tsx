import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack, ToolCallIndicator } from "@oppulence/design-system";

const meta = {
  title: "Molecules/ToolCallIndicator",
  component: ToolCallIndicator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ToolCallIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Stack gap="2">
      <ToolCallIndicator toolName="web_search" />
      <ToolCallIndicator toolName="getBurnRate" />
    </Stack>
  ),
};
