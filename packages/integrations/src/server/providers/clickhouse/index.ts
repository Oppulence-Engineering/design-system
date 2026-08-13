import type { IntegrationProviderPack } from "../../core/provider-pack";
import { requireOptionalSdk } from "../shared/optional-sdk";
import { optionalInputString, requiredInputString } from "../shared/sdk";
import {
  ClickHouseConnectionSchema,
  createProtocolPack,
  protocolConnection,
  protocolInvocationError,
  quoteIdentifier,
  quoteQualifiedName,
  type ProtocolInput,
  type ProtocolOperation,
} from "../shared/clients/protocol";
import {
  buildDelete,
  buildInsert,
  buildRaw,
  buildSelect,
  buildUpdate,
  type SqlStatement,
} from "../shared/clients/protocol-sql";

export interface ClickHouseConnection {
  query(statement: SqlStatement): Promise<unknown>;
  command(statement: SqlStatement): Promise<unknown>;
}

function table(input: ProtocolInput): string {
  return quoteQualifiedName(
    requiredInputString(input, "table", "tableName"),
    "clickhouse",
  );
}

function database(input: ProtocolInput): string {
  return quoteIdentifier(
    requiredInputString(input, "database", "databaseName"),
    "clickhouse",
  );
}

/** A statement whose only variable parts are validated identifiers. */
function ddl(text: string): SqlStatement {
  return { text, values: [] };
}

/**
 * ClickHouse mutates rows with ALTER TABLE rather than UPDATE/DELETE, so the
 * shared builders produce the statement and it is rewritten to the ClickHouse
 * form. The parameter bindings survive the rewrite.
 */
function toAlter(
  statement: SqlStatement,
  kind: "UPDATE" | "DELETE",
): SqlStatement {
  if (kind === "UPDATE") {
    const match = /^UPDATE (.+?) SET (.+?)( WHERE .+)?$/su.exec(statement.text);
    if (!match) throw protocolInvocationError();
    return {
      text: `ALTER TABLE ${match[1]} UPDATE ${match[2]}${match[3] ?? ""}`,
      values: statement.values,
    };
  }
  const match = /^DELETE FROM (.+?)( WHERE .+)?$/su.exec(statement.text);
  if (!match) throw protocolInvocationError();
  return {
    text: `ALTER TABLE ${match[1]} DELETE${match[2] ?? ""}`,
    values: statement.values,
  };
}

const CLICKHOUSE_OPERATIONS: Readonly<
  Record<string, ProtocolOperation<ClickHouseConnection>>
