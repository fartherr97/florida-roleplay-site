/**
 * The Emergency Services transfer portal.
 *
 * Ported from fartherr97/es-transfer-portal, which was a standalone Next.js app
 * for SSRP. Three things changed in the move, and they are the reason this is a
 * port rather than a copy:
 *
 * 1. **Departments and ranks come from this community, not from a list in the
 *    portal.** SSRP hard-coded four departments and invented rank ladders for
 *    them. Here the departments and every rank are read from ROLE_MAP, so a
 *    rank renamed on the Discord Role Mapping page is renamed here too and
 *    there is no second list to drift.
 * 2. **Access is this site's permission model.** The original resolved its own
 *    Discord roles into `isDeptHead` / `isManagement` through a role-map file
 *    of its own. Here a department head is that department's command role and
 *    management is `transfers.manage` — the same indirection every other gate
 *    on this site uses.
 * 3. **It is a section of the site, not an app.** One React app, one router,
 *    one design system, one session. The original carried its own Discord OAuth,
 *    its own top bar and its own button and input primitives; none of that
 *    survives the move, and none of it needed to.
 *
 * The ticket model itself is unchanged: dual approval, a public thread and a
 * staff-only thread, presence, and a history that is appended to and never
 * rewritten.
 *
 * Everything here is pure. Mirrored at server/src/lib/transferPortal.js.
 */
import { DEPARTMENTS, ROLE_MAP } from "../data/rosterData";

/* ------------------------------------------------------------------ *
 * Departments and ranks
 * ------------------------------------------------------------------ */

/**
 * The departments somebody can transfer between: law enforcement, fire and
 * federal. Civilian and management are not transferable postings.
 */
export const TRANSFER_DEPARTMENTS = DEPARTMENTS.filter((department) =>
  ["law", "fire", "federal"].includes(department.division),
).map((department) => ({
  id: department.id,
  abbr: department.abbr,
  label: department.label,
  tone: department.tone,
}));

export const TRANSFER_DEPARTMENT_IDS = TRANSFER_DEPARTMENTS.map((d) => d.id);

export function departmentFor(id) {
  return TRANSFER_DEPARTMENTS.find((d) => d.id === id) ?? null;
}

export function departmentLabel(id) {
  return departmentFor(id)?.label ?? id ?? "—";
}

export function departmentAbbr(id) {
  return departmentFor(id)?.abbr ?? String(id ?? "").toUpperCase();
}

/**
 * Every rank in a department, lowest first — straight off the role map, so this
 * is the same ladder the roster and the bot use.
 */
export function ranksFor(departmentId) {
  return ROLE_MAP.filter((role) => role.department === departmentId)
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((role) => ({ key: role.key, label: role.rankFull || role.rank, order: role.order }));
}

/** The command rank of a department — the one that signs transfers off. */
export function commandRankKey(departmentId) {
  const ranks = ranksFor(departmentId);
  return ranks.length ? ranks[ranks.length - 1].key : null;
}

/* ------------------------------------------------------------------ *
 * Status
 * ------------------------------------------------------------------ */

/**
 * pending → approved (both departments have signed) → completed → closed
 *         ↘ rejected (either department refuses)
 *
 * `approved` is not a decision anybody makes; it is what the ticket becomes
 * once the second signature lands. Nothing sets it directly.
 */
export const TRANSFER_STATUSES = ["pending", "approved", "completed", "rejected", "closed"];

export const STATUS_LABELS = {
  pending: "Pending review",
  approved: "Both approved",
  completed: "Completed",
  rejected: "Rejected",
  closed: "Closed",
};

export const STATUS_TONES = {
  pending: "amber",
  approved: "brand",
  completed: "green",
  rejected: "rose",
  closed: "slate",
};

/** A ticket nobody should be signing or processing any more. */
export const TERMINAL_STATUSES = ["completed", "rejected", "closed"];

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

/* ------------------------------------------------------------------ *
 * Who can do what
 * ------------------------------------------------------------------ */

/**
 * Management oversees every ticket. On SSRP this was a list of Discord role
 * ids; here it is a permission, so it is edited on the permissions page like
 * everything else.
 */
export function isManagement({ permissions = new Set() } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  return perms.has("transfers.manage");
}

/**
 * The departments this caller is head of. A department head is whoever holds
 * that department's command role — Colonel, Sheriff, Chief of Police, Fire
 * Chief, Director — which is the same rule the application builder uses.
 */
export function headOf({ roleKeys = [] } = {}) {
  const held = new Set(roleKeys);
  return TRANSFER_DEPARTMENT_IDS.filter((id) => {
    const command = commandRankKey(id);
    return command && held.has(command);
  });
}

/** Staff here means anybody who can act on somebody else's ticket. */
export function isStaff(ctx) {
  return isManagement(ctx) || headOf(ctx).length > 0;
}

/** True when this ticket is the caller's own transfer. */
export function isOwnTicket(ticket, { user } = {}) {
  if (!ticket || !user) return false;
  return Boolean(ticket.memberDiscordId) && ticket.memberDiscordId === user.id;
}

