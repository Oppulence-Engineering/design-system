import { describe, expect, test } from "bun:test";

import {
  assertProviderPackCoverage,
  buildDelete,
  buildInsert,
  buildSelect,
  buildUpdate,
  createClickHousePack,
  createIntegrationCredentialReference,
  createJupyterPack,
  createMySqlPack,
  createPostgreSqlPack,
  createRedisPack,
  createSftpPack,
  createSshPack,
  quoteIdentifier,
  type IntegrationProviderPack,
  type SqlStatement,
} from "../src/server";

const apiKeyRuntime = {
  async withCredential<T>(
    _reference: unknown,
    operation: (credential: {
      readonly apiKey: string;
      readonly fields: Readonly<Record<string, string>>;
    }) => Promise<T>,
  ): Promise<T> {
    return operation({
      apiKey: "s3cret",
      fields: {
        host: "db.internal.example",
        user: "reporting",
        database: "analytics",
      },
    });
  },
  async request() {
    return Response.json({});
  },
};

function reference(integrationId: string) {
  return createIntegrationCredentialReference({
    integrationId,
    connectionId: `connection_${integrationId}`,
    product: "eigenn",
  });
}

const PACKS: readonly IntegrationProviderPack[] = [
  createPostgreSqlPack(),
  createMySqlPack(),
  createClickHousePack(),
  createRedisPack(),
  createSshPack(),
  createSftpPack(),
  createJupyterPack(),
];

