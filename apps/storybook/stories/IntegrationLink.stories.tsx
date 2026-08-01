import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Section, Stack, Text } from "@oppulence/design-system";
import {
  MergeConnectionLinkButton,
  PlaidConnectionLinkButton,
  type IntegrationConnectionLinkClient,
} from "@oppulence/integrations/react";

function pending<T>(): Promise<T> {
  return new Promise(() => undefined);
}

const pendingLinkClient: IntegrationConnectionLinkClient = {
  createToken: () => pending(),
  complete: () => pending(),
};

function ConnectionLinkControls() {
  return (
    <Section
      title="Secure provider connections"
      description="Linking begins with a short-lived token; provider credentials never enter the product UI."
    >
      <Stack gap="lg" align="start">
        <Text size="sm" variant="muted">
          Select a provider to start its secure connection flow.
        </Text>
        <PlaidConnectionLinkButton client={pendingLinkClient} />
        <MergeConnectionLinkButton client={pendingLinkClient} />
      </Stack>
    </Section>
  );
}

const meta = {
  title: "Integrations/Connection Link",
  component: ConnectionLinkControls,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof ConnectionLinkControls>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SecureConnectionControls: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const plaidButton = canvas.getByRole("button", { name: "Connect Plaid" });
    const mergeButton = canvas.getByRole("button", { name: "Connect Merge" });

    await expect(plaidButton).toBeEnabled();
    await expect(mergeButton).toBeEnabled();

    await userEvent.click(plaidButton);

    await expect(plaidButton).toHaveAttribute(
      "data-integration-link-phase",
      "preparing",
    );
    await expect(plaidButton).toBeDisabled();

    await userEvent.click(mergeButton);

    await expect(mergeButton).toHaveAttribute(
      "data-integration-link-phase",
      "preparing",
    );
    await expect(mergeButton).toBeDisabled();
  },
};
