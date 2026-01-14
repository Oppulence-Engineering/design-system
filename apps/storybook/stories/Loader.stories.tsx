import type { Meta, StoryObj } from "@storybook/react-vite";
import { Loader, Stack } from "@oppulence/design-system";

const meta = {
  title: "Atoms/Loader",
  component: Loader,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Loader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Stack direction="row" gap="4">
      <Loader size={12} />
      <Loader size={16} />
      <Loader size={24} />
    </Stack>
  ),
};
