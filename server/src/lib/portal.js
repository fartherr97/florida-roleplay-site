/**
 * Transfer Portal — access control, session resolution and Discord webhooks.
 *
 * A port of lib/access.js, lib/role-map.js and lib/webhook.js from the ES
 * Transfer Portal (github.com/fartherr97/es-transfer-portal), pointed at this
 * community's roles. The rules are the originals, verbatim:
 *
 *   • Management  → sees and manages EVERY ticket; internal chat everywhere.
 *   • Dept Head   → sees and manages tickets where their dept is the FROM or TO
 *                   department only; internal chat on those tickets.
 *   • Transferee  → sees ONLY their own ticket; public chat only; no internal,
 *                   no status controls.
 *
 * SSRP resolves those three from raw Discord role IDs it keeps its own map of.
 * This site already resolves roles centrally, so `sessionFrom` maps the site's
 * user onto SSRP's session shape and every rule below is unchanged.
 */

import { ROLE_MAP } from "../rosterSeed.js";

/** The departments a member can transfer between — emergency services only. */
export const TRANSFER_DEPT_IDS = ["fhp", "hcso", "tpd", "hcfr"];

/** Abbreviation → department id, the key the rest of the site uses. */
export const DEPTS = {
  FHP: "fhp",
  HCSO: "hcso",
  TPD: "tpd",
  HCFR: "hcfr",
};

/** The Discord role key that commands each department. */
export const DEPT_COMMAND_KEYS = {
  FHP: "fhp_colonel",
  HCSO: "hcso_sheriff",
  TPD: "tpd_chief",
  HCFR: "hcfr_fire_chief",
};

export const DEPT_KEYS = Object.keys(DEPTS);

/**
 * Builds the portal session from a site user.
 *
 * Shape: { id, username, displayName, avatar, dept, rank, isDeptHead, isManagement }
 * — the same object lib/session.js returns upstream, so lib/access.js's rules
 * port across untouched.
 */
export function sessionFrom(user) {
  if (!user) return null;
  const held = new Set(user.roles ?? []);

  const commandFor = DEPT_KEYS.find((abbr) => held.has(DEPT_COMMAND_KEYS[abbr]));

  const mine = ROLE_MAP.filter(
    (role) => held.has(role.key) && TRANSFER_DEPT_IDS.includes(role.department),
  ).sort((a, b) => b.order - a.order)[0];

  const deptAbbr =
    commandFor ?? (mine ? DEPT_KEYS.find((abbr) => DEPTS[abbr] === mine.department) : null);

  return {
    id: user.id ?? user.discordId ?? null,
    username: user.username ?? "",
    displayName: user.displayName || user.username || "",
    avatar: user.avatar ?? null,
    dept: deptAbbr ?? null,
    rank: mine?.rankFull ?? user.rank ?? null,
    isDeptHead: Boolean(commandFor),
    isManagement: held.has("directorship") || held.has("ownership"),
  };
}

export function isStaff(session) {
  return !!session && (session.isManagement || session.isDeptHead);
}

/** True when the session belongs to the transferee who created this ticket. */
export function isOwnTicket(session, transfer) {
  if (!session || !transfer) return false;
  const u = session.username?.toLowerCase();
  const d = session.displayName?.toLowerCase();
  return (
    (!!transfer.discord && transfer.discord.toLowerCase() === u) ||
    (!!transfer.member && transfer.member.toLowerCase() === d)
  );
}

/** Can this session open / view this ticket at all? */
export function canViewTicket(session, transfer) {
  if (!session || !transfer) return false;
  if (session.isManagement) return true;
  if (session.isDeptHead && (transfer.fromDept === session.dept || transfer.toDept === session.dept)) {
    return true;
  }
  return isOwnTicket(session, transfer);
}

/** Can this session read/write the internal (staff-only) chat thread? */
export function canUseInternal(session, transfer) {
  if (!session || !transfer) return false;
  if (session.isManagement) return true;
  return (
    session.isDeptHead &&
    (transfer.fromDept === session.dept || transfer.toDept === session.dept)
  );
}

