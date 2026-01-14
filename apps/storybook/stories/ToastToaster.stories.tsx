import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Button,
  Stack,
  ToastToaster,
  toast,
} from "@oppulence/design-system";

const meta = {
  title: "Organisms/ToastToaster",
  component: ToastToaster,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ToastToaster>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="min-h-[240px] p-6">
      <Stack gap="3" align="start">
        <Button
          onClick={() =>
            toast({
              title: "Sync complete",
              description: "All sources are up to date.",
              variant: "success",
            })
          }
        >
          Show success toast
        </Button>
        <Button
          variant="outline"
          onClick={() =>
            toast({
              title: "Uploading",
              description: "Processing your files now.",
              variant: "progress",
              progress: 62,
            })
          }
        >
          Show progress
        </Button>
      </Stack>
      <ToastToaster />
    </div>
  ),
};
