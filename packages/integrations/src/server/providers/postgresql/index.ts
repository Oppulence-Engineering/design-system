import { createRequire } from "node:module";

import type { IntegrationProviderPack } from "../../core/provider-pack";
import type { SqlConnection } from "../shared/sql-connection";
import type { SqlConnectionFactory } from "../shared/sql-connection";
import type { SqlPackOptions } from "../shared/sql-connection";
import {
  createProtocolPack,
  protocolConnection,
  SqlConnectionSchema,
  type ProtocolInput,
  type ProtocolOperation,
} from "../shared/clients/protocol";
import {
  buildDelete,
  buildInsert,
  buildIntrospect,
  buildRaw,
  buildSelect,
  buildUpdate,
  type SqlDialect,
  type SqlStatement,
} from "../shared/clients/protocol-sql";

const databaseRequire = createRequire(import.meta.url);

/** The single call every SQL driver reduces to. */
function sqlOperations(
  integrationId: string,
  dialect: SqlDialect,
): Readonly<Record<string, ProtocolOperation<SqlConnection>>> {
  const run =
    (build: (input: ProtocolInput) => SqlStatement) =>
    ({ client, input }: { client: SqlConnection; input: ProtocolInput }) =>
      client.query(build(input));

  return {
    [`${integrationId}:query-select`]: {
      run: run((input) => buildSelect(dialect, input)),
    },
    [`${integrationId}:insert-data`]: {
      run: run((input) => buildInsert(dialect, input)),
    },
    [`${integrationId}:update-data`]: {
      run: run((input) => buildUpdate(dialect, input)),
    },
    [`${integrationId}:delete-data`]: {
      run: run((input) => buildDelete(dialect, input)),
    },
    [`${integrationId}:execute-raw-sql`]: { run: run(buildRaw) },
    [`${integrationId}:introspect-schema`]: {
      run: run((input) => buildIntrospect(dialect, input)),
    },
  };
}

interface PgClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(config: {
    text: string;
    values: readonly unknown[];
  }): Promise<{ rows: unknown[]; rowCount: number | null; fields?: unknown[] }>;
}

/**
 * Opens one PostgreSQL client per invocation. A pool would outlive the request
 * and hold a decrypted password in memory between calls, so the adapter takes
 * the connection cost instead.
 */
async function connectPostgres(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: SqlConnection; close: () => Promise<void> }> {
  const settings = protocolConnection(
    SqlConnectionSchema,
    credential,
    "password",
  );
  const { Client } = databaseRequire("pg") as {
    Client: new (config: Record<string, unknown>) => PgClient;
  };
  const client = new Client({
    host: settings.host,
    port: settings.port ?? 5_432,
    user: settings.user,
    password: settings.password,
    database: settings.database,
    ...(settings.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    connectionTimeoutMillis: 10_000,
    statement_timeout: 30_000,
  });
  await client.connect();
  return {
    client: {
      async query(statement) {
        const result = await client.query({
          text: statement.text,
          values: statement.values,
        });
        return { rows: result.rows, rowCount: result.rowCount ?? 0 };
      },
    },
    close: () => client.end(),
  };
}

interface MysqlConnection {
  execute(sql: string, values: readonly unknown[]): Promise<[unknown, unknown]>;
  end(): Promise<void>;
}

async function connectMysql(credential: {
  readonly apiKey: string;
  readonly fields: Readonly<Record<string, string>>;
}): Promise<{ client: SqlConnection; close: () => Promise<void> }> {
  const settings = protocolConnection(
    SqlConnectionSchema,
    credential,
    "password",
  );
  const mysql = databaseRequire("mysql2/promise") as {
    createConnection(config: Record<string, unknown>): Promise<MysqlConnection>;
  };
  const connection = await mysql.createConnection({
    host: settings.host,
    port: settings.port ?? 3_306,
    user: settings.user,
    password: settings.password,
    database: settings.database,
    ...(settings.ssl ? { ssl: { rejectUnauthorized: true } } : {}),
    connectTimeout: 10_000,
    // Reject a caller that tries to smuggle a second statement past the
    // parameter binding.
    multipleStatements: false,
  });
  return {
    client: {
      async query(statement) {
        const [rows] = await connection.execute(
          statement.text,
          statement.values,
        );
        return Array.isArray(rows)
          ? { rows, rowCount: rows.length }
          : { rows: [], result: rows };
      },
    },
    close: () => connection.end(),
  };
}

export function createPostgreSqlPack(
  options: SqlPackOptions = {},
): IntegrationProviderPack {
  return createProtocolPack<SqlConnection>({
    integrationId: "postgresql",
    driver: "pg",
    operations: sqlOperations("postgresql", "postgres"),
    connect: options.connect ?? connectPostgres,
  });
}
