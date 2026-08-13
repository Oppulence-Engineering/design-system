import { IntegrationProviderSdkError } from "../../core/provider-sdk";
import { requireOptionalSdk } from "../shared/optional-sdk";
import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  optionalInputNumber,
  optionalInputString,
  optionalInputStringArray,
  requiredInputRecord,
  requiredInputString,
  type SdkMethodTarget,
} from "../shared/sdk";
import {
  createVendorPack,
  requiredVendorField,
  vendorToken,
  type VendorClientFactory,
  type VendorInput,
  type VendorOperation,
} from "../shared/clients/vendor";


/**
 * A Salesforce object name is part of the REST path and of SOQL, so it can
 * never be a bound value. Standard and custom objects are both plain
 * identifiers, custom ones ending in `__c`.
 */
function objectName(input: VendorInput, ...names: string[]): string {
  const value = requiredInputString(input, ...names);
  if (!/^[A-Za-z][A-Za-z0-9_]{0,80}$/u.test(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

function recordId(input: VendorInput): string {
  const value = requiredInputString(input, "recordId", "id");
  if (!/^[A-Za-z0-9]{15,18}$/u.test(value)) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return value;
}

interface SalesforceConnection extends SdkMethodTarget {
  query(soql: string): Promise<unknown>;
  queryMore(locator: string): Promise<unknown>;
  describe(objectName: string): Promise<unknown>;
  describeGlobal(): Promise<unknown>;
  sobject(name: string): {
    create(record: unknown): Promise<unknown>;
    update(record: unknown): Promise<unknown>;
    destroy(id: string): Promise<unknown>;
    retrieve(id: string): Promise<unknown>;
  };
  request(input: string | Record<string, unknown>): Promise<unknown>;
  tooling: { query(soql: string): Promise<unknown> };
}

/**
 * Builds a SOQL read for one object. Field and object names are identifiers,
 * validated above; the caller's WHERE clause is passed through because SOQL
 * has no bind syntax over the REST query endpoint, and the limit is bounded.
 */
function selectQuery(input: VendorInput, defaultObject: string): string {
  const object = optionalInputString(input, "objectName", "object")
    ? objectName(input, "objectName", "object")
    : defaultObject;
  const fields = optionalInputStringArray(input, "fields");
  for (const field of fields ?? []) {
    if (!/^[A-Za-z][A-Za-z0-9_.]{0,80}$/u.test(field)) {
      throw new IntegrationProviderSdkError(
        "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      );
    }
  }
  const where = optionalInputString(input, "where", "filter");
  const limit = optionalInputNumber(input, "limit") ?? 200;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2_000) {
    throw new IntegrationProviderSdkError(
      "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    );
  }
  return `SELECT ${(fields ?? ["Id", "Name"]).join(", ")} FROM ${object}${
    where ? ` WHERE ${where}` : ""
  } LIMIT ${limit}`;
}

/**
 * The CRUD quartet is identical for every standard object. Both slugs are
 * passed because the source action names are not derivable from one another:
 * "opportunities" does not singularise by dropping an "s".
 */
function crud(
  object: string,
  plural: string,
  singular: string,
  defaultFields: readonly string[],
): Readonly<Record<string, VendorOperation>> {
  return {
    [`salesforce:get-${plural}`]: {
      path: ["query"],
      invoke: ({ client, input }) =>
        (client as unknown as SalesforceConnection).query(
          selectQuery(
            { ...input, fields: input.fields ?? defaultFields },
            object,
          ),
        ),
    },
    [`salesforce:create-${singular}`]: {
      path: ["sobject"],
      invoke: ({ client, input }) =>
        (client as unknown as SalesforceConnection)
          .sobject(object)
          .create(requiredInputRecord(input, "fields", "record", "data")),
    },
    [`salesforce:update-${singular}`]: {
      path: ["sobject"],
      invoke: ({ client, input }) =>
        (client as unknown as SalesforceConnection).sobject(object).update({
          Id: recordId(input),
          ...requiredInputRecord(input, "fields", "record", "data"),
        }),
    },
    [`salesforce:delete-${singular}`]: {
      path: ["sobject"],
      invoke: async ({ client, input }) => {
        const id = recordId(input);
        await (client as unknown as SalesforceConnection)
          .sobject(object)
          .destroy(id);
        return { id, deleted: true };
      },
    },
  };
}

const SALESFORCE_OPERATIONS: Readonly<Record<string, VendorOperation>> = {
  ...crud("Account", "accounts", "account", [
    "Id",
    "Name",
    "Industry",
    "Website",
  ]),
  ...crud("Contact", "contacts", "contact", [
    "Id",
    "FirstName",
    "LastName",
    "Email",
  ]),
  ...crud("Lead", "leads", "lead", [
    "Id",
    "FirstName",
    "LastName",
    "Company",
    "Status",
  ]),
  ...crud("Opportunity", "opportunities", "opportunity", [
    "Id",
    "Name",
    "StageName",
    "Amount",
    "CloseDate",
  ]),
  ...crud("Case", "cases", "case", ["Id", "CaseNumber", "Subject", "Status"]),
  ...crud("Task", "tasks", "task", ["Id", "Subject", "Status", "ActivityDate"]),
  "salesforce:run-soql-query": {
    path: ["query"],
    invoke: ({ client, input }) =>
      (client as unknown as SalesforceConnection).query(
        requiredInputString(input, "query", "soql"),
      ),
  },
  "salesforce:get-more-query-results": {
    path: ["queryMore"],
    invoke: ({ client, input }) =>
      (client as unknown as SalesforceConnection).queryMore(
        requiredInputString(input, "nextRecordsUrl", "locator"),
      ),
  },
  "salesforce:run-tooling-query": {
    path: ["tooling", "query"],
    params: (input) => [requiredInputString(input, "query", "soql")],
  },
  "salesforce:describe-object": {
    path: ["describe"],
    params: (input) => [objectName(input, "objectName", "object")],
  },
  "salesforce:list-objects": { path: ["describeGlobal"] },
  "salesforce:list-reports": {
    path: ["request"],
    params: () => ["/services/data/v60.0/analytics/reports"],
  },
  "salesforce:get-report": {
    path: ["request"],
    params: (input) => [
      `/services/data/v60.0/analytics/reports/${recordId(input)}/describe`,
    ],
  },
  "salesforce:run-report": {
    path: ["request"],
    params: (input) => [
      {
        method: "GET",
        url: `/services/data/v60.0/analytics/reports/${recordId(input)}?includeDetails=${
          input.includeDetails === false ? "false" : "true"
        }`,
      },
    ],
  },
  "salesforce:list-report-types": {
    path: ["request"],
    params: () => ["/services/data/v60.0/analytics/reportTypes"],
  },
  "salesforce:list-dashboards": {
    path: ["request"],
    params: () => ["/services/data/v60.0/analytics/dashboards"],
  },
  "salesforce:get-dashboard": {
    path: ["request"],
    params: (input) => [
      `/services/data/v60.0/analytics/dashboards/${recordId(input)}`,
    ],
  },
  "salesforce:refresh-dashboard": {
    path: ["request"],
    params: (input) => [
      {
        method: "PUT",
        url: `/services/data/v60.0/analytics/dashboards/${recordId(input)}`,
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      },
    ],
  },
  // Metadata writes go through the Tooling API, which jsforce reaches with a
  // raw request rather than a typed method.
  "salesforce:create-custom-object": {
    path: ["request"],
    params: (input) => [
      {
        method: "POST",
        url: "/services/data/v60.0/tooling/sobjects/CustomObject",
        body: JSON.stringify(
          requiredInputRecord(input, "definition", "fields"),
        ),
        headers: { "content-type": "application/json" },
      },
    ],
  },
  "salesforce:create-custom-field": {
    path: ["request"],
    params: (input) => [
      {
        method: "POST",
        url: "/services/data/v60.0/tooling/sobjects/CustomField",
        body: JSON.stringify(
          requiredInputRecord(input, "definition", "fields"),
        ),
        headers: { "content-type": "application/json" },
      },
    ],
  },
  "salesforce:update-custom-field": {
    path: ["request"],
    params: (input) => [
      {
        method: "PATCH",
        url: `/services/data/v60.0/tooling/sobjects/CustomField/${requiredInputString(input, "fieldId")}`,
        body: JSON.stringify(
          requiredInputRecord(input, "definition", "fields"),
        ),
        headers: { "content-type": "application/json" },
      },
    ],
  },
  "salesforce:delete-custom-field": {
    path: ["request"],
    params: (input) => [
      {
        method: "DELETE",
        url: `/services/data/v60.0/tooling/sobjects/CustomField/${requiredInputString(input, "fieldId")}`,
      },
    ],
    output: (_value, input) => ({
      fieldId: requiredInputString(input, "fieldId"),
      deleted: true,
    }),
  },
};

/**
 * jsforce takes the instance URL alongside the token. Salesforce issues a
 * per-org instance host at authorization time, so a product stores it on its
 * connection row and the package reads it from the credential envelope rather
 * than from operation input.
 */
export const createSalesforceClient: VendorClientFactory = (credential) => {
  const { Connection } = requireOptionalSdk("jsforce") as {
    Connection: new (config: Record<string, unknown>) => SalesforceConnection;
  };
  return new Connection({
    instanceUrl: requiredVendorField(credential, "instanceUrl"),
    accessToken: vendorToken(credential),
    version: "60.0",
  }) as unknown as SdkMethodTarget;
};

export function createSalesforcePack(
  options: { clientFactory?: VendorClientFactory } = {},
): IntegrationProviderPack {
  return createVendorPack({
    integrationId: "salesforce",
    driver: "jsforce@3.10.19",
    transportKind: "oauth2",
    operations: SALESFORCE_OPERATIONS,
    clientFactory: options.clientFactory ?? createSalesforceClient,
  });
}
