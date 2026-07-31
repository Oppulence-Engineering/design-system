import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import {
  IntegrationCard,
  IntegrationConnectionList,
  IntegrationDirectory,
  IntegrationDetailPanel,
  IntegrationSetupProgress,
  IntegrationStatusBadge,
} from "@oppulence/design-system";
import {
  type IntegrationConnectionProjection,
  type IntegrationDefinition,
  type IntegrationDirectory as IntegrationDirectoryModel,
  type IntegrationDirectoryEntry,
} from "@oppulence/integrations";

const baseEntry: IntegrationDirectoryEntry = {
  integration: {
    id: "quickbooks",
    name: "QuickBooks",
    category: "accounting",
    summary:
      "Accounting actuals, invoices, payments, and chart-of-accounts context.",
    capabilities: ["ledger_actuals", "chart_of_accounts", "invoice_import"],
    authMethods: ["oauth2"],
    availability: "planned",
    searchText:
      "quickbooks accounting actuals invoices payments chart of accounts",
  },
  product: {
    product: "eigenn",
    availability: "planned",
    authMethods: ["oauth2"],
    enabledCapabilities: [],
    setup: [],
    documentationPath: "/integrations/quickbooks",
    minimumPermission: "connect",
    plannedOutcome: "Tracked for a finance decision or modelling outcome.",
  },
  connections: [],
  availability: "planned",
  primaryAction: undefined,
  searchText:
    "quickbooks accounting actuals invoices payments chart of accounts",
};

function sampleEntry(
  directoryState: IntegrationDirectoryEntry["availability"],
  connectionState?: IntegrationConnectionProjection["state"],
): IntegrationDirectoryEntry {
  const connection: IntegrationConnectionProjection | undefined =
    connectionState
      ? {
          id: `quickbooks-${connectionState}`,
          integrationId: "quickbooks",
          product: "eigenn",
          displayName: "Northstar Finance",
          state: connectionState,
          enabledCapabilities: ["ledger_actuals"],
          sourceFreshness: {
            state:
              connectionState === "stale"
                ? "stale"
                : connectionState === "attention"
                  ? "failed"
                  : "fresh",
            lastSuccessfulSyncAt: "2026-07-31T12:00:00.000Z",
          },
          permittedActions:
            connectionState === "healthy"
              ? ["inspect"]
              : ["reconnect", "inspect"],
          safeIssue:
            connectionState === "attention"
              ? {
                  code: "REAUTH_REQUIRED",
                  summary: "Reconnect to restore source access.",
                  recoverable: true,
                }
              : undefined,
        }
      : undefined;
  return {
    ...baseEntry,
    integration: {
      ...baseEntry.integration,
      id: `${baseEntry.integration.id}-${directoryState}${connectionState ? `-${connectionState}` : ""}`,
      name: `QuickBooks (${directoryState})`,
    },
    product: {
      ...baseEntry.product,
      availability:
        directoryState === "planned" || directoryState === "retired"
          ? directoryState
          : "beta",
      enabledCapabilities: ["ledger_actuals"],
      setup:
        directoryState === "setup-required"
          ? [
              {
                id: "admin-approval",
                label: "Administrator approval",
                description: "An administrator must approve the connection.",
                required: true,
              },
            ]
          : [],
    },
    connections: connection ? [connection] : [],
    availability: directoryState,
    searchText: `${baseEntry.searchText} ${directoryState} ${connectionState ?? ""}`,
    primaryAction:
      directoryState === "available"
        ? "connect"
        : directoryState === "disconnected"
          ? "reconnect"
          : directoryState === "connected" && connectionState !== "healthy"
            ? "reconnect"
            : directoryState === "connected"
              ? "inspect"
              : undefined,
  };
}

const directory: IntegrationDirectoryModel = {
  product: "eigenn",
  entries: [
    sampleEntry("connected", "healthy"),
    sampleEntry("connected", "stale"),
    sampleEntry("connected", "attention"),
    sampleEntry("disconnected", "disconnected"),
    sampleEntry("available"),
    sampleEntry("setup-required"),
    sampleEntry("planned"),
    sampleEntry("no-access"),
    sampleEntry("retired"),
  ],
};

const salesforceEntry: IntegrationDirectoryEntry = {
  ...sampleEntry("available"),
  integration: {
    ...sampleEntry("available").integration,
    id: "salesforce",
    name: "Salesforce",
    category: "crm-work",
    summary: "Pipeline, account, and contact context for finance decisions.",
    capabilities: ["crm_account_context", "deal_pipeline_driver"],
    searchText: "salesforce crm pipeline account contact context",
  },
  product: {
    ...sampleEntry("available").product,
    enabledCapabilities: ["crm_account_context", "deal_pipeline_driver"],
  },
  searchText: "salesforce crm pipeline account contact context available",
};

