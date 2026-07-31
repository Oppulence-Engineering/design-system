import {
  type IntegrationCapability,
  type IntegrationConnectionProjection,
  IntegrationConnectionProjectionSchema,
  type IntegrationDefinition,
  type IntegrationId,
  type IntegrationSummary,
  IntegrationSummarySchema,
  type Product,
  type ProductIntegration,
} from "./contracts";
import { getProductIntegrations } from "./registry";

export type DirectoryAvailability =
  | "connected"
  | "disconnected"
  | "available"
  | "setup-required"
  | "planned"
  | "retired"
  | "no-access";

export interface IntegrationDirectoryEntry {
  integration: IntegrationSummary;
  product: ProductIntegration;
  connections: readonly IntegrationConnectionProjection[];
  availability: DirectoryAvailability;
  primaryAction?: IntegrationConnectionProjection["permittedActions"][number];
  searchText: string;
}

export interface IntegrationDirectory {
  product: Product;
  entries: readonly IntegrationDirectoryEntry[];
}

export interface IntegrationConnectionResolver<TContext> {
  listAuthorizedConnections(
    context: TContext,
  ): Promise<readonly IntegrationConnectionProjection[]>;
}

export interface IntegrationDirectoryLoader {
  (options?: { signal?: AbortSignal }): Promise<IntegrationDirectory>;
}

export interface BuildIntegrationDirectoryInput {
  product: Product;
  connections: readonly IntegrationConnectionProjection[];
  canConnect?: (
    integration: IntegrationDefinition,
    product: ProductIntegration,
  ) => boolean;
  /** Test and migration seam; production callers use the canonical catalogue. */
  definitions?: readonly IntegrationDefinition[];
}

export class IntegrationDirectoryValidationError extends Error {
  readonly code = "INVALID_CONNECTION_PROJECTION";

  constructor(message: string) {
    super(message);
    this.name = "IntegrationDirectoryValidationError";
  }
}

function validateConnection(
  projection: unknown,
  product: Product,
  productIntegrations: ReadonlyMap<IntegrationId, ProductIntegration>,
  definitions: ReadonlyMap<IntegrationId, IntegrationDefinition>,
): IntegrationConnectionProjection {
  const connection = IntegrationConnectionProjectionSchema.parse(projection);
  if (connection.product !== product) {
    throw new IntegrationDirectoryValidationError(
      `Connection ${connection.id} belongs to ${connection.product}, not ${product}.`,
    );
  }
  const integration = definitions.get(connection.integrationId);
  const productMetadata = productIntegrations.get(connection.integrationId);
  if (!integration || !productMetadata) {
    throw new IntegrationDirectoryValidationError(
      `Connection ${connection.id} references an unknown integration: ${connection.integrationId}.`,
    );
  }
  const allowedCapabilities = new Set(productMetadata.enabledCapabilities);
  for (const capability of connection.enabledCapabilities) {
    if (!allowedCapabilities.has(capability)) {
      throw new IntegrationDirectoryValidationError(
        `Connection ${connection.id} enables ${capability}, which ${integration.id} does not support for ${product}.`,
      );
    }
  }
  if (
    productMetadata.availability === "planned" ||
    productMetadata.availability === "retired"
  ) {
    throw new IntegrationDirectoryValidationError(
      `Connection ${connection.id} cannot reference a ${productMetadata.availability} integration.`,
    );
  }
  return connection;
}

function directoryAvailability(
  product: ProductIntegration,
  connections: readonly IntegrationConnectionProjection[],
  canConnect: boolean,
): DirectoryAvailability {
  if (connections.some((connection) => connection.state !== "disconnected")) {
    return "connected";
  }
  if (connections.length > 0) {
    return "disconnected";
  }
  if (product.availability === "planned") {
    return "planned";
  }
  if (product.availability === "retired") {
    return "retired";
  }
  if (!canConnect) {
    return "no-access";
  }
  return product.setup.length > 0 ? "setup-required" : "available";
}

