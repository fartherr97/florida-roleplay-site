/**
 * The disciplinary-action Discord webhook.
 *
 * Every DA filed in the DA Hub is posted to one records-log channel (like the
 * screenshot's "SSRP Records Logs"): the member, action type, department,
 * reason, who issued it, and the log id. When the DA is a department one, the
 * post also pings that department's command — its head role(s) — above the
 * embed, so the dept heads are notified. Staff/management DAs post without a
 * department ping.
 *
 * Config is one channel webhook. Each department's DA pings its head and deputy
 * head (the 01 and 02) — their real records-log-server role ids are built in
 * below and can be overridden with DA_PING_ROLES. Fired server-side on the
 * filing request; best-effort, so a webhook failure never fails the DA that
 * already saved.
 */
import { query } from "../db.js";
import { sendWebhook } from "./deptWebhook.js";
import {
  ACTION_BODY_MAP,
  ACTION_TYPE_MAP,
  DEPARTMENT_COMMAND_KEYS,
  actionLabel,
  bodyLabel,
} from "./discipline.js";

/** The records-log channel webhook. The feature is inert until it's set. */
export function daLogWebhookUrl() {
  return String(process.env.DA_LOG_WEBHOOK_URL ?? "").trim();
}

/**
 * The head + deputy-head Discord role ids pinged for each department's DAs — the
 * 01 and 02. These are the real roles in the records-log server, so they always
 * resolve (the role map holds department-guild ids, which show as @unknown-role
 * in the main guild). Override any of them with DA_PING_ROLES if roles change.
 */
const DEFAULT_PING_ROLES = {
  fhp: ["1534498144870727680", "1534498145633833124"], // Colonel, Lt. Colonel
  bso: ["1534498938080460890", "1534498939099943064"], // Sheriff, Undersheriff
  mpd: ["1534522987007443065", "1534522987779195000"], // Chief of Police, Deputy Chief
};

/** Embed colour by action severity, matching the DA Hub's own palette. */
function colorFor(typeId) {
  const sev = ACTION_TYPE_MAP[typeId]?.severity ?? 0;
  if (sev >= 5) return 0xef4444; // demotion / termination / blacklist — red
  if (sev >= 4) return 0xa855f7; // suspension — violet
  if (sev >= 2) return 0xf59e0b; // warnings / strike / PTO — amber
  return 0xf59e0b;
}

/**
 * Explicit ping overrides from DA_PING_ROLES, shaped "fhp:111,222;bso:333;mpd:444".
 * A body id maps to the role ids pinged for it — use this to ping more than the
 * one head role (e.g. an assistant head) or to ping on staff/management DAs.
 */
function pingOverrides() {
  const raw = String(process.env.DA_PING_ROLES ?? "").trim();
  const map = {};
  if (!raw) return map;
  for (const part of raw.split(";")) {
    const [body, ids] = part.split(":");
    const key = String(body ?? "").trim();
    if (!key) continue;
    const roleIds = String(ids ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{17,20}$/.test(s));
    if (roleIds.length) map[key] = roleIds;
  }
  return map;
}

/** How many top ranks a department DA pings — the head and their deputy (01 & 02). */
const DEPT_PING_DEPTH = 2;

/**
 * The role ids to ping for a body: an explicit DA_PING_ROLES override if set,
 * else the department's built-in head + deputy-head roles (the 01 and 02). As a
 * last resort — for a department with no built-in entry — the two highest-ranked
 * roles from the role map are used. Staff/management bodies ping nobody unless
 * overridden.
 */
