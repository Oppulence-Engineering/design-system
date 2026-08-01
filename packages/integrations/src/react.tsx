"use client";

import * as React from "react";
import { useMergeLink } from "@mergeapi/react-merge-link";
import { usePlaidLink } from "react-plaid-link";

import { filterIntegrationDirectory } from "./connection";
import type {
  IntegrationDirectoryEntry,
  IntegrationDirectoryFacets,
  IntegrationDirectoryFilter,
  IntegrationDirectoryLoader,
} from "./connection";
import {
  createIntegrationConnectionLinkClient,
  type CreateIntegrationConnectionLinkClientConfig,
  type IntegrationConnectionLinkClient,
  type IntegrationConnectionLinkCompletion,
  type IntegrationConnectionLinkProvider,
} from "./link-client";
import {
  IntegrationDirectoryLoaderController,
  type IntegrationDirectoryState,
} from "./react-controller";

export type { IntegrationDirectoryState } from "./react-controller";
export {
  createIntegrationConnectionLinkClient,
  IntegrationConnectionLinkClientError,
} from "./link-client";
export type {
  CreateIntegrationConnectionLinkClientConfig,
  IntegrationConnectionLinkClient,
  IntegrationConnectionLinkCompletion,
  IntegrationConnectionLinkFetcher,
  IntegrationConnectionLinkProvider,
  IntegrationConnectionLinkToken,
} from "./link-client";

const IntegrationDirectoryContext = React.createContext<
  IntegrationDirectoryState | undefined
>(undefined);

export function useIntegrationDirectoryLoader(
  loader: IntegrationDirectoryLoader,
  scopeKey: string,
): IntegrationDirectoryState {
  const controllerRef = React.useRef<
    | {
        scopeKey: string;
        controller: IntegrationDirectoryLoaderController;
      }
    | undefined
  >(undefined);
  if (!controllerRef.current || controllerRef.current.scopeKey !== scopeKey) {
    controllerRef.current = {
      scopeKey,
      controller: new IntegrationDirectoryLoaderController(loader),
    };
  }
  const controller = controllerRef.current.controller;
  controller.setLoader(loader);
  const [state, setState] = React.useState<IntegrationDirectoryState>(
    controller.state,
  );

  React.useEffect(() => {
    const unsubscribe = controller.subscribe(setState);
    void controller.refresh();
    return () => {
      unsubscribe();
    };
  }, [controller, loader]);

  React.useEffect(() => {
    return () => controller.dispose();
  }, [controller]);

  // Never render a prior organization or product while a new scope is loading.
  return state.refresh === controller.state.refresh ? state : controller.state;
}

export interface IntegrationDirectoryProviderProps {
  loader: IntegrationDirectoryLoader;
  /** Stable product-and-tenant identity, for example `eigenn:team_123`. */
  scopeKey: string;
  children: React.ReactNode;
}

export function IntegrationDirectoryProvider({
  loader,
  scopeKey,
  children,
}: IntegrationDirectoryProviderProps): React.ReactElement {
  const state = useIntegrationDirectoryLoader(loader, scopeKey);
  return (
    <IntegrationDirectoryContext.Provider value={state}>
      {children}
    </IntegrationDirectoryContext.Provider>
  );
}

export function useIntegrationDirectory(): IntegrationDirectoryState {
  const state = React.useContext(IntegrationDirectoryContext);
  if (!state) {
    throw new Error(
      "useIntegrationDirectory must be used within an IntegrationDirectoryProvider.",
    );
  }
  return state;
}

export type IntegrationConnectionLinkPhase =
  | "idle"
  | "preparing"
  | "ready"
  | "completing"
  | "connected"
  | "failed";

