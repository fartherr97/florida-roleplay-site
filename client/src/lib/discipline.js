/**
 * Disciplinary actions — one store for every action taken against a member,
 * whether the staff team took it or a department did.
 *
 * Two things read this and they want opposite shapes. The DA Hub wants a flat
 * list to file and edit; `/bgcheck` in Discord wants one member's record folded
 * into a summary. Both come out of the same rows, because a department action
 * that the staff team cannot see is how somebody with four write-ups keeps
 * getting hired.
 *
 * The split that matters for a background check is **verbal versus non-verbal**.
 * A verbal warning is a conversation that was logged; everything else is on
 * paper and follows the member. Sorting a record by that line is what tells a
 * reviewer whether they are looking at coaching or at a history.
 *
 * Everything here is pure. Mirrored at server/src/lib/discipline.js.
 */
import { DEPARTMENTS } from "../data/rosterData";

export const CONFIG_VERSION = 1;

/* ------------------------------------------------------------------ *
 * Action types
 * ------------------------------------------------------------------ */

/**
 * `verbal` marks the ones that are a conversation rather than a record.
 * `severity` orders them for the summary line — the highest one somebody has
 * taken is the number a reviewer reads first.
 */
export const ACTION_TYPES = [
  { id: "verbal_warning", label: "Verbal Warning", tone: "amber", verbal: true, severity: 1, detail: "A conversation, logged so it is not repeated." },
  { id: "written_warning", label: "Written Warning", tone: "primary", verbal: false, severity: 2, detail: "On paper. Follows the member." },
  { id: "strike", label: "Strike", tone: "primary", verbal: false, severity: 3, detail: "Counts toward a threshold set by the department." },
  { id: "pto_restriction", label: "PTO Restriction", tone: "brand", verbal: false, severity: 3, detail: "Time off withheld for a set period." },
  { id: "suspension", label: "Suspension", tone: "violet", verbal: false, severity: 4, detail: "Removed from duty for a set period." },
  { id: "demotion", label: "Demotion", tone: "rose", verbal: false, severity: 5, detail: "Reduced in rank." },
  { id: "termination", label: "Termination", tone: "rose", verbal: false, severity: 6, detail: "Removed from the department or the team." },
  { id: "blacklist", label: "Blacklist", tone: "rose", verbal: false, severity: 7, detail: "Barred from returning." },
];

export const ACTION_TYPE_MAP = Object.fromEntries(ACTION_TYPES.map((t) => [t.id, t]));

export function actionLabel(typeId) {
  return ACTION_TYPE_MAP[typeId]?.label ?? typeId;
}

export function actionTone(typeId) {
  return ACTION_TYPE_MAP[typeId]?.tone ?? "slate";
}

export function isVerbal(typeId) {
  return ACTION_TYPE_MAP[typeId]?.verbal === true;
}

/* ------------------------------------------------------------------ *
 * Where an action came from
 * ------------------------------------------------------------------ */

/**
 * Every body that can file one: the emergency services departments, the staff
 * team, and the directorship. Read off the community's own department list so
 * there is no second roster of names to drift.
 */
export const ACTION_BODIES = [
  ...DEPARTMENTS.filter((d) => ["law", "fire", "federal"].includes(d.division)).map((d) => ({
    id: d.id,
    label: d.label,
    abbr: d.abbr,
    tone: d.tone,
    source: "department",
  })),
  { id: "staff", label: "Server Staff Team", abbr: "STAFF", tone: "primary", source: "staff" },
  { id: "management", label: "Board of Directors", abbr: "BOD", tone: "rose", source: "staff" },
];

export const ACTION_BODY_MAP = Object.fromEntries(ACTION_BODIES.map((b) => [b.id, b]));

export function bodyLabel(id) {
  return ACTION_BODY_MAP[id]?.label ?? id ?? "—";
}

/**
 * "Staff" or "Department" — the axis `/bgcheck` splits on.
 *
 * The staff team and the directorship both count as staff: from the member's
 * side they are the same authority, and a background check that listed them
 * apart would bury a directorship termination under a heading nobody reads.
 */
export function sourceOf(bodyId) {
  return ACTION_BODY_MAP[bodyId]?.source ?? "department";
}

/* ------------------------------------------------------------------ *
 * Records
 * ------------------------------------------------------------------ */

const str = (v, max = 500) => (typeof v === "string" ? v.slice(0, max) : "");

