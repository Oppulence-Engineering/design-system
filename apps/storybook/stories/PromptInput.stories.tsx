import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  Stack,
  Text,
  type PromptInputMessage,
} from "@oppulence/design-system";
import { useState } from "react";

type Status = "idle" | "submitted" | "streaming" | "error";

const meta = {
  title: "Organisms/PromptInput",
  component: PromptInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof PromptInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [status, setStatus] = useState<Status>("idle");
    const [lastMessage, setLastMessage] = useState<PromptInputMessage | null>(
      null,
    );

    const handleSubmit = (message: PromptInputMessage) => {
      setLastMessage(message);
      setStatus("submitted");
      setTimeout(() => setStatus("idle"), 1200);
    };

    return (
      <Stack gap="3">
        <div className="w-[520px]">
          <PromptInput onSubmit={handleSubmit}>
            <PromptInputBody>
              <PromptInputAttachments>
                {(attachment) => (
                  <PromptInputAttachment data={attachment} />
                )}
              </PromptInputAttachments>
              <PromptInputTextarea />
            </PromptInputBody>
            <PromptInputToolbar>
              <PromptInputTools>
                <PromptInputActionAddAttachments />
                <PromptInputActionMenu>
                  <PromptInputActionMenuTrigger />
                  <PromptInputActionMenuContent>
                    <PromptInputActionMenuItem>
                      Clear input
                    </PromptInputActionMenuItem>
                    <PromptInputActionMenuItem>
                      Insert template
                    </PromptInputActionMenuItem>
                  </PromptInputActionMenuContent>
                </PromptInputActionMenu>
                <PromptInputModelSelect defaultValue="gpt-4o-mini">
                  <PromptInputModelSelectTrigger>
                    <PromptInputModelSelectValue placeholder="Model" />
                  </PromptInputModelSelectTrigger>
                  <PromptInputModelSelectContent>
                    <PromptInputModelSelectItem value="gpt-4o-mini">
                      GPT-4o Mini
                    </PromptInputModelSelectItem>
                    <PromptInputModelSelectItem value="gpt-4o">
                      GPT-4o
                    </PromptInputModelSelectItem>
                  </PromptInputModelSelectContent>
                </PromptInputModelSelect>
              </PromptInputTools>
              <PromptInputSubmit status={status} />
            </PromptInputToolbar>
          </PromptInput>
        </div>
        <Text size="sm" variant="muted">
          Last message: {lastMessage?.text || "None"}
        </Text>
      </Stack>
    );
  },
};
