/**
 * The support portal.
 *
 * A ticket is a conversation with a state attached. Members open one, staff work
 * it, and the two see different things: the member sees the public thread and
 * the status; staff also see internal notes, the assignment, and the tools for
 * changing either.
 *
 * The piece worth explaining is **response flows**. A support team answers the
 * same handful of questions endlessly, but the answer usually depends on one or
 * two follow-ups — "which server", "was it permanent". A flat library of canned
 * replies makes an agent find the right one; a flow asks them the follow-up and
 * hands them the answer. It is a tree of prompts whose leaves are reply text,
 * walked in the composer, and it inserts rather than sends — an agent always
 * gets to edit before a member reads it.
 *
 * Everything here is pure. Mirrored from client/src/lib/support.js.
 */

export const CONFIG_VERSION = 1;

/* ------------------------------------------------------------------ *
 * Status and priority
 * ------------------------------------------------------------------ */

/**
 * `open` is anything a member is waiting on. `pending` means the ball is back
 * with them — the distinction is what stops a queue filling with tickets nobody
 * can act on.
 */
export const TICKET_STATUSES = [
  { id: "open", label: "Open", tone: "brand", detail: "Waiting on the support team." },
  { id: "pending", label: "Waiting on member", tone: "amber", detail: "We have asked something and are waiting for an answer." },
  { id: "escalated", label: "Escalated", tone: "violet", detail: "Passed up — needs somebody more senior." },
  { id: "resolved", label: "Resolved", tone: "green", detail: "Answered. The member can still reply." },
  { id: "closed", label: "Closed", tone: "slate", detail: "Finished. Reopening takes a staff member." },
];

export const STATUS_MAP = Object.fromEntries(TICKET_STATUSES.map((s) => [s.id, s]));
export const OPEN_STATUSES = ["open", "pending", "escalated"];

export function statusLabel(id) {
  return STATUS_MAP[id]?.label ?? id;
}
export function statusTone(id) {
  return STATUS_MAP[id]?.tone ?? "slate";
}
export function isTicketOpen(status) {
  return OPEN_STATUSES.includes(status);
}

export const PRIORITIES = [
  { id: "low", label: "Low", tone: "slate" },
  { id: "normal", label: "Normal", tone: "brand" },
  { id: "high", label: "High", tone: "amber" },
  { id: "urgent", label: "Urgent", tone: "rose" },
];

export const PRIORITY_MAP = Object.fromEntries(PRIORITIES.map((p) => [p.id, p]));

/* ------------------------------------------------------------------ *
 * Ticket types
 * ------------------------------------------------------------------ */

/**
 * What a member picks when they open one. Each type carries its own intake
 * fields, so a ban appeal asks for the ban reason and a bug report asks what
 * they were doing — rather than one box labelled "describe your issue" that
 * every reply then has to chase details for.
 *
 * These are now *configuration*, not code: the list below is only the default
 * catalogue an install starts with. Directorship edits it on the ticket-category
 * page, and every consumer takes the live list as an argument so a renamed or
 * newly added category is honoured everywhere. `DEFAULT_TICKET_TYPES` remains the
 * fallback used when the live config has not loaded (or there is no database).
 *
 * Access is described by three fields rather than the old single `restrictedTo`:
 *   - `openPermission`  the permission required to *open* it; null means anyone
 *     signed in (support that only answers people who already hold a role is not
 *     support).
 *   - `workPermissions` the permissions that let somebody *see and work* it. A
 *     department category lists that department's support permission, which is
 *     what routes an FHP ticket to FHP command.
 *   - `exclusive`       when true, ONLY the listed work permissions may work it,
 *     and the central support team (`support.work`) does not see it. This is what
 *     keeps a report about the staff team away from the staff team. When false,
 *     `support.work`/`support.manage` see it in addition to the listed roles.
 */
