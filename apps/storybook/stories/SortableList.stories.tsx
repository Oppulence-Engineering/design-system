import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  SortableItem,
  SortableHandle,
  SortableList,
} from "@oppulence/design-system";
import { useState } from "react";

const meta = {
  title: "Organisms/SortableList",
  component: SortableList,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof SortableList>;

export default meta;
type Story = StoryObj<typeof meta>;

const initialItems = [
  { id: "1", label: "Build component library" },
  { id: "2", label: "Write documentation" },
  { id: "3", label: "Add Storybook stories" },
  { id: "4", label: "Create unit tests" },
  { id: "5", label: "Deploy to npm" },
];

function VerticalDemo() {
  const [items, setItems] = useState(initialItems);
  return (
    <div className="w-[400px]">
      <SortableList items={items} onReorder={setItems}>
        {items.map((item) => (
          <SortableItem key={item.id} id={item.id}>
            <div className="flex items-center gap-3 px-4 py-3">
              <SortableHandle />
              <span className="text-sm">{item.label}</span>
            </div>
          </SortableItem>
        ))}
      </SortableList>
    </div>
  );
}

export const Default: Story = {
  render: () => <VerticalDemo />,
};

function HorizontalDemo() {
  const [items, setItems] = useState([
    { id: "a", label: "Mon" },
    { id: "b", label: "Tue" },
    { id: "c", label: "Wed" },
    { id: "d", label: "Thu" },
    { id: "e", label: "Fri" },
  ]);
  return (
    <SortableList items={items} onReorder={setItems} direction="horizontal">
      {items.map((item) => (
        <SortableItem key={item.id} id={item.id}>
          <div className="flex items-center gap-2 px-4 py-2">
            <span className="text-sm font-medium">{item.label}</span>
          </div>
        </SortableItem>
      ))}
    </SortableList>
  );
}

export const Horizontal: Story = {
  render: () => <HorizontalDemo />,
};
