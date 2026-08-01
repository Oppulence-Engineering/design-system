"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  LockKeyhole,
  Search,
  Wrench,
} from "lucide-react";
import * as React from "react";

import type {
  IntegrationConnectionProjection,
  IntegrationDefinition,
  IntegrationDirectory as IntegrationDirectoryModel,
  IntegrationDirectoryEntry,
} from "@oppulence/integrations";

import { Button } from "../atoms/button";
import { Badge } from "../atoms/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "./sheet";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../molecules/input-group";

type IntegrationAction = NonNullable<
  IntegrationDirectoryEntry["primaryAction"]
>;

export interface IntegrationStatusBadgeProps {
  state:
    | IntegrationConnectionProjection["state"]
    | IntegrationDirectoryEntry["availability"];
  freshness?: IntegrationConnectionProjection["sourceFreshness"];
}

const STATUS_DETAILS: Record<
  IntegrationStatusBadgeProps["state"],
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
    Icon: typeof CheckCircle2;
  }
> = {
  healthy: { label: "Connected", variant: "default", Icon: CheckCircle2 },
  stale: { label: "Stale", variant: "secondary", Icon: Clock3 },
  attention: {
    label: "Needs attention",
    variant: "destructive",
    Icon: AlertCircle,
  },
  disconnected: {
    label: "Disconnected",
    variant: "outline",
    Icon: CircleDashed,
  },
  authorizing: {
    label: "Authorizing",
    variant: "secondary",
    Icon: CircleDashed,
  },
  initial_sync: {
    label: "Initial sync",
    variant: "secondary",
    Icon: CircleDashed,
  },
  not_connected: {
    label: "Not connected",
    variant: "outline",
    Icon: CircleDashed,
  },
  connected: { label: "Connected", variant: "default", Icon: CheckCircle2 },
  available: { label: "Available", variant: "outline", Icon: CheckCircle2 },
  "setup-required": {
    label: "Setup required",
    variant: "secondary",
    Icon: Wrench,
  },
  planned: { label: "Planned", variant: "outline", Icon: Clock3 },
  retired: { label: "Retired", variant: "outline", Icon: CircleDashed },
  "no-access": { label: "No access", variant: "outline", Icon: LockKeyhole },
};

function formatFreshness(
  freshness: IntegrationConnectionProjection["sourceFreshness"],
): string | undefined {
  if (!freshness) {
    return undefined;
  }
  if (freshness.lastSuccessfulSyncAt) {
    return `Source freshness: ${freshness.state}; last successful sync ${new Date(freshness.lastSuccessfulSyncAt).toLocaleString()}.`;
  }
  return `Source freshness: ${freshness.state}.`;
}

export function IntegrationStatusBadge({
  state,
  freshness,
}: IntegrationStatusBadgeProps): React.ReactElement {
  const detail = STATUS_DETAILS[state];
  const freshnessText = formatFreshness(freshness);
  return (
    <Badge
      aria-label={[detail.label, freshnessText].filter(Boolean).join(". ")}
      role="status"
      variant={detail.variant}
    >
      <detail.Icon aria-hidden="true" className="size-3" />
      {detail.label}
    </Badge>
  );
}

function actionLabel(action: IntegrationAction): string {
  return {
    connect: "Connect",
    reconnect: "Reconnect",
    sync_now: "Sync now",
    configure: "Configure",
    disconnect: "Disconnect",
    inspect: "View connection",
  }[action];
}

function representativeState(
  entry: IntegrationDirectoryEntry,
): IntegrationStatusBadgeProps["state"] {
  const connection =
    entry.connections.find(
      (candidate) =>
        candidate.state === "attention" || candidate.state === "stale",
    ) ?? entry.connections[0];
  return connection?.state ?? entry.availability;
}

export interface IntegrationConnectionListProps {
  connections: readonly IntegrationConnectionProjection[];
  onAction?: (
    connection: IntegrationConnectionProjection,
    action: IntegrationAction,
  ) => void;
}

