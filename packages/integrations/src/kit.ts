import { INTEGRATION_CATALOGUE } from "./catalog";
import {
  buildIntegrationDirectory,
  type IntegrationConnectionResolver,
  type IntegrationDirectory,
} from "./connection";
import {
  type IntegrationConnectionProjection,
  IntegrationConnectionProjectionSchema,
  type IntegrationDefinition,
  type IntegrationId,
  type Product,
  type ProductIntegration,
} from "./contracts";
import {
  type ActionResult,
  type ConnectRequest,
  ConnectRequestSchema,
  type ConnectResult,
  type ConnectionHealth,
  type ConnectionHealthRequest,
  ConnectionHealthRequestSchema,
  type IntegrationActionRequest,
  IntegrationActionRequestSchema,
  type IntegrationEntitlement,
  IntegrationEntitlementSchema,
  type IntegrationSupportContract,
  type ProductIntegrationConnector,
  validateFunctionalSupportContracts,
} from "./support";

export type IntegrationCommand = "connect" | IntegrationActionRequest["action"];
export type IntegrationEntitlementInput = z.input<
  typeof IntegrationEntitlementSchema
>;

export interface IntegrationEntitlementRequest {
  integration: IntegrationDefinition;
  product: ProductIntegration;
  action: IntegrationCommand;
  connection?: IntegrationConnectionProjection;
}

/**
 * The owning product supplies policy results, but this package validates them
 * and uses them consistently for directory rendering and command dispatch.
 */
export interface ProductIntegrationEntitlements<TContext> {
  evaluate(
    context: TContext,
    request: IntegrationEntitlementRequest,
  ): Promise<IntegrationEntitlementInput>;
  /**
   * Optional bulk path for a directory. It prevents a catalogue with hundreds
   * of entries from forcing one database/policy read per provider.
   */
  evaluateDirectory?(
    context: TContext,
    candidates: readonly {
      integration: IntegrationDefinition;
      product: ProductIntegration;
    }[],
  ): Promise<ReadonlyMap<string, IntegrationEntitlementInput>>;
}

/**
 * Maps product-private database records into the browser-safe projection.
 * The shared package deliberately receives neither a database client nor the
 * private record type.
 */
export interface IntegrationConnectionRecordAdapter<TContext, TRecord> {
  listAuthorizedRecords(context: TContext): Promise<readonly TRecord[]>;
  toProjection(
    context: TContext,
    record: TRecord,
  ): IntegrationConnectionProjection;
}

export function createIntegrationConnectionResolver<TContext, TRecord>(
  adapter: IntegrationConnectionRecordAdapter<TContext, TRecord>,
): IntegrationConnectionResolver<TContext> {
  return {
    async listAuthorizedConnections(context) {
      const records = await adapter.listAuthorizedRecords(context);
      return records.map((record) =>
        IntegrationConnectionProjectionSchema.parse(
          adapter.toProjection(context, record),
        ),
      );
    },
  };
}

export interface ProductIntegrationKitConfig<TContext> {
  product: Product;
  resolver: IntegrationConnectionResolver<TContext>;
  /**
   * Must load by an already-authorized connection ID. Returning undefined is
   * deliberately indistinguishable from an inaccessible connection.
   */
  findAuthorizedConnection(
    context: TContext,
    connectionId: string,
  ): Promise<IntegrationConnectionProjection | undefined>;
  entitlements: ProductIntegrationEntitlements<TContext>;
  connector: ProductIntegrationConnector<TContext>;
  /** Test and staged-migration seam; production callers use the catalogue. */
  definitions?: readonly IntegrationDefinition[];
  /** Product-owned, declarative functional-parity evidence. */
  supportContracts?: readonly IntegrationSupportContract[];
}

export interface ProductIntegrationKit<TContext> {
  getDirectory(context: TContext): Promise<IntegrationDirectory>;
  getEntitlement(
    context: TContext,
    integrationId: string,
    action: IntegrationCommand,
    connection?: IntegrationConnectionProjection,
  ): Promise<IntegrationEntitlement>;
  beginConnection(context: TContext, request: unknown): Promise<ConnectResult>;
  performAction(context: TContext, request: unknown): Promise<ActionResult>;
  getConnectionHealth(
    context: TContext,
    request: unknown,
  ): Promise<ConnectionHealth>;
}

