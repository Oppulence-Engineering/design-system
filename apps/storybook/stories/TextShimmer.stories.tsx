import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextShimmer } from "@oppulence/design-system";

const meta = {
  title: "Atoms/TextShimmer",
  component: TextShimmer,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TextShimmer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Shimmering text",
    size: "md",
  },
};
