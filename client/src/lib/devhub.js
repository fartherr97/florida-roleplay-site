/**
 * The Development Hub.
 *
 * A development request is a ticket with a build attached: a member asks for a
 * personal vehicle, a department livery, a fleet change, a script — and the dev
 * team works it to done. It reuses the shape of a support ticket (a typed intake
 * form, a status, a thread) but its own vocabulary: request categories, a Tebex
 * email, a vehicle link, requested liveries, and an approval before anyone buys
 * anything.
 *
 * Everything here is pure. Mirrored at server/src/lib/devhub.js.
 */

/* ------------------------------------------------------------------ *
 * Status
 * ------------------------------------------------------------------ */

/**
 * A request opens `pending` — nothing is bought until the team approves it,
 * which is the whole point of the auto-reply. From there it is worked
 * (`in_progress`) and finished (`completed`), or turned down (`denied`).
 */
export const DEV_STATUSES = [
  { id: "pending", label: "Pending approval", tone: "amber", detail: "With the dev team for review. Do not buy anything yet." },
  { id: "approved", label: "Approved", tone: "sky", detail: "Cleared to proceed — follow the team's instructions." },
  { id: "in_progress", label: "In progress", tone: "brand", detail: "Being built right now." },
  { id: "completed", label: "Completed", tone: "green", detail: "Done and delivered. You can still reply." },
  { id: "denied", label: "Denied", tone: "rose", detail: "Turned down. The reason is in the thread." },
  { id: "closed", label: "Closed", tone: "slate", detail: "Finished. Reopening takes a team member." },
];

export const DEV_STATUS_MAP = Object.fromEntries(DEV_STATUSES.map((s) => [s.id, s]));
export const OPEN_DEV_STATUSES = ["pending", "approved", "in_progress"];

export function devStatusLabel(id) {
  return DEV_STATUS_MAP[id]?.label ?? id;
}
export function devStatusTone(id) {
  return DEV_STATUS_MAP[id]?.tone ?? "slate";
}
export function isDevOpen(status) {
  return OPEN_DEV_STATUSES.includes(status);
}

export const DEV_PRIORITIES = [
  { id: "low", label: "Low", tone: "slate" },
  { id: "normal", label: "Normal", tone: "brand" },
  { id: "high", label: "High", tone: "amber" },
  { id: "urgent", label: "Urgent", tone: "rose" },
];
export const DEV_PRIORITY_MAP = Object.fromEntries(DEV_PRIORITIES.map((p) => [p.id, p]));

/* ------------------------------------------------------------------ *
 * Request categories
 * ------------------------------------------------------------------ */

/**
 * What a member picks when they open a request. Each carries its own intake
 * fields, so a LEO personal vehicle asks for the department and liveries while a
 * dev request asks for a scope — rather than one box every reply has to chase.
 *
 * `openPermission` gates who may open it (null = anyone signed in). The dev team
 * (development.work) works them all.
 */
