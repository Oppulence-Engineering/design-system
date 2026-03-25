"use client";

import { XIcon } from "lucide-react";
import * as React from "react";

import { Badge } from "../atoms/badge";
import { Button } from "../atoms/button";

type TagInputProps = Omit<
  React.ComponentProps<"div">,
  "className" | "onChange"
> & {
  value?: string[];
  defaultValue?: string[];
  onChange?: (tags: string[]) => void;
  onTagAdd?: (tag: string) => void;
  onTagRemove?: (tag: string) => void;
  placeholder?: string;
  maxTags?: number;
  allowDuplicates?: boolean;
  validate?: (tag: string) => boolean;
  disabled?: boolean;
  readOnly?: boolean;
};

function TagInput({
  value: controlledValue,
  defaultValue = [],
  onChange,
  onTagAdd,
  onTagRemove,
  placeholder = "Add tag...",
  maxTags,
  allowDuplicates = false,
  validate,
  disabled = false,
  readOnly = false,
  ...props
}: TagInputProps) {
  const [internalTags, setInternalTags] = React.useState(defaultValue);
  const tags = controlledValue ?? internalTags;
  const [inputValue, setInputValue] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const updateTags = React.useCallback(
    (newTags: string[]) => {
      if (controlledValue === undefined) {
        setInternalTags(newTags);
      }
      onChange?.(newTags);
    },
    [controlledValue, onChange],
  );

  const addTag = React.useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed) return;
      if (!allowDuplicates && tags.includes(trimmed)) return;
      if (maxTags && tags.length >= maxTags) return;
      if (validate && !validate(trimmed)) return;

      const newTags = [...tags, trimmed];
      updateTags(newTags);
      onTagAdd?.(trimmed);
      setInputValue("");
    },
    [tags, allowDuplicates, maxTags, validate, updateTags, onTagAdd],
  );

  const removeTag = React.useCallback(
    (index: number) => {
      const removed = tags[index];
      const newTags = tags.filter((_, i) => i !== index);
      updateTags(newTags);
      if (removed) onTagRemove?.(removed);
    },
    [tags, updateTags, onTagRemove],
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" || e.key === ",") {
        e.preventDefault();
        addTag(inputValue);
      } else if (e.key === "Backspace" && !inputValue && tags.length > 0) {
        removeTag(tags.length - 1);
      } else if (e.key === "Escape") {
        inputRef.current?.blur();
      }
    },
    [inputValue, tags, addTag, removeTag],
  );

  const atMax = maxTags !== undefined && tags.length >= maxTags;

  return (
    <div
      data-slot="tag-input"
      className="focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px] flex min-h-8 w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-sm transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      aria-disabled={disabled || undefined}
      onClick={() => inputRef.current?.focus()}
      {...props}
    >
      {tags.map((tag, index) => (
        <Badge key={`${tag}-${index}`} variant="secondary">
          {tag}
          {!readOnly && !disabled && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={(e) => {
                e.stopPropagation();
                removeTag(index);
              }}
              aria-label={`Remove ${tag}`}
            >
              <XIcon className="size-3" />
            </Button>
          )}
        </Badge>
      ))}
      {!readOnly && !disabled && !atMax && (
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) addTag(inputValue);
          }}
          placeholder={tags.length === 0 ? placeholder : ""}
          disabled={disabled}
          className="flex-1 min-w-[80px] bg-transparent outline-none placeholder:text-muted-foreground text-sm"
        />
      )}
    </div>
  );
}

export { TagInput };
export type { TagInputProps };
