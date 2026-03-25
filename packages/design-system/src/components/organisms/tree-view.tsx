"use client";

import { ChevronRightIcon } from "lucide-react";
import * as React from "react";

type TreeViewContextValue = {
  expandedItems: Set<string>;
  selectedItems: Set<string>;
  selectionMode: "single" | "multiple" | "none";
  toggleExpanded: (value: string) => void;
  toggleSelected: (value: string) => void;
};

const TreeViewContext = React.createContext<TreeViewContextValue>({
  expandedItems: new Set(),
  selectedItems: new Set(),
  selectionMode: "none",
  toggleExpanded: () => {},
  toggleSelected: () => {},
});

type TreeViewProps = Omit<React.ComponentProps<"ul">, "className"> & {
  selectionMode?: "single" | "multiple" | "none";
  expandedItems?: string[];
  onExpandedChange?: (items: string[]) => void;
  selectedItems?: string[];
  onSelectedChange?: (items: string[]) => void;
  defaultExpanded?: string[];
};

function TreeView({
  selectionMode = "none",
  expandedItems: controlledExpanded,
  onExpandedChange,
  selectedItems: controlledSelected,
  onSelectedChange,
  defaultExpanded = [],
  children,
  ...props
}: TreeViewProps) {
  const [internalExpanded, setInternalExpanded] = React.useState(
    new Set(defaultExpanded),
  );
  const [internalSelected, setInternalSelected] = React.useState(
    new Set<string>(),
  );

  const expandedItems = controlledExpanded
    ? new Set(controlledExpanded)
    : internalExpanded;
  const selectedItems = controlledSelected
    ? new Set(controlledSelected)
    : internalSelected;

  const toggleExpanded = React.useCallback(
    (value: string) => {
      const next = new Set(expandedItems);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      if (controlledExpanded === undefined) {
        setInternalExpanded(next);
      }
      onExpandedChange?.([...next]);
    },
    [expandedItems, controlledExpanded, onExpandedChange],
  );

  const toggleSelected = React.useCallback(
    (value: string) => {
      if (selectionMode === "none") return;

      let next: Set<string>;
      if (selectionMode === "single") {
        next = selectedItems.has(value) ? new Set() : new Set([value]);
      } else {
        next = new Set(selectedItems);
        if (next.has(value)) {
          next.delete(value);
        } else {
          next.add(value);
        }
      }
      if (controlledSelected === undefined) {
        setInternalSelected(next);
      }
      onSelectedChange?.([...next]);
    },
    [selectionMode, selectedItems, controlledSelected, onSelectedChange],
  );

  return (
    <TreeViewContext.Provider
      value={{
        expandedItems,
        selectedItems,
        selectionMode,
        toggleExpanded,
        toggleSelected,
      }}
    >
      <ul
        data-slot="tree-view"
        role="tree"
        className="flex flex-col gap-0.5 text-sm"
        {...props}
      >
        {children}
      </ul>
    </TreeViewContext.Provider>
  );
}

const TreeViewItemContext = React.createContext<{
  value: string;
  depth: number;
}>({
  value: "",
  depth: 0,
});

type TreeViewItemProps = Omit<React.ComponentProps<"li">, "className"> & {
  value: string;
  disabled?: boolean;
};

function TreeViewItem({
  value,
  disabled = false,
  children,
  ...props
}: TreeViewItemProps) {
  const parent = React.useContext(TreeViewItemContext);
  const depth = parent.value ? parent.depth + 1 : 0;

  return (
    <TreeViewItemContext.Provider value={{ value, depth }}>
      <li
        data-slot="tree-view-item"
        role="treeitem"
        aria-disabled={disabled || undefined}
        data-value={value}
        className="flex flex-col"
        {...props}
      >
        {children}
      </li>
    </TreeViewItemContext.Provider>
  );
}

function TreeViewItemContent({
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  const { value, depth } = React.useContext(TreeViewItemContext);
  const { selectedItems, selectionMode, toggleSelected } =
    React.useContext(TreeViewContext);
  const isSelected = selectedItems.has(value);

  return (
    <div
      data-slot="tree-view-item-content"
      data-selected={isSelected || undefined}
      style={{ paddingLeft: `${depth * 16 + 4}px` }}
      className="flex items-center gap-1 rounded-md px-1 py-1 hover:bg-muted data-[selected]:bg-muted data-[selected]:text-foreground cursor-default"
      onClick={
        selectionMode !== "none" ? () => toggleSelected(value) : undefined
      }
      {...props}
    />
  );
}

function TreeViewItemTrigger({
  ...props
}: Omit<React.ComponentProps<"button">, "className">) {
  const { value } = React.useContext(TreeViewItemContext);
  const { expandedItems, toggleExpanded } = React.useContext(TreeViewContext);
  const isExpanded = expandedItems.has(value);

  return (
    <button
      data-slot="tree-view-item-trigger"
      aria-expanded={isExpanded}
      onClick={(e) => {
        e.stopPropagation();
        toggleExpanded(value);
        props.onClick?.(e);
      }}
      className="flex size-5 shrink-0 items-center justify-center rounded-sm hover:bg-muted-foreground/10 outline-none"
      {...props}
    >
      <TreeViewItemIndicator />
    </button>
  );
}

function TreeViewItemIndicator() {
  const { value } = React.useContext(TreeViewItemContext);
  const { expandedItems } = React.useContext(TreeViewContext);
  const isExpanded = expandedItems.has(value);

  return (
    <ChevronRightIcon
      data-slot="tree-view-item-indicator"
      className={`size-3.5 shrink-0 text-muted-foreground transition-transform duration-150 ${
        isExpanded ? "rotate-90" : ""
      }`}
    />
  );
}

function TreeViewItemChildren({
  ...props
}: Omit<React.ComponentProps<"ul">, "className">) {
  const { value } = React.useContext(TreeViewItemContext);
  const { expandedItems } = React.useContext(TreeViewContext);
  const isExpanded = expandedItems.has(value);

  if (!isExpanded) return null;

  return (
    <ul
      data-slot="tree-view-item-children"
      role="group"
      className="flex flex-col gap-0.5"
      {...props}
    />
  );
}

export {
  TreeView,
  TreeViewItem,
  TreeViewItemChildren,
  TreeViewItemContent,
  TreeViewItemIndicator,
  TreeViewItemTrigger,
};
export type { TreeViewProps, TreeViewItemProps };
