/**
 * MariaDB connection pool. Every route is written to survive the database being
 * absent, so this module never throws at import time — failures surface when a
 * query runs and the route falls back to seed data.
 *
 * Because that fallback is a supported mode (the site is fully usable before a
 * database is provisioned), a short-lived circuit breaker keeps every request
 * from paying the connection timeout: once a connection fails, further attempts
 * fail immediately until the cooldown expires.
 */
import mariadb from "mariadb";

const CONNECT_TIMEOUT = Number(process.env.DB_CONNECT_TIMEOUT || 2000);
const BREAKER_COOLDOWN_MS = Number(process.env.DB_BREAKER_COOLDOWN || 15000);

const pool = mariadb.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "florida_rp",
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  connectTimeout: CONNECT_TIMEOUT,
  initializationTimeout: CONNECT_TIMEOUT,
  acquireTimeout: CONNECT_TIMEOUT,
  // INT/TINYINT counts come back as plain numbers rather than BigInt, so they
  // serialise straight to JSON.
  bigIntAsNumber: true,
});

// An absent database is an expected state here, and each route already reports
// it by serving seed data — so pool-level connection errors are not fatal.
pool.on("error", () => {});

let unavailableUntil = 0;

class DatabaseUnavailableError extends Error {
  constructor() {
    super("Database unavailable");
    this.name = "DatabaseUnavailableError";
  }
}

/** Runs a parameterised query and always returns the connection to the pool. */
export async function query(sql, params = []) {
  if (Date.now() < unavailableUntil) throw new DatabaseUnavailableError();

  let conn;
  try {
    conn = await pool.getConnection();
  } catch (err) {
    unavailableUntil = Date.now() + BREAKER_COOLDOWN_MS;
    throw err;
  }

  try {
    const rows = await conn.query(sql, params);
    unavailableUntil = 0;
    return rows;
  } finally {
    conn.release();
  }
}

/** True when the database answers, false otherwise. Never throws. */
export async function ping() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.ping();
    unavailableUntil = 0;
    return true;
  } catch {
    unavailableUntil = Date.now() + BREAKER_COOLDOWN_MS;
    return false;
  } finally {
    if (conn) conn.release();
  }
}

export default pool;
