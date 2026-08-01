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

// ------------------------------------------------------------------- Qdrant

const QDRANT_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  "qdrant:upsert": {
    path: ["upsert"],
    params: (i) => [
      resourceName(i, "collection", "collectionName"),
      { wait: true, points: i.points ?? i.vectors },
    ],
  },
  "qdrant:search": {
    path: ["search"],
    params: (i) => [
      resourceName(i, "collection", "collectionName"),
      definedFields({
        vector: i.vector ?? i.values,
        limit: optionalInputNumber(i, "limit", "topK") ?? 10,
        filter: optionalInputRecord(i, "filter"),
        with_payload: i.withPayload !== false,
      }),
    ],
  },
  "qdrant:fetch": {
    path: ["retrieve"],
    params: (i) => [
      resourceName(i, "collection", "collectionName"),
      {
        ids: requiredInputStringArray(i, "ids", "id"),
        with_payload: i.withPayload !== false,
      },
    ],
  },
};

/** Qdrant is self-hosted or cloud, so the URL comes from the connection. */
export const createQdrantClient: VendorClientFactory = (credential) => {
  const { QdrantClient } = datastoreRequire("@qdrant/js-client-rest") as {
    QdrantClient: new (config: {
      url: string;
      apiKey?: string;
    }) => SdkMethodTarget;
  };
  return new QdrantClient({
    url: requiredVendorField(credential, "url"),
    apiKey: vendorToken(credential),
  });
};

export function createQdrantPack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "qdrant",
    driver: "@qdrant/js-client-rest@1.18.0",
    transportKind: "api_key",
    operations: QDRANT_OPERATIONS,
    clientFactory: options.clientFactory ?? createQdrantClient,
  });
}
