/**
 * The /api/bans router — the active Discord ban list.
 *
 * The bot reports bans and unbans with its shared secret (requireBot, the same
 * WEBSITE_BOT_TOKEN / BOT_TOKEN pair /bgcheck and the roster sync use). The
 * Staff Hub reads the active list with bans.view. The site never enforces a ban
 * — it only mirrors what the bot did — so there is no site-side ban/unban write
 * beyond what the bot reports.
 */
import { Router } from "express";
import { requireBot } from "../middleware/requireBot.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { str, isDiscordId } from "../validate.js";
import * as bans from "../lib/bans.js";

const router = Router();

/** The bot reports a global ban. */
router.post("/bot", requireBot, async (req, res) => {
  const discordId = str(req.body?.discordId).trim();
  if (!isDiscordId(discordId)) {
    return res.status(400).json({ ok: false, message: "A valid Discord id is required." });
  }
  let expiresAt = null;
  if (req.body?.expiresAt) {
    const d = new Date(req.body.expiresAt);
    if (!Number.isNaN(d.getTime())) expiresAt = d.toISOString();
  }
  try {
    const ban = await bans.upsertBan({
      discordId,
      displayName: str(req.body?.displayName).slice(0, 120) || null,
      reason: str(req.body?.reason).slice(0, 2000) || null,
      actorId: str(req.body?.actorId).trim() || null,
      actorName: str(req.body?.actorName).slice(0, 120) || null,
      serversApplied: Number(req.body?.serversApplied),
      serversTotal: Number(req.body?.serversTotal),
      expiresAt,
    });
    return res.json({ ok: true, ban });
  } catch {
    return res.status(500).json({ ok: false, message: "Could not record the ban." });
  }
});

/** The bot reports a global unban. */
router.post("/bot/unban", requireBot, async (req, res) => {
  const discordId = str(req.body?.discordId).trim();
  if (!isDiscordId(discordId)) {
    return res.status(400).json({ ok: false, message: "A valid Discord id is required." });
  }
  try {
    const cleared = await bans.deactivateBan({
      discordId,
      actorId: str(req.body?.actorId).trim() || null,
      actorName: str(req.body?.actorName).slice(0, 120) || null,
    });
    return res.json({ ok: true, cleared });
  } catch {
    return res.status(500).json({ ok: false, message: "Could not clear the ban." });
  }
});

/** The Staff Hub's active ban list. */
router.get("/", requirePermission("bans.view"), async (_req, res) => {
  try {
    return res.json({ bans: await bans.listActiveBans() });
  } catch {
    return res.json({ bans: [], message: "The ban list is unavailable right now." });
  }
});

export default router;
