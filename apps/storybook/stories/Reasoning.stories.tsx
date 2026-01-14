import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@oppulence/design-system";

const meta = {
  title: "Organisms/Reasoning",
  component: Reasoning,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Reasoning>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[520px]">
      <Reasoning duration={4} defaultOpen>
        <ReasoningTrigger />
        <ReasoningContent>
          Reviewing revenue drivers and highlighting region-specific variances
          before summarizing the top three contributors.
        </ReasoningContent>
      </Reasoning>
    </div>
  ),
};
