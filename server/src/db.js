/**
 * PostgreSQL connection pool. Every route is written to survive the database
 * being absent, so this module never throws at import time — failures surface
 * when a query runs and the route falls back to seed data.
 *
 * Because that fallback is a supported mode (the site is fully usable before a
 * database is provisioned), a short-lived circuit breaker keeps every request
 * from paying the connection timeout: once a connection fails, further attempts
 * fail immediately until the cooldown expires.
 *
 * ## Configuration
 *
 * `DATABASE_URL` is the one that matters. Railway and Northflank both hand you
 * exactly that, so the deployment configures itself and neither platform needs
 * a variable named after it. The discrete `DB_*` vars are the local-development
 * path and are only read when `DATABASE_URL` is unset.
 *
 * TLS is required for any host that is not local. Managed Postgres speaks TLS
 * and refuses plaintext, and a connection that silently downgrades is one
 * sending the whole database over the open internet in the clear.
 * `DB_SSL_REJECT_UNAUTHORIZED=false` relaxes only certificate verification,
 * which is what Railway's internal hostnames need — the traffic is still
 * encrypted. It is not a way to turn TLS off.
 */
import pg from "pg";

const { Pool, types } = pg;

const CONNECT_TIMEOUT = Number(process.env.DB_CONNECT_TIMEOUT || 5000);
const BREAKER_COOLDOWN_MS = Number(process.env.DB_BREAKER_COOLDOWN || 15000);

/**
 * BIGINT and NUMERIC come back as strings by default, because they can exceed
 * what a JS number holds exactly. Every one of ours is a COUNT or a small
 * identity, so they are parsed to numbers and serialise straight to JSON —
 * without this, `SELECT COUNT(*)` renders as `"12"` on the page.
 *
 * Discord snowflakes are the reason nothing in the schema uses BIGINT for an
 * id: they are stored as VARCHAR and stay strings the whole way through.
 */
types.setTypeParser(types.builtins.INT8, (value) => Number(value));
types.setTypeParser(types.builtins.NUMERIC, (value) => Number(value));

/** Whether a host needs TLS. Anything not on this machine does. */
function needsTls(connectionString) {
  if (process.env.DB_SSL === "disable") return false;
  if (process.env.DB_SSL === "require") return true;
  if (!connectionString) {
    const host = process.env.DB_HOST || "localhost";
    return !["localhost", "127.0.0.1", "::1", "postgres"].includes(host);
  }
  try {
    const { hostname } = new URL(connectionString);
    return !["localhost", "127.0.0.1", "::1"].includes(hostname);
  } catch {
    return true;
  }
}

function poolConfig() {
  const connectionString = process.env.DATABASE_URL || "";
  const ssl = needsTls(connectionString)
    ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== "false" }
    : false;

  const shared = {
    ssl,
    max: Number(process.env.DB_CONNECTION_LIMIT || 5),
    connectionTimeoutMillis: CONNECT_TIMEOUT,
    idleTimeoutMillis: Number(process.env.DB_IDLE_TIMEOUT || 30000),
    // A statement that has not finished in this long is not going to; letting
    // it hold a pooled connection open is how one slow query becomes an outage.
    statement_timeout: Number(process.env.DB_STATEMENT_TIMEOUT || 15000),
    application_name: "florida-rp-api",
  };

  if (connectionString) return { connectionString, ...shared };

  return {
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "florida_rp",
    ...shared,
  };
}

const pool = new Pool(poolConfig());

// An absent database is an expected state here, and each route already reports
// it by serving seed data — so pool-level connection errors are not fatal. An
// idle client erroring out (a managed provider recycling the instance) also
// raises this; without a handler it would take the process down.
pool.on("error", () => {});

let unavailableUntil = 0;

class DatabaseUnavailableError extends Error {
  constructor() {
    super("Database unavailable");
    this.name = "DatabaseUnavailableError";
  }
}

/**
 * Whether a write actually changed a row.
 *
 * Reads fall back to seed data when a table is empty, which means an UPDATE can
 * target a record the caller can plainly see on the page but that has never been
 * inserted — the seeds are not in the database. Postgres reports that as success
 * with zero rows affected, so without this check the API would answer "saved" to
 * a write that did nothing. Callers use it to say so instead.
 */
export function changedRows(result) {
  return Number(result?.rowCount ?? 0) > 0;
}

/**
 * Runs a parameterised query and returns the rows.
 *
 * Returns `result.rows` rather than the result object, because that is what
 * every caller wants and it is the shape the routes were written against.
 * Callers that need the row count take the whole result from `execute` below.
 *
 * Placeholders are Postgres's `$1, $2, …`. Never interpolate a value into the
 * SQL string — not once, not for a number, not for an identifier you are sure
 * about.
 */
export async function query(sql, params = []) {
  return (await execute(sql, params)).rows;
}

/** As `query`, but returns the full result — `rowCount` and all. */
export async function execute(sql, params = []) {
  if (Date.now() < unavailableUntil) throw new DatabaseUnavailableError();

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    unavailableUntil = Date.now() + BREAKER_COOLDOWN_MS;
    throw err;
  }

  try {
    const result = await client.query(sql, params);
    unavailableUntil = 0;
    return result;
  } catch (err) {
    // Every route catches this and falls back to seed data, which is the right
    // answer for the caller and no help at all to whoever has to work out why
    // the fallback fired. One line, with the statement that failed.
    console.error(`[db] ${err.message}\n  ${sql.trim().split("\n")[0]}`);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Runs `fn` inside a transaction, rolling back if it throws.
 *
 * The callback is handed a `query` bound to the same connection. Using the
 * module-level `query` inside a transaction would take a *different* connection
 * out of the pool, so that statement would run outside the transaction and
 * survive the rollback — which is the kind of bug that only shows up under load.
 */
export async function transaction(fn) {
  if (Date.now() < unavailableUntil) throw new DatabaseUnavailableError();

  let client;
  try {
    client = await pool.connect();
  } catch (err) {
    unavailableUntil = Date.now() + BREAKER_COOLDOWN_MS;
    throw err;
  }

  try {
    await client.query("BEGIN");
    const result = await fn(async (sql, params = []) => (await client.query(sql, params)).rows);
    await client.query("COMMIT");
    unavailableUntil = 0;
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** True when the database answers, false otherwise. Never throws. */
export async function ping() {
  let client;
  try {
    client = await pool.connect();
    await client.query("SELECT 1");
    unavailableUntil = 0;
    return true;
  } catch {
    unavailableUntil = Date.now() + BREAKER_COOLDOWN_MS;
    return false;
  } finally {
    if (client) client.release();
  }
}

/** Closes the pool. Called on shutdown so a deploy drains rather than drops. */
export async function close() {
  await pool.end().catch(() => {});
}

export default pool;
