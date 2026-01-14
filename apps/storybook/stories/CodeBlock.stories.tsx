import type { Meta, StoryObj } from "@storybook/react-vite";
import { CodeBlock, CodeBlockCopyButton } from "@oppulence/design-system";

const meta = {
  title: "Molecules/CodeBlock",
  component: CodeBlock,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof CodeBlock>;

export default meta;
type Story = StoryObj<typeof meta>;

const sample = `function greet(name: string) {
  return \`Hello, ${name}!\`;
}`;

export const Default: Story = {
  render: () => (
    <div className="w-[480px]">
      <CodeBlock code={sample} language="ts">
        <CodeBlockCopyButton />
      </CodeBlock>
    </div>
  ),
};
