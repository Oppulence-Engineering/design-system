import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Task,
  TaskContent,
  TaskItem,
  TaskItemFile,
  TaskTrigger,
} from "@oppulence/design-system";

const meta = {
  title: "Molecules/Task",
  component: Task,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Task>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[420px]">
      <Task defaultOpen>
        <TaskTrigger title="Search receipts" />
        <TaskContent>
          <TaskItem>
            Found 4 receipts in
            <TaskItemFile>April_2024.pdf</TaskItemFile>
          </TaskItem>
          <TaskItem>
            Matching vendor: Acme Cloud
            <TaskItemFile>acme-cloud.csv</TaskItemFile>
          </TaskItem>
          <TaskItem>
            Ready to export summary report.
          </TaskItem>
        </TaskContent>
      </Task>
    </div>
  ),
};