export const DEFAULT_TICKET_TYPES = [
  {
    id: "general",
    label: "General question",
    icon: "LifeBuoy",
    tone: "brand",
    blurb: "Anything that does not fit the others.",
    enabled: true,
    openPermission: null,
    workPermissions: [],
    exclusive: false,
    fields: [],
  },
  {
    id: "ban_appeal",
    label: "Ban appeal",
    icon: "Gavel",
    tone: "rose",
    blurb: "Appeal a ban from the game server or the Discord.",
    enabled: true,
    openPermission: null,
    workPermissions: [],
    exclusive: false,
    fields: [
      { id: "where", label: "Where were you banned?", type: "select", options: ["FiveM server", "Discord", "Both"], required: true },
      { id: "when", label: "Roughly when?", type: "date", required: true },
      { id: "reason_given", label: "What reason were you given?", type: "short", required: true },
    ],
  },
  {
    id: "player_report",
    label: "Report a player",
    icon: "Siren",
    tone: "amber",
    blurb: "Rulebreaking, harassment, or anything you want staff to look at.",
    enabled: true,
    openPermission: null,
    workPermissions: [],
    exclusive: false,
    fields: [
      { id: "who", label: "Who are you reporting?", type: "short", required: true, help: "Their name in game, or their Discord." },
      { id: "when", label: "When did it happen?", type: "short", required: true },
      { id: "evidence", label: "Link to evidence", type: "short", required: false, help: "A clip or screenshot. Optional but it decides most reports." },
    ],
  },
  {
    id: "staff_report",
    label: "Report a staff member",
    icon: "Shield",
    tone: "rose",
    blurb: "Goes to the directorship, not to the staff team.",
    enabled: true,
    // Anyone may open one, but only the directorship works it: a report about the
    // staff team that the staff team triages is not a report.
    openPermission: null,
    workPermissions: ["support.escalated"],
    exclusive: true,
    fields: [
      { id: "who", label: "Which staff member?", type: "short", required: true },
      { id: "evidence", label: "Link to evidence", type: "short", required: false },
    ],
  },
  {
    id: "bug",
    label: "Bug or technical issue",
    icon: "Wrench",
    tone: "primary",
    blurb: "Something on the server or the site is broken.",
    enabled: true,
    openPermission: null,
    workPermissions: [],
    exclusive: false,
    fields: [
      { id: "where", label: "Where did it happen?", type: "select", options: ["In game", "On the website", "In Discord"], required: true },
      { id: "steps", label: "What were you doing?", type: "paragraph", required: true },
    ],
  },
  {
    id: "billing",
    label: "Store or donation",
    icon: "Store",
    tone: "green",
    blurb: "A purchase that did not arrive, or a question about one.",
    enabled: true,
    openPermission: null,
    workPermissions: [],
    exclusive: false,
    fields: [
      { id: "order", label: "Order or transaction ID", type: "short", required: false },
    ],
  },
  {
    id: "dept_fhp",
    label: "FHP — Florida Highway Patrol",
    icon: "Car",
    tone: "amber",
    blurb: "A question or request for Florida Highway Patrol command.",
    enabled: true,
    openPermission: null,
    workPermissions: ["support.fhp"],
    exclusive: false,
    fields: [
      { id: "callsign", label: "Your in-game name or callsign", type: "short", required: false },
    ],
  },
  {
    id: "dept_mpd",
    label: "MPD — Miami Police Department",
    icon: "Siren",
    tone: "sky",
    blurb: "A question or request for Miami Police Department command.",
    enabled: true,
    openPermission: null,
    workPermissions: ["support.mpd"],
    exclusive: false,
    fields: [
      { id: "callsign", label: "Your in-game name or callsign", type: "short", required: false },
    ],
  },
  {
    id: "dept_bcso",
    label: "BCSO — Broward County Sheriff's Office",
    icon: "Shield",
    tone: "green",
    blurb: "A question or request for Broward County Sheriff's Office command.",
    enabled: true,
    openPermission: null,
    workPermissions: ["support.bcso"],
    exclusive: false,
    fields: [
      { id: "callsign", label: "Your in-game name or callsign", type: "short", required: false },
    ],
  },
  {
    id: "dept_civilian",
    label: "Civilian Department",
    icon: "Users",
    tone: "brand",
    blurb: "A civilian-side question, request or record change.",
    enabled: true,
    openPermission: null,
    workPermissions: ["support.civilian"],
    exclusive: false,
    fields: [
      { id: "character", label: "Which character is this about?", type: "short", required: false },
    ],
  },
  {
    id: "directorship",
    label: "Staff / Directorship",
    icon: "Crown",
    tone: "violet",
    blurb: "A community-level matter for the directorship.",
    enabled: true,
    openPermission: null,
    workPermissions: ["support.escalated"],
    exclusive: true,
    fields: [],
  },
];

