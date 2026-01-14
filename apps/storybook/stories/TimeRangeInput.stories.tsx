import type { Meta, StoryObj } from "@storybook/react-vite";
import { TimeRangeInput } from "@oppulence/design-system";
import { useState } from "react";

const meta = {
  title: "Molecules/TimeRangeInput",
  component: TimeRangeInput,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TimeRangeInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const [value, setValue] = useState({
      start: "09:00",
      stop: "17:30",
    });

    return (
      <div className="w-[360px]">
        <TimeRangeInput value={value} onChange={setValue} />
      </div>
    );
  },
};