interface IntegrationConnectionLinkButtonBaseProps {
  /** Reuse a product fetch wrapper when it injects CSRF protection or tracing. */
  client?: IntegrationConnectionLinkClient;
  /** Used only when `client` is omitted. Defaults to `/integrations`. */
  basePath?: string;
  buttonProps?: Omit<
    React.ComponentPropsWithoutRef<"button">,
    "children" | "onClick" | "type"
  >;
  children?: React.ReactNode;
  onConnected?(result: IntegrationConnectionLinkCompletion): void;
  onExit?(): void;
  onError?(error: Error): void;
}

interface IntegrationConnectionLinkLifecycle {
  error: Error | undefined;
  linkToken: string | undefined;
  phase: IntegrationConnectionLinkPhase;
  shouldOpen: boolean;
  complete(publicToken: string): Promise<void>;
  openWhenReady(): void;
  fail(error: unknown): void;
  exit(): void;
}

function asLinkError(error: unknown): Error {
  return error instanceof Error
    ? error
    : new Error("The secure provider connection could not be completed.");
}

function useIntegrationConnectionLinkLifecycle(
  integrationId: IntegrationConnectionLinkProvider,
  client: IntegrationConnectionLinkClient,
  callbacks: Pick<
    IntegrationConnectionLinkButtonBaseProps,
    "onConnected" | "onError" | "onExit"
  >,
): IntegrationConnectionLinkLifecycle {
  const callbacksRef = React.useRef(callbacks);
  callbacksRef.current = callbacks;
  const [linkToken, setLinkToken] = React.useState<string>();
  const [phase, setPhase] =
    React.useState<IntegrationConnectionLinkPhase>("idle");
  const [error, setError] = React.useState<Error>();
  const [shouldOpen, setShouldOpen] = React.useState(false);

  const fail = React.useCallback((rawError: unknown) => {
    const nextError = asLinkError(rawError);
    setShouldOpen(false);
    setPhase("failed");
    setError(nextError);
    callbacksRef.current.onError?.(nextError);
  }, []);

  const openWhenReady = React.useCallback(async () => {
    if (phase === "preparing" || phase === "completing") {
      return;
    }
    setError(undefined);
    setPhase("preparing");
    try {
      const token = await client.createToken(integrationId);
      setLinkToken(token.linkToken);
      setShouldOpen(true);
      setPhase("ready");
    } catch (rawError) {
      fail(rawError);
    }
  }, [client, fail, integrationId, phase]);

  const complete = React.useCallback(
    async (publicToken: string) => {
      if (phase === "completing") {
        return;
      }
      setShouldOpen(false);
      setPhase("completing");
      setError(undefined);
      try {
        const result = await client.complete(integrationId, publicToken);
        setLinkToken(undefined);
        setPhase("connected");
        callbacksRef.current.onConnected?.(result);
      } catch (rawError) {
        fail(rawError);
      }
    },
    [client, fail, integrationId, phase],
  );

  const exit = React.useCallback(() => {
    setShouldOpen(false);
    if (phase !== "completing") {
      setPhase("idle");
    }
    callbacksRef.current.onExit?.();
  }, [phase]);

  return {
    error,
    linkToken,
    phase,
    shouldOpen,
    complete,
    openWhenReady,
    fail,
    exit,
  };
}

function useLinkClient(
  client: IntegrationConnectionLinkClient | undefined,
  basePath: string | undefined,
): IntegrationConnectionLinkClient {
  return React.useMemo(
    () => client ?? createIntegrationConnectionLinkClient({ basePath }),
    [basePath, client],
  );
}

function linkButtonLabel(
  phase: IntegrationConnectionLinkPhase,
  provider: string,
): string {
  switch (phase) {
    case "preparing":
      return "Preparing secure connection…";
    case "completing":
      return "Finishing connection…";
    case "connected":
      return `${provider} connected`;
    default:
      return `Connect ${provider}`;
  }
}

export interface PlaidConnectionLinkButtonProps extends IntegrationConnectionLinkButtonBaseProps {
  /** Pass the nonce used by a strict Content-Security-Policy. */
  cspNonce?: string;
}