export function IntegrationConnectionList({
  connections,
  onAction,
}: IntegrationConnectionListProps): React.ReactElement | null {
  if (connections.length === 0) {
    return null;
  }
  return (
    <ul aria-label="Authorized connections" className="space-y-2">
      {connections.map((connection) => {
        const freshnessText = formatFreshness(connection.sourceFreshness);
        const recoveryAction = connection.permittedActions.find(
          (action) =>
            action === "reconnect" ||
            action === "sync_now" ||
            action === "configure",
        );
        return (
          <li
            className="border-border/60 bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            key={connection.id}
          >
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">{connection.displayName}</p>
              {connection.accountLabel && (
                <p className="text-muted-foreground text-xs">
                  {connection.accountLabel}
                </p>
              )}
              <p className="text-muted-foreground text-xs" role="status">
                {freshnessText ??
                  "Freshness is not reported for this connection."}
              </p>
              {connection.safeIssue && (
                <p className="text-destructive text-xs" role="status">
                  {connection.safeIssue.summary}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <IntegrationStatusBadge
                freshness={connection.sourceFreshness}
                state={connection.state}
              />
              {recoveryAction && onAction && (
                <Button
                  aria-label={`${actionLabel(recoveryAction)} ${connection.displayName}`}
                  onClick={() => onAction(connection, recoveryAction)}
                  size="sm"
                  variant="outline"
                >
                  {actionLabel(recoveryAction)}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface IntegrationCardProps {
  entry: IntegrationDirectoryEntry;
  onAction?: (
    entry: IntegrationDirectoryEntry,
    action: IntegrationAction,
  ) => void;
  onConnectionAction?: (
    connection: IntegrationConnectionProjection,
    action: IntegrationAction,
  ) => void;
  onDetails?: (entry: IntegrationDirectoryEntry) => void;
}

export function IntegrationCard({
  entry,
  onAction,
  onConnectionAction,
  onDetails,
}: IntegrationCardProps): React.ReactElement {
  const state = representativeState(entry);
  const connection =
    entry.connections.find((candidate) => candidate.state === state) ??
    entry.connections[0];
  const plannedDescription =
    entry.availability === "planned" ? entry.product.plannedOutcome : undefined;
  const freshnessText = formatFreshness(connection?.sourceFreshness);
  const needsRecoveryContext =
    state === "stale" ||
    state === "attention" ||
    state === "disconnected" ||
    connection?.sourceFreshness?.state === "stale" ||
    connection?.sourceFreshness?.state === "failed";
  const recoveryContext =
    state === "disconnected"
      ? (connection?.safeIssue?.summary ??
        "This connection is disconnected. Reconnect to restore source access.")
      : needsRecoveryContext
        ? (connection?.safeIssue?.summary ?? freshnessText)
        : undefined;
  const primaryConnection = entry.primaryAction
    ? (entry.connections.find(
        (candidate) =>
          candidate.permittedActions.includes(entry.primaryAction!) &&
          (candidate.state === "attention" ||
            candidate.state === "stale" ||
            candidate.state === "disconnected"),
      ) ??
      entry.connections.find((candidate) =>
        candidate.permittedActions.includes(entry.primaryAction!),
      ))
    : undefined;
  return (
    <article className="border-border bg-card flex min-h-48 flex-col gap-4 rounded-xl border p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate font-medium">{entry.integration.name}</h3>
          <p className="text-muted-foreground text-sm">
            {entry.integration.summary}
          </p>
        </div>
        <IntegrationStatusBadge
          freshness={connection?.sourceFreshness}
          state={state}
        />
      </div>
      <div
        className="flex flex-wrap gap-1.5"
        aria-label="Integration category and capabilities"
      >
        <Badge variant="secondary">{entry.integration.category}</Badge>
        {entry.integration.capabilities.slice(0, 2).map((capability) => (
          <Badge key={capability} variant="outline">
            {capability.replace(/_/g, " ")}
          </Badge>
        ))}
      </div>
      {plannedDescription && (
        <p className="text-muted-foreground text-xs">{plannedDescription}</p>
      )}
      {recoveryContext && (
        <p
          className={
            connection?.safeIssue
              ? "text-destructive flex items-start gap-1.5 text-xs"
              : "text-muted-foreground flex items-start gap-1.5 text-xs"
          }
          role="status"
        >
          <AlertCircle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
          {recoveryContext}
        </p>
      )}
      <div className="mt-auto flex flex-wrap gap-2">
        {entry.primaryAction &&
          (onAction || (primaryConnection && onConnectionAction)) && (
            <Button
              aria-label={`${actionLabel(entry.primaryAction)} ${entry.integration.name}`}
              onClick={() => {
                if (primaryConnection && onConnectionAction) {
                  onConnectionAction(primaryConnection, entry.primaryAction!);
                  return;
                }
                onAction?.(entry, entry.primaryAction!);
              }}
              size="sm"
            >
              {actionLabel(entry.primaryAction)}
            </Button>
          )}
        {onDetails && (
          <Button
            aria-label={`View details for ${entry.integration.name}`}
            onClick={() => onDetails(entry)}
            size="sm"
            variant="outline"
          >
            Details
            <ChevronRight aria-hidden="true" className="size-3" />
          </Button>
        )}
      </div>
    </article>
  );
}

export interface IntegrationSetupProgressProps {
  steps: readonly {
    id: string;
    label: string;
    description: string;
    required: boolean;
  }[];
  currentStepId?: string;
}

export function IntegrationSetupProgress({
  steps,
  currentStepId,
}: IntegrationSetupProgressProps): React.ReactElement | null {
  if (steps.length === 0) {
    return null;
  }
  const completedCount = currentStepId
    ? Math.max(
        0,
        steps.findIndex((step) => step.id === currentStepId),
      )
    : 0;
  return (
    <section aria-label="Setup progress" className="space-y-2">
      <p className="text-sm font-medium">Setup</p>
      <ol className="space-y-2">
        {steps.map((step, index) => {
          const isCurrent = step.id === currentStepId;
          const isComplete = index < completedCount;
          return (
            <li className="flex gap-2 text-sm" key={step.id}>
              <span
                aria-label={
                  isComplete
                    ? "Complete"
                    : isCurrent
                      ? "Current step"
                      : "Not started"
                }
                className="border-muted-foreground/40 mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]"
              >
                {isComplete ? "✓" : index + 1}
              </span>
              <span>
                <span className="font-medium">{step.label}</span>
                <span className="text-muted-foreground block text-xs">
                  {step.description}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export interface IntegrationDetailPanelProps {
  entry: IntegrationDirectoryEntry | undefined;
  detail?: IntegrationDefinition;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction?: (
    entry: IntegrationDirectoryEntry,
    action: IntegrationAction,
  ) => void;
  onConnectionAction?: (
    connection: IntegrationConnectionProjection,
    action: IntegrationAction,
  ) => void;
}

export function IntegrationDetailPanel({
  entry,
  detail,
  open,
  onOpenChange,
  onAction,
  onConnectionAction,
}: IntegrationDetailPanelProps): React.ReactElement | null {
  if (!entry) {
    return null;
  }
  const state = representativeState(entry);
  const showEntryAction =
    Boolean(entry.primaryAction && onAction) &&
    (entry.connections.length === 0 || !onConnectionAction);
  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent showCloseButton={false} side="right">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3 pr-2">
            <SheetTitle>{entry.integration.name}</SheetTitle>
            <IntegrationStatusBadge state={state} />
          </div>
          <SheetDescription>{entry.integration.summary}</SheetDescription>
        </SheetHeader>
        {/* The sheet is full height, so the body takes the slack and scrolls
            on its own rather than being capped to a fraction of the viewport. */}
        <div className="flex-1 space-y-6 overflow-y-auto pb-2">
          <section className="space-y-2">
            <p className="text-sm font-medium">Capabilities</p>
            <ul className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
              {entry.integration.capabilities.map((capability) => (
                <li key={capability}>{capability.replace(/_/g, " ")}</li>
              ))}
            </ul>
          </section>
          <IntegrationSetupProgress steps={entry.product.setup} />
          <IntegrationConnectionList
            connections={entry.connections}
            onAction={onConnectionAction}
          />
          {detail && detail.operations.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm font-medium">Source operations</p>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {detail.operations.map((operation) => (
                  <li key={operation.id}>{operation.label}</li>
                ))}
              </ul>
            </section>
          )}
          {detail && detail.triggers.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm font-medium">Source triggers</p>
              <ul className="text-muted-foreground space-y-1 text-sm">
                {detail.triggers.map((trigger) => (
                  <li key={trigger.id}>{trigger.label}</li>
                ))}
              </ul>
            </section>
          )}
        </div>
        <SheetFooter>
          {showEntryAction && entry.primaryAction && onAction && (
            <Button onClick={() => onAction(entry, entry.primaryAction!)}>
              {actionLabel(entry.primaryAction)}
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

export interface IntegrationDirectoryProps {
  directory: IntegrationDirectoryModel;
  detailsById?: ReadonlyMap<string, IntegrationDefinition>;
  onAction?: (
    entry: IntegrationDirectoryEntry,
    action: IntegrationAction,
  ) => void;
  onConnectionAction?: (
    connection: IntegrationConnectionProjection,
    action: IntegrationAction,
  ) => void;
}

export function IntegrationDirectory({
  directory,
  detailsById,
  onAction,
  onConnectionAction,
}: IntegrationDirectoryProps): React.ReactElement {
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [capability, setCapability] = React.useState("all");
  const [selectedEntry, setSelectedEntry] =
    React.useState<IntegrationDirectoryEntry>();
  const [detailOpen, setDetailOpen] = React.useState(false);
  const openerRef = React.useRef<HTMLElement | null>(null);
  const categories = React.useMemo(
    () =>
      [
        ...new Set(
          directory.entries.map((entry) => entry.integration.category),
        ),
      ].sort(),
    [directory.entries],
  );
  const capabilities = React.useMemo(
    () =>
      [
        ...new Set(
          directory.entries.flatMap((entry) => entry.integration.capabilities),
        ),
      ].sort(),
    [directory.entries],
  );
  const entries = directory.entries.filter((entry) => {
    const matchesQuery =
      !query || entry.searchText.includes(query.toLocaleLowerCase("en-US"));
    const matchesCategory =
      category === "all" || entry.integration.category === category;
    const matchesCapability =
      capability === "all" ||
      entry.integration.capabilities.includes(capability as never);
    return matchesQuery && matchesCategory && matchesCapability;
  });
  const groups = [
    { state: "connected", label: "Connected" },
    { state: "disconnected", label: "Disconnected" },
    { state: "available", label: "Available" },
    { state: "setup-required", label: "Setup required" },
    { state: "planned", label: "Planned" },
    { state: "no-access", label: "No access" },
    { state: "retired", label: "Retired" },
  ] as const;

  const openDetails = (
    entry: IntegrationDirectoryEntry,
    opener?: HTMLElement,
  ) => {
    openerRef.current = opener ?? null;
    setSelectedEntry(entry);
    setDetailOpen(true);
  };
  const handleOpenChange = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      window.setTimeout(() => openerRef.current?.focus(), 0);
    }
  };

  return (
    <section aria-label="Integration directory" className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="grow">
          <span className="sr-only">Search integrations</span>
          <InputGroup>
            <InputGroupAddon align="inline-start">
              <Search aria-hidden="true" className="size-4" />
            </InputGroupAddon>
            <InputGroupInput
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search providers, operations, and triggers"
              type="search"
              value={query}
            />
          </InputGroup>
        </label>
        <label>
          <span className="sr-only">Filter by category</span>
          <select
            aria-label="Filter by category"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            onChange={(event) => setCategory(event.target.value)}
            value={category}
          >
            <option value="all">All categories</option>
            {categories.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filter by capability</span>
          <select
            aria-label="Filter by capability"
            className="border-input bg-background h-9 rounded-md border px-3 text-sm"
            onChange={(event) => setCapability(event.target.value)}
            value={capability}
          >
            <option value="all">All capabilities</option>
            {capabilities.map((value) => (
              <option key={value} value={value}>
                {value.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p aria-live="polite" className="text-muted-foreground text-sm">
        {entries.length} integrations shown
      </p>
      {entries.length === 0 ? (
        <p className="border-border text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
          No integrations match these filters.
        </p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const groupEntries = entries.filter(
              (entry) => entry.availability === group.state,
            );
            if (groupEntries.length === 0) {
              return null;
            }
            return (
              <section
                aria-labelledby={`integration-group-${group.state}`}
                key={group.state}
              >
                <h2
                  className="mb-3 text-sm font-medium"
                  id={`integration-group-${group.state}`}
                >
                  {group.label} ({groupEntries.length})
                </h2>
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {groupEntries.map((entry) => (
                    <IntegrationCard
                      entry={entry}
                      key={entry.integration.id}
                      onAction={onAction}
                      onConnectionAction={onConnectionAction}
                      onDetails={(nextEntry) => {
                        const activeElement = document.activeElement;
                        openDetails(
                          nextEntry,
                          activeElement instanceof HTMLElement
                            ? activeElement
                            : undefined,
                        );
                      }}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <IntegrationDetailPanel
        entry={selectedEntry}
        detail={
          selectedEntry
            ? detailsById?.get(selectedEntry.integration.id)
            : undefined
        }
        onAction={onAction}
        onConnectionAction={onConnectionAction}
        onOpenChange={handleOpenChange}
        open={detailOpen}
      />
    </section>
  );
}
