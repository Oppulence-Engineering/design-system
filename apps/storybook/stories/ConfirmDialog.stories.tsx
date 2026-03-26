import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, ConfirmDialog, Stack } from "@oppulence/design-system";
import { fn } from "storybook/test";

const meta = {
  title: "Molecules/ConfirmDialog",
  component: ConfirmDialog,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onConfirm: fn(),
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Destructive: Story = {
  args: {
    variant: "destructive",
    title: "Delete item?",
    description:
      "This action cannot be undone. This will permanently delete the item.",
    confirmLabel: "Delete",
    trigger: <Button variant="destructive">Delete</Button>,
  },
};

export const Warning: Story = {
  args: {
    variant: "warning",
    title: "Discard changes?",
    description:
      "You have unsaved changes. Are you sure you want to discard them?",
    confirmLabel: "Discard",
    trigger: <Button variant="outline">Discard</Button>,
  },
};

export const Info: Story = {
  args: {
    variant: "info",
    title: "Enable notifications?",
    description: "You'll receive updates about your account activity.",
    confirmLabel: "Enable",
    trigger: <Button>Enable notifications</Button>,
  },
};

export const DefaultVariant: Story = {
  args: {
    variant: "default",
    title: "Confirm action",
    description: "Are you sure you want to proceed?",
    trigger: <Button variant="outline">Confirm</Button>,
  },
};