export const DEFAULT_REQUEST_TYPES = [
  {
    id: "leo_personal",
    label: "LEO Personal Vehicle",
    icon: "Car",
    tone: "sky",
    blurb: "A personal vehicle for a law-enforcement member — marked or unmarked.",
    enabled: true,
    openPermission: null,
    fields: [
      { id: "tebex_email", label: "Tebex email", type: "short", required: true, help: "The email tied to your Tebex purchases." },
      { id: "vehicle_link", label: "Vehicle link", type: "short", required: true, help: "Link to the vehicle you want." },
      { id: "department", label: "Department", type: "select", options: ["FHP", "BCSO", "MPD"], required: true },
      { id: "liveries", label: "Requested liveries", type: "short", required: false, help: "e.g. MARKED FHP, MARKED CIU." },
    ],
  },
  {
    id: "civ_personal",
    label: "Civilian Personal Vehicle",
    icon: "Car",
    tone: "green",
    blurb: "A personal vehicle for a civilian character.",
    enabled: true,
    openPermission: null,
    fields: [
      { id: "tebex_email", label: "Tebex email", type: "short", required: true },
      { id: "vehicle_link", label: "Vehicle link", type: "short", required: true },
      { id: "color", label: "Requested colour", type: "short", required: false },
      { id: "notes", label: "Notes", type: "paragraph", required: false },
    ],
  },
  {
    id: "supporter_personal",
    label: "Supporter Tier Vehicle",
    icon: "Star",
    tone: "violet",
    blurb: "Priority personal vehicle access for Diamond and Founder supporters.",
    enabled: true,
    openPermission: null,
    fields: [
      { id: "tebex_email", label: "Tebex email", type: "short", required: true },
      { id: "vehicle_link", label: "Vehicle link", type: "short", required: true },
      { id: "tier", label: "Supporter tier", type: "select", options: ["Diamond", "Founder"], required: true },
      { id: "notes", label: "Notes", type: "paragraph", required: false },
    ],
  },
  {
    id: "department_work",
    label: "Department Work",
    icon: "Building2",
    tone: "amber",
    blurb: "Department-wide fleet, livery or asset work.",
    enabled: true,
    openPermission: null,
    fields: [
      { id: "department", label: "Department", type: "select", options: ["FHP", "BCSO", "MPD", "Civilian"], required: true },
      { id: "work_type", label: "Type of work", type: "select", options: ["Livery", "Fleet vehicle", "MLO / map", "Script", "Other"], required: true },
      { id: "vehicle_link", label: "Vehicle / asset link", type: "short", required: false },
      { id: "liveries", label: "Requested liveries", type: "short", required: false },
    ],
  },
  {
    id: "personal_change",
    label: "Personal Change",
    icon: "Wrench",
    tone: "brand",
    blurb: "A change to a vehicle or asset you already have.",
    enabled: true,
    openPermission: null,
    fields: [
      { id: "what", label: "What needs changing?", type: "paragraph", required: true },
      { id: "vehicle_link", label: "Vehicle link", type: "short", required: false },
    ],
  },
  {
    id: "dev_request",
    label: "Development Request",
    icon: "Code",
    tone: "primary",
    blurb: "A script, resource or tooling request for the dev team.",
    enabled: true,
    openPermission: null,
    fields: [
      { id: "project", label: "Project name", type: "short", required: true },
      { id: "scope", label: "Scope", type: "paragraph", required: true, help: "What it should do, and where it fits." },
      { id: "priority", label: "How urgent?", type: "select", options: ["Low", "Normal", "High"], required: false },
    ],
  },
];

export function requestTypeMapOf(types = DEFAULT_REQUEST_TYPES) {
  return Object.fromEntries((types ?? []).map((t) => [t.id, t]));
}

export function requestTypeLabel(id, types = DEFAULT_REQUEST_TYPES) {
  return requestTypeMapOf(types)[id]?.label ?? id;
}

function permSet(permissions) {
  return permissions instanceof Set ? permissions : new Set(permissions ?? []);
}

/** Whether this caller may open a request of this type. */
export function canOpenRequest(type, permissions) {
  if (!type || type.enabled === false) return false;
  if (!type.openPermission) return true;
  return permSet(permissions).has(type.openPermission);
}

/** The dev team: works the queue, replies, changes status, assigns. */
export function isDevTeam({ permissions = new Set() } = {}) {
  const perms = permSet(permissions);
  return perms.has("development.work") || perms.has("development.manage");
}

/** Whether this caller may configure request types and the vehicle library. */
export function canManageDev({ permissions = new Set() } = {}) {
  return permSet(permissions).has("development.manage");
}

/* ------------------------------------------------------------------ *
 * Opening one
 * ------------------------------------------------------------------ */

const str = (v, max = 4000) => (typeof v === "string" ? v.slice(0, max) : "");

/** What is wrong with a new request, keyed by field. */
export function validateRequest(draft, types = DEFAULT_REQUEST_TYPES) {
  const errors = {};
  const type = requestTypeMapOf(types)[draft?.type];
  if (!type) errors.type = "Pick what this request is for.";
  const subject = str(draft?.subject).trim();
  if (subject.length < 4) errors.subject = "Give it a short title.";
  const body = str(draft?.body).trim();
  if (body.length < 15) errors.body = "Tell us what you need — a sentence or two at least.";

  for (const field of type?.fields ?? []) {
    if (!field.required) continue;
    const value = draft?.details?.[field.id];
    if (value == null || String(value).trim() === "") {
      errors[`details.${field.id}`] = "This one is required.";
    }
  }
  return { errors, ok: Object.keys(errors).length === 0 };
}

