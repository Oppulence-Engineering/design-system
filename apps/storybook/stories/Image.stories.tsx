import type { Meta, StoryObj } from "@storybook/react-vite";
import { Image } from "@oppulence/design-system";

const meta = {
  title: "Atoms/Image",
  component: Image,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Image>;

export default meta;
type Story = StoryObj<typeof meta>;

const sampleBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=";

export const Default: Story = {
  args: {
    base64: sampleBase64,
    mediaType: "image/png",
    alt: "Sample image",
  },
};
