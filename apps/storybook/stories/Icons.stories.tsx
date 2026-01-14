import type { Meta, StoryObj } from "@storybook/react-vite";
import { Icons } from "@oppulence/design-system";

const meta = {
  title: "Atoms/Icons",
  component: Icons.LogoSmall,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Icons.LogoSmall>;

export default meta;
type Story = StoryObj<typeof meta>;

const IconGrid = () => (
  <div className="grid grid-cols-4 gap-6 text-center text-xs">
    <div className="flex flex-col items-center gap-2">
      <Icons.LogoSmall size={28} />
      <span>LogoSmall</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <Icons.AI size={20} />
      <span>AI</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <Icons.Search size={20} />
      <span>Search</span>
    </div>
    <div className="flex flex-col items-center gap-2">
      <Icons.ChevronDown size={20} />
      <span>ChevronDown</span>
    </div>
  </div>
);

export const Default: Story = {
  render: () => <IconGrid />,
};