/**
 * Can this caller open the ticket at all?
 *
 * Management sees everything. A department head sees tickets where their
 * department is either side of the move — both of them have to sign, so both of
 * them have to read it. Everybody else sees only their own.
 */
export function canViewTicket(ticket, ctx) {
  if (!ticket) return false;
  if (isManagement(ctx)) return true;
  const mine = headOf(ctx);
  if (mine.includes(ticket.fromDept) || mine.includes(ticket.toDept)) return true;
  return isOwnTicket(ticket, ctx);
}

/**
 * The staff-only thread, and the buttons that change a ticket's state. The
 * transferee never gets either, however much of their own ticket they can read.
 */
export function canManageTicket(ticket, ctx) {
  if (!ticket) return false;
  if (isManagement(ctx)) return true;
  const mine = headOf(ctx);
  return mine.includes(ticket.fromDept) || mine.includes(ticket.toDept);
}

export const canUseInternal = canManageTicket;

/** Which side of this transfer the caller signs for, or null if neither. */
export function signingDepartmentFor(ticket, ctx) {
  if (!ticket) return null;
  const mine = headOf(ctx);
  if (mine.includes(ticket.fromDept)) return ticket.fromDept;
  if (mine.includes(ticket.toDept)) return ticket.toDept;
  // Management signs for whichever side has not signed yet — they oversee both.
  if (isManagement(ctx)) {
    const signed = new Set((ticket.approvals ?? []).map((a) => a.dept));
    if (!signed.has(ticket.fromDept)) return ticket.fromDept;
    if (!signed.has(ticket.toDept)) return ticket.toDept;
  }
  return null;
}

/** Only management ends a ticket or puts it back. */
export function canCloseTicket(ctx) {
  return isManagement(ctx);
}

/** The tickets a caller may see, out of all of them. */
export function visibleTickets(tickets, ctx) {
  return (tickets ?? []).filter((ticket) => canViewTicket(ticket, ctx));
}

/* ------------------------------------------------------------------ *
 * Approvals
 * ------------------------------------------------------------------ */

/** Both departments' signatures, in a shape the UI can render directly. */
export function approvalState(ticket) {
  const approvals = ticket?.approvals ?? [];
  const find = (dept) => approvals.find((a) => a.dept === dept) ?? null;
  const from = find(ticket?.fromDept);
  const to = find(ticket?.toDept);
  return {
    from,
    to,
    both: Boolean(from && to),
    outstanding: [
      !from ? ticket?.fromDept : null,
      !to ? ticket?.toDept : null,
    ].filter(Boolean),
  };
}

/**
 * Applies a signature and returns the ticket as it should now be.
 *
 * A department signing twice replaces its own entry rather than adding a
 * second, and the ticket only becomes `approved` when both are in and it has
 * not already moved past review. Pure, so the server writes exactly what the
 * client predicted.
 */
export function applyApproval(ticket, { dept, actorId, actorName, at }) {
  const approvals = [...(ticket.approvals ?? [])];
  const history = [...(ticket.history ?? [])];
  const stamp = at ?? new Date().toISOString();
  const entry = { dept, actorId: actorId ?? null, actorName: actorName ?? null, approvedAt: stamp };

  const existing = approvals.findIndex((a) => a.dept === dept);
  if (existing >= 0) {
    approvals[existing] = entry;
    history.push({ action: "approved", actor: actorName, details: `${departmentAbbr(dept)} updated their approval`, at: stamp });
  } else {
    approvals.push(entry);
    history.push({ action: "approved", actor: actorName, details: `${departmentAbbr(dept)} approved the transfer`, at: stamp });
  }

  const both =
    approvals.some((a) => a.dept === ticket.fromDept) && approvals.some((a) => a.dept === ticket.toDept);
  const status = both && !isTerminal(ticket.status) ? "approved" : ticket.status;

  return { ...ticket, approvals, history, status };
}

/** Withdrawing a signature drops the ticket back to pending if it had both. */
export function applyRevoke(ticket, { dept, actorName, at }) {
  const approvals = (ticket.approvals ?? []).filter((a) => a.dept !== dept);
  if (approvals.length === (ticket.approvals ?? []).length) return ticket;
  const stamp = at ?? new Date().toISOString();
  const history = [
    ...(ticket.history ?? []),
    { action: "revoked", actor: actorName, details: `${departmentAbbr(dept)} withdrew their approval`, at: stamp },
  ];
  const status = ticket.status === "approved" ? "pending" : ticket.status;
  return { ...ticket, approvals, history, status };
}

/* ------------------------------------------------------------------ *
 * Validation
 * ------------------------------------------------------------------ */

export const EMPLOYMENT_TYPES = [
  { id: "fulltime", label: "Full time" },
  { id: "parttime", label: "Part time" },
];

