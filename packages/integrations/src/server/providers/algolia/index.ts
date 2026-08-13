import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import { requireOptionalSdk } from "../shared/optional-sdk";
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

// ------------------------------------------------------------------ Algolia

const ALGOLIA_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "algolia:search": {
    path: ["searchSingleIndex"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        searchParams: definedFields({
          query: optionalInputString(input, "query", "search") ?? "",
          filters: optionalInputString(input, "filters"),
          hitsPerPage: optionalInputNumber(input, "limit", "hitsPerPage"),
          page: optionalInputNumber(input, "page"),
        }),
      },
    ],
  },
  "algolia:browse-records": {
    path: ["browse"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        browseParams: definedFields({
          query: optionalInputString(input, "query"),
          filters: optionalInputString(input, "filters"),
          cursor: optionalInputString(input, "cursor"),
        }),
      },
    ],
  },
  "algolia:add-record": {
    path: ["saveObject"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        body: requiredInputRecord(input, "record", "object", "body"),
      },
    ],
  },
  "algolia:get-record": {
    path: ["getObject"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        objectID: requiredInputString(input, "objectID", "objectId", "id"),
      },
    ],
  },
  "algolia:get-records": {
    path: ["getObjects"],
    params: (input) => [
      {
        requests: requiredInputStringArray(input, "objectIDs", "ids").map(
          (objectID) => ({
            indexName: resourceName(input, "index", "indexName"),
            objectID,
          }),
        ),
      },
    ],
  },
  "algolia:partial-update-record": {
    path: ["partialUpdateObject"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        objectID: requiredInputString(input, "objectID", "objectId", "id"),
        attributesToUpdate: requiredInputRecord(input, "attributes", "record"),
        createIfNotExists: input.createIfNotExists !== false,
      },
    ],
  },
  "algolia:delete-record": {
    path: ["deleteObject"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        objectID: requiredInputString(input, "objectID", "objectId", "id"),
      },
    ],
  },
  "algolia:batch-operations": {
    path: ["batch"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        batchWriteParams: { requests: input.requests ?? input.operations },
      },
    ],
  },
  "algolia:delete-by-filter": {
    path: ["deleteBy"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        deleteByParams: definedFields({
          filters: requiredInputString(input, "filters"),
        }),
      },
    ],
  },
  "algolia:clear-records": {
    path: ["clearObjects"],
    params: (input) => [
      { indexName: resourceName(input, "index", "indexName") },
    ],
  },
  "algolia:list-indices": { path: ["listIndices"] },
  "algolia:get-settings": {
    path: ["getSettings"],
    params: (input) => [
      { indexName: resourceName(input, "index", "indexName") },
    ],
  },
  "algolia:update-settings": {
    path: ["setSettings"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        indexSettings: requiredInputRecord(input, "settings"),
      },
    ],
  },
  "algolia:delete-index": {
    path: ["deleteIndex"],
    params: (input) => [
      { indexName: resourceName(input, "index", "indexName") },
    ],
    output: (_v, input) => ({
      index: resourceName(input, "index", "indexName"),
      deleted: true,
    }),
  },
  "algolia:copy-move-index": {
    path: ["operationIndex"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        operationIndexParams: {
          operation: optionalInputString(input, "operation") ?? "copy",
          destination: resourceName(input, "destination", "destinationIndex"),
        },
      },
    ],
  },
  "algolia:get-task-status": {
    path: ["getTask"],
    params: (input) => [
      {
        indexName: resourceName(input, "index", "indexName"),
        taskID: requiredInputNumber(input, "taskID"),
      },
    ],
  },
};

/** Algolia's write key is the secret; the application ID identifies the app. */
export const createAlgoliaClient: VendorClientFactory = (credential) => {
  const { algoliasearch } = requireOptionalSdk("algoliasearch") as {
    algoliasearch(appId: string, apiKey: string): SdkMethodTarget;
  };
  return algoliasearch(
    requiredVendorField(credential, "applicationId"),
    vendorToken(credential),
  );
};

export function createAlgoliaPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "algolia",
    driver: "algoliasearch@5.56.0",
    transportKind: "api_key",
    operations: ALGOLIA_OPERATIONS,
    clientFactory: options.clientFactory ?? createAlgoliaClient,
  });
}