const filterDirectory: IntegrationDirectoryModel = {
  product: "eigenn",
  entries: [sampleEntry("available"), salesforceEntry],
};

const quickBooksDetail: IntegrationDefinition = {
  id: "quickbooks-connected-attention",
  aliases: ["quickbooks"],
  name: "QuickBooks",
  category: "accounting",
  summary:
    "Accounting actuals, invoices, payments, and chart-of-accounts context.",
  capabilities: ["ledger_actuals", "chart_of_accounts", "invoice_import"],
  operations: [
    {
      id: "list-invoices",
      label: "List invoices",
      description: "Lists invoice records for the authorized company.",
      requiredCapabilities: ["invoice_import"],
      inputSensitivity: "internal",
      outputSensitivity: "sensitive",
    },
  ],
  triggers: [
    {
      id: "invoice-created",
      label: "Invoice created",
      description: "Emits when an invoice is created in QuickBooks.",
      requiredCapabilities: ["event_trigger"],
      delivery: "webhook",
    },
  ],
  products: [
    {
      product: "eigenn",
      availability: "planned",
      authMethods: ["oauth2"],
      enabledCapabilities: [],
      setup: [],
      documentationPath: "/integrations/quickbooks",
      minimumPermission: "connect",
      plannedOutcome: "Tracked for a finance decision or modelling outcome.",
    },
  ],
  sourceParity: [{ source: "oppulence" }],
};

const multipleConnectionsEntry: IntegrationDirectoryEntry = {
  ...sampleEntry("connected", "attention"),
  integration: {
    ...sampleEntry("connected", "attention").integration,
    id: quickBooksDetail.id,
    name: quickBooksDetail.name,
  },
  connections: [
    sampleEntry("connected", "attention").connections[0]!,
    {
      ...sampleEntry("connected", "healthy").connections[0]!,
      id: "quickbooks-healthy-secondary",
      displayName: "Northstar International",
      accountLabel: "International entity",
    },
  ],
};

const meta = {
  title: "Organisms/IntegrationDirectory",
  component: IntegrationDirectory,
  parameters: {
    layout: "padded",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof IntegrationDirectory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DirectoryStates: Story = {
  args: {
    directory,
    onAction: fn(),
    onConnectionAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: /Disconnected \(1\)/ }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: /Retired \(1\)/ }),
    ).toBeVisible();
  },
};

export const PlannedIsInformational: Story = {
  args: {
    directory: {
      product: "eigenn",
      entries: [sampleEntry("planned")],
    },
    onAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Planned")).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: /^Connect\b/ }),
    ).toBeNull();
  },
};

export const KeyboardSearch: Story = {
  args: {
    directory,
    onAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const search = canvas.getByRole("searchbox", {
      name: "Search integrations",
    });
    await userEvent.click(search);
    await userEvent.type(search, "attention");
    await expect(canvas.getByText("1 integrations shown")).toBeVisible();
    await userEvent.tab();
    await expect(
      canvas.getByRole("combobox", { name: "Filter by category" }),
    ).toHaveFocus();
  },
};

export const FiltersAndEmptyState: Story = {
  args: {
    directory: filterDirectory,
    onAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const category = canvas.getByRole("combobox", {
      name: "Filter by category",
    });
    await userEvent.selectOptions(category, "crm-work");
    await expect(canvas.getByText("1 integrations shown")).toBeVisible();
    await expect(canvas.getByText("Salesforce")).toBeVisible();

    const capability = canvas.getByRole("combobox", {
      name: "Filter by capability",
    });
    await userEvent.selectOptions(capability, "crm_account_context");
    await expect(canvas.getByText("Salesforce")).toBeVisible();

    const search = canvas.getByRole("searchbox", {
      name: "Search integrations",
    });
    await userEvent.type(search, "no matching provider");
    await expect(
      canvas.getByText("No integrations match these filters."),
    ).toBeVisible();
  },
};

export const StatusLabels: Story = {
  args: { directory },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <IntegrationStatusBadge state="healthy" />
      <IntegrationStatusBadge state="stale" />
      <IntegrationStatusBadge state="attention" />
      <IntegrationStatusBadge state="disconnected" />
      <IntegrationStatusBadge state="authorizing" />
      <IntegrationStatusBadge state="initial_sync" />
      <IntegrationStatusBadge state="not_connected" />
      <IntegrationStatusBadge state="available" />
      <IntegrationStatusBadge state="setup-required" />
      <IntegrationStatusBadge state="planned" />
      <IntegrationStatusBadge state="retired" />
      <IntegrationStatusBadge state="no-access" />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("status", { name: "Connected" }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("status", { name: "Needs attention" }),
    ).toBeVisible();
    await expect(canvas.getByRole("status", { name: "Planned" })).toBeVisible();
    await expect(
      canvas.getByRole("status", { name: "Initial sync" }),
    ).toBeVisible();
  },
};

