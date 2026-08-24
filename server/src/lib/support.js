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
 * TODO: these are the shape, not the final list. Edit them once the support
 * team has run the portal for a week and knows what it actually receives.
 */
export const TICKET_TYPES = [
  {
    id: "general",
    label: "General question",
    icon: "LifeBuoy",
    tone: "brand",
    blurb: "Anything that does not fit the others.",
    fields: [],
  },
  {
    id: "ban_appeal",
    label: "Ban appeal",
    icon: "Gavel",
    tone: "rose",
    blurb: "Appeal a ban from the game server or the Discord.",
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
    fields: [
      { id: "who", label: "Who are you reporting?", type: "short", required: true, help: "Their name in game, or their Discord." },
      { id: "when", label: "When did it happen?", type: "short", required: true },
      { id: "evidence", label: "Link to evidence", type: "short", required: false, help: "A clip or screenshot. Optional but it decides most reports." },
    ],
  },
  {
    id: "staff_report",
    label: "Report a staff member",
    icon: "ShieldAlert",
    tone: "rose",
    blurb: "Goes to the directorship, not to the staff team.",
    // Only the directorship sees these. A report about a staff member that the
    // staff team triages is not a report.
    restrictedTo: "support.escalated",
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
    fields: [
      { id: "order", label: "Order or transaction ID", type: "short", required: false },
    ],
  },
];

export const TYPE_MAP = Object.fromEntries(TICKET_TYPES.map((t) => [t.id, t]));

export function typeLabel(id) {
  return TYPE_MAP[id]?.label ?? id;
}

/** The types this caller may open. Most are open to everyone. */
export function typesFor({ permissions = new Set() } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  return TICKET_TYPES.filter((type) => !type.restrictedTo || perms.has(type.restrictedTo));
}

/* ------------------------------------------------------------------ *
 * Access
 * ------------------------------------------------------------------ */

/** Anybody who works tickets rather than only raising them. */
export function isAgent({ permissions = new Set() } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  return perms.has("support.work") || perms.has("support.manage");
}

/** The senior tier: staff reports, reassignment across the team, flow editing. */
export function isSupportLead({ permissions = new Set() } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  return perms.has("support.manage");
}

/**
 * Whether a caller may open this ticket.
 *
 * A staff report is the exception that shapes this: it is worked only by
 * whoever holds `support.escalated`, so an ordinary agent must not see it even
 * though they work every other queue.
 */
export function canViewTicket(ticket, ctx = {}) {
  if (!ticket) return false;
  const perms = ctx.permissions instanceof Set ? ctx.permissions : new Set(ctx.permissions ?? []);
  if (ticket.openedByDiscordId && ticket.openedByDiscordId === ctx.user?.id) return true;
  const type = TYPE_MAP[ticket.type];
  if (type?.restrictedTo) return perms.has(type.restrictedTo);
  return isAgent({ permissions: perms });
}

/** Whether a caller may change status, assign, or write internal notes. */
export function canWorkTicket(ticket, ctx = {}) {
  if (!ticket) return false;
  const perms = ctx.permissions instanceof Set ? ctx.permissions : new Set(ctx.permissions ?? []);
  const type = TYPE_MAP[ticket.type];
  if (type?.restrictedTo) return perms.has(type.restrictedTo);
  return isAgent({ permissions: perms });
}

/* ------------------------------------------------------------------ *
 * Opening one
 * ------------------------------------------------------------------ */

const str = (v, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");

/** What is wrong with a new ticket, keyed by field. */
export function validateTicket(draft) {
  const errors = {};
  const type = TYPE_MAP[draft?.type];
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
export function cleanDetails(typeId, raw = {}) {
  const type = TYPE_MAP[typeId];
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
