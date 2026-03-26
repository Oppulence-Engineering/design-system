import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  ErrorFallback,
  ErrorFallbackActions,
  ErrorFallbackDescription,
  ErrorFallbackTitle,
  Button,
} from "@oppulence/design-system";

const meta = {
  title: "Organisms/ErrorBoundary",
  component: ErrorFallback,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
  argTypes: {
    variant: {
      control: "select",
      options: ["page", "section", "inline"],
    },
  },
} satisfies Meta<typeof ErrorFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Section: Story = {
  render: () => (
    <div className="w-[500px]">
      <ErrorFallback
        variant="section"
        error={new Error("Failed to load data from the server.")}
        onRetry={() => alert("Retrying...")}
      />
    </div>
  ),
};

export const Page: Story = {
  render: () => (
    <ErrorFallback
      variant="page"
      error={new Error("Something went terribly wrong.")}
      onRetry={() => alert("Retrying...")}
    />
  ),
};

export const Inline: Story = {
  render: () => (
    <div className="w-[400px]">
      <ErrorFallback
        variant="inline"
        error={new Error("Could not load widget.")}
        onRetry={() => alert("Retrying...")}
      />
    </div>
  ),
};

export const CustomContent: Story = {
  render: () => (
    <div className="w-[500px]">
      <ErrorFallback variant="section">
        <ErrorFallbackTitle>Connection lost</ErrorFallbackTitle>
        <ErrorFallbackDescription>
          Please check your internet connection and try again.
        </ErrorFallbackDescription>
        <ErrorFallbackActions>
          <Button variant="outline" onClick={() => alert("Retrying...")}>
            Reconnect
          </Button>
          <Button variant="ghost" onClick={() => alert("Going home...")}>
            Go home
          </Button>
        </ErrorFallbackActions>
      </ErrorFallback>
    </div>
  ),
};