/** Can this session change the ticket status (approve / reject / complete)? */
export function canManageTicket(session, transfer) {
  return canUseInternal(session, transfer);
}

/** Filters a full transfer list down to what `session` is allowed to see. */
export function visibleTransfers(session, transfers) {
  if (!session) return [];
  if (session.isManagement) return transfers;
  return transfers.filter((t) => canViewTicket(session, t));
}

/* ─── Discord webhooks ─────────────────────────────────────────────────────── */

/**
 * Replaces {key} placeholders in a template string with values from `vars`.
 * Unknown keys are left as-is so broken templates don't crash the embed.
 */
export function interpolate(template, vars) {
  return (template ?? "").replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

/**
 * Converts a department's webhook config + template vars into a Discord payload.
 * See: https://discord.com/developers/docs/resources/webhook#execute-webhook
 */
export function buildPayload(cfg, vars) {
  const colorHex = (cfg.color ?? "#5865F2").replace("#", "");
  const color = parseInt(colorHex, 16) || 0x5865f2;

  const embed = {
    title: interpolate(cfg.embedTitle ?? "", vars) || undefined,
    description: interpolate(cfg.embedDescription ?? "", vars) || undefined,
    color,
  };

  if (cfg.thumbnailUrl) embed.thumbnail = { url: cfg.thumbnailUrl };
  if (cfg.footer || cfg.footerIconUrl) {
    embed.footer = { text: cfg.footer ?? "" };
    if (cfg.footerIconUrl) embed.footer.icon_url = cfg.footerIconUrl;
  }

  const payload = { embeds: [embed] };
  if (cfg.username) payload.username = cfg.username;
  if (cfg.avatarUrl) payload.avatar_url = cfg.avatarUrl;

  return payload;
}

/**
 * A webhook URL we are willing to POST to.
 *
 * The original posts to whatever string is in the config. That is a
 * server-side request to an operator-supplied URL, so it is restricted to
 * Discord's own webhook endpoint — the only thing the field is for, and the
 * difference between a misconfigured webhook and a request forged through this
 * server at something on its own network.
 */
export function cleanWebhookUrl(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    return "";
  }
  if (url.protocol !== "https:") return "";
  if (url.hostname !== "discord.com" && url.hostname !== "discordapp.com") return "";
  if (!url.pathname.startsWith("/api/webhooks/")) return "";
  return url.toString();
}

/**
 * Fires webhooks to both the from-dept and to-dept channels when a ticket is
 * created. Skips any dept that doesn't have a URL configured.
 * Failures are logged but never thrown — callers must not crash on webhook errors.
 */
export async function sendTransferWebhooks(transfer, settings) {
  const webhooks = settings.webhooks ?? {};

  const vars = {
    member: transfer.member ?? "",
    discord: transfer.discord ?? "",
    rank: transfer.rank ?? "",
    fromDept: transfer.fromDept ?? "",
    toDept: transfer.toDept ?? "",
    ticketId: transfer.id ?? "",
  };

  // Deduplicate in case from-dept and to-dept happen to be the same.
  const depts = [...new Set([transfer.fromDept, transfer.toDept].filter(Boolean))];

  for (const dept of depts) {
    const url = cleanWebhookUrl(webhooks[dept]?.url);
    if (!url) continue; // no webhook configured for this dept — skip silently

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload(webhooks[dept], vars)),
      });
      if (!res.ok) console.error(`[webhook] ${dept} responded ${res.status}`);
    } catch (err) {
      console.error(`[webhook] ${dept} failed:`, err?.message);
    }
  }
}

/** Default webhook config applied to every department on first boot. */
export const DEFAULT_WEBHOOK_CFG = {
  url: "",
  username: "",
  avatarUrl: "",
  color: "#5865F2",
  thumbnailUrl: "",
  embedTitle: "New Transfer Request · {toDept}",
  embedDescription:
    "**{member}** ({discord}) has submitted a transfer request.\n\n**Outgoing:** {fromDept}\n**Incoming:** {toDept}\n**Rank:** {rank}\n\nTicket: {ticketId}",
  footer: "Florida Roleplay Transfer Portal",
  footerIconUrl: "",
};
