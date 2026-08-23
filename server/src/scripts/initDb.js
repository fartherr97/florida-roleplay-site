/**
 * One-shot schema initialiser. Opens a connection with no database selected —
 * schema.sql creates it — runs the DDL, then closes.
 *
 * Usage: npm run db:init
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import mariadb from "mariadb";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const sql = await readFile(resolve(here, "../schema.sql"), "utf8");

  const conn = await mariadb.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true,
  });

  await conn.query(sql);
  console.log(
    `Schema initialised on ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 3306}`,
  );
  await conn.end();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