/** Keeps only the intake fields this type declares. */
export function cleanRequestDetails(typeId, raw = {}, types = DEFAULT_REQUEST_TYPES) {
  const type = requestTypeMapOf(types)[typeId];
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
 * The request-category page edits the catalogue above. Everything here keeps a
 * stored or user-edited category safe to trust: display fields clamped, intake
 * fields re-shaped, ids slugged.
 */

/** Icons offered in the editor. All resolve in the icon registry. */
export const REQUEST_ICON_CHOICES = [
  "Car", "Wrench", "Building2", "Code", "Star", "Siren", "Shield", "Users",
  "Store", "Image", "Radio", "ClipboardList", "Ticket", "LifeBuoy",
];

/** Tones offered in the editor. */
export const REQUEST_TONE_CHOICES = ["violet", "brand", "sky", "green", "amber", "rose", "primary", "slate"];

/** Intake-field input types. */
export const FIELD_TYPES = [
  { id: "short", label: "Short text" },
  { id: "paragraph", label: "Paragraph" },
  { id: "select", label: "Dropdown" },
  { id: "date", label: "Date" },
];
const FIELD_TYPE_IDS = FIELD_TYPES.map((f) => f.id);

let sequence = 0;
function localId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  sequence += 1;
  return `${prefix}_${sequence.toString(36)}${Date.now().toString(36)}`;
}

function slugId(value, fallback) {
  const slug = String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug || fallback;
}

export function blankRequestType(overrides = {}) {
  return {
    id: overrides.id ?? localId("type"),
    label: "",
    icon: "Wrench",
    tone: "violet",
    blurb: "",
    enabled: true,
    openPermission: null,
    fields: [],
    ...overrides,
  };
}

export function blankRequestField(overrides = {}) {
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

export function normalizeRequestType(raw, index = 0) {
  const tone = REQUEST_TONE_CHOICES.includes(raw?.tone) ? raw.tone : "violet";
  const icon = REQUEST_ICON_CHOICES.includes(raw?.icon) ? raw.icon : "Wrench";
  const open = str(raw?.openPermission, 64).trim();
  return {
    id: slugId(raw?.id, `type_${index + 1}`),
    label: str(raw?.label, 80),
    icon,
    tone,
    blurb: str(raw?.blurb, 240),
    enabled: raw?.enabled !== false,
    openPermission: open || null,
    fields: (Array.isArray(raw?.fields) ? raw.fields : []).slice(0, 25).map(normalizeField),
  };
}

export function normalizeRequestTypes(list) {
  const types = (Array.isArray(list) ? list : []).slice(0, 60).map(normalizeRequestType);
  const byId = new Map();
  for (const type of types) {
    if (type.id) byId.set(type.id, type);
  }
  return [...byId.values()];
}

/** Problems with a category, for the editor to render beside its save button. */
export function validateRequestType(type) {
  const problems = [];
  if (!type.label?.trim()) problems.push("The category needs a name.");
  if (!type.id?.trim()) problems.push("The category needs an id.");
  for (const field of type.fields ?? []) {
    if (!field.label?.trim()) problems.push("An intake field has no label.");
    if (field.type === "select" && (!field.options || field.options.length === 0)) {
      problems.push(`"${field.label || "A dropdown"}" has no options.`);
    }
  }
  return problems;
}

/* ------------------------------------------------------------------ *
 * Feedback
 * ------------------------------------------------------------------ */

export const FEEDBACK_TYPES = [
  { id: "suggestion", label: "Suggestion", tone: "brand" },
  { id: "bug", label: "Bug report", tone: "rose" },
  { id: "feature", label: "Feature request", tone: "violet" },
  { id: "other", label: "Other", tone: "slate" },
];
export const FEEDBACK_TYPE_MAP = Object.fromEntries(FEEDBACK_TYPES.map((t) => [t.id, t]));

export function validateFeedback(draft) {
  const errors = {};
  if (!FEEDBACK_TYPE_MAP[draft?.type]) errors.type = "Pick a type.";
  const title = str(draft?.title).trim();
  if (title.length < 4) errors.title = "Give it a title.";
  const body = str(draft?.body).trim();
  if (body.length < 15) errors.body = "Add a little more detail.";
  return { errors, ok: Object.keys(errors).length === 0 };
}

/** A short human-quotable reference, DEV-260827-A1 style. */
export function makeRequestId(now = new Date(), random = Math.random) {
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, "");
  const tail = Math.floor(random() * 46_656).toString(36).toUpperCase().padStart(3, "0");
  return `DEV-${stamp}-${tail}`;
}
