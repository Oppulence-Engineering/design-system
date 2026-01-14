import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { QuantityInput, Stack, Text } from "@oppulence/design-system";

const meta = {
  title: "Atoms/QuantityInput",
  component: QuantityInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof QuantityInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState(1);

    return (
      <Stack gap="2" align="center">
        <QuantityInput value={value} min={0} max={10} onChange={setValue} />
        <Text size="sm" variant="muted">
          Value: {value}
        </Text>
      </Stack>
    );
  },
};