/**
 * Complete Plaid Link button backed by package-owned token and completion
 * routes. The browser receives only a short-lived Link token and public token.
 */
export function PlaidConnectionLinkButton({
  client: suppliedClient,
  basePath,
  buttonProps,
  children,
  onConnected,
  onError,
  onExit,
  cspNonce,
}: PlaidConnectionLinkButtonProps): React.ReactElement {
  const client = useLinkClient(suppliedClient, basePath);
  const lifecycle = useIntegrationConnectionLinkLifecycle("plaid", client, {
    onConnected,
    onError,
    onExit,
  });
  const { complete, exit, fail, linkToken, openWhenReady, phase, shouldOpen } =
    lifecycle;
  const onSuccess = React.useCallback(
    (publicToken: string | null) => {
      if (!publicToken) {
        fail(new Error("Plaid Link did not return a connection token."));
        return;
      }
      void complete(publicToken);
    },
    [complete, fail],
  );
  const { open, ready, error } = usePlaidLink({
    token: linkToken ?? null,
    onSuccess,
    onExit: exit,
    ...(cspNonce ? { cspNonce } : {}),
  });

  React.useEffect(() => {
    if (error) {
      fail(error);
    }
  }, [error, fail]);
  React.useEffect(() => {
    if (shouldOpen && ready) {
      open();
    }
  }, [open, ready, shouldOpen]);

  const disabled =
    buttonProps?.disabled || phase === "preparing" || phase === "completing";
  return (
    <button
      {...buttonProps}
      type="button"
      data-integration-link-provider="plaid"
      data-integration-link-phase={phase}
      aria-busy={disabled || undefined}
      disabled={disabled}
      onClick={() => void openWhenReady()}
    >
      {children ?? linkButtonLabel(phase, "Plaid")}
    </button>
  );
}

export interface MergeConnectionLinkButtonProps extends IntegrationConnectionLinkButtonBaseProps {
  /** Required only for a Merge tenant with a non-default API base URL. */
  tenantConfig?: { apiBaseURL?: string };
}

/**
 * Complete Merge Link button backed by package-owned token and completion
 * routes. Merge account tokens never enter browser or product component state.
 */
export function MergeConnectionLinkButton({
  client: suppliedClient,
  basePath,
  buttonProps,
  children,
  onConnected,
  onError,
  onExit,
  tenantConfig,
}: MergeConnectionLinkButtonProps): React.ReactElement {
  const client = useLinkClient(suppliedClient, basePath);
  const lifecycle = useIntegrationConnectionLinkLifecycle("merge", client, {
    onConnected,
    onError,
    onExit,
  });
  const { complete, exit, fail, linkToken, openWhenReady, phase, shouldOpen } =
    lifecycle;
  const onSuccess = React.useCallback(
    (publicToken: string) => {
      void complete(publicToken);
    },
    [complete],
  );
  const mergeConfig = React.useMemo(
    () => ({
      linkToken,
      onSuccess,
      onExit: exit,
      ...(tenantConfig ? { tenantConfig } : {}),
    }),
    [exit, linkToken, onSuccess, tenantConfig],
  );
  const { open, isReady, error } = useMergeLink(mergeConfig);

  React.useEffect(() => {
    if (error) {
      fail(error);
    }
  }, [error, fail]);
  React.useEffect(() => {
    if (shouldOpen && isReady) {
      open();
    }
  }, [isReady, open, shouldOpen]);

  const disabled =
    buttonProps?.disabled || phase === "preparing" || phase === "completing";
  return (
    <button
      {...buttonProps}
      type="button"
      data-integration-link-provider="merge"
      data-integration-link-phase={phase}
      aria-busy={disabled || undefined}
      disabled={disabled}
      onClick={() => void openWhenReady()}
    >
      {children ?? linkButtonLabel(phase, "Merge")}
    </button>
  );
}

// --------------------------------------------------------- directory display

