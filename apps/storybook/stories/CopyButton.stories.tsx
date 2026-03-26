import type { Meta, StoryObj } from "@storybook/react-vite";
import { CopyButton, Stack } from "@oppulence/design-system";

const meta = {
  title: "Atoms/CopyButton",
  component: CopyButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CopyButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: "npm install @oppulence/design-system",
  },
};

export const WithCode: Story = {
  render: () => (
    <div className="flex items-center gap-2 rounded-md border px-3 py-2">
      <code className="text-sm">npm install @oppulence/design-system</code>
      <CopyButton value="npm install @oppulence/design-system" />
    </div>
  ),
};

export const Variants: Story = {
  render: () => (
    <Stack direction="row" gap="sm">
      <CopyButton value="ghost" variant="ghost" />
      <CopyButton value="outline" variant="outline" />
      <CopyButton value="secondary" variant="secondary" />
    </Stack>
  ),
};
