/**
 * The /api/truth-social router — the ownership broadcast composer.
 *
 * A Twitter-style composer: ownership types a post and it goes to a Discord channel through
 * a webhook, pinging @here above an embed. The webhook URL is stored here (one row) so it
 * survives restarts and is set once from the page.
 *
 *   GET  /config   the saved webhook (masked-safe: ownership only anyway). truthsocial.post
 *   POST /config   save the webhook URL. truthsocial.post
 *   POST /post     send a post to the channel. truthsocial.post
 *
 * Everything is gated on `truthsocial.post`, which defaults to Ownership only. The webhook
 * URL is restricted to Discord's own webhook host, the same as the transfer portal, so this
 * can never be pointed at something on the server's own network.
 *
 * The table is created on demand, like the others, so a deploy that has not re-run the
 * schema still works.
 */
import { Router } from "express";
import { query } from "../db.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { cleanWebhookUrl } from "../lib/portal.js";
import { str } from "../validate.js";

const router = Router();

const SITE_NAME = "The White House";
const MAX_TITLE = 256;
const MAX_BODY = 4000;
const BRAND_COLOR = 0x2f81f7;

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await query(`CREATE TABLE IF NOT EXISTS truth_social_settings (
    id          SMALLINT     NOT NULL DEFAULT 1,
    webhook_url TEXT         NOT NULL DEFAULT '',
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CONSTRAINT truth_social_singleton CHECK (id = 1)
  )`);
  tableReady = true;
}

/** The stored webhook URL, or "" when none is set. */
async function loadWebhook() {
  await ensureTable();
  const rows = await query("SELECT webhook_url FROM truth_social_settings WHERE id = 1");
  return rows[0]?.webhook_url ?? "";
}

router.get("/config", requirePermission("truthsocial.post"), async (_req, res) => {
  try {
    const webhookUrl = await loadWebhook();
    return res.json({ webhookUrl });
  } catch {
    return res.status(500).json({ message: "Could not load the broadcast settings." });
  }
});

router.post("/config", requirePermission("truthsocial.post"), async (req, res) => {
  const raw = str(req.body?.webhookUrl);
  // An empty string clears it; anything else must be a real Discord webhook URL.
  const cleaned = raw ? cleanWebhookUrl(raw) : "";
  if (raw && !cleaned) {
    return res.status(400).json({ message: "That is not a valid Discord webhook URL." });
  }
  try {
    await ensureTable();
    await query(
      `INSERT INTO truth_social_settings (id, webhook_url, updated_at)
         VALUES (1, $1, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO UPDATE SET webhook_url = EXCLUDED.webhook_url, updated_at = CURRENT_TIMESTAMP`,
      [cleaned],
    );
    return res.json({ webhookUrl: cleaned });
  } catch {
    return res.status(500).json({ message: "Could not save the webhook." });
  }
});

router.post("/post", requirePermission("truthsocial.post"), async (req, res) => {
  const title = str(req.body?.title).slice(0, MAX_TITLE);
  const body = str(req.body?.body).slice(0, MAX_BODY);
  if (!body.trim()) {
    return res.status(400).json({ message: "Write something before posting." });
  }

  let webhookUrl;
  try {
    webhookUrl = cleanWebhookUrl(await loadWebhook());
  } catch {
    webhookUrl = "";
  }
  if (!webhookUrl) {
    return res.status(400).json({ message: "Set a webhook URL first." });
  }

  const embed = {
    author: { name: SITE_NAME },
    description: body,
    color: BRAND_COLOR,
    timestamp: new Date().toISOString(),
    footer: { text: SITE_NAME },
  };
  if (title.trim()) embed.title = title.trim();

  const payload = {
    // @here above the embed. allowed_mentions must opt into it or Discord silently drops it.
    content: "@here",
    username: SITE_NAME,
    embeds: [embed],
    allowed_mentions: { parse: ["everyone"] },
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (response.status === 404) {
        return res.status(400).json({
          message:
            "Discord couldn't find that webhook (404). It was deleted or the URL is wrong — " +
            "re-copy it from the channel's Integrations → Webhooks and save it again.",
        });
      }
      if (response.status === 401 || response.status === 403) {
        return res.status(400).json({
          message: "Discord refused that webhook (bad token). Re-copy the webhook URL and save it again.",
        });
      }
      return res.status(502).json({
        message: `Discord rejected the post (${response.status}).${detail ? ` ${detail.slice(0, 200)}` : ""}`,
      });
    }
    return res.json({ ok: true });
  } catch {
    return res.status(502).json({ message: "Could not reach Discord. Try again." });
  }
});

export default router;
