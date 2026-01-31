"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { Command } from "./command";
import {
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Button } from "../atoms/button";
import { Popover, PopoverContent, PopoverTrigger } from "../molecules/popover";

export type ComboboxItem = {
  id: string;
  label: string;
  disabled?: boolean;
};

type Props<T> = {
  placeholder?: React.ReactNode;
  searchPlaceholder?: string;
  items: T[];
  onSelect: (item: T) => void;
  selectedItem?: T;
  renderSelectedItem?: (selectedItem: T) => React.ReactNode;
  renderOnCreate?: (value: string) => React.ReactNode;
  renderListItem?: (listItem: {
    isChecked: boolean;
    item: T;
  }) => React.ReactNode;
  emptyResults?: React.ReactNode;
  popoverProps?: Omit<React.ComponentProps<typeof PopoverContent>, "className">;
  disabled?: boolean;
  onCreate?: (value: string) => void;
  headless?: boolean;
  modal?: boolean;
};

export function ComboboxDropdown<T extends ComboboxItem>({
  headless,
  placeholder,
  searchPlaceholder,
  items,
  onSelect,
  selectedItem: incomingSelectedItem,
  renderSelectedItem = (item) => item.label,
  renderListItem,
  renderOnCreate,
  emptyResults,
  popoverProps,
  disabled,
  onCreate,
  modal = true,
}: Props<T>) {
  const [open, setOpen] = React.useState(false);
  const [internalSelectedItem, setInternalSelectedItem] = React.useState<
    T | undefined
  >();
  const [inputValue, setInputValue] = React.useState("");

  const selectedItem = incomingSelectedItem ?? internalSelectedItem;

  const filteredItems = items.filter((item) =>
    item.label.toLowerCase().includes(inputValue.toLowerCase()),
  );

  const showCreate = onCreate && Boolean(inputValue) && !filteredItems.length;

  const Component = (
    <Command loop shouldFilter={false}>
      <CommandInput
        value={inputValue}
        onValueChange={setInputValue}
        placeholder={searchPlaceholder ?? "Search item..."}
      />

      <CommandGroup>
        <CommandList>
          {filteredItems.map((item) => {
            const isChecked = selectedItem?.id === item.id;

            return (
              <CommandItem
                disabled={item.disabled}
                key={item.id}
                value={item.id}
                onSelect={(id) => {
                  const foundItem = items.find((item) => item.id === id);

                  if (!foundItem) {
                    return;
                  }

                  onSelect(foundItem);
                  setInternalSelectedItem(foundItem);
                  setOpen(false);
                }}
              >
                {renderListItem ? (
                  renderListItem({ isChecked, item })
                ) : (
                  <>
                    <Check
                      className={
                        isChecked
                          ? "mr-2 h-4 w-4 opacity-100"
                          : "mr-2 h-4 w-4 opacity-0"
                      }
                    />
                    {item.label}
                  </>
                )}
              </CommandItem>
            );
          })}

          <CommandEmpty>{emptyResults ?? "No item found"}</CommandEmpty>

          {showCreate && (
            <CommandItem
              key={inputValue}
              value={inputValue}
              onSelect={() => {
                onCreate(inputValue);
                setOpen(false);
                setInputValue("");
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {renderOnCreate ? renderOnCreate(inputValue) : null}
            </CommandItem>
          )}
        </CommandList>
      </CommandGroup>
    </Command>
  );

  if (headless) {
    return Component;
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={modal}>
      <PopoverTrigger
        render={<Button variant="outline" width="full" aria-expanded={open} />}
        disabled={disabled}
      >
        <span className="flex w-full items-center justify-between gap-2">
          <span className="truncate text-ellipsis">
            {selectedItem ? (
              <span className="items-center overflow-hidden whitespace-nowrap text-ellipsis block">
                {renderSelectedItem
                  ? renderSelectedItem(selectedItem)
                  : selectedItem.label}
              </span>
            ) : (
              (placeholder ?? "Select item...")
            )}
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </span>
      </PopoverTrigger>

      <PopoverContent
        {...popoverProps}
        style={{
          width: "var(--anchor-width)",
          ...popoverProps?.style,
        }}
      >
        {Component}
      </PopoverContent>
    </Popover>
  );
}