> = {
  "clickhouse:query-select": {
    run: ({ client, input }) => client.query(buildSelect("clickhouse", input)),
  },
  "clickhouse:execute-raw-sql": {
    run: ({ client, input }) => client.query(buildRaw(input)),
  },
  "clickhouse:insert-row": {
    run: ({ client, input }) =>
      client.command(buildInsert("clickhouse", input)),
  },
  "clickhouse:insert-rows-bulk": {
    run: ({ client, input }) =>
      client.command(buildInsert("clickhouse", input)),
  },
  "clickhouse:update-data": {
    run: ({ client, input }) =>
      client.command(toAlter(buildUpdate("clickhouse", input), "UPDATE")),
  },
  "clickhouse:delete-data": {
    run: ({ client, input }) =>
      client.command(toAlter(buildDelete("clickhouse", input), "DELETE")),
  },
  "clickhouse:list-databases": {
    run: ({ client }) => client.query(ddl("SHOW DATABASES")),
  },
  "clickhouse:list-tables": {
    run: ({ client, input }) => {
      const name = optionalInputString(input, "database", "databaseName");
      return client.query(
        ddl(
          name
            ? `SHOW TABLES FROM ${quoteIdentifier(name, "clickhouse")}`
            : "SHOW TABLES",
        ),
      );
    },
  },
  "clickhouse:describe-table": {
    run: ({ client, input }) =>
      client.query(ddl(`DESCRIBE TABLE ${table(input)}`)),
  },
  "clickhouse:show-create-table": {
    run: ({ client, input }) =>
      client.query(ddl(`SHOW CREATE TABLE ${table(input)}`)),
  },
  "clickhouse:count-rows": {
    run: ({ client, input }) =>
      client.query(ddl(`SELECT count() AS count FROM ${table(input)}`)),
  },
  "clickhouse:introspect-schema": {
    run: ({ client }) =>
      client.query(
        ddl(
          "SELECT database, table, name AS column_name, type AS data_type " +
            "FROM system.columns ORDER BY database, table, position",
        ),
      ),
  },
  "clickhouse:create-database": {
    run: ({ client, input }) =>
      client.command(ddl(`CREATE DATABASE IF NOT EXISTS ${database(input)}`)),
  },
  "clickhouse:drop-database": {
    run: ({ client, input }) =>
      client.command(ddl(`DROP DATABASE IF EXISTS ${database(input)}`)),
  },
  "clickhouse:create-table": {
    run: ({ client, input }) => {
      // A column definition is a type expression, not a bindable value, so it
      // is restricted to the characters a ClickHouse type can contain.
      const definition = requiredInputString(input, "definition", "columns");
      if (!/^[A-Za-z0-9_,()'" =<>.\s-]{1,4000}$/u.test(definition)) {
        throw protocolInvocationError();
      }
      const engine = optionalInputString(input, "engine") ?? "MergeTree()";
      if (!/^[A-Za-z0-9_()',\s.]{1,200}$/u.test(engine)) {
        throw protocolInvocationError();
      }
      const orderBy = optionalInputString(input, "orderBy");
      const order = orderBy
        ? ` ORDER BY ${quoteIdentifier(orderBy, "clickhouse")}`
        : " ORDER BY tuple()";
      return client.command(
        ddl(
          `CREATE TABLE IF NOT EXISTS ${table(input)} (${definition}) ENGINE = ${engine}${order}`,
        ),
      );
    },
  },
  "clickhouse:drop-table": {
    run: ({ client, input }) =>
      client.command(ddl(`DROP TABLE IF EXISTS ${table(input)}`)),
  },
  "clickhouse:truncate-table": {
    run: ({ client, input }) =>
      client.command(ddl(`TRUNCATE TABLE IF EXISTS ${table(input)}`)),
  },
  "clickhouse:rename-table": {
    run: ({ client, input }) =>
      client.command(
        ddl(
          `RENAME TABLE ${table(input)} TO ${quoteQualifiedName(
            requiredInputString(input, "newTable", "newName"),
            "clickhouse",
          )}`,
        ),
      ),
  },
  "clickhouse:optimize-table": {
    run: ({ client, input }) =>
      client.command(ddl(`OPTIMIZE TABLE ${table(input)} FINAL`)),
  },
  "clickhouse:list-partitions": {
    run: ({ client, input }) =>
      client.query({
        text:
          "SELECT partition, name, rows, bytes_on_disk FROM system.parts " +
          "WHERE active AND table = {table:String} ORDER BY partition",
        values: [requiredInputString(input, "table", "tableName")],
      }),
  },
  "clickhouse:drop-partition": {
    run: ({ client, input }) => {
      const partition = requiredInputString(input, "partition");
      if (!/^[A-Za-z0-9_'.-]{1,128}$/u.test(partition)) {
        throw protocolInvocationError();
      }
      return client.command(
        ddl(`ALTER TABLE ${table(input)} DROP PARTITION '${partition}'`),
      );
    },
  },
  "clickhouse:list-mutations": {
    run: ({ client }) =>
      client.query(
        ddl(
          "SELECT database, table, mutation_id, command, is_done, create_time " +
            "FROM system.mutations WHERE NOT is_done ORDER BY create_time DESC",
        ),
      ),
  },
  "clickhouse:list-running-queries": {
    run: ({ client }) =>
      client.query(
        ddl(
          "SELECT query_id, user, elapsed, read_rows, memory_usage, query " +
            "FROM system.processes ORDER BY elapsed DESC",
        ),
      ),
  },
  "clickhouse:kill-query": {
    run: ({ client, input }) =>
      client.command({
        text: "KILL QUERY WHERE query_id = {queryId:String}",
        values: [requiredInputString(input, "queryId")],
      }),
  },
  "clickhouse:table-stats": {
    run: ({ client, input }) =>
      client.query({
        text:
          "SELECT sum(rows) AS rows, sum(bytes_on_disk) AS bytes, count() AS parts " +
          "FROM system.parts WHERE active AND table = {table:String}",
        values: [requiredInputString(input, "table", "tableName")],
      }),
  },
  "clickhouse:list-clusters": {
    run: ({ client }) =>
      client.query(
        ddl(
          "SELECT cluster, shard_num, replica_num, host_name, port " +
            "FROM system.clusters ORDER BY cluster, shard_num, replica_num",
        ),
      ),
  },
};

interface ClickHouseSdkClient {
  query(input: Record<string, unknown>): Promise<{ json(): Promise<unknown> }>;
  command(input: Record<string, unknown>): Promise<unknown>;
  close(): Promise<void>;
}

/**
 * ClickHouse names its bound parameters, so positional values are mapped onto
 * the `{name:Type}` markers a statement declares. Statements the shared SQL
 * builders produce use positional markers, which are rewritten here.
 */
function namedParameters(statement: SqlStatement): {
  query: string;
  query_params: Record<string, unknown>;
} {
  const query_params: Record<string, unknown> = {};
  let index = 0;
  const query = statement.text.replace(/\?/gu, () => {
    const name = `p${index}`;
    query_params[name] = statement.values[index];
    index += 1;
    return `{${name}:String}`;
  });
  // A statement written with ClickHouse's own named markers passes through and
  // takes its values in declaration order.
  if (index === 0 && statement.values.length > 0) {
    for (const [position, marker] of [
      ...query.matchAll(/\{(\w+):[^}]+\}/gu),
    ].entries()) {
      query_params[marker[1]] = statement.values[position];
    }
  }
  return { query, query_params };
}

export type ClickHouseConnectionFactory = (credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}) => Promise<{ client: ClickHouseConnection; close: () => Promise<void> }>;

async function connectClickHouse(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: ClickHouseConnection; close: () => Promise<void> }> {
  const settings = protocolConnection(
    ClickHouseConnectionSchema,
    credential,
    "password",
  );
  const { createClient } = requireOptionalSdk("@clickhouse/client") as {
    createClient(config: Record<string, unknown>): ClickHouseSdkClient;
  };
  const protocol = settings.protocol ?? "https";
  const client = createClient({
    url: `${protocol}://${settings.host}:${settings.port ?? (protocol === "https" ? 8_443 : 8_123)}`,
    username: settings.username,
    password: settings.password ?? "",
    ...(settings.database ? { database: settings.database } : {}),
    request_timeout: 30_000,
  });
  return {
    client: {
      async query(statement) {
        const resultSet = await client.query({
          ...namedParameters(statement),
          format: "JSON",
        });
        return resultSet.json();
      },
      async command(statement) {
        await client.command(namedParameters(statement));
        return { applied: true };
      },
    },
    close: () => client.close(),
  };
}

export function createClickHousePack(
  options: { connect?: ClickHouseConnectionFactory } = {},
): IntegrationProviderPack {
  return createProtocolPack<ClickHouseConnection>({
    integrationId: "clickhouse",
    driver: "@clickhouse/client",
    operations: CLICKHOUSE_OPERATIONS,
    connect: options.connect ?? connectClickHouse,
  });
}
