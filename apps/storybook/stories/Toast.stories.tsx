import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@oppulence/design-system";

const meta = {
  title: "Organisms/Toast",
  component: Toast,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Toast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <ToastProvider>
      <Toast open variant="default">
        <div className="grid gap-1">
          <ToastTitle>Report ready</ToastTitle>
          <ToastDescription>
            Your weekly summary has finished generating.
          </ToastDescription>
        </div>
        <ToastAction altText="Open report">Open</ToastAction>
        <ToastClose />
      </Toast>
      <ToastViewport />
    </ToastProvider>
  ),
};
