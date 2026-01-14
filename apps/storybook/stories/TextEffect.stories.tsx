import type { Meta, StoryObj } from "@storybook/react-vite";
import { TextEffect } from "@oppulence/design-system";

const meta = {
  title: "Atoms/TextEffect",
  component: TextEffect,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TextEffect>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Animated text reveal",
    preset: "fade-in-blur",
    per: "word",
  },
};