export class IntegrationUnavailableError extends Error {
  readonly code = "INTEGRATION_UNAVAILABLE";

  constructor(message = "This integration is not available in this product.") {
    super(message);
    this.name = "IntegrationUnavailableError";
  }
}

export class IntegrationAccessDeniedError extends Error {
  readonly code = "INTEGRATION_ACCESS_DENIED";
  readonly entitlement: IntegrationEntitlement;

  constructor(entitlement: IntegrationEntitlement) {
    super(entitlement.explanation ?? "You do not have access to this action.");
    this.name = "IntegrationAccessDeniedError";
    this.entitlement = entitlement;
  }
}

export class IntegrationConnectionAccessError extends Error {
  readonly code = "INTEGRATION_CONNECTION_NOT_FOUND";

  constructor() {
    super("The requested connection is not available.");
    this.name = "IntegrationConnectionAccessError";
  }
}

interface DefinitionIndex {
  byId: ReadonlyMap<string, IntegrationDefinition>;
  aliases: ReadonlyMap<string, IntegrationId>;
}

function normalizeId(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

function createDefinitionIndex(
  definitions: readonly IntegrationDefinition[],
): DefinitionIndex {
  const byId = new Map<string, IntegrationDefinition>();
  const aliases = new Map<string, IntegrationId>();
  for (const definition of definitions) {
    if (byId.has(definition.id) || aliases.has(definition.id)) {
      throw new Error(`Duplicate integration ID: ${definition.id}.`);
    }
    byId.set(definition.id, definition);
    for (const alias of definition.aliases) {
      if (byId.has(alias) || aliases.has(alias)) {
        throw new Error(`Duplicate integration alias: ${alias}.`);
      }
      aliases.set(alias, definition.id);
    }
  }
  return { byId, aliases };
}

function getProductMetadata(
  definition: IntegrationDefinition,
  product: Product,
): ProductIntegration | undefined {
  return definition.products.find((candidate) => candidate.product === product);
}

function isConnectable(product: ProductIntegration): boolean {
  return product.availability === "beta" || product.availability === "shipped";
}

function deniedEntitlement(): IntegrationEntitlement {
  return IntegrationEntitlementSchema.parse({
    allowed: false,
    reasonCode: "integration_unavailable",
    requestAccessAllowed: false,
    explanation: "This integration is not available for your workspace.",
  });
}

/**
 * Centralizes safe, framework-neutral directory and command orchestration.
 * Product code supplies only the authorized record lookup, policy evaluator,
 * and server-side connector implementation.
 */
export function createProductIntegrationKit<TContext>(
  config: ProductIntegrationKitConfig<TContext>,
): ProductIntegrationKit<TContext> {
  const definitions = config.definitions ?? INTEGRATION_CATALOGUE;
  const index = createDefinitionIndex(definitions);
  validateFunctionalSupportContracts(
    definitions,
    config.supportContracts ?? [],
  );

  function resolveDefinition(value: string): IntegrationDefinition | undefined {
    const normalized = normalizeId(value);
    const canonicalId = index.byId.has(normalized)
      ? normalized
      : index.aliases.get(normalized);
    return canonicalId ? index.byId.get(canonicalId) : undefined;
  }

  function requireConnectableIntegration(value: string): {
    integration: IntegrationDefinition;
    product: ProductIntegration;
  } {
    const integration = resolveDefinition(value);
    if (!integration) {
      throw new IntegrationUnavailableError();
    }
    const product = getProductMetadata(integration, config.product);
    if (!product || !isConnectable(product)) {
      throw new IntegrationUnavailableError();
    }
    return { integration, product };
  }

  async function getEntitlement(
    context: TContext,
    integrationId: string,
    action: IntegrationCommand,
    connection?: IntegrationConnectionProjection,
  ): Promise<IntegrationEntitlement> {
    const { integration, product } =
      requireConnectableIntegration(integrationId);
    const entitlement = IntegrationEntitlementSchema.parse(
      await config.entitlements.evaluate(context, {
        integration,
        product,
        action,
        connection,
      }),
    );
    return entitlement;
  }

  async function requireEntitlement(
    context: TContext,
    integration: IntegrationDefinition,
    product: ProductIntegration,
    action: IntegrationCommand,
    connection?: IntegrationConnectionProjection,
  ): Promise<void> {
    const entitlement = IntegrationEntitlementSchema.parse(
      await config.entitlements.evaluate(context, {
        integration,
        product,
        action,
        connection,
      }),
    );
    if (!entitlement.allowed) {
      throw new IntegrationAccessDeniedError(entitlement);
    }
  }

  async function findConnection(
    context: TContext,
    connectionId: string,
  ): Promise<{
    connection: IntegrationConnectionProjection;
    integration: IntegrationDefinition;
    product: ProductIntegration;
  }> {
    const rawConnection = await config.findAuthorizedConnection(
      context,
      connectionId,
    );
    if (!rawConnection) {
      throw new IntegrationConnectionAccessError();
    }
    const connection =
      IntegrationConnectionProjectionSchema.parse(rawConnection);
    if (connection.product !== config.product) {
      throw new IntegrationConnectionAccessError();
    }
    const integration = index.byId.get(connection.integrationId);
    const product = integration
      ? getProductMetadata(integration, config.product)
      : undefined;
    if (!integration || !product || !isConnectable(product)) {
      throw new IntegrationConnectionAccessError();
    }
    for (const capability of connection.enabledCapabilities) {
      if (!product.enabledCapabilities.includes(capability)) {
        throw new IntegrationConnectionAccessError();
      }
    }
    return { connection, integration, product };
  }

  async function resolveDirectoryEntitlements(
    context: TContext,
  ): Promise<ReadonlyMap<string, IntegrationEntitlement>> {
    const candidates = definitions.flatMap((integration) => {
      const product = getProductMetadata(integration, config.product);
      return product && isConnectable(product)
        ? [{ integration, product }]
        : [];
    });
    const rawEntitlements = config.entitlements.evaluateDirectory
      ? await config.entitlements.evaluateDirectory(context, candidates)
      : new Map(
          await Promise.all(
            candidates.map(
              async ({ integration, product }) =>
                [
                  integration.id,
                  await config.entitlements.evaluate(context, {
                    integration,
                    product,
                    action: "connect",
                  }),
                ] as const,
            ),
          ),
        );
    const entitlements = new Map<string, IntegrationEntitlement>();
    for (const { integration } of candidates) {
      const rawEntitlement = rawEntitlements.get(integration.id);
      entitlements.set(
        integration.id,
        rawEntitlement
          ? IntegrationEntitlementSchema.parse(rawEntitlement)
          : deniedEntitlement(),
      );
    }
    return entitlements;
  }

  return {
    async getDirectory(context) {
      const [connections, entitlements] = await Promise.all([
        config.resolver.listAuthorizedConnections(context),
        resolveDirectoryEntitlements(context),
      ]);
      return buildIntegrationDirectory({
        product: config.product,
        definitions,
        connections,
        canConnect: (integration) =>
          entitlements.get(integration.id)?.allowed ?? false,
      });
    },

    getEntitlement,

    async beginConnection(context, rawRequest) {
      const request = ConnectRequestSchema.parse(rawRequest);
      const { integration, product } = requireConnectableIntegration(
        request.integrationId,
      );
      if (!product.authMethods.includes(request.mode)) {
        throw new IntegrationUnavailableError(
          "This connection method is not available for this integration.",
        );
      }
      await requireEntitlement(context, integration, product, "connect");
      return config.connector.beginConnection(context, {
        ...request,
        integrationId: integration.id,
      });
    },

    async performAction(context, rawRequest) {
      const request = IntegrationActionRequestSchema.parse(rawRequest);
      const { connection, integration, product } = await findConnection(
        context,
        request.connectionId,
      );
      if (!connection.permittedActions.includes(request.action)) {
        throw new IntegrationAccessDeniedError(deniedEntitlement());
      }
      await requireEntitlement(
        context,
        integration,
        product,
        request.action,
        connection,
      );
      return config.connector.performAction(context, request);
    },

    async getConnectionHealth(context, rawRequest) {
      const request: ConnectionHealthRequest =
        ConnectionHealthRequestSchema.parse(rawRequest);
      const { connection, integration, product } = await findConnection(
        context,
        request.connectionId,
      );
      await requireEntitlement(
        context,
        integration,
        product,
        "inspect",
        connection,
      );
      return config.connector.getConnectionHealth(context, request);
    },
  };
}
import type { z } from "zod";
