import {
  optionalInputNumber,
  optionalInputRecord,
  optionalInputStringArray,
  requiredInputRecord,
  requiredInputString,
} from "../shared";
import {
  protocolInvocationError,
  quoteIdentifier,
  quoteQualifiedName,
  type ProtocolInput,
} from "./client";

export type SqlDialect = "postgres" | "mysql" | "clickhouse";

export interface SqlStatement {
  readonly text: string;
  readonly values: readonly unknown[];
}

/**
 * Positional parameter markers differ by dialect: PostgreSQL numbers them,
 * MySQL and ClickHouse use a plain placeholder.
 */
function placeholder(dialect: SqlDialect, index: number): string {
  return dialect === "postgres" ? `$${index}` : "?";
}

/**
 * Builds a WHERE clause from an equality map. Column names are identifiers and
 * are validated and quoted; every value binds as a parameter, so a caller
 * cannot inject SQL through a filter value.
 */
function whereClause(
  dialect: SqlDialect,
  conditions: Record<string, unknown>,
  values: unknown[],
): string {
  const entries = Object.entries(conditions);
  if (entries.length === 0) return "";
  const predicates = entries.map(([column, value]) => {
    values.push(value);
    return `${quoteIdentifier(column, dialect)} = ${placeholder(dialect, values.length)}`;
  });
  return ` WHERE ${predicates.join(" AND ")}`;
}

export function buildSelect(
  dialect: SqlDialect,
  input: ProtocolInput,
): SqlStatement {
  const table = quoteQualifiedName(
    requiredInputString(input, "table", "tableName"),
    dialect,
  );
  const columns = optionalInputStringArray(input, "columns");
  const projection = columns?.length
    ? columns.map((column) => quoteIdentifier(column, dialect)).join(", ")
    : "*";
  const values: unknown[] = [];
  let text = `SELECT ${projection} FROM ${table}`;
  text += whereClause(
    dialect,
    optionalInputRecord(input, "where") ?? {},
    values,
  );

  const orderBy = optionalInputStringArray(input, "orderBy");
  if (orderBy?.length) {
    // A direction suffix is part of the clause, not a bindable value, so it is
    // matched against the two legal keywords rather than interpolated.
    text += ` ORDER BY ${orderBy
      .map((entry) => {
        const [column, direction = "ASC"] = entry.trim().split(/\s+/u);
        const normalized = direction.toUpperCase();
        if (normalized !== "ASC" && normalized !== "DESC") {
          throw protocolInvocationError();
        }
        return `${quoteIdentifier(column, dialect)} ${normalized}`;
      })
      .join(", ")}`;
  }

  const limit = optionalInputNumber(input, "limit");
  if (limit !== undefined) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10_000) {
      throw protocolInvocationError();
    }
    values.push(limit);
    text += ` LIMIT ${placeholder(dialect, values.length)}`;
  }
  const offset = optionalInputNumber(input, "offset");
  if (offset !== undefined) {
    if (!Number.isSafeInteger(offset) || offset < 0) {
      throw protocolInvocationError();
    }
    values.push(offset);
    text += ` OFFSET ${placeholder(dialect, values.length)}`;
  }
  return { text, values };
}

export function buildInsert(
  dialect: SqlDialect,
  input: ProtocolInput,
): SqlStatement {
  const table = quoteQualifiedName(
    requiredInputString(input, "table", "tableName"),
    dialect,
  );
  const rows = rowsFrom(input);
  const columns = Object.keys(rows[0]);
  if (columns.length === 0) throw protocolInvocationError();

  const values: unknown[] = [];
  const tuples = rows.map((row) => {
    const markers = columns.map((column) => {
      // Every row must agree on shape, or the tuple arity would drift.
      if (!(column in row)) throw protocolInvocationError();
      values.push(row[column]);
      return placeholder(dialect, values.length);
    });
    return `(${markers.join(", ")})`;
  });

  const text = `INSERT INTO ${table} (${columns
    .map((column) => quoteIdentifier(column, dialect))
    .join(", ")}) VALUES ${tuples.join(", ")}${
    dialect === "postgres" ? " RETURNING *" : ""
  }`;
  return { text, values };
}

export function buildUpdate(
  dialect: SqlDialect,
  input: ProtocolInput,
): SqlStatement {
  const table = quoteQualifiedName(
    requiredInputString(input, "table", "tableName"),
    dialect,
  );
  const assignments = requiredInputRecord(input, "set", "data", "values");
  const conditions = requiredInputRecord(input, "where");
  if (
    Object.keys(assignments).length === 0 ||
    Object.keys(conditions).length === 0
  ) {
    // An update with no predicate rewrites the whole table.
    throw protocolInvocationError();
  }

  const values: unknown[] = [];
  const setClause = Object.entries(assignments)
    .map(([column, value]) => {
      values.push(value);
      return `${quoteIdentifier(column, dialect)} = ${placeholder(dialect, values.length)}`;
    })
    .join(", ");
  const text = `UPDATE ${table} SET ${setClause}${whereClause(
    dialect,
    conditions,
    values,
  )}${dialect === "postgres" ? " RETURNING *" : ""}`;
  return { text, values };
}

export function buildDelete(
  dialect: SqlDialect,
  input: ProtocolInput,
): SqlStatement {
  const table = quoteQualifiedName(
    requiredInputString(input, "table", "tableName"),
    dialect,
  );
  const conditions = requiredInputRecord(input, "where");
  if (Object.keys(conditions).length === 0) {
    // A delete with no predicate empties the table.
    throw protocolInvocationError();
  }
  const values: unknown[] = [];
  const text = `DELETE FROM ${table}${whereClause(dialect, conditions, values)}${
    dialect === "postgres" ? " RETURNING *" : ""
  }`;
  return { text, values };
}

/**
 * Raw SQL is the action's entire purpose, so the statement is passed through.
 * Parameters still bind, which is what lets a caller use it safely.
 */
export function buildRaw(input: ProtocolInput): SqlStatement {
  const text = requiredInputString(input, "sql", "query", "statement");
  if (text.length > 100_000) throw protocolInvocationError();
  const parameters = input.parameters ?? input.values;
  return {
    text,
    values: Array.isArray(parameters) ? parameters : [],
  };
}

/** The information_schema query behind every introspect-schema action. */
export function buildIntrospect(
  dialect: SqlDialect,
  input: ProtocolInput,
): SqlStatement {
  const values: unknown[] = [];
  let text =
    "SELECT table_schema, table_name, column_name, data_type, is_nullable " +
    "FROM information_schema.columns";
  const schema = optionalInputRecord(input, "where")?.table_schema;
  if (typeof schema === "string") {
    values.push(schema);
    text += ` WHERE table_schema = ${placeholder(dialect, 1)}`;
  }
  text += " ORDER BY table_schema, table_name, ordinal_position";
  return { text, values };
}

function rowsFrom(input: ProtocolInput): Record<string, unknown>[] {
  const rows = input.rows ?? input.data ?? input.values;
  if (Array.isArray(rows)) {
    if (rows.length === 0 || rows.length > 1_000)
      throw protocolInvocationError();
    return rows.map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) {
        throw protocolInvocationError();
      }
      return row as Record<string, unknown>;
    });
  }
  return [requiredInputRecord(input, "row", "data", "values")];
}
