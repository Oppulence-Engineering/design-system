"use client";

import * as React from "react";

import type { IntegrationDirectoryLoader } from "./connection";
import {
  IntegrationDirectoryLoaderController,
  type IntegrationDirectoryState,
} from "./react-controller";

export type { IntegrationDirectoryState } from "./react-controller";

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
