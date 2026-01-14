import type { Meta, StoryObj } from "@storybook/react-vite";
import { CurrencyInput, Stack } from "@oppulence/design-system";

const meta = {
  title: "Atoms/CurrencyInput",
  component: CurrencyInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CurrencyInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Stack gap="2">
      <CurrencyInput placeholder="0.00" prefix="$" />
    </Stack>
  ),
};
