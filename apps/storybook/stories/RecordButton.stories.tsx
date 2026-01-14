import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RecordButton, Stack, Text } from "@oppulence/design-system";

const meta = {
  title: "Atoms/RecordButton",
  component: RecordButton,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof RecordButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [isRecording, setIsRecording] = useState(false);

    return (
      <Stack direction="row" gap="4" align="center">
        <RecordButton
          isRecording={isRecording}
          onClick={() => setIsRecording((prev) => !prev)}
        />
        <Text size="sm" variant="muted">
          {isRecording ? "Recording" : "Idle"}
        </Text>
      </Stack>
    );
  },
};
