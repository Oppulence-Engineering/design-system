import { INTEGRATION_CATALOGUE } from "./catalog";
import type {
  IntegrationCapability,
  IntegrationCategory,
  IntegrationDefinition,
  IntegrationId,
  Product,
  ProductAvailability,
  ProductIntegration,
} from "./contracts";

export interface ProductIntegrationDefinition {
  definition: IntegrationDefinition;
  product: ProductIntegration;
}

export interface IntegrationSearchOptions {
  product?: Product;
  categories?: readonly IntegrationCategory[];
  capabilities?: readonly IntegrationCapability[];
  availability?: readonly ProductAvailability[];
  includeRetired?: boolean;
}

const byCanonicalId = new Map<string, IntegrationDefinition>();
const aliases = new Map<string, IntegrationId>();
const searchText = new Map<string, string>();

for (const integration of INTEGRATION_CATALOGUE) {
  if (byCanonicalId.has(integration.id)) {
    throw new Error(`Duplicate canonical integration ID: ${integration.id}`);
  }
  if (aliases.has(integration.id)) {
    throw new Error(
      `Canonical integration ID overlaps an alias: ${integration.id}`,
    );
  }
  byCanonicalId.set(integration.id, integration);
  for (const alias of integration.aliases) {
    if (byCanonicalId.has(alias) || aliases.has(alias)) {
      throw new Error(`Duplicate integration alias: ${alias}`);
    }
    aliases.set(alias, integration.id);
  }
  searchText.set(
    integration.id,
    [
      integration.id,
      ...integration.aliases,
      integration.name,
      integration.summary,
      integration.category,
      ...integration.capabilities,
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
      .toLocaleLowerCase("en-US"),
  );
}

function normalizeLookupId(value: string): string {
  return value.trim().toLocaleLowerCase("en-US");
}

export function resolveIntegrationId(value: string): IntegrationId | undefined {
  const normalized = normalizeLookupId(value);
  return byCanonicalId.has(normalized)
    ? (normalized as IntegrationId)
    : aliases.get(normalized);
}

export function getIntegration(
  value: string,
): IntegrationDefinition | undefined {
  const id = resolveIntegrationId(value);
  return id ? byCanonicalId.get(id) : undefined;
}

/**
 * Returns the full provider detail for a selected ID. Directory consumers use
 * compact summaries first and resolve this only for a detail surface.
 */
export function getIntegrationDetail(
  value: string,
): IntegrationDefinition | undefined {
  return getIntegration(value);
}

export function getProductIntegrations(
  product: Product,
): readonly ProductIntegrationDefinition[] {
  return INTEGRATION_CATALOGUE.flatMap((definition) => {
    const productMetadata = definition.products.find(
      (candidate) => candidate.product === product,
    );
    return productMetadata ? [{ definition, product: productMetadata }] : [];
  });
}

function matchesProductFilters(
  integration: IntegrationDefinition,
  options: IntegrationSearchOptions,
): boolean {
  if (!options.product) {
    return true;
  }
  const product = integration.products.find(
    (candidate) => candidate.product === options.product,
  );
  if (!product) {
    return false;
  }
  if (!options.includeRetired && product.availability === "retired") {
    return false;
  }
  return (
    !options.availability || options.availability.includes(product.availability)
  );
}

export function searchIntegrations(
  query = "",
  options: IntegrationSearchOptions = {},
): readonly IntegrationDefinition[] {
  const normalizedQuery = query.trim().toLocaleLowerCase("en-US");
  const categories = new Set(options.categories ?? []);
  const capabilities = new Set(options.capabilities ?? []);

  return INTEGRATION_CATALOGUE.filter((integration) => {
    if (!matchesProductFilters(integration, options)) {
      return false;
    }
    if (categories.size > 0 && !categories.has(integration.category)) {
      return false;
    }
    if (
      capabilities.size > 0 &&
      ![...capabilities].every((capability) =>
        integration.capabilities.includes(capability),
      )
    ) {
      return false;
    }
    return (
      !normalizedQuery ||
      searchText.get(integration.id)?.includes(normalizedQuery)
    );
  });
}

export function getIntegrationCatalogue(): readonly IntegrationDefinition[] {
  return INTEGRATION_CATALOGUE;
}
