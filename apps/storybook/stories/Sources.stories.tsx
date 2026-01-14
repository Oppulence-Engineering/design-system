import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from "@oppulence/design-system";

const meta = {
  title: "Molecules/Sources",
  component: Sources,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Sources>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[420px]">
      <Sources defaultOpen>
        <SourcesTrigger count={2} />
        <SourcesContent>
          <Source
            href="https://example.com/earnings"
            title="Q4 Earnings Summary"
          />
          <Source
            href="https://example.com/market"
            title="Market Snapshot"
          />
        </SourcesContent>
      </Sources>
    </div>
  ),
};
