import type { Meta, StoryObj } from "@storybook/react-vite";
import { Action, Actions } from "@oppulence/design-system";
import { Bell, Settings } from "lucide-react";

const meta = {
  title: "Molecules/Actions",
  component: Actions,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Actions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Actions>
      <Action tooltip="Notifications" aria-label="Notifications">
        <Bell className="size-4" />
      </Action>
      <Action tooltip="Settings" aria-label="Settings">
        <Settings className="size-4" />
      </Action>
    </Actions>
  ),
};
