import type { IntegrationProviderPack } from "../../core/provider-pack";
import {
  definedFields,
  optionalInputBoolean,
  optionalInputNumber,
  optionalInputRecord,
  optionalInputString,
  optionalInputStringArray,
  requiredInputNumber,
  requiredInputString,
  requiredInputStringArray,
} from "../shared/sdk";
import { createAwsPack, type AwsOperation } from "../shared/clients/aws";

type AwsInput = Readonly<Record<string, unknown>>;

const ATHENA_OPERATIONS: Readonly<Record<string, AwsOperation>> = {
  "athena:start-query": {
    command: "StartQueryExecutionCommand",
    input: (i) =>
      definedFields({
        QueryString: requiredInputString(i, "query", "queryString", "sql"),
        WorkGroup: optionalInputString(i, "workGroup"),
        QueryExecutionContext: definedFields({
          Database: optionalInputString(i, "database"),
          Catalog: optionalInputString(i, "catalog"),
        }),
        ResultConfiguration: optionalInputString(i, "outputLocation")
          ? { OutputLocation: optionalInputString(i, "outputLocation") }
          : undefined,
      }),
  },
  "athena:get-query-execution": {
    command: "GetQueryExecutionCommand",
    input: (i) => ({
      QueryExecutionId: requiredInputString(i, "queryExecutionId"),
    }),
  },
  "athena:get-query-results": {
    command: "GetQueryResultsCommand",
    input: (i) =>
      definedFields({
        QueryExecutionId: requiredInputString(i, "queryExecutionId"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "athena:stop-query": {
    command: "StopQueryExecutionCommand",
    input: (i) => ({
      QueryExecutionId: requiredInputString(i, "queryExecutionId"),
    }),
    output: (_v, i) => ({
      queryExecutionId: requiredInputString(i, "queryExecutionId"),
      stopped: true,
    }),
  },
  "athena:list-query-executions": {
    command: "ListQueryExecutionsCommand",
    input: (i) =>
      definedFields({
        WorkGroup: optionalInputString(i, "workGroup"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "athena:batch-get-query-executions": {
    command: "BatchGetQueryExecutionCommand",
    input: (i) => ({
      QueryExecutionIds: requiredInputStringArray(i, "queryExecutionIds"),
    }),
  },
  "athena:create-named-query": {
    command: "CreateNamedQueryCommand",
    input: (i) =>
      definedFields({
        Name: requiredInputString(i, "name"),
        Database: requiredInputString(i, "database"),
        QueryString: requiredInputString(i, "query", "queryString", "sql"),
        Description: optionalInputString(i, "description"),
        WorkGroup: optionalInputString(i, "workGroup"),
      }),
  },
  "athena:get-named-query": {
    command: "GetNamedQueryCommand",
    input: (i) => ({ NamedQueryId: requiredInputString(i, "namedQueryId") }),
  },
  "athena:list-named-queries": {
    command: "ListNamedQueriesCommand",
    input: (i) =>
      definedFields({
        WorkGroup: optionalInputString(i, "workGroup"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "athena:delete-named-query": {
    command: "DeleteNamedQueryCommand",
    input: (i) => ({ NamedQueryId: requiredInputString(i, "namedQueryId") }),
    output: (_v, i) => ({
      namedQueryId: requiredInputString(i, "namedQueryId"),
      deleted: true,
    }),
  },
  "athena:list-databases": {
    command: "ListDatabasesCommand",
    input: (i) =>
      definedFields({
        CatalogName:
          optionalInputString(i, "catalog", "catalogName") ?? "AwsDataCatalog",
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
  "athena:list-table-metadata": {
    command: "ListTableMetadataCommand",
    input: (i) =>
      definedFields({
        CatalogName:
          optionalInputString(i, "catalog", "catalogName") ?? "AwsDataCatalog",
        DatabaseName: requiredInputString(i, "database", "databaseName"),
        Expression: optionalInputString(i, "expression"),
        MaxResults: optionalInputNumber(i, "maxResults", "limit"),
        NextToken: optionalInputString(i, "nextToken", "cursor"),
      }),
  },
};

export function createAthenaPack(): IntegrationProviderPack {
  return createAwsPack({
    integrationId: "athena",
    packageName: "@aws-sdk/client-athena",
    clientExport: "AthenaClient",
    operations: ATHENA_OPERATIONS,
  });
}