function primaryAction(
  availability: DirectoryAvailability,
  connections: readonly IntegrationConnectionProjection[],
): IntegrationDirectoryEntry["primaryAction"] {
  if (
    availability === "planned" ||
    availability === "retired" ||
    availability === "no-access"
  ) {
    return undefined;
  }
  if (connections.length === 0) {
    return "connect";
  }
  if (availability === "disconnected") {
    return connections.some((connection) =>
      connection.permittedActions.includes("reconnect"),
    )
      ? "reconnect"
      : undefined;
  }
  const attentionConnection = connections.find(
    (connection) =>
      connection.state === "attention" || connection.state === "stale",
  );
  if (attentionConnection?.permittedActions.includes("reconnect")) {
    return "reconnect";
  }
  return connections[0]?.permittedActions.includes("inspect")
    ? "inspect"
    : undefined;
}

function makeSearchText(
  integration: IntegrationDefinition,
  product: ProductIntegration,
): string {
  return [
    integration.name,
    integration.summary,
    integration.category,
    ...integration.capabilities,
    ...product.authMethods,
    ...integration.operations.flatMap((operation) => [
      operation.label,
      operation.description,
    ]),
    ...integration.triggers.flatMap((trigger) => [
      trigger.label,
      trigger.description,
    ]),
  ]
    .join(" ")
    .toLocaleLowerCase("en-US");
}

function createIntegrationSummary(
  integration: IntegrationDefinition,
  product: ProductIntegration,
): IntegrationSummary {
  return IntegrationSummarySchema.parse({
    id: integration.id,
    name: integration.name,
    category: integration.category,
    summary: integration.summary,
    capabilities: integration.capabilities,
    authMethods: product.authMethods,
    availability: product.availability,
    searchText: makeSearchText(integration, product),
  });
}

/**
 * Merges already-authorized, browser-safe projections into the canonical
 * catalogue. It deliberately has no tenant ID, database client, or policy
 * decision; those stay in the owning product's resolver.
 */
export function buildIntegrationDirectory(
  input: BuildIntegrationDirectoryInput,
): IntegrationDirectory {
  const productEntries = input.definitions
    ? input.definitions.flatMap((definition) => {
        const product = definition.products.find(
          (candidate) => candidate.product === input.product,
        );
        return product ? [{ definition, product }] : [];
      })
    : getProductIntegrations(input.product);
  const productIntegrations = new Map<IntegrationId, ProductIntegration>(
    productEntries.map(({ definition, product }) => [definition.id, product]),
  );
  const definitions = new Map<IntegrationId, IntegrationDefinition>(
    productEntries.map(({ definition }) => [definition.id, definition]),
  );
  const connectionsByIntegration = new Map<
    IntegrationId,
    IntegrationConnectionProjection[]
  >();

  for (const projection of input.connections) {
    const connection = validateConnection(
      projection,
      input.product,
      productIntegrations,
      definitions,
    );
    const existing =
      connectionsByIntegration.get(connection.integrationId) ?? [];
    existing.push(connection);
    connectionsByIntegration.set(connection.integrationId, existing);
  }

  return {
    product: input.product,
    entries: productEntries.map(({ definition, product }) => {
      const connections = connectionsByIntegration.get(definition.id) ?? [];
      const canConnect = input.canConnect?.(definition, product) ?? true;
      const availability = directoryAvailability(
        product,
        connections,
        canConnect,
      );
      return {
        integration: createIntegrationSummary(definition, product),
        product,
        connections,
        availability,
        primaryAction: primaryAction(availability, connections),
        searchText: makeSearchText(definition, product),
      };
    }),
  };
}

export function createIntegrationDirectoryResolver<TContext>(input: {
  product: Product;
  resolver: IntegrationConnectionResolver<TContext>;
  canConnect?: (
    integration: IntegrationDefinition,
    product: ProductIntegration,
  ) => boolean;
}): (context: TContext) => Promise<IntegrationDirectory> {
  return async (context: TContext) =>
    buildIntegrationDirectory({
      product: input.product,
      connections: await input.resolver.listAuthorizedConnections(context),
      canConnect: input.canConnect,
    });
}

export function getConnectionAttentionCount(
  directory: IntegrationDirectory,
): number {
  return directory.entries.reduce(
    (total, entry) =>
      total +
      entry.connections.filter(
        (connection) =>
          connection.state === "attention" ||
          connection.state === "stale" ||
          connection.sourceFreshness?.state === "failed" ||
          connection.sourceFreshness?.state === "stale",
      ).length,
    0,
  );
}

export function connectionSupportsCapability(
  connection: IntegrationConnectionProjection,
  capability: IntegrationCapability,
): boolean {
  return connection.enabledCapabilities.includes(capability);
}