async function pingRoleIdsFor(bodyId) {
  // An env override wins, for setups that prefer configuration by variable.
  const override = pingOverrides()[bodyId];
  if (override) return override;

  // The head + deputy head role ids per department (the 01 and 02).
  if (DEFAULT_PING_ROLES[bodyId]) return DEFAULT_PING_ROLES[bodyId];

  const body = ACTION_BODY_MAP[bodyId];
  if (!body || body.source !== "department") return [];
  try {
    // The department id is the body id for a department body; take its top ranks
    // by seniority (sort_order), highest first.
    const rows = await query(
      `SELECT role_id FROM roster_role_map
         WHERE department = $1 AND kind = 'rank' AND role_id IS NOT NULL
         ORDER BY sort_order DESC
         LIMIT $2`,
      [bodyId, DEPT_PING_DEPTH],
    );
    const ids = rows.map((r) => String(r.role_id)).filter((id) => /^\d{17,20}$/.test(id));
    if (ids.length) return ids;
    // Fall back to the single mapped command rank if the map has no ordered rows.
    const commandKey = DEPARTMENT_COMMAND_KEYS[bodyId];
    if (!commandKey) return [];
    const head = await query(
      "SELECT role_id FROM roster_role_map WHERE role_key = $1 AND role_id IS NOT NULL",
      [commandKey],
    );
    return head.map((r) => String(r.role_id)).filter((id) => /^\d{17,20}$/.test(id));
  } catch {
    return [];
  }
}

/** Build the Discord payload for one filed DA. */
export function buildDaPayload(action, pingRoleIds = []) {
  const body = ACTION_BODY_MAP[action.bodyId];
  const isDept = body?.source === "department";

  const memberValue = [
    action.targetName || "Unknown member",
    action.targetDiscordId ? `(${action.targetDiscordId})` : null,
  ]
    .filter(Boolean)
    .join(" ");
  const issuedValue = [
    action.issuedByName || "Unknown",
    action.issuedByDiscordId ? `(${action.issuedByDiscordId})` : null,
  ]
    .filter(Boolean)
    .join(" ");

  const fields = [
    { name: "Member", value: memberValue.slice(0, 1024) },
    { name: "Action Type", value: actionLabel(action.type).slice(0, 1024), inline: true },
    { name: "Department", value: bodyLabel(action.bodyId).slice(0, 1024), inline: true },
    { name: "Reason", value: (action.reason || "—").slice(0, 1024) },
    { name: "Issued By", value: issuedValue.slice(0, 1024) },
    { name: "Log ID", value: `#${action.id}`, inline: true },
  ];
  if (action.expiresAt) {
    const ts = Math.floor(new Date(action.expiresAt).getTime() / 1000);
    if (Number.isFinite(ts)) fields.push({ name: "Expires", value: `<t:${ts}:R>`, inline: true });
  }

  const content = pingRoleIds.map((id) => `<@&${id}>`).join(" ");

  return {
    ...(content ? { content } : {}),
    embeds: [
      {
        title: "Disciplinary Action Issued",
        description: isDept
          ? "A member of your department has received a disciplinary action."
          : `A member has received a disciplinary action from ${bodyLabel(action.bodyId)}.`,
        color: colorFor(action.type),
        fields,
        footer: { text: "FLRP Records • DA Hub" },
        timestamp: new Date(action.createdAt || Date.now()).toISOString(),
      },
    ],
    // Only the head-role pings may notify; the member id is shown as plain text,
    // never a mention, so filing a DA never pings the member being actioned.
    allowed_mentions: { parse: content ? ["roles"] : [] },
  };
}

/**
 * Post a filed DA to the records-log channel, pinging dept heads for a
 * department DA. Never throws — the DA has already been saved.
 * @param {object} action A normalized action (id, type, bodyId, targetName,
 *   targetDiscordId, reason, issuedByName, issuedByDiscordId, expiresAt, createdAt)
 */
export async function fireDaWebhook(action) {
  const url = daLogWebhookUrl();
  if (!url || !action?.id) return;
  try {
    const pingRoleIds = await pingRoleIdsFor(action.bodyId);
    await sendWebhook(url, buildDaPayload(action, pingRoleIds));
  } catch {
    // Best-effort — the DA is filed regardless of whether Discord heard about it.
  }
}
