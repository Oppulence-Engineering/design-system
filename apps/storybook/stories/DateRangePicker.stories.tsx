import type { Meta, StoryObj } from "@storybook/react-vite";
import { DateRangePicker } from "@oppulence/design-system";
import type { DateRange } from "react-day-picker";
import { useState } from "react";

const meta = {
  title: "Organisms/DateRangePicker",
  component: DateRangePicker,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof DateRangePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => {
    const baseDate = new Date(2024, 7, 1);
    const [range, setRange] = useState<DateRange>({
      from: baseDate,
      to: new Date(baseDate.getTime() + 6 * 24 * 60 * 60 * 1000),
    });

    return (
      <div className="w-[320px]">
        <DateRangePicker
          range={range}
          onSelect={(nextRange) => {
            setRange(nextRange ?? { from: undefined, to: undefined });
          }}
          placeholder="Select date range"
        />
      </div>
    );
  },
};
