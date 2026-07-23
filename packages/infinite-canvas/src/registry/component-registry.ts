/**
 * Component registry (§9). The consumer registers leaf components with a Zod schema as
 * the SINGLE SOURCE OF TRUTH — props are inferred (`z.output<S>`), so a consumer never
 * hand-maintains a props interface that can drift. The document stores only
 * `componentKey` + JSON props; the registry restores type safety at authoring time and
 * guards rendering via `schema.safeParse`.
 *
 * v1 limitation (stated in the plan): leaf components with serializable props only —
 * no `children`/ReactNode/function props. Nodes parented to a ComponentNode are ignored
 * by the renderer with a dev warning; a `slots` design is reserved for a later version.
 */

import * as React from "react";
import type { z } from "zod";
import type { JsonValue } from "../document/json";
import {
  asNodeId,
  defaultIdFactory,
  type IdFactory,
  type NodeId,
} from "../document/ids";
import type { ComponentNode } from "../document/nodes";
import type { InspectorSection } from "./inspector-controls";

export interface ComponentDefinition<
  P extends Record<string, JsonValue> = Record<string, JsonValue>,
> {
  key: string;
  label: string;
  schema: z.ZodType<P>;
  component: React.ComponentType<P>;
  defaultProps: P;
  defaultSize?: { width: number; height: number };
  inspector?: readonly InspectorSection[];
}

/** Identity helper that infers props from the schema and ties component + defaults to them. */
export function defineComponent<
  S extends z.ZodType<Record<string, JsonValue>>,
>(def: {
  key: string;
  label: string;
  schema: S;
  component: React.ComponentType<z.output<S>>;
  defaultProps: z.output<S>;
  defaultSize?: { width: number; height: number };
  inspector?: readonly InspectorSection[];
}): ComponentDefinition<z.output<S>> {
  return def as unknown as ComponentDefinition<z.output<S>>;
}

export interface ComponentRegistry<
  T extends Record<string, ComponentDefinition<Record<string, JsonValue>>> =
    Record<string, ComponentDefinition<Record<string, JsonValue>>>,
> {
  get(key: string): ComponentDefinition | undefined;
  has(key: string): boolean;
  keys(): string[];
  /** Fully-typed node authoring for keys known at compile time. */
  createNode<K extends keyof T & string>(
    key: K,
    overrides?: {
      id?: NodeId;
      parentId?: NodeId | null;
      sortKey?: string;
      props?: Partial<ReturnType<() => Record<string, JsonValue>>>;
    },
    idFactory?: IdFactory,
  ): ComponentNode;
}

export function createComponentRegistry<
  T extends Record<string, ComponentDefinition<Record<string, JsonValue>>>,
>(defs: T): ComponentRegistry<T> {
  const map = new Map<string, ComponentDefinition>(Object.entries(defs));

  return {
    get: (key) => map.get(key),
    has: (key) => map.has(key),
    keys: () => [...map.keys()],
    createNode(key, overrides, idFactory = defaultIdFactory) {
      const def = map.get(key);
      if (def === undefined) throw new Error(`Unknown component key: ${key}`);
      const size = def.defaultSize ?? { width: 200, height: 120 };
      return {
        type: "component",
        id: overrides?.id ?? asNodeId(idFactory.nodeId()),
        parentId: overrides?.parentId ?? null,
        sortKey: overrides?.sortKey ?? "a0",
        name: def.label,
        visible: true,
        locked: false,
        rotation: 0,
        componentKey: key,
        props: { ...def.defaultProps, ...(overrides?.props ?? {}) } as Record<
          string,
          JsonValue
        >,
        style: { width: size.width, height: size.height },
      };
    },
  };
}

/** An empty registry (single-player docs with no component instances). */
export function emptyRegistry(): ComponentRegistry {
  return createComponentRegistry({});
}