/** Back-compatible aliases: the default catalogue, used as a display fallback. */
export const TICKET_TYPES = DEFAULT_TICKET_TYPES;

/** A `{id: type}` map over a types list (defaults to the built-in catalogue). */
export function typeMapOf(types = DEFAULT_TICKET_TYPES) {
  return Object.fromEntries((types ?? []).map((t) => [t.id, t]));
}

export const TYPE_MAP = typeMapOf(DEFAULT_TICKET_TYPES);

export function typeLabel(id, types = DEFAULT_TICKET_TYPES) {
  return typeMapOf(types)[id]?.label ?? id;
}

/** Normalises a permission value into a Set. */
function permSet(permissions) {
  return permissions instanceof Set ? permissions : new Set(permissions ?? []);
}

/** Whether this caller may open a ticket of this type. */
export function canOpenType(type, permissions) {
  if (!type || type.enabled === false) return false;
  if (!type.openPermission) return true;
  return permSet(permissions).has(type.openPermission);
}

/** Whether this caller may see and work a ticket of this type. */
export function canWorkType(type, permissions) {
  if (!type) return false;
  const perms = permSet(permissions);
  const listed = (type.workPermissions ?? []).some((key) => perms.has(key));
  if (type.exclusive) return listed;
  return listed || perms.has("support.work") || perms.has("support.manage");
}

/** The types this caller may open, from the live catalogue. */
export function typesFor({ permissions = new Set(), types = DEFAULT_TICKET_TYPES } = {}) {
  const perms = permSet(permissions);
  return (types ?? []).filter((type) => canOpenType(type, perms));
}

/* ------------------------------------------------------------------ *
 * Access
 * ------------------------------------------------------------------ */

/**
 * Anybody who works tickets rather than only raising them. That is the central
 * support team (`support.work`/`support.manage`) *and* anyone who holds a work
 * permission that some category routes to — a department commander works their
 * own department's queue without being on the support team.
 */
export function isAgent({ permissions = new Set() } = {}, types = DEFAULT_TICKET_TYPES) {
  const perms = permSet(permissions);
  if (perms.has("support.work") || perms.has("support.manage")) return true;
  return (types ?? []).some((type) => (type.workPermissions ?? []).some((key) => perms.has(key)));
}

/** The senior tier: staff reports, reassignment across the team, flow editing. */
export function isSupportLead({ permissions = new Set() } = {}) {
  const perms = permSet(permissions);
  return perms.has("support.manage");
}

/** Whether this caller may edit the ticket-category catalogue. */
export function canConfigureTypes({ permissions = new Set() } = {}) {
  return permSet(permissions).has("support.configure");
}

/**
 * Whether a caller may see this ticket. The opener always may; otherwise it is
 * whoever may work the ticket's category — which routes a department ticket to
 * that department, and keeps a staff report to the directorship.
 */
export function canViewTicket(ticket, ctx = {}, types = DEFAULT_TICKET_TYPES) {
  if (!ticket) return false;
  const perms = permSet(ctx.permissions);
  if (ticket.openedByDiscordId && ticket.openedByDiscordId === ctx.user?.id) return true;
  return canWorkType(typeMapOf(types)[ticket.type], perms);
}

