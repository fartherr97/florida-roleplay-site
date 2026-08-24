import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import router from "./routes/index.js";
import { close, ping } from "./db.js";

/**
 * Express entry point. In production this single process serves both the API and
 * the built client, with SPA history fallback so deep links survive a refresh.
 */
const app = express();
const here = dirname(fileURLToPath(import.meta.url));
const clientDist = resolve(here, "../../client/dist");

const origins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

/**
 * How many proxies sit in front of this process, so `req.ip` is the visitor
 * rather than the nearest hop.
 *
 * A count, never `true`. `true` tells Express to believe the whole
 * `X-Forwarded-For` chain, which any caller can prepend to — so anything that
 * later rate-limits or bans by IP could be pointed at an address of the
 * caller's choosing. Behind Cloudflare in front of Railway this is 2; adjust it
 * if the chain changes.
 */
app.set("trust proxy", Number(process.env.TRUST_PROXY || 0));

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "256kb" }));

/**
 * Liveness and readiness in one.
 *
 * Returns 200 with `database: false` when the database is down rather than
 * failing: the site is designed to serve seed data without one, so a platform
 * health check that failed here would take a working site out of rotation. The
 * flag is what tells you which of the two states you are in.
 */
app.get("/healthz", async (_req, res) => {
  const database = await ping();
  res.json({ ok: true, service: "florida-rp-api", database });
});

app.use("/api", router);

if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // Everything that is not an API route falls back to index.html, so
  // /patch-notes and friends load on a hard refresh.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.sendFile(resolve(clientDist, "index.html"));
  });
} else {
  app.get("/", (_req, res) => res.json({ service: "florida-rp-api", ok: true }));
}

if (process.env.NODE_ENV !== "production") {
  console.warn(
    "[auth] Development mode: the caller is resolved from DEV_USER_ID (or an " +
      "x-discord-id header) instead of Discord OAuth. This path is disabled " +
      "when NODE_ENV=production.",
  );
}

const port = Number(process.env.PORT || 4000);
// 0.0.0.0, not localhost: a container's health check and its router both reach
// the process from outside it.
const server = app.listen(port, "0.0.0.0", () => {
  console.log(`florida-rp-api listening on http://localhost:${port}`);
  console.log(
    clientDist && existsSync(clientDist)
      ? `serving client from ${clientDist}`
      : "client/dist not built — API only",
  );
});

/**
 * Drain on shutdown.
 *
 * Railway and Northflank both send SIGTERM and then wait before killing the
 * container. Closing the listener first stops new requests, finishing the ones
 * in flight, then the pool closes — which is the difference between a deploy
 * nobody notices and one that drops whatever was mid-request.
 */
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`${signal} received — draining`);
    server.close(async () => {
      await close();
      process.exit(0);
    });
    // If the drain has not finished in ten seconds, something is holding a
    // connection open and the platform is about to kill us anyway.
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}

export default app;
