import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageAvatar,
  MessageContent,
  Stack,
} from "@oppulence/design-system";

const meta = {
  title: "Organisms/Conversation",
  component: Conversation,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Conversation>;

export default meta;
type Story = StoryObj<typeof meta>;

const messages = [
  {
    id: "m1",
    from: "assistant",
    text: "Here are the latest pipeline updates.",
  },
  {
    id: "m2",
    from: "user",
    text: "Can you break it down by region?",
  },
  {
    id: "m3",
    from: "assistant",
    text: "North America leads with 42% of new deals.",
  },
  {
    id: "m4",
    from: "assistant",
    text: "EMEA follows at 31%, driven by renewals.",
  },
  {
    id: "m5",
    from: "user",
    text: "Great. Add that to the weekly brief.",
  },
  {
    id: "m6",
    from: "assistant",
    text: "Will do. Draft coming shortly.",
  },
];

export const Default: Story = {
  render: () => (
    <div className="h-[360px] w-[480px] rounded-lg border bg-background flex flex-col">
      <Conversation>
        <ConversationContent>
          <Stack gap="4">
            {messages.map((message) => (
              <Message
                key={message.id}
                from={message.from === "assistant" ? "assistant" : "user"}
              >
                <MessageAvatar
                  src={
                    message.from === "assistant"
                      ? "https://i.pravatar.cc/40?img=12"
                      : "https://i.pravatar.cc/40?img=32"
                  }
                  name={message.from === "assistant" ? "A" : "J"}
                />
                <MessageContent>
                  <p>{message.text}</p>
                </MessageContent>
              </Message>
            ))}
          </Stack>
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
    </div>
  ),
};