/** Whether a caller may change status, assign, or write internal notes. */
export function canWorkTicket(ticket, ctx = {}, types = DEFAULT_TICKET_TYPES) {
  if (!ticket) return false;
  return canWorkType(typeMapOf(types)[ticket.type], permSet(ctx.permissions));
}

/* ------------------------------------------------------------------ *
 * Opening one
 * ------------------------------------------------------------------ */

const str = (v, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");

/** What is wrong with a new ticket, keyed by field. */
export function validateTicket(draft, types = DEFAULT_TICKET_TYPES) {
  const errors = {};
  const type = typeMapOf(types)[draft?.type];
  if (!type) errors.type = "Pick what this is about.";
  const subject = str(draft?.subject).trim();
  if (subject.length < 4) errors.subject = "Give it a subject.";
  const body = str(draft?.body).trim();
  if (body.length < 20) errors.body = "Tell us what is going on — a sentence or two at least.";

  for (const field of type?.fields ?? []) {
    if (!field.required) continue;
    const value = draft?.details?.[field.id];
    if (value == null || String(value).trim() === "") {
      errors[`details.${field.id}`] = "This one is required.";
    }
  }
  return { errors, ok: Object.keys(errors).length === 0 };
}

/** Keeps only the intake fields this type actually declares. */
export function cleanDetails(typeId, raw = {}, types = DEFAULT_TICKET_TYPES) {
  const type = typeMapOf(types)[typeId];
  if (!type) return {};
  const out = {};
  for (const field of type.fields) {
    const value = raw[field.id];
    if (value == null || String(value).trim() === "") continue;
    if (field.type === "select" && !field.options.includes(String(value))) continue;
    out[field.id] = str(value, 1000);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Category configuration
 * ------------------------------------------------------------------ *
 *
 * The ticket-category page edits the catalogue above. Everything here keeps a
 * stored or user-edited category safe to trust: the display fields are clamped,
 * the intake fields are re-shaped, and the access fields are coerced to the
 * three-field model so a document that pre-dates a field still loads.
 */

/** Icons offered in the category editor. All resolve in the icon registry. */
export const TICKET_ICON_CHOICES = [
  "LifeBuoy", "Gavel", "Siren", "Shield", "Wrench", "Store", "Car", "Users",
  "Building2", "Radio", "Scale", "Crown", "Award", "ClipboardList", "ScrollText",
  "Briefcase", "Flame", "Heart", "Mail", "Newspaper", "Tag", "UserCog", "Stethoscope",
];

/** Tones offered in the category editor. */
export const TICKET_TONE_CHOICES = ["brand", "sky", "green", "amber", "rose", "violet", "primary", "slate"];

/** Intake-field input types. */
export const FIELD_TYPES = [
  { id: "short", label: "Short text" },
  { id: "paragraph", label: "Paragraph" },
  { id: "select", label: "Dropdown" },
  { id: "date", label: "Date" },
];

const FIELD_TYPE_IDS = FIELD_TYPES.map((f) => f.id);

/** A slug safe to use as a stored category id. */
function slugId(value, fallback) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

export function blankTicketType(overrides = {}) {
  return {
    id: overrides.id ?? localId("type"),
    label: "",
    icon: "LifeBuoy",
    tone: "brand",
    blurb: "",
    enabled: true,
    openPermission: null,
    workPermissions: [],
    exclusive: false,
    fields: [],
    ...overrides,
  };
}

export function blankTicketField(overrides = {}) {
  return { id: localId("f"), label: "", type: "short", required: false, options: [], help: "", ...overrides };
}

function normalizeField(raw, index) {
  const type = FIELD_TYPE_IDS.includes(raw?.type) ? raw.type : "short";
  const field = {
    id: slugId(raw?.id, `field_${index + 1}`),
    label: str(raw?.label, 120),
    type,
    required: raw?.required === true,
    help: str(raw?.help, 200),
  };
  if (type === "select") {
    field.options = (Array.isArray(raw?.options) ? raw.options : [])
      .slice(0, 25)
      .map((option) => str(option, 100).trim())
      .filter(Boolean);
  }
  return field;
}

export function normalizeTicketType(raw, index = 0) {
  const tone = TICKET_TONE_CHOICES.includes(raw?.tone) ? raw.tone : "brand";
  const icon = TICKET_ICON_CHOICES.includes(raw?.icon) ? raw.icon : "LifeBuoy";
  const open = str(raw?.openPermission, 64).trim();
  // Legacy: a `restrictedTo` category becomes an exclusive, restricted one.
  const legacy = str(raw?.restrictedTo, 64).trim();
  return {
    id: slugId(raw?.id, `type_${index + 1}`),
    label: str(raw?.label, 80),
    icon,
    tone,
    blurb: str(raw?.blurb, 240),
    enabled: raw?.enabled !== false,
    openPermission: open || (legacy || null),
    workPermissions: Array.isArray(raw?.workPermissions)
      ? [...new Set(raw.workPermissions.map((k) => str(k, 64).trim()).filter(Boolean))].slice(0, 12)
      : legacy
        ? [legacy]
        : [],
    exclusive: raw?.exclusive === true || Boolean(legacy && !raw?.workPermissions),
    fields: (Array.isArray(raw?.fields) ? raw.fields : []).slice(0, 25).map(normalizeField),
  };
}

export function normalizeTicketTypes(list) {
  const types = (Array.isArray(list) ? list : []).slice(0, 60).map(normalizeTicketType);
  // Drop entries that lost their id, and de-duplicate by id (last wins).
  const byId = new Map();
  for (const type of types) {
    if (type.id) byId.set(type.id, type);
  }
  return [...byId.values()];
}

/** Problems with a category, for the editor to render beside its save button. */
export function validateTicketType(type) {
  const problems = [];
  if (!type.label?.trim()) problems.push("The category needs a name.");
  if (!type.id?.trim()) problems.push("The category needs an id.");
  for (const field of type.fields ?? []) {
    if (!field.label?.trim()) problems.push("An intake field has no label.");
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      problems.push(`"${field.label || "A dropdown"}" has no options.`);
    }
  }
  if (type.exclusive && (type.workPermissions ?? []).length === 0) {
    problems.push(
      `"${type.label || "This category"}" is restricted but names no role that can work it — nobody but Ownership would see it.`,
    );
  }
  return problems;
}

/* ------------------------------------------------------------------ *
 * Response flows
 * ------------------------------------------------------------------ */

let sequence = 0;
function localId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  sequence += 1;
  return `${prefix}_${sequence.toString(36)}${Date.now().toString(36)}`;
}

/**
 * A flow is a tree of nodes.
 *
 * `prompt` nodes ask the agent something and offer choices; `reply` nodes carry
 * the text that gets inserted. A choice points at the next node by id, so the
 * tree is stored flat and rendered by walking it — which is what lets the
 * builder show it as an outline rather than as nested JSON nobody can edit.
 */
export const NODE_TYPES = ["prompt", "reply"];

export function blankNode(type = "reply") {
  return type === "prompt"
    ? { id: localId("n"), type: "prompt", label: "", choices: [] }
    : { id: localId("n"), type: "reply", label: "", body: "" };
}

export function blankFlow(overrides = {}) {
  const root = blankNode("prompt");
  root.label = "What is this about?";
  return {
    version: CONFIG_VERSION,
    id: overrides.id ?? localId("flow"),
    name: overrides.name ?? "",
    ticketTypes: [],
    enabled: false,
    rootId: root.id,
    nodes: [root],
    ...overrides,
  };
}

export function normalizeFlow(raw) {
  const nodes = (Array.isArray(raw?.nodes) ? raw.nodes : [])
    .slice(0, 200)
    .map((node) => {
      const type = NODE_TYPES.includes(node?.type) ? node.type : "reply";
      const base = { id: str(node?.id, 64) || localId("n"), type, label: str(node?.label, 200) };
      if (type === "prompt") {
        return {
          ...base,
          choices: (Array.isArray(node?.choices) ? node.choices : []).slice(0, 12).map((choice) => ({
            label: str(choice?.label, 120),
            nextId: str(choice?.nextId, 64),
          })),
        };
      }
      return { ...base, body: str(node?.body, 4000) };
    });

  const ids = new Set(nodes.map((n) => n.id));
  return {
    version: CONFIG_VERSION,
    id: str(raw?.id, 64) || localId("flow"),
    name: str(raw?.name, 120),
    ticketTypes: (Array.isArray(raw?.ticketTypes) ? raw.ticketTypes : []).filter((t) => TYPE_MAP[t]),
    enabled: raw?.enabled === true,
    rootId: ids.has(raw?.rootId) ? raw.rootId : (nodes[0]?.id ?? ""),
    nodes,
  };
}

export function nodeById(flow, id) {
  return (flow?.nodes ?? []).find((node) => node.id === id) ?? null;
}

/**
 * What is wrong with a flow, as a list the builder renders beside its save
 * button. A choice pointing at a node that no longer exists is the failure that
 * matters — it dead-ends an agent mid-conversation with a member.
 */
export function validateFlow(flow) {
  const problems = [];
  const add = (level, message) => problems.push({ level, message });

  if (!flow.name.trim()) add("error", "The flow needs a name.");
  if (!flow.nodes.length) add("error", "The flow has no steps.");
  if (!nodeById(flow, flow.rootId)) add("error", "The flow has no starting step.");

  const ids = new Set(flow.nodes.map((n) => n.id));
  for (const node of flow.nodes) {
    if (!node.label.trim()) add("error", `A ${node.type} has no label.`);
    if (node.type === "prompt") {
      if (!node.choices.length) add("error", `"${node.label || "Untitled"}" offers no choices.`);
      for (const choice of node.choices) {
        if (!choice.label.trim()) add("error", `A choice under "${node.label}" has no label.`);
        if (!choice.nextId) add("error", `"${choice.label || "A choice"}" does not lead anywhere.`);
        else if (!ids.has(choice.nextId)) {
          add("error", `"${choice.label}" points at a step that no longer exists.`);
        }
      }
    } else if (!node.body.trim()) {
      add("warning", `"${node.label || "Untitled"}" has no reply text.`);
    }
  }

  // A node nothing points at and which is not the root is unreachable — not
  // broken, but the agent will never see it, which is usually a mistake.
  const pointedAt = new Set(
    flow.nodes.flatMap((n) => (n.type === "prompt" ? n.choices.map((c) => c.nextId) : [])),
  );
  for (const node of flow.nodes) {
    if (node.id !== flow.rootId && !pointedAt.has(node.id)) {
      add("warning", `"${node.label || "Untitled"}" cannot be reached from the start.`);
    }
  }
  return problems;
}

/** The flows offered on a ticket of this type. */
export function flowsFor(flows, typeId) {
  return (flows ?? []).filter(
    (flow) => flow.enabled && (!flow.ticketTypes.length || flow.ticketTypes.includes(typeId)),
  );
}

/** `{key}` substitution in a reply, from the ticket it is being sent on. */
export function fillReply(body, ticket, agent) {
  const vars = {
    user: ticket?.openedByName ?? "there",
    ticket: ticket?.id ?? "",
    subject: ticket?.subject ?? "",
    agent: agent?.displayName ?? agent?.username ?? "",
  };
  return String(body ?? "").replace(/\{(\w+)\}/g, (whole, key) =>
    vars[key] != null ? String(vars[key]) : whole,
  );
}

export const REPLY_VARIABLES = [
  { key: "user", detail: "The member who opened it" },
  { key: "ticket", detail: "The ticket reference" },
  { key: "subject", detail: "Its subject line" },
  { key: "agent", detail: "Your own name" },
];

/** A short human-quotable reference. */
export function makeTicketId(now = new Date(), random = Math.random) {
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, "");
  const tail = Math.floor(random() * 46_656).toString(36).toUpperCase().padStart(3, "0");
  return `TKT-${stamp}-${tail}`;
}