/** What is wrong with a new request, keyed by field. */
export function validateRequest(draft) {
  const errors = {};
  if (!String(draft?.memberName ?? "").trim()) errors.memberName = "Who is transferring?";
  if (!/^\d{17,20}$/.test(String(draft?.memberDiscordId ?? "").trim())) {
    errors.memberDiscordId = "A Discord ID is 17 to 20 digits.";
  }
  if (!TRANSFER_DEPARTMENT_IDS.includes(draft?.fromDept)) errors.fromDept = "Pick the department they are leaving.";
  if (!TRANSFER_DEPARTMENT_IDS.includes(draft?.toDept)) errors.toDept = "Pick the department they are joining.";
  if (draft?.fromDept && draft.fromDept === draft.toDept) {
    errors.toDept = "A transfer has to be between two different departments.";
  }
  if (!String(draft?.currentRank ?? "").trim()) errors.currentRank = "What rank do they hold now?";
  const reason = String(draft?.reason ?? "").trim();
  if (reason.length < 20) errors.reason = "Say why, in a sentence or two — the receiving department reads this.";
  return { errors, ok: Object.keys(errors).length === 0 };
}

/* ------------------------------------------------------------------ *
 * The Discord webhook
 * ------------------------------------------------------------------ */

/**
 * Each department can point new tickets at a Discord webhook of its own.
 *
 * A webhook is not the bot: it posts a message and nothing else. That is
 * exactly right here — a transfer is decided in this portal by two department
 * heads, so the Discord message is a notification, not a control surface, and
 * needs no buttons. (Where buttons *are* needed — applications — the bot owns
 * them, because a webhook cannot carry one.)
 */
export const WEBHOOK_VARIABLES = [
  { key: "member", detail: "The transferring member's name" },
  { key: "discord", detail: "Their Discord mention" },
  { key: "rank", detail: "The rank they hold now" },
  { key: "fromDept", detail: "The department they are leaving" },
  { key: "toDept", detail: "The department they are joining" },
  { key: "ticketId", detail: "The ticket reference" },
  { key: "reason", detail: "What they wrote in the reason box" },
];

export const DEFAULT_WEBHOOK = {
  url: "",
  username: "",
  avatarUrl: "",
  color: "",
  embedTitle: "Transfer request · {toDept}",
  embedDescription:
    "**{member}** ({discord}) has asked to transfer.\n\n**Leaving** {fromDept}\n**Joining** {toDept}\n**Current rank** {rank}\n\n{reason}",
  footer: "Florida Roleplay · Transfer Portal",
  footerIconUrl: "",
};

/** `{key}` substitution. An unknown key is left alone rather than blanked. */
export function interpolate(template, vars) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (whole, key) =>
    vars[key] != null ? String(vars[key]) : whole,
  );
}

/** The variables a template can use, taken off a ticket. */
export function webhookVars(ticket) {
  return {
    member: ticket.memberName ?? "",
    discord: ticket.memberDiscordId ? `<@${ticket.memberDiscordId}>` : "",
    rank: ticket.currentRank ?? "",
    fromDept: departmentLabel(ticket.fromDept),
    toDept: departmentLabel(ticket.toDept),
    ticketId: ticket.id ?? "",
    reason: ticket.reason ?? "",
  };
}

const TONE_COLORS = {
  brand: 0x3b82f6, green: 0x10b981, rose: 0xf43f5e,
  amber: 0xf59e0b, primary: 0xf2800d, slate: 0x94a3b8,
};

/**
 * The payload Discord receives. Built here so the settings preview and the
 * server's send agree exactly — including the truncation, which Discord would
 * otherwise apply silently.
 */
export function buildWebhookPayload(config, ticket) {
  const vars = webhookVars(ticket);
  const clamp = (value, max) => {
    const text = String(value ?? "");
    return text.length > max ? `${text.slice(0, max - 1)}…` : text;
  };

  const hex = String(config?.color ?? "").replace("#", "");
  const color = /^[0-9a-f]{6}$/i.test(hex)
    ? parseInt(hex, 16)
    : TONE_COLORS[departmentFor(ticket.toDept)?.tone] ?? TONE_COLORS.brand;

  const embed = {
    title: clamp(interpolate(config?.embedTitle, vars), 256) || undefined,
    description: clamp(interpolate(config?.embedDescription, vars), 4096) || undefined,
    color,
    timestamp: ticket.createdAt ?? new Date().toISOString(),
  };
  if (config?.footer || config?.footerIconUrl) {
    embed.footer = { text: clamp(config.footer ?? "", 2048) };
    if (config.footerIconUrl) embed.footer.icon_url = config.footerIconUrl;
  }

  const payload = { embeds: [embed] };
  if (config?.username) payload.username = clamp(config.username, 80);
  if (config?.avatarUrl) payload.avatar_url = config.avatarUrl;
  return payload;
}

/** A Discord webhook URL, or null. Anything else is refused rather than posted to. */
export function cleanWebhookUrl(value) {
  const url = String(value ?? "").trim();
  if (!url) return "";
  return /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(url) ? url : null;
}