/** A stored row is never trusted — this is what makes it safe to render. */
export function normalizeAction(raw) {
  return {
    id: raw?.id ?? null,
    type: ACTION_TYPE_MAP[raw?.type] ? raw.type : "verbal_warning",
    bodyId: ACTION_BODY_MAP[raw?.bodyId] ? raw.bodyId : "staff",
    targetName: str(raw?.targetName, 128),
    targetDiscordId: /^\d{17,20}$/.test(String(raw?.targetDiscordId ?? "")) ? String(raw.targetDiscordId) : "",
    issuedByName: str(raw?.issuedByName, 128),
    issuedByDiscordId: /^\d{17,20}$/.test(String(raw?.issuedByDiscordId ?? "")) ? String(raw.issuedByDiscordId) : "",
    reason: str(raw?.reason, 1000),
    // How long a suspension or restriction runs. Null for the ones that do not
    // expire — a termination has no end date.
    expiresAt: raw?.expiresAt ?? null,
    voided: raw?.voided === true,
    voidReason: str(raw?.voidReason, 500),
    createdAt: raw?.createdAt ?? null,
    updatedAt: raw?.updatedAt ?? null,
  };
}

/** What is wrong with one somebody is filing, keyed by field. */
export function validateAction(draft) {
  const errors = {};
  if (!ACTION_TYPE_MAP[draft?.type]) errors.type = "Pick an action type.";
  if (!ACTION_BODY_MAP[draft?.bodyId]) errors.bodyId = "Who is filing this?";
  if (!String(draft?.targetName ?? "").trim()) errors.targetName = "Who is it against?";
  if (!/^\d{17,20}$/.test(String(draft?.targetDiscordId ?? "").trim())) {
    errors.targetDiscordId = "A Discord ID is 17 to 20 digits.";
  }
  const reason = String(draft?.reason ?? "").trim();
  if (reason.length < 8) errors.reason = "Say what happened — this is the record.";
  return { errors, ok: Object.keys(errors).length === 0 };
}

/**
 * Who may file and edit.
 *
 * `discipline.file` is the community-wide grant. A department's own command
 * may always file against their department without it, which is the same rule
 * the application builder and the transfer portal use — command staff run their
 * own department.
 */
export function canFileFor(bodyId, { roleKeys = [], permissions = new Set() } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  if (perms.has("discipline.file")) return true;
  const body = ACTION_BODY_MAP[bodyId];
  if (!body || body.source !== "department") return false;
  return commandRoleKeys(bodyId).some((key) => new Set(roleKeys).has(key));
}

/**
 * The bodies a caller may file on behalf of. An empty list means no filing at
 * all, which is what the UI keys "can this person add an action" off — offering
 * a body they cannot use is offering a 403.
 */
export function filingBodiesFor(ctx) {
  return ACTION_BODIES.filter((body) => canFileFor(body.id, ctx));
}

/** The command role keys for a department, resolved off the role map at call time. */
let COMMAND_CACHE = null;
function commandRoleKeys(bodyId) {
  if (!COMMAND_CACHE) {
    COMMAND_CACHE = {};
    for (const body of ACTION_BODIES) {
      if (body.source !== "department") continue;
      COMMAND_CACHE[body.id] = DEPARTMENT_COMMAND_KEYS[body.id] ? [DEPARTMENT_COMMAND_KEYS[body.id]] : [];
    }
  }
  return COMMAND_CACHE[bodyId] ?? [];
}

/** The rank that runs each department. Matches the applications and transfer engines. */
export const DEPARTMENT_COMMAND_KEYS = {
  fhp: "fhp_colonel",
  bcso: "bcso_sheriff",
  mpd: "mpd_chief",
};

/** Reading somebody else's record is its own grant from filing one. */
export function canViewAll({ permissions = new Set() } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  return perms.has("discipline.view");
}

/** Editing or voiding somebody else's entry is a management act. */
export function canEditAction(action, { user, permissions = new Set() } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  if (perms.has("discipline.manage")) return true;
  // Whoever filed it may correct their own — a typo in a reason should not need
  // a director.
  return Boolean(user?.id) && action?.issuedByDiscordId === user.id;
}

/* ------------------------------------------------------------------ *
 * The background check
 * ------------------------------------------------------------------ */

export const DEFAULT_WINDOW_DAYS = 180;

/**
 * One member's record, folded the way `/bgcheck` presents it.
 *
 * Split first by verbal versus non-verbal, then by whether the staff team or a
 * department filed it — that is the shape the Discord embed renders, and doing
 * the folding here rather than in the bot means the site and the embed can
 * never disagree about somebody's history.
 *
 * Voided entries are counted separately rather than dropped. An action that was
 * later withdrawn is part of the record: leaving it out entirely would let a
 * reviewer conclude nothing ever happened.
 */
