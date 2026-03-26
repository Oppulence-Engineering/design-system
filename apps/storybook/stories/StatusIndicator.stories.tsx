import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack, StatusIndicator } from "@oppulence/design-system";

const meta = {
  title: "Atoms/StatusIndicator",
  component: StatusIndicator,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    status: {
      control: "select",
      options: [
        "online",
        "offline",
        "busy",
        "away",
        "error",
        "success",
        "warning",
      ],
    },
    size: {
      control: "select",
      options: ["sm", "default", "lg"],
    },
    pulse: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof StatusIndicator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    status: "online",
  },
};

export const AllStatuses: Story = {
  render: () => (
    <Stack direction="row" gap="md" align="center">
      <Stack align="center" gap="xs">
        <StatusIndicator status="online" />
        <span className="text-xs text-muted-foreground">Online</span>
      </Stack>
      <Stack align="center" gap="xs">
        <StatusIndicator status="offline" />
        <span className="text-xs text-muted-foreground">Offline</span>
      </Stack>
      <Stack align="center" gap="xs">
        <StatusIndicator status="busy" />
        <span className="text-xs text-muted-foreground">Busy</span>
      </Stack>
      <Stack align="center" gap="xs">
        <StatusIndicator status="away" />
        <span className="text-xs text-muted-foreground">Away</span>
      </Stack>
      <Stack align="center" gap="xs">
        <StatusIndicator status="error" />
        <span className="text-xs text-muted-foreground">Error</span>
      </Stack>
      <Stack align="center" gap="xs">
        <StatusIndicator status="success" />
        <span className="text-xs text-muted-foreground">Success</span>
      </Stack>
      <Stack align="center" gap="xs">
        <StatusIndicator status="warning" />
        <span className="text-xs text-muted-foreground">Warning</span>
      </Stack>
    </Stack>
  ),
};

export const Sizes: Story = {
  render: () => (
    <Stack direction="row" gap="md" align="center">
      <StatusIndicator status="online" size="sm" />
      <StatusIndicator status="online" size="default" />
      <StatusIndicator status="online" size="lg" />
    </Stack>
  ),
};

export const WithPulse: Story = {
  render: () => (
    <Stack direction="row" gap="md" align="center">
      <StatusIndicator status="online" pulse />
      <StatusIndicator status="busy" pulse />
      <StatusIndicator status="warning" pulse />
    </Stack>
  ),
};
