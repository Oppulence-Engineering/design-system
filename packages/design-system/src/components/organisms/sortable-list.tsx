"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import * as React from "react";

// ─── SortableList ───────────────────────────────────────────────────────────

type SortableListItem = { id: string | number };

type SortableListProps<T extends SortableListItem> = Omit<
  React.ComponentProps<"div">,
  "className"
> & {
  items: T[];
  onReorder: (items: T[]) => void;
  direction?: "vertical" | "horizontal";
  disabled?: boolean;
};

function SortableList<T extends SortableListItem>({
  items,
  onReorder,
  direction = "vertical",
  disabled = false,
  children,
  ...props
}: SortableListProps<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const strategy =
    direction === "vertical"
      ? verticalListSortingStrategy
      : horizontalListSortingStrategy;

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onReorder(arrayMove(items, oldIndex, newIndex));
    },
    [items, onReorder],
  );

  return (
    <DndContext
      sensors={disabled ? undefined : sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={items} strategy={strategy}>
        <div
          data-slot="sortable-list"
          data-direction={direction}
          className={
            direction === "vertical"
              ? "flex flex-col gap-1"
              : "flex flex-row gap-1"
          }
          {...props}
        >
          {children}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ─── SortableItem ───────────────────────────────────────────────────────────

const SortableItemContext = React.createContext<{
  attributes: ReturnType<typeof useSortable>["attributes"] | null;
  listeners: ReturnType<typeof useSortable>["listeners"];
}>({
  attributes: null,
  listeners: undefined,
});

type SortableItemProps = Omit<React.ComponentProps<"div">, "className"> & {
  id: string | number;
  disabled?: boolean;
};

function SortableItem({
  id,
  disabled = false,
  children,
  ...props
}: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : undefined,
  };

  return (
    <SortableItemContext.Provider value={{ attributes, listeners }}>
      <div
        ref={setNodeRef}
        data-slot="sortable-item"
        data-dragging={isDragging || undefined}
        style={style}
        className="relative rounded-md border bg-background"
        {...attributes}
        {...listeners}
        {...props}
      >
        {children}
      </div>
    </SortableItemContext.Provider>
  );
}

// ─── SortableHandle ─────────────────────────────────────────────────────────

function SortableHandle({
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "className">) {
  const { attributes, listeners } = React.useContext(SortableItemContext);

  return (
    <div
      data-slot="sortable-handle"
      className="flex shrink-0 cursor-grab items-center text-muted-foreground hover:text-foreground active:cursor-grabbing"
      {...attributes}
      {...listeners}
      {...props}
    >
      {children ?? <GripVerticalIcon className="size-4" />}
    </div>
  );
}

export { SortableList, SortableItem, SortableHandle };
export type { SortableListProps, SortableItemProps, SortableListItem };