export function backgroundFor(actions, { discordId, windowDays = DEFAULT_WINDOW_DAYS, now = Date.now() } = {}) {
  const since = now - windowDays * 86_400_000;
  const mine = (actions ?? [])
    .map(normalizeAction)
    .filter((action) => action.targetDiscordId === String(discordId))
    .filter((action) => {
      const at = new Date(action.createdAt).getTime();
      return Number.isFinite(at) && at >= since;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const live = mine.filter((a) => !a.voided);
  const voided = mine.filter((a) => a.voided);

  const bucket = (list) => ({
    staff: list.filter((a) => sourceOf(a.bodyId) === "staff"),
    department: list.filter((a) => sourceOf(a.bodyId) === "department"),
  });

  const verbal = live.filter((a) => isVerbal(a.type));
  const nonVerbal = live.filter((a) => !isVerbal(a.type));

  const worst = live.reduce(
    (max, a) => Math.max(max, ACTION_TYPE_MAP[a.type]?.severity ?? 0),
    0,
  );

  return {
    discordId: String(discordId),
    windowDays,
    since: new Date(since).toISOString(),
    total: live.length,
    verbal: { total: verbal.length, ...bucket(verbal) },
    nonVerbal: { total: nonVerbal.length, ...bucket(nonVerbal) },
    voided,
    // The single line a reviewer reads before anything else.
    headline: headlineFor(live, worst),
    mostSevere: ACTION_TYPES.find((t) => t.severity === worst)?.id ?? null,
    // Anything still running right now, which is what stops somebody being
    // hired mid-suspension.
    active: live.filter((a) => {
      if (!a.expiresAt) return false;
      const until = new Date(a.expiresAt).getTime();
      return Number.isFinite(until) && until > now;
    }),
  };
}

function headlineFor(live, worst) {
  if (!live.length) return "Nothing on record in this window.";
  const type = ACTION_TYPES.find((t) => t.severity === worst);
  const n = live.length;
  return `${n} action${n === 1 ? "" : "s"} on record, the most serious a ${type?.label ?? "record"}.`;
}

const EMBED_COLORS = { clean: 0x10b981, light: 0xf59e0b, heavy: 0xf43f5e };

/**
 * A record's date the way the embed prints it: `M/D/YYYY, h:mm:ss AM/PM` in UTC.
 *
 * The embed's body is a static code block, so the timestamp cannot be a Discord
 * `<t:…>` tag that renders in the reader's zone — it has to be a literal string.
 * UTC keeps it deterministic across whoever runs the check.
 */
function embedDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  const h = d.getUTCHours();
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${d.getUTCFullYear()}, ` +
    `${hour12}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} ${h < 12 ? "AM" : "PM"} UTC`
  );
}

/**
 * The Discord embed `/bgcheck` posts.
 *
 * Built here, not in the bot, for the same reason the application embeds are:
 * the site owns what a record means, and a second renderer would be a second
 * opinion about somebody's history.
 *
 * The body is monospace on purpose: a background check is read like a form, so
 * every entry lays out the same labelled fields — Action Type, Reason, Date,
 * Department, Revocation — under a PLAYER INFO header, and a section with
 * nothing in it says so rather than vanishing.
 */
export function buildBackgroundEmbed(background, { memberName } = {}) {
  const clampBlock = (text, max = 1000) =>
    text.length > max ? `${text.slice(0, max - 1)}…` : text;

  // One record as the labelled block the reference lays out.
  const entry = (action) => {
    const revoked = action.voided
      ? `Revoked${action.voidReason ? ` — ${action.voidReason}` : ""}`
      : "Not Revoked";
    return [
      `Action Type: ${actionLabel(action.type)}`,
      `Reason:      ${action.reason || "—"}`,
      `Date:        ${embedDate(action.createdAt)}`,
      `Department:  ${bodyLabel(action.bodyId)}`,
      `Revocation:  ${revoked}`,
    ].join("\n");
  };

  // A whole section, always shown, wrapped in a code fence so it renders
  // monospace. "No records found." when the member has nothing of that kind.
  const section = (name, list) => {
    const body = list.length
      ? list.map(entry).join("\n\n")
      : "No records found.";
    return {
      name,
      value: `\`\`\`\n${clampBlock(body)}\n\`\`\``,
      inline: false,
    };
  };

  // Staff and department read as one list here — the entry names the department
  // itself, so the reviewer sees the whole verbal (or non-verbal) history in one
  // place rather than split across two headings.
  const verbal = [...background.verbal.staff, ...background.verbal.department].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );
  const nonVerbal = [...background.nonVerbal.staff, ...background.nonVerbal.department].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  );

  const severity = background.total === 0 ? "clean" : background.nonVerbal.total > 0 ? "heavy" : "light";

  const playerInfo = [
    `Name:       ${memberName || "Unknown"}`,
    `Discord ID: ${background.discordId}`,
    `Window:     last ${Math.round(background.windowDays / 30)} months`,
    `Summary:    ${background.total} active · ${background.voided.length} revoked`,
  ].join("\n");

  const fields = [
    section("🚨 NON-VERBAL DISCIPLINARY LOGS (last 6 mo)", nonVerbal),
    section("🗣️ VERBAL DISCIPLINARY LOGS (last 6 mo)", verbal),
  ];

  return {
    embeds: [
      {
        title: "Background Check Results",
        description:
          `**PLAYER INFO**\n\`\`\`\n${clampBlock(playerInfo)}\n\`\`\`\n` +
          `<@${background.discordId}> — ${background.headline}`,
        color: EMBED_COLORS[severity],
        fields,
        footer: { text: "Florida Roleplay · Disciplinary record" },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}
