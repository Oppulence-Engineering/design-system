import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Message,
  MessageAvatar,
  MessageContent,
  Stack,
} from "@oppulence/design-system";

const meta = {
  title: "Molecules/Message",
  component: Message,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Message>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[420px]">
      <Stack gap="4">
        <Message from="assistant">
          <MessageAvatar
            src="https://i.pravatar.cc/40?img=12"
            name="A"
          />
          <MessageContent>
            <p>Here is the overview of Q4 performance.</p>
            <p>Would you like a breakdown by region?</p>
          </MessageContent>
        </Message>
        <Message from="user">
          <MessageAvatar
            src="https://i.pravatar.cc/40?img=32"
            name="J"
          />
          <MessageContent>
            <p>Yes, show North America and EMEA first.</p>
          </MessageContent>
        </Message>
      </Stack>
    </div>
  ),
};
