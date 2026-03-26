import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  TreeView,
  TreeViewItem,
  TreeViewItemChildren,
  TreeViewItemContent,
  TreeViewItemTrigger,
} from "@oppulence/design-system";
import { FileIcon, FolderIcon } from "lucide-react";

const meta = {
  title: "Organisms/TreeView",
  component: TreeView,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof TreeView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="w-[300px] rounded-lg border p-2">
      <TreeView defaultExpanded={["src", "components"]}>
        <TreeViewItem value="src">
          <TreeViewItemContent>
            <TreeViewItemTrigger />
            <FolderIcon className="size-4 text-muted-foreground" />
            <span>src</span>
          </TreeViewItemContent>
          <TreeViewItemChildren>
            <TreeViewItem value="components">
              <TreeViewItemContent>
                <TreeViewItemTrigger />
                <FolderIcon className="size-4 text-muted-foreground" />
                <span>components</span>
              </TreeViewItemContent>
              <TreeViewItemChildren>
                <TreeViewItem value="button.tsx">
                  <TreeViewItemContent>
                    <div className="size-5" />
                    <FileIcon className="size-4 text-muted-foreground" />
                    <span>button.tsx</span>
                  </TreeViewItemContent>
                </TreeViewItem>
                <TreeViewItem value="input.tsx">
                  <TreeViewItemContent>
                    <div className="size-5" />
                    <FileIcon className="size-4 text-muted-foreground" />
                    <span>input.tsx</span>
                  </TreeViewItemContent>
                </TreeViewItem>
              </TreeViewItemChildren>
            </TreeViewItem>
            <TreeViewItem value="index.ts">
              <TreeViewItemContent>
                <div className="size-5" />
                <FileIcon className="size-4 text-muted-foreground" />
                <span>index.ts</span>
              </TreeViewItemContent>
            </TreeViewItem>
          </TreeViewItemChildren>
        </TreeViewItem>
        <TreeViewItem value="package.json">
          <TreeViewItemContent>
            <div className="size-5" />
            <FileIcon className="size-4 text-muted-foreground" />
            <span>package.json</span>
          </TreeViewItemContent>
        </TreeViewItem>
      </TreeView>
    </div>
  ),
};

export const WithSelection: Story = {
  render: () => (
    <div className="w-[300px] rounded-lg border p-2">
      <TreeView selectionMode="multiple" defaultExpanded={["docs"]}>
        <TreeViewItem value="docs">
          <TreeViewItemContent>
            <TreeViewItemTrigger />
            <FolderIcon className="size-4 text-muted-foreground" />
            <span>docs</span>
          </TreeViewItemContent>
          <TreeViewItemChildren>
            <TreeViewItem value="readme.md">
              <TreeViewItemContent>
                <div className="size-5" />
                <FileIcon className="size-4 text-muted-foreground" />
                <span>readme.md</span>
              </TreeViewItemContent>
            </TreeViewItem>
            <TreeViewItem value="guide.md">
              <TreeViewItemContent>
                <div className="size-5" />
                <FileIcon className="size-4 text-muted-foreground" />
                <span>guide.md</span>
              </TreeViewItemContent>
            </TreeViewItem>
          </TreeViewItemChildren>
        </TreeViewItem>
      </TreeView>
    </div>
  ),
};

export const SingleSelect: Story = {
  render: () => (
    <div className="w-[300px] rounded-lg border p-2">
      <TreeView selectionMode="single" defaultExpanded={["pages"]}>
        <TreeViewItem value="pages">
          <TreeViewItemContent>
            <TreeViewItemTrigger />
            <FolderIcon className="size-4 text-muted-foreground" />
            <span>pages</span>
          </TreeViewItemContent>
          <TreeViewItemChildren>
            <TreeViewItem value="home">
              <TreeViewItemContent>
                <div className="size-5" />
                <FileIcon className="size-4 text-muted-foreground" />
                <span>Home</span>
              </TreeViewItemContent>
            </TreeViewItem>
            <TreeViewItem value="about">
              <TreeViewItemContent>
                <div className="size-5" />
                <FileIcon className="size-4 text-muted-foreground" />
                <span>About</span>
              </TreeViewItemContent>
            </TreeViewItem>
            <TreeViewItem value="contact">
              <TreeViewItemContent>
                <div className="size-5" />
                <FileIcon className="size-4 text-muted-foreground" />
                <span>Contact</span>
              </TreeViewItemContent>
            </TreeViewItem>
          </TreeViewItemChildren>
        </TreeViewItem>
      </TreeView>
    </div>
  ),
};
