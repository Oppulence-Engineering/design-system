/**
 * Data-binding React context (§ templates). Provided by CanvasProvider from its `data`
 * and `filters` props; consumed by the renderer to resolve `{{…}}` expressions in text,
 * attrs, and component props. Null = no data context (raw placeholders shown).
 */

"use client";

import * as React from "react";
import type { BindingData, FilterMap } from "./resolve";
import { DEFAULT_FILTERS } from "./resolve";

export interface BindingContextValue {
  data: BindingData;
  filters: FilterMap;
}

export const BindingContext = React.createContext<BindingContextValue | null>(
  null,
);

export function useBinding(): BindingContextValue | null {
  return React.useContext(BindingContext);
}

export function BindingProvider({
  data,
  filters,
  children,
}: {
  data?: BindingData;
  filters?: FilterMap;
  children: React.ReactNode;
}): React.JSX.Element {
  const value = React.useMemo<BindingContextValue | null>(
    () =>
      data === undefined
        ? null
        : { data, filters: { ...DEFAULT_FILTERS, ...filters } },
    [data, filters],
  );
  return (
    <BindingContext.Provider value={value}>{children}</BindingContext.Provider>
  );
}
