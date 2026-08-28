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
 * Each hook is `{ enabled, url, botName?, avatarUrl?, roleIds?, color?, footer? }`.
 * `adminlog` is the only one wired today; the shape is generic so more can follow.
 */
import { accentOf } from "./departmentConfig.js";

const WEBHOOK_RE = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//;

/** Meaning-aware colour for an entry's type, matching the page's own palette. */
function typeColor(type = "") {
  const t = String(type).toLowerCase();
  if (/pass|hire|accept|approved|commend/.test(t)) return 0x22c55e;
  if (/fail|resign|strike|terminat|remov/.test(t)) return 0xef4444;
  if (/transfer in/.test(t)) return 0x3b82f6;
  if (/transfer out/.test(t)) return 0xf97316;
  if (/\bda\b|coach|warn|probation|suspen|demot/.test(t)) return 0xf59e0b;
  if (/booth/.test(t)) return 0x14b8a6;
  if (/interview/.test(t)) return 0xa855f7;
  if (/academy|training|eval/.test(t)) return 0x3b82f6;
  return null;
}

function accentInt(config) {
  const hex = accentOf(config?.branding).color.replace("#", "");
  const n = parseInt(hex, 16);
  return Number.isFinite(n) ? n : 0x3d82f0;
}

/** The Discord payload for one snapshot admin-log entry. */
export function buildAdminLogPayload(config, hook, entry) {
  const fmt = (v) => (v?.type === "checkbox" ? (v.value ? "Yes" : "No") : String(v?.value ?? ""));
  const fields = [];

  // Subject, with a mention when we have the id.
  if (entry.subject?.name || entry.subject?.discordId) {
    const value =
      [entry.subject?.name, entry.subject?.discordId && `<@${entry.subject.discordId}>`]
        .filter(Boolean)
        .join(" ") || "—";
    fields.push({ name: "Subject", value: value.slice(0, 1024), inline: true });
  }
  // Every filled custom field.
  for (const v of Array.isArray(entry.values) ? entry.values : []) {
    const val = fmt(v);
    if (val === "" || val === "No") continue;
    fields.push({ name: v.label || "Field", value: val.slice(0, 1024) });
  }

  const hookColor = parseInt(String(hook.color || "").replace("#", ""), 16);
  const embed = {
    ...(entry.bookName ? { author: { name: String(entry.bookName).slice(0, 256) } } : {}),
    title: entry.type ? String(entry.type).slice(0, 256) : "Admin Log entry",
    color: Number.isFinite(hookColor) ? hookColor : typeColor(entry.type) ?? accentInt(config),
    ...(fields.length ? { fields: fields.slice(0, 25) } : {}),
    footer: {
      text: [
        entry.by?.name && `Logged by ${entry.by.name}`,
        hook.footer || config?.branding?.shortName || config?.branding?.name || "Department",
      ]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 2048),
    },
    timestamp: new Date(entry.at || entry.date || Date.now()).toISOString(),
  };

  // Optional role pings above the embed.
  const content = (Array.isArray(hook.roleIds) ? hook.roleIds : [])
    .map((id) => `<@&${String(id).trim()}>`)
    .filter((s) => s.length > 5)
    .join(" ");

  return {
    ...(content ? { content } : {}),
    ...(hook.botName ? { username: String(hook.botName).slice(0, 80) } : {}),
    ...(hook.avatarUrl ? { avatar_url: hook.avatarUrl } : {}),
    embeds: [embed],
    allowed_mentions: { parse: content ? ["roles"] : [] },
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
