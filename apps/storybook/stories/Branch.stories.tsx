import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Branch,
  BranchMessages,
  BranchNext,
  BranchPage,
  BranchPrevious,
  BranchSelector,
  Card,
  CardContent,
  Stack,
} from "@oppulence/design-system";

const meta = {
  title: "Molecules/Branch",
  component: Branch,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Branch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[360px]">
      <Branch>
        <BranchMessages>
          <Card>
            <CardContent>First branch content.</CardContent>
          </Card>
          <Card>
            <CardContent>Second branch content.</CardContent>
          </Card>
        </BranchMessages>
        <BranchSelector from="assistant">
          <Stack direction="row" gap="2" align="center">
            <BranchPrevious />
            <BranchPage />
            <BranchNext />
          </Stack>
        </BranchSelector>
      </Branch>
    </div>
  ),
};