export interface IntegrationDirectorySearch {
  entries: readonly IntegrationDirectoryEntry[];
  facets: IntegrationDirectoryFacets;
  isLoading: boolean;
  error: Error | undefined;
  /** Total before filtering, so a UI can say "12 of 255". */
  total: number;
}

/**
 * Filters the loaded directory. The filtering itself lives in `connection` so
 * it stays testable without a DOM; this only binds it to the loaded state.
 */
export function useIntegrationDirectorySearch(
  filter: IntegrationDirectoryFilter = {},
): IntegrationDirectorySearch {
  const { directory, error, isLoading } = useIntegrationDirectory();
  const { query, category, availability } = filter;

  return React.useMemo(() => {
    const all = directory?.entries ?? [];
    const { entries, facets } = filterIntegrationDirectory(all, {
      query,
      category,
      availability,
    });
    return { entries, facets, total: all.length, isLoading, error };
  }, [availability, category, directory, error, isLoading, query]);
}

export interface IntegrationDirectoryListProps extends IntegrationDirectoryFilter {
  /** Replaces the default row. Receives each entry that survives the filter. */
  renderEntry?: (entry: IntegrationDirectoryEntry) => React.ReactNode;
  /** Rendered instead of the list while the first load is in flight. */
  renderLoading?: () => React.ReactNode;
  /** Rendered when the loader failed. */
  renderError?: (error: Error) => React.ReactNode;
  /** Rendered when the filter matched nothing. */
  renderEmpty?: () => React.ReactNode;
  /** Invoked when a connectable entry's action is activated. */
  onSelect?: (entry: IntegrationDirectoryEntry) => void;
}

/**
 * Renders the directory as a semantic list. Styling is left to the product:
 * every element carries data attributes rather than class names, and the row
 * can be replaced wholesale with `renderEntry`.
 */
export function IntegrationDirectoryList({
  renderEntry,
  renderLoading,
  renderError,
  renderEmpty,
  onSelect,
  ...filter
}: IntegrationDirectoryListProps): React.ReactElement | null {
  const { entries, error, isLoading } = useIntegrationDirectorySearch(filter);

  if (error) {
    return <>{renderError ? renderError(error) : null}</>;
  }
  // Keep showing the previous results while a refresh is in flight; only the
  // very first load has nothing to render.
  if (isLoading && !entries.length) {
    return <>{renderLoading ? renderLoading() : null}</>;
  }
  if (!entries.length) {
    return <>{renderEmpty ? renderEmpty() : null}</>;
  }

  return (
    <ul data-integration-directory="list">
      {entries.map((entry) => (
        <li
          key={entry.integration.id}
          data-integration-id={entry.integration.id}
          data-integration-category={entry.integration.category}
          data-integration-availability={entry.availability}
        >
          {renderEntry ? (
            renderEntry(entry)
          ) : (
            <IntegrationDirectoryRow entry={entry} onSelect={onSelect} />
          )}
        </li>
      ))}
    </ul>
  );
}

export interface IntegrationDirectoryRowProps {
  entry: IntegrationDirectoryEntry;
  onSelect?: (entry: IntegrationDirectoryEntry) => void;
}

/** The default row: name, summary, state, and the entry's primary action. */
export function IntegrationDirectoryRow({
  entry,
  onSelect,
}: IntegrationDirectoryRowProps): React.ReactElement {
  const { integration, availability, primaryAction, connections } = entry;
  return (
    <div data-integration-directory="row">
      <span data-integration-field="name">{integration.name}</span>
      <span data-integration-field="summary">{integration.summary}</span>
      <span data-integration-field="availability">{availability}</span>
      {connections.length > 0 ? (
        <span data-integration-field="connections">{connections.length}</span>
      ) : null}
      {primaryAction ? (
        <button
          type="button"
          data-integration-action={primaryAction}
          onClick={() => onSelect?.(entry)}
        >
          {primaryAction}
        </button>
      ) : null}
    </div>
  );
}
