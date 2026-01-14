import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { SubmitButton } from "@oppulence/design-system";

const meta = {
  title: "Atoms/SubmitButton",
  component: SubmitButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SubmitButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [loading, setLoading] = useState(false);

    return (
      <SubmitButton
        isSubmitting={loading}
        onClick={() => {
          setLoading(true);
          setTimeout(() => setLoading(false), 1200);
        }}
      >
        Save Changes
      </SubmitButton>
    );
  },
};