describe("protocol provider family", () => {
  test("every pack accounts for all of its source actions on the special lane", () => {
    for (const pack of PACKS) {
      expect(() =>
        assertProviderPackCoverage(pack, { apiKeyRuntime }),
      ).not.toThrow();
      expect(
        pack.coverage.every(
          (entry) =>
            entry.disposition === "supported" && entry.lane === "special",
        ),
      ).toBe(true);
    }

    expect(PACKS.reduce((total, pack) => total + pack.coverage.length, 0)).toBe(
      95,
    );
  });

  test("binds filter values instead of interpolating them", () => {
    const statement = buildSelect("postgres", {
      table: "invoices",
      columns: ["id", "total"],
      where: { customer: "acme'; DROP TABLE invoices; --" },
      limit: 10,
    });

    expect(statement.text).toBe(
      'SELECT "id", "total" FROM "invoices" WHERE "customer" = $1 LIMIT $2',
    );
    // The attack payload survives only as a bound value.
    expect(statement.values).toEqual(["acme'; DROP TABLE invoices; --", 10]);
    expect(statement.text).not.toContain("DROP TABLE");
  });

  test("rejects an identifier that is not a plain name", () => {
    for (const identifier of [
      'invoices"; DROP TABLE users; --',
      "invoices WHERE 1=1",
      "",
      "1invoices",
    ]) {
      expect(() => quoteIdentifier(identifier, "postgres")).toThrow();
    }
    expect(() =>
      buildSelect("postgres", { table: "public.invoices" }),
    ).not.toThrow();
  });

  test("refuses an update or delete with no predicate", () => {
    // Without a WHERE clause these rewrite or empty the whole table.
    expect(() =>
      buildUpdate("postgres", {
        table: "invoices",
        set: { paid: true },
        where: {},
      }),
    ).toThrow();
    expect(() =>
      buildDelete("postgres", { table: "invoices", where: {} }),
    ).toThrow();
    expect(() =>
      buildDelete("postgres", { table: "invoices", where: { id: 7 } }),
    ).not.toThrow();
  });

  test("numbers PostgreSQL parameters and keeps MySQL placeholders positional", () => {
    const rows = [
      { name: "a", total: 1 },
      { name: "b", total: 2 },
    ];
    const postgres = buildInsert("postgres", { table: "invoices", rows });
    const mysql = buildInsert("mysql", { table: "invoices", rows });

    expect(postgres.text).toBe(
      'INSERT INTO "invoices" ("name", "total") VALUES ($1, $2), ($3, $4) RETURNING *',
    );
    expect(mysql.text).toBe(
      "INSERT INTO `invoices` (`name`, `total`) VALUES (?, ?), (?, ?)",
    );
    expect(postgres.values).toEqual(["a", 1, "b", 2]);
    expect(mysql.values).toEqual(postgres.values);
  });

  test("rejects a batch whose rows disagree on shape", () => {
    expect(() =>
      buildInsert("postgres", {
        table: "invoices",
        rows: [{ name: "a" }, { total: 2 }],
      }),
    ).toThrow();
  });

  test("accepts only ASC or DESC as a sort direction", () => {
    expect(
      buildSelect("postgres", { table: "t", orderBy: ["created DESC"] }).text,
    ).toContain('ORDER BY "created" DESC');
    expect(() =>
      buildSelect("postgres", {
        table: "t",
        orderBy: ["created; DROP TABLE t"],
      }),
    ).toThrow();
  });

  test("closes the connection even when an operation throws", async () => {
    let closed = 0;
    const pack = createPostgreSqlPack({
      connect: async () => ({
        client: {
          async query() {
            throw new Error("connection reset");
          },
        },
        close: async () => {
          closed += 1;
        },
      }),
    });
    const provider = pack.create({ apiKeyRuntime })[0];

    await expect(
      provider.execute({
        integrationId: "postgresql",
        operationId: "postgresql:query-select",
        reference: reference("postgresql"),
        input: { table: "invoices" },
      }),
    ).rejects.toThrow("connection reset");
    expect(closed).toBe(1);
  });

  test("takes the connection target from the credential, not from input", async () => {
    const opened: unknown[] = [];
    const statements: SqlStatement[] = [];
    const pack = createPostgreSqlPack({
      connect: async (credential) => {
        opened.push(credential.fields);
        return {
          client: {
            async query(statement) {
              statements.push(statement);
              return { rows: [] };
            },
          },
          close: async () => undefined,
        };
      },
    });
    const provider = pack.create({ apiKeyRuntime })[0];

    await provider.execute({
      integrationId: "postgresql",
      operationId: "postgresql:query-select",
      reference: reference("postgresql"),
      // A caller trying to redirect the query at another server.
      input: { table: "invoices", host: "attacker.example", port: 1234 },
    });

    expect(opened[0]).toMatchObject({ host: "db.internal.example" });
    expect(JSON.stringify(opened[0])).not.toContain("attacker.example");
    expect(statements[0]?.text).toBe('SELECT * FROM "invoices"');
  });

  test("allows only data-plane verbs through the Redis escape hatch", async () => {
    const sent: readonly string[][] = [];
    const pack = createRedisPack({
      connect: async () => ({
        client: {
          async send(command) {
            (sent as string[][]).push([...command]);
            return "OK";
          },
        },
        close: async () => undefined,
      }),
    });
    const provider = pack.create({ apiKeyRuntime })[0];
    const run = (input: Record<string, unknown>) =>
      provider.execute({
        integrationId: "redis",
        operationId: "redis:command",
        reference: reference("redis"),
        input,
      });

    await run({ command: "get", args: ["session:1"] });
    expect(sent[0]).toEqual(["GET", "session:1"]);

    // FLUSHALL, CONFIG, and friends would affect the whole server.
    for (const command of ["FLUSHALL", "CONFIG", "SHUTDOWN", "KEYS", "EVAL"]) {
      await expect(run({ command })).rejects.toMatchObject({
        code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      });
    }
  });

  test("scans rather than blocking the server to list keys", async () => {
    const sent: string[][] = [];
    const pack = createRedisPack({
      connect: async () => ({
        client: {
          async send(command) {
            sent.push([...command]);
            return ["0", []];
          },
        },
        close: async () => undefined,
      }),
    });

    await pack.create({ apiKeyRuntime })[0].execute({
      integrationId: "redis",
      operationId: "redis:list-keys",
      reference: reference("redis"),
      input: { pattern: "session:*" },
    });

    expect(sent[0]?.[0]).toBe("SCAN");
    expect(sent[0]).toContain("session:*");
  });

  test("rejects a remote path that could break out of the command", async () => {
    const commands: string[] = [];
    const pack = createSshPack({
      connect: async () => ({
        client: {
          async exec(command) {
            commands.push(command);
            return { stdout: "", stderr: "", exitCode: 0 };
          },
        },
        close: async () => undefined,
      }),
    });
    const provider = pack.create({ apiKeyRuntime })[0];
    const run = (path: string) =>
      provider.execute({
        integrationId: "ssh",
        operationId: "ssh:list-directory",
        reference: reference("ssh"),
        input: { path },
      });

    await run("/var/log/app");
    expect(commands[0]).toBe("ls -la -- /var/log/app");

    for (const path of [
      "/var/log; rm -rf /",
      "/var/log && whoami",
      "$(whoami)",
      "/var/../etc/shadow",
      "`id`",
    ]) {
      await expect(run(path)).rejects.toMatchObject({
        code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
      });
    }
    expect(commands).toHaveLength(1);
  });

  test("passes an arbitrary command through, which is that action's purpose", async () => {
    const commands: string[] = [];
    const pack = createSshPack({
      connect: async () => ({
        client: {
          async exec(command) {
            commands.push(command);
            return { stdout: "root\n", stderr: "", exitCode: 0 };
          },
        },
        close: async () => undefined,
      }),
    });

    const result = await pack.create({ apiKeyRuntime })[0].execute({
      integrationId: "ssh",
      operationId: "ssh:execute-command",
      reference: reference("ssh"),
      input: { command: "whoami && uptime" },
    });

    expect(commands[0]).toBe("whoami && uptime");
    expect(result.output).toEqual({
      stdout: "root\n",
      stderr: "",
      exitCode: 0,
    });
  });

  test("addresses a self-hosted Jupyter server through its own base URL", async () => {
    const requests: Array<{ method: string; path: string }> = [];
    const pack = createJupyterPack({
      connect: async () => ({
        client: {
          async request({ method, path }) {
            requests.push({ method, path });
            return { kernels: [] };
          },
        },
        close: async () => undefined,
      }),
    });
    const provider = pack.create({ apiKeyRuntime })[0];

    await provider.execute({
      integrationId: "jupyter",
      operationId: "jupyter:get-content",
      reference: reference("jupyter"),
      input: { path: "notebooks/analysis.ipynb" },
    });

    expect(requests[0]).toEqual({
      method: "GET",
      path: "/api/contents/notebooks/analysis.ipynb",
    });

    await expect(
      provider.execute({
        integrationId: "jupyter",
        operationId: "jupyter:get-content",
        reference: reference("jupyter"),
        input: { path: "../../etc/passwd" },
      }),
    ).rejects.toMatchObject({
      code: "INTEGRATION_PROVIDER_SDK_INVOCATION_INVALID",
    });
  });

  test("rewrites ClickHouse mutations to ALTER TABLE, keeping the bindings", async () => {
    const statements: SqlStatement[] = [];
    const pack = createClickHousePack({
      connect: async () => ({
        client: {
          async query(statement) {
            statements.push(statement);
            return {};
          },
          async command(statement) {
            statements.push(statement);
            return { applied: true };
          },
        },
        close: async () => undefined,
      }),
    });
    const provider = pack.create({ apiKeyRuntime })[0];

    await provider.execute({
      integrationId: "clickhouse",
      operationId: "clickhouse:update-data",
      reference: reference("clickhouse"),
      input: { table: "events", set: { status: "done" }, where: { id: 42 } },
    });
    await provider.execute({
      integrationId: "clickhouse",
      operationId: "clickhouse:delete-data",
      reference: reference("clickhouse"),
      input: { table: "events", where: { id: 42 } },
    });

    expect(statements[0]?.text).toBe(
      "ALTER TABLE `events` UPDATE `status` = ? WHERE `id` = ?",
    );
    expect(statements[0]?.values).toEqual(["done", 42]);
    expect(statements[1]?.text).toBe(
      "ALTER TABLE `events` DELETE WHERE `id` = ?",
    );
  });

  test("defers protocol triggers with a recorded reason", () => {
    for (const pack of PACKS) {
      for (const trigger of pack.triggerCoverage) {
        expect(trigger.disposition).toBe("deferred");
        expect(trigger.reason?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });
});
