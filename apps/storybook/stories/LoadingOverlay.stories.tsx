import type { Meta, StoryObj } from "@storybook/react-vite";
import { LoadingOverlay } from "@oppulence/design-system";

const meta = {
  title: "Molecules/LoadingOverlay",
  component: LoadingOverlay,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["fullscreen", "section", "inline"],
    },
    blur: {
      control: "boolean",
    },
    showLabel: {
      control: "boolean",
    },
  },
} satisfies Meta<typeof LoadingOverlay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Section: Story = {
  render: () => (
    <div className="relative h-[200px] w-[400px] rounded-lg border">
      <div className="p-4">
        <p className="text-sm">Content behind the overlay</p>
      </div>
      <LoadingOverlay variant="section" />
    </div>
  ),
};

export const Inline: Story = {
  args: {
    variant: "inline",
  },
  render: (args) => (
    <div className="w-[400px]">
      <LoadingOverlay {...args} />
    </div>
  ),
};

export const WithBlur: Story = {
  render: () => (
    <div className="relative h-[200px] w-[400px] rounded-lg border">
      <div className="p-4">
        <p className="text-sm">Content behind the blurred overlay</p>
        <p className="text-sm text-muted-foreground">
          This text should appear blurry
        </p>
      </div>
      <LoadingOverlay variant="section" blur />
    </div>
  ),
};

export const CustomLabel: Story = {
  args: {
    variant: "inline",
    label: "Saving changes...",
  },
  render: (args) => (
    <div className="w-[400px]">
      <LoadingOverlay {...args} />
    </div>
  ),
};

export const NoLabel: Story = {
  args: {
    variant: "inline",
    showLabel: false,
  },
  render: (args) => (
    <div className="w-[400px]">
      <LoadingOverlay {...args} />
    </div>
  ),
};
