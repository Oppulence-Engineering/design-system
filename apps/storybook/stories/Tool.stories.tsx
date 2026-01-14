import type { Meta, StoryObj } from "@storybook/react-vite";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@oppulence/design-system";

const meta = {
  title: "Molecules/Tool",
  component: Tool,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Tool>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[520px]">
      <Tool defaultOpen>
        <ToolHeader type="web_search" state="output-available" />
        <ToolContent>
          <ToolInput
            input={{ query: "enterprise churn rate", limit: 3 }}
          />
          <ToolOutput
            errorText={null}
            output={
              <pre className="p-3 text-xs whitespace-pre-wrap">
                {JSON.stringify(
                  {
                    result: "Churn rate declined 1.4% MoM",
                    sources: 3,
                  },
                  null,
                  2,
                )}
              </pre>
            }
          />
        </ToolContent>
      </Tool>
    </div>
  ),
};
