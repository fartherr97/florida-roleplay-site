import "dotenv/config";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import router from "./routes/index.js";

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

app.use(cors({ origin: origins, credentials: true }));
app.use(express.json({ limit: "256kb" }));

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
app.listen(port, () => {
  console.log(`florida-rp-api listening on http://localhost:${port}`);
  console.log(
    clientDist && existsSync(clientDist)
      ? `serving client from ${clientDist}`
      : "client/dist not built — API only",
  );
});

export default app;
