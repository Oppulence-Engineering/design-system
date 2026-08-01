import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { IntegrationDirectory } from "@oppulence/design-system";
import {
  buildIntegrationDirectory,
  EXECUTABLE_INTEGRATION_ID_SET,
  getIntegrationCatalogue,
  type IntegrationDefinition,
} from "@oppulence/integrations";

/**
 * The real catalogue, not a fixture. Every other integration story builds a
 * handful of synthetic entries to exercise one state; this one renders what a
 * product actually ships, which is the only way to see that an integration the
 * package can execute is genuinely offerable.
 */
const directory = buildIntegrationDirectory({
  product: "eigenn",
  connections: [],
});

const detailsById: ReadonlyMap<string, IntegrationDefinition> = new Map(
  getIntegrationCatalogue().map((definition) => [definition.id, definition]),
);

const connectable = directory.entries.filter(
  (entry) => entry.availability === "available",
);

const meta = {
  title: "Organisms/IntegrationCatalogue",
  component: IntegrationDirectory,
  parameters: { layout: "padded" },
  tags: ["autodocs"],
} satisfies Meta<typeof IntegrationDirectory>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Every integration in the catalogue, in the state a product would see it:
 * the ones the package can execute are connectable, the rest are planned.
 */
export const EveryIntegration: Story = {
  args: {
    directory,
    detailsById,
    onAction: fn(),
    onConnectionAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(`${directory.entries.length} integrations shown`),
    ).toBeVisible();

    // The catalogue is only useful here if a real provider is connectable.
    await expect(
      canvas.getByRole("button", { name: /^Connect PostHog/ }),
    ).toBeVisible();
  },
};

/**
 * Narrowed to what can actually be connected today. This is the count that
 * moves when a provider pack lands.
 */
export const ConnectableOnly: Story = {
  args: {
    directory: { product: "eigenn", entries: connectable },
    detailsById,
    onAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText(`${connectable.length} integrations shown`),
    ).toBeVisible();
    // Nothing here may be planned: every entry is one the package can run.
    await expect(
      connectable.every((entry) =>
        EXECUTABLE_INTEGRATION_ID_SET.has(entry.integration.id),
      ),
    ).toBe(true);
    await expect(canvas.queryByText("Planned")).toBeNull();
  },
};

/** Searching the real catalogue, rather than a two-entry fixture. */
export const SearchTheCatalogue: Story = {
  args: {
    directory,
    detailsById,
    onAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole("searchbox", {
      name: "Search integrations",
    });
    await userEvent.click(search);
    await userEvent.type(search, "tailscale");
    await expect(canvas.getByText("Tailscale")).toBeVisible();
    await expect(canvas.getByText("1 integrations shown")).toBeVisible();
  },
};

/**
 * The detail surface is a right-hand sheet rather than a centre dialog, so the
 * directory stays visible behind it while a connection is inspected.
 */
const connectedDirectory = buildIntegrationDirectory({
  product: "eigenn",
  connections: [
    {
      id: "posthog-primary",
      integrationId: "posthog",
      product: "eigenn",
      displayName: "Northstar Analytics",
      state: "attention",
      enabledCapabilities: ["workflow_action"],
      sourceFreshness: {
        state: "failed",
        lastSuccessfulSyncAt: "2026-07-31T12:00:00.000Z",
      },
      permittedActions: ["reconnect", "inspect"],
      safeIssue: {
        code: "REAUTH_REQUIRED",
        summary: "Reconnect to restore project access.",
        recoverable: true,
      },
    },
  ],
});

export const ConnectionDetailSheet: Story = {
  args: {
    directory: connectedDirectory,
    detailsById,
    onAction: fn(),
    onConnectionAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /View details for PostHog/ }),
    );

    const body = within(canvasElement.ownerDocument.body);
    // Wait for visibility, not merely presence: the popup mounts empty and is
    // still animating in, so grabbing it on first query races the content.
    await waitFor(() => expect(body.getByRole("dialog")).toBeVisible());
    const sheet = body.getByRole("dialog");
    // It is the sheet, not the centred dialog: it anchors to one edge.
    await expect(sheet).toHaveAttribute("data-slot", "sheet-content");
    await expect(sheet).toHaveAttribute("data-side", "right");
    // Scoped to the sheet: the card behind it renders the same summary, so an
    // unscoped lookup would match twice.
    await expect(
      within(sheet).getByText("Reconnect to restore project access."),
    ).toBeVisible();
    await expect(
      within(sheet).getByRole("button", {
        name: "Reconnect Northstar Analytics",
      }),
    ).toBeVisible();
  },
};

/**
 * Logos come from Simple Icons, which covers roughly half the catalogue and
 * none of the B2B long tail. Anything without a mark gets a tinted monogram,
 * so a row never renders a gap where a logo should be.
 */
export const LogosAndMonograms: Story = {
  args: {
    directory: {
      product: "eigenn",
      // Three with a real brand mark, three without.
      entries: directory.entries.filter((entry) =>
        [
          "github",
          "slack",
          "stripe",
          "attio",
          "rocketlane",
          "sixtyfour-ai",
        ].includes(entry.integration.id),
      ),
    },
    detailsById,
    onAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const brand = canvasElement.querySelectorAll(
      '[data-integration-logo="brand"]',
    );
    const monogram = canvasElement.querySelectorAll(
      '[data-integration-logo="monogram"]',
    );
    await expect(brand.length).toBe(3);
    await expect(monogram.length).toBe(3);

    // The monogram carries initials, and the mark stays decorative: the
    // provider name beside it is what a screen reader announces.
    await expect(canvas.getByText("RO")).toBeVisible();
    await expect(brand[0]).toHaveAttribute("aria-hidden", "true");
    await expect(monogram[0]).toHaveAttribute("aria-hidden", "true");
  },
};
