import type { Meta, StoryObj } from "@storybook/react-vite";
import { TagInput } from "@oppulence/design-system";
import { fn } from "storybook/test";

const meta = {
  title: "Molecules/TagInput",
  component: TagInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof TagInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Add a tag...",
  },
  render: (args) => (
    <div className="w-[400px]">
      <TagInput {...args} />
    </div>
  ),
};

export const WithInitialTags: Story = {
  args: {
    defaultValue: ["React", "TypeScript", "Tailwind"],
  },
  render: (args) => (
    <div className="w-[400px]">
      <TagInput {...args} />
    </div>
  ),
};

export const MaxTags: Story = {
  args: {
    defaultValue: ["One", "Two"],
    maxTags: 3,
    placeholder: "Max 3 tags",
  },
  render: (args) => (
    <div className="w-[400px]">
      <TagInput {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    defaultValue: ["React", "TypeScript"],
    disabled: true,
  },
  render: (args) => (
    <div className="w-[400px]">
      <TagInput {...args} />
    </div>
  ),
};

export const ReadOnly: Story = {
  args: {
    defaultValue: ["React", "TypeScript", "Tailwind"],
    readOnly: true,
  },
  render: (args) => (
    <div className="w-[400px]">
      <TagInput {...args} />
    </div>
  ),
};
