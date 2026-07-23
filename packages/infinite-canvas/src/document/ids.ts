/**
 * Branded id types. At runtime these are plain strings (so documents stay JSON);
 * the `unique symbol` brand makes them nominally distinct at compile time so you
 * cannot pass a raw string, a NodeId, and a ClientId interchangeably.
 */

declare const NodeIdBrand: unique symbol;
declare const DocumentIdBrand: unique symbol;
declare const ClientIdBrand: unique symbol;
declare const BatchIdBrand: unique symbol;

export type NodeId = string & { readonly [NodeIdBrand]: "NodeId" };
export type DocumentId = string & { readonly [DocumentIdBrand]: "DocumentId" };
export type ClientId = string & { readonly [ClientIdBrand]: "ClientId" };
export type BatchId = string & { readonly [BatchIdBrand]: "BatchId" };

/** The synthetic parent key for top-level (artboard) nodes in the children index. */
export const ROOT_PARENT = "root" as const;
export type ChildrenIndexKey = NodeId | typeof ROOT_PARENT;

// --- casts (validated elsewhere; these are the only sanctioned brand entry points) ---

export const asNodeId = (raw: string): NodeId => raw as NodeId;
export const asDocumentId = (raw: string): DocumentId => raw as DocumentId;
export const asClientId = (raw: string): ClientId => raw as ClientId;
export const asBatchId = (raw: string): BatchId => raw as BatchId;

/**
 * ID generator. Injectable so tests are deterministic and workflow scripts (which
 * ban `Math.random`/`Date.now`) can supply their own. Defaults to `crypto.randomUUID`.
 */
export interface IdFactory {
  nodeId(): NodeId;
  batchId(): BatchId;
  clientId(): ClientId;
}

function randomUuid(): string {
  // `crypto` is available in browsers, Node 19+, and workers.
  return crypto.randomUUID();
}

export const defaultIdFactory: IdFactory = {
  nodeId: () => asNodeId(randomUuid()),
  batchId: () => asBatchId(randomUuid()),
  clientId: () => asClientId(randomUuid()),
};

/**
 * Deterministic id factory for tests: monotonically increasing ids with a prefix.
 * Never use in production (ids must be globally unique across clients).
 */
export function createSeededIdFactory(prefix = "n"): IdFactory {
  let node = 0;
  let batch = 0;
  let client = 0;
  return {
    nodeId: () => asNodeId(`${prefix}-node-${node++}`),
    batchId: () => asBatchId(`${prefix}-batch-${batch++}`),
    clientId: () => asClientId(`${prefix}-client-${client++}`),
  };
}
