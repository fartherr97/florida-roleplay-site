/**
 * Department Discord webhooks — fired server-side.
 *
 * The reference department hub posts its Emergency-Services admin log to a
 * Discord channel from the browser; here it fires from the server, on the same
 * request that saves the entry, so the webhook URL is a write credential that
 * never reaches a client. The URL lives in `config.webhooks.<key>.url` and is
 * redacted from every non-manager read (see redactSensitive), so only someone
 * who could set it ever sees it.
 *
 * Each hook is `{ enabled, url, botName?, avatarUrl? }`. `adminlog` is the only
 * one wired today; the shape is generic so more can follow.
 */
import { accentOf } from "./departmentConfig.js";

const WEBHOOK_RE = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//;

/** Colours the admin-log embed by the weight of the action. */
const ACTION_COLORS = {
  Promotion: 0x1eb854,
  Commendation: 0x3d82f0,
  Demotion: 0xf59e0b,
  "Written warning": 0xf59e0b,
  Suspension: 0xef4444,
  Removal: 0xef4444,
};

function accentInt(config) {
  const hex = accentOf(config?.branding).color.replace("#", "");
  const n = parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0x3d82f0;
}

/** The Discord payload for one admin-log entry. */
export function buildAdminLogPayload(config, hook, entry) {
  const fields = [];
  if (entry.member) fields.push({ name: "Member", value: String(entry.member).slice(0, 1024), inline: true });
  if (entry.action) fields.push({ name: "Action", value: String(entry.action).slice(0, 1024), inline: true });
  if (entry.issuedBy) fields.push({ name: "Issued by", value: String(entry.issuedBy).slice(0, 1024), inline: true });
  if (entry.detail) fields.push({ name: "Detail", value: String(entry.detail).slice(0, 1024) });

  const embed = {
    title: entry.action ? `Admin Log · ${entry.action}` : "Admin Log entry",
    color: ACTION_COLORS[entry.action] ?? accentInt(config),
    ...(fields.length ? { fields } : {}),
    footer: { text: config?.branding?.shortName || config?.branding?.name || "Department" },
    timestamp: new Date(entry.date || Date.now()).toISOString(),
  };

  return {
    ...(hook.botName ? { username: String(hook.botName).slice(0, 80) } : {}),
    ...(hook.avatarUrl ? { avatar_url: hook.avatarUrl } : {}),
    embeds: [embed],
    // A record post never pings anyone.
    allowed_mentions: { parse: [] },
  };
}

/** Fire-and-forget POST to Discord. Resolves true on a 2xx, false otherwise. */
export async function sendWebhook(url, payload) {
  if (!WEBHOOK_RE.test(String(url || ""))) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Post every newly-added admin-log entry to the department's admin-log webhook.
 * `before`/`after` are the page's `entries` arrays; an entry is "new" when its
 * id was not present before, so re-saving the page never re-posts old entries.
 * Never throws — a webhook failure must not fail the save that already landed.
 */
export async function fireAdminLogWebhook(config, before, after) {
  const hook = config?.webhooks?.adminlog;
  if (!hook?.enabled || !WEBHOOK_RE.test(String(hook.url || ""))) return;

  const seen = new Set((Array.isArray(before) ? before : []).map((e) => e?.id));
  const fresh = (Array.isArray(after) ? after : []).filter((e) => e?.id && !seen.has(e.id));
  // Oldest-first so the channel reads in the order entries were filed.
  for (const entry of fresh.reverse()) {
    await sendWebhook(hook.url, buildAdminLogPayload(config, hook, entry));
  }
}
