"use client";

import type { HTMLAttributes } from "react";
import type { DateRange } from "react-day-picker";

import { ChevronDownIcon } from "lucide-react";
import { Button } from "../atoms/button";
import { Calendar } from "./calendar";
import { Popover, PopoverContent, PopoverTrigger } from "../molecules/popover";

export type DateRangePickerProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "className"
> & {
  range: DateRange;
  onSelect: (range?: DateRange) => void;
  placeholder: string;
  disabled?: boolean;
};

export function DateRangePicker({
  range,
  disabled,
  onSelect,
  placeholder,
  ...props
}: DateRangePickerProps) {
  return (
    <div className="grid gap-2" {...props}>
      <Popover>
        <PopoverTrigger
          render={<Button variant="outline" width="full" />}
          disabled={disabled}
        >
          <span className="flex w-full items-center justify-between gap-2 font-medium">
            <span>{placeholder}</span>
            <ChevronDownIcon className="size-4" />
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={8}>
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={range?.from}
            selected={range}
            onSelect={onSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
