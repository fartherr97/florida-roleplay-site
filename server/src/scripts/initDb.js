/**
 * One-shot schema initialiser.
 *
 * Every statement in schema.sql is IF NOT EXISTS (or CREATE OR REPLACE), so
 * running this against a live database is a no-op rather than a migration. It
 * is safe to run on every deploy, which is what the Railway start command does.
 *
 * Usage: npm run db:init
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pool, { close } from "../db.js";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = await readFile(resolve(here, "../schema.sql"), "utf8");

  // One statement to node-postgres, which sends it as a simple query — that is
  // what allows several statements separated by semicolons, and it runs them in
  // an implicit transaction, so a failure half way leaves nothing behind.
  const client = await pool.connect();
  try {
    await client.query(sql);
  } finally {
    client.release();
  }

  const where = process.env.DATABASE_URL
    ? new URL(process.env.DATABASE_URL).host
    : `${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 5432}`;
  console.log(`Schema initialised on ${where}`);
  await close();
}

main().catch(async (err) => {
  console.error(err.message);
  await close();
  process.exit(1);
});