export const NoAccessAndRetiredAreInformational: Story = {
  args: {
    directory: {
      product: "eigenn",
      entries: [sampleEntry("no-access"), sampleEntry("retired")],
    },
    onAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: /No access \(1\)/ }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("heading", { name: /Retired \(1\)/ }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: /^Connect\b/ }),
    ).toBeNull();
  },
};

/** A disconnected record remains recoverable and targets the precise connection. */
export const DisconnectedCard: Story = {
  args: {
    directory: {
      product: "eigenn",
      entries: [sampleEntry("disconnected", "disconnected")],
    },
    onConnectionAction: fn(),
  },
  render: ({ directory: currentDirectory, onConnectionAction }) => (
    <div className="max-w-sm">
      <IntegrationCard
        entry={currentDirectory.entries[0]!}
        onConnectionAction={onConnectionAction}
      />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("status", { name: /^Disconnected/ }),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: /^Reconnect QuickBooks/ }),
    );
    await expect(args.onConnectionAction).toHaveBeenCalledWith(
      args.directory.entries[0]!.connections[0],
      "reconnect",
    );
  },
};

/** Focused recovery state for the connection-list primitive. */
export const ConnectionRecovery: Story = {
  args: {
    directory: {
      product: "eigenn",
      entries: [sampleEntry("connected", "attention")],
    },
    onConnectionAction: fn(),
  },
  render: ({ directory: currentDirectory, onConnectionAction }) => (
    <IntegrationConnectionList
      connections={currentDirectory.entries[0]!.connections}
      onAction={onConnectionAction}
    />
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByText("Reconnect to restore source access."),
    ).toBeVisible();
    await userEvent.click(
      canvas.getByRole("button", { name: "Reconnect Northstar Finance" }),
    );
    await expect(args.onConnectionAction).toHaveBeenCalledWith(
      args.directory.entries[0]!.connections[0],
      "reconnect",
    );
  },
};

/** Focused available state for the provider-card primitive. */
export const AvailableCard: Story = {
  args: {
    directory: {
      product: "eigenn",
      entries: [sampleEntry("available")],
    },
    onAction: fn(),
  },
  render: ({ directory: currentDirectory, onAction }) => (
    <div className="max-w-sm">
      <IntegrationCard
        entry={currentDirectory.entries[0]!}
        onAction={onAction}
        onDetails={fn()}
      />
    </div>
  ),
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: /^Connect QuickBooks/ }),
    );
    await expect(args.onAction).toHaveBeenCalledWith(
      args.directory.entries[0],
      "connect",
    );
  },
};

/** The setup-progress primitive with complete, current, and pending steps. */
export const SetupProgress: Story = {
  args: {
    directory,
  },
  render: () => (
    <div className="max-w-md">
      <IntegrationSetupProgress
        currentStepId="verify-permissions"
        steps={[
          {
            id: "authorize",
            label: "Authorize access",
            description: "Sign in with an administrator account.",
            required: true,
          },
          {
            id: "verify-permissions",
            label: "Verify permissions",
            description: "Confirm access to the required accounting data.",
            required: true,
          },
          {
            id: "initial-sync",
            label: "Complete initial sync",
            description: "Load and validate the first source snapshot.",
            required: true,
          },
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByLabelText("Complete")).toBeVisible();
    await expect(canvas.getByLabelText("Current step")).toBeVisible();
    await expect(canvas.getByLabelText("Not started")).toBeVisible();
  },
};

export const DetailFocusRestoration: Story = {
  args: {
    directory: {
      product: "eigenn",
      entries: [sampleEntry("available")],
    },
    onAction: fn(),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const details = canvas.getByRole("button", {
      name: /View details for QuickBooks/,
    });
    await userEvent.click(details);

    const documentCanvas = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(documentCanvas.getByRole("dialog")).toBeVisible(),
    );
    await userEvent.click(
      documentCanvas.getByRole("button", { name: "Close" }),
    );
    await waitFor(() => expect(details).toHaveFocus());
  },
};

export const ConnectionDetail: Story = {
  args: { directory },
  render: () => (
    <IntegrationDetailPanel
      detail={quickBooksDetail}
      entry={multipleConnectionsEntry}
      onAction={fn()}
      onConnectionAction={fn()}
      onOpenChange={fn()}
      open
    />
  ),
  play: async ({ canvasElement }) => {
    const documentCanvas = within(canvasElement.ownerDocument.body);
    await waitFor(() =>
      expect(documentCanvas.getByRole("dialog")).toBeVisible(),
    );
    await expect(
      documentCanvas.getByRole("button", {
        name: "Reconnect Northstar Finance",
      }),
    ).toBeVisible();
    await expect(
      documentCanvas.queryByRole("button", { name: "Reconnect" }),
    ).toBeNull();
  },
};
