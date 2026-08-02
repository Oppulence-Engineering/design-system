import { createRequire } from "node:module";

import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  requiredInputNumber,
  requiredInputRecord,
  requiredInputString,
  requiredInputStringArray,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
  vendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";

const datastoreRequire = createRequire(import.meta.url);

function invocationError(): IntegrationProviderSdkError {
  return new IntegrationProviderSdkError(
    "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
  );
}

/** An index, collection, or namespace name appears in the request path. */
function resourceName(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[A-Za-z0-9._-]{1,128}$/u.test(value)) throw invocationError();
  return value;
}

// ------------------------------------------------------------ Elasticsearch

const ELASTICSEARCH_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "elasticsearch:search": {
    path: ["search"],
    params: (i) => [
      definedFields({
        index: resourceName(i, "index", "indexName"),
        query: optionalInputRecord(i, "query") ?? { match_all: {} },
        size: optionalInputNumber(i, "size", "limit"),
        from: optionalInputNumber(i, "from", "offset"),
        sort: i.sort,
      }),
    ],
  },
  "elasticsearch:count-documents": {
    path: ["count"],
    params: (i) => [
      definedFields({
        index: resourceName(i, "index", "indexName"),
        query: optionalInputRecord(i, "query"),
      }),
    ],
  },
  "elasticsearch:index-document": {
    path: ["index"],
    params: (i) => [
      definedFields({
        index: resourceName(i, "index", "indexName"),
        id: optionalInputString(i, "id", "documentId"),
        document: requiredInputRecord(i, "document", "body"),
        refresh: i.refresh === true ? true : undefined,
      }),
    ],
  },
  "elasticsearch:get-document": {
    path: ["get"],
    params: (i) => [
      {
        index: resourceName(i, "index", "indexName"),
        id: requiredInputString(i, "id", "documentId"),
      },
    ],
  },
  "elasticsearch:update-document": {
    path: ["update"],
    params: (i) => [
      {
        index: resourceName(i, "index", "indexName"),
        id: requiredInputString(i, "id", "documentId"),
        doc: requiredInputRecord(i, "document", "doc", "body"),
      },
    ],
  },
  "elasticsearch:delete-document": {
    path: ["delete"],
    params: (i) => [
      {
        index: resourceName(i, "index", "indexName"),
        id: requiredInputString(i, "id", "documentId"),
      },
    ],
  },
  "elasticsearch:bulk-operations": {
    path: ["bulk"],
    params: (i) => [
      definedFields({
        index: optionalInputString(i, "index", "indexName"),
        operations: i.operations ?? i.body,
        refresh: i.refresh === true ? true : undefined,
      }),
    ],
  },
  "elasticsearch:create-index": {
    path: ["indices", "create"],
    params: (i) => [
      definedFields({
        index: resourceName(i, "index", "indexName"),
        mappings: optionalInputRecord(i, "mappings"),
        settings: optionalInputRecord(i, "settings"),
      }),
    ],
  },
  "elasticsearch:delete-index": {
    path: ["indices", "delete"],
    params: (i) => [{ index: resourceName(i, "index", "indexName") }],
    output: (_v, i) => ({
      index: resourceName(i, "index", "indexName"),
      deleted: true,
    }),
  },
  "elasticsearch:get-index-info": {
    path: ["indices", "get"],
    params: (i) => [{ index: resourceName(i, "index", "indexName") }],
  },
  "elasticsearch:list-indices": {
    path: ["cat", "indices"],
    params: () => [{ format: "json" }],
  },
  "elasticsearch:cluster-health": { path: ["cluster", "health"] },
  "elasticsearch:cluster-stats": { path: ["cluster", "stats"] },
};

/**
 * Elasticsearch is self-hosted or Elastic Cloud, so the node URL comes from
 * the connection. Either an API key or a cloud ID plus key identifies it.
 */
export const createElasticsearchClient: VendorClientFactory = (credential) => {
  const { Client } = datastoreRequire("@elastic/elasticsearch") as {
    Client: new (config: Record<string, unknown>) => SdkMethodTarget;
  };
  const cloudId = vendorField(credential, "cloudId");
  return new Client({
    ...(cloudId
      ? { cloud: { id: cloudId } }
      : { node: requiredVendorField(credential, "node") }),
    auth: { apiKey: vendorToken(credential) },
    requestTimeout: 30_000,
  });
};

export function createElasticsearchPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "elasticsearch",
    driver: "@elastic/elasticsearch@9.4.3",
    transportKind: "api_key",
    operations: ELASTICSEARCH_OPERATIONS,
    clientFactory: options.clientFactory ?? createElasticsearchClient,
  });
}
