import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, CardContent, Editor } from "@oppulence/design-system";

const meta = {
  title: "Organisms/Editor",
  component: Editor,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Editor>;

export default meta;
type Story = StoryObj<typeof meta>;

const initialContent =
  "<p>Draft the weekly update here. Use the bubble menu to format text.</p>";

export const Default: Story = {
  render: () => (
    <div className="w-[640px]">
      <Card>
        <CardContent>
          <Editor
            initialContent={initialContent}
            placeholder="Start typing..."
          />
        </CardContent>
      </Card>
    </div>
  ),
};
