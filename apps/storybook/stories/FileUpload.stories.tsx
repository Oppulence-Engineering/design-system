import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadList,
  FileUploadTrigger,
} from "@oppulence/design-system";
import { fn } from "storybook/test";

const meta = {
  title: "Molecules/FileUpload",
  component: FileUpload,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  args: {
    onFilesChange: fn(),
  },
} satisfies Meta<typeof FileUpload>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div className="w-[500px]">
      <FileUpload {...args}>
        <FileUploadDropzone />
        <FileUploadList />
      </FileUpload>
    </div>
  ),
};

export const Compact: Story = {
  render: (args) => (
    <div className="w-[500px]">
      <FileUpload {...args}>
        <FileUploadDropzone variant="compact">
          <p className="text-xs text-muted-foreground">PNG, JPG up to 10MB</p>
        </FileUploadDropzone>
        <FileUploadList />
      </FileUpload>
    </div>
  ),
};

export const SingleFile: Story = {
  render: (args) => (
    <div className="w-[500px]">
      <FileUpload {...args} multiple={false} maxFiles={1}>
        <FileUploadDropzone />
        <FileUploadList />
      </FileUpload>
    </div>
  ),
};

export const WithTriggerButton: Story = {
  render: (args) => (
    <div className="w-[500px]">
      <FileUpload {...args}>
        <FileUploadTrigger>Choose files</FileUploadTrigger>
        <FileUploadList />
      </FileUpload>
    </div>
  ),
};

export const ImagesOnly: Story = {
  render: (args) => (
    <div className="w-[500px]">
      <FileUpload
        {...args}
        accept={{ "image/*": [".png", ".jpg", ".jpeg", ".gif"] }}
        maxSize={5 * 1024 * 1024}
      >
        <FileUploadDropzone>
          <p className="text-xs text-muted-foreground">Images only, max 5MB</p>
        </FileUploadDropzone>
        <FileUploadList />
      </FileUpload>
    </div>
  ),
};
