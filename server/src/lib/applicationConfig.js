/**
 * The application engine — one document describes a whole application, and both
 * the client and the server read it to decide what to render, what to accept and
 * what Discord receives.
 *
 * An application is deliberately not a form (src/lib/forms.js). A form is graded
 * and lives inside a hub for people who are already members; an application is
 * filled in by somebody who may hold no roles at all, is routed to a Discord
 * channel for a decision, and its outcome is a yes or a no rather than a score.
 * Sharing one document type would have meant every field carrying a `points`
 * value nobody uses and every application carrying a pass threshold that means
 * nothing.
 *
 * Everything here is pure so the two sides agree exactly. Mirrored at
 * server/src/lib/applicationConfig.js — change one, change the other.
 */

export const CONFIG_VERSION = 1;

/* ------------------------------------------------------------------ *
 * Fields
 * ------------------------------------------------------------------ */

/**
 * The field palette.
 *
 * `input` is how the renderer draws it, `options` marks the types that carry a
 * choice list, and `content` marks the ones that ask nothing — a heading or a
 * block of text the applicant only reads. `pattern` is a built-in format check
 * so the common identity fields validate without anybody writing a regex.
 */
export const FIELD_TYPES = [
  { type: "short", label: "Short answer", input: "text", detail: "One line of free text." },
  { type: "paragraph", label: "Paragraph", input: "textarea", detail: "Multiple lines — the workhorse of any application." },
  { type: "number", label: "Number", input: "number", detail: "A numeric answer, with an optional range." },
  { type: "email", label: "Email", input: "text", pattern: "email", detail: "Checked for a plausible address." },
  { type: "url", label: "Link", input: "text", pattern: "url", detail: "Checked for http or https." },
  { type: "discord", label: "Discord ID", input: "text", pattern: "discord", detail: "A 17–20 digit Discord user ID." },
  { type: "steam", label: "Steam hex / ID", input: "text", pattern: "steam", detail: "steam:110000… or a 17-digit SteamID64." },
  { type: "age", label: "Age", input: "number", detail: "A number of years, with a minimum you set." },
  { type: "date", label: "Date", input: "date", detail: "A calendar date." },
  { type: "time", label: "Time", input: "time", detail: "A time of day." },
  { type: "multiple", label: "Multiple choice", input: "radio", options: true, detail: "One answer from a list." },
  { type: "checkboxes", label: "Checkboxes", input: "checkbox", options: true, detail: "Any number of answers from a list." },
  { type: "dropdown", label: "Dropdown", input: "select", options: true, detail: "One answer, chosen from a menu." },
  { type: "scale", label: "Linear scale", input: "scale", detail: "A rating between two bounds." },
  { type: "agree", label: "Agreement", input: "agree", detail: "A statement the applicant must tick to continue." },
  { type: "availability", label: "Availability", input: "checkbox", options: true, detail: "Which days or shifts they can play." },
  { type: "heading", label: "Section heading", input: "none", content: true, detail: "A title inside the page. Asks nothing." },
  { type: "statement", label: "Statement", input: "none", content: true, detail: "A block of text to read. Asks nothing." },
];

export const FIELD_TYPE_MAP = Object.fromEntries(FIELD_TYPES.map((f) => [f.type, f]));

export function fieldHasOptions(type) {
  return FIELD_TYPE_MAP[type]?.options === true;
}

/** True for the types that render text and collect nothing. */
export function isContentField(type) {
  return FIELD_TYPE_MAP[type]?.content === true;
}

/** The built-in format checks, so the common identity fields need no regex. */
const PATTERNS = {
  email: { test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v), message: "That does not look like an email address." },
  url: { test: (v) => /^https?:\/\/\S+\.\S+/i.test(v), message: "Links must start with http:// or https://." },
  discord: { test: (v) => /^\d{17,20}$/.test(v), message: "A Discord ID is 17 to 20 digits." },
  steam: { test: (v) => /^(steam:[0-9a-f]{15,}|\d{17})$/i.test(v), message: "Use a steam: hex or a 17-digit SteamID64." },
};

/* ------------------------------------------------------------------ *
 * Blanks
 * ------------------------------------------------------------------ */

let sequence = 0;

/** Ids only have to be unique inside one document. */
function localId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
  }
  sequence += 1;
  return `${prefix}_${sequence.toString(36)}${Date.now().toString(36)}`;
}

export function blankField(type = "short") {
  const field = {
    id: localId("f"),
    type,
    label: "",
    help: "",
    required: !isContentField(type),
    placeholder: "",
  };
  if (fieldHasOptions(type)) field.options = ["Option 1", "Option 2"];
  if (type === "scale") Object.assign(field, { min: 1, max: 5, minLabel: "", maxLabel: "" });
  if (type === "age") field.min = 16;
  if (type === "availability") {
    field.options = ["Weekday mornings", "Weekday evenings", "Weekend mornings", "Weekend evenings", "Late night"];
  }
  if (type === "agree") field.label = "I confirm the above is accurate.";
  return field;
}

export function blankSection(title = "Untitled section") {
  return { id: localId("s"), title, description: "", fields: [] };
}

export function blankApplication(overrides = {}) {
  return {
    version: CONFIG_VERSION,
    id: overrides.id ?? localId("app"),
    slug: overrides.slug ?? "",
    title: overrides.title ?? "",
    summary: overrides.summary ?? "",
    departmentId: overrides.departmentId ?? "",
    subdivisionId: overrides.subdivisionId ?? "",
    icon: overrides.icon ?? "ClipboardList",
    tone: overrides.tone ?? "brand",
    status: "draft",
    sections: [blankSection("About you")],
    // Who may apply, and how often.
    requirements: {
      minAgeYears: 0,
      requireSignIn: true,
      requireRoleKeys: [],
      cooldownDays: 14,
      maxOpenSubmissions: 1,
    },
    // Everything Discord needs. Raw snowflakes, because these are enforced by
    // the bot inside Discord where role keys mean nothing.
    discord: {
      channelId: "",
      pingRoleIds: [],
      reviewerRoleIds: [],
      approvedRoleIds: [],
      mentionApplicant: true,
      embedColor: "",
      footer: "",
    },
    // What the applicant sees after submitting, and what happens next.
    outcome: {
      confirmation: "Your application is in. You will hear back in Discord.",
      approvedMessage: "",
      deniedMessage: "",
    },
    ...overrides,
  };
}

/* ------------------------------------------------------------------ *
 * Normalising
 * ------------------------------------------------------------------ */

const str = (v, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const bool = (v, fallback = false) => (typeof v === "boolean" ? v : fallback);
const int = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : fallback);

/** A list of Discord snowflakes, deduplicated, with anything malformed dropped. */
export function cleanRoleIds(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/[\s,]+/);
  return [...new Set(list.map((v) => String(v).trim()).filter((v) => /^\d{17,20}$/.test(v)))];
}

function normalizeField(raw) {
  const type = FIELD_TYPE_MAP[raw?.type] ? raw.type : "short";
  const field = {
    id: str(raw?.id, 64) || localId("f"),
    type,
    label: str(raw?.label, 300),
    help: str(raw?.help, 500),
    required: isContentField(type) ? false : bool(raw?.required, true),
    placeholder: str(raw?.placeholder, 120),
  };
  if (fieldHasOptions(type)) {
    field.options = (Array.isArray(raw?.options) ? raw.options : [])
      .map((o) => str(o, 200))
      .filter(Boolean)
      .slice(0, 40);
    if (!field.options.length) field.options = ["Option 1"];
  }
  if (type === "scale") {
    field.min = int(raw?.min, 1);
    field.max = Math.max(field.min + 1, int(raw?.max, 5));
    field.minLabel = str(raw?.minLabel, 60);
    field.maxLabel = str(raw?.maxLabel, 60);
  }
  if (type === "number" || type === "age") {
    if (raw?.min != null && raw.min !== "") field.min = int(raw.min, 0);
    if (raw?.max != null && raw.max !== "") field.max = int(raw.max, 0);
  }
  if (type === "short" || type === "paragraph") {
    if (raw?.minLength) field.minLength = Math.max(0, int(raw.minLength, 0));
    if (raw?.maxLength) field.maxLength = Math.max(1, int(raw.maxLength, 0));
  }
  // Conditional visibility: show this field only when another field's answer
  // matches. One condition per field on purpose — a rule builder that nests is
  // a rule builder nobody can read back six months later.
  if (raw?.showIf?.fieldId) {
    field.showIf = {
      fieldId: str(raw.showIf.fieldId, 64),
      equals: str(raw.showIf.equals, 200),
    };
  }
  return field;
}

function normalizeSection(raw) {
  return {
    id: str(raw?.id, 64) || localId("s"),
    title: str(raw?.title, 200) || "Untitled section",
    description: str(raw?.description, 800),
    fields: (Array.isArray(raw?.fields) ? raw.fields : []).slice(0, 60).map(normalizeField),
  };
}

export const APPLICATION_STATUSES = ["draft", "open", "closed"];

/** A stored document is never trusted — this is what makes it safe to render. */
export function normalizeApplication(raw) {
  const base = blankApplication();
  const req = raw?.requirements ?? {};
  const dc = raw?.discord ?? {};
  const out = raw?.outcome ?? {};
  return {
    version: CONFIG_VERSION,
    id: str(raw?.id, 64) || base.id,
    slug: slugify(str(raw?.slug, 64) || str(raw?.title, 64)),
    title: str(raw?.title, 200),
    summary: str(raw?.summary, 800),
    departmentId: str(raw?.departmentId, 32),
    subdivisionId: str(raw?.subdivisionId, 64),
    icon: str(raw?.icon, 40) || "ClipboardList",
    tone: str(raw?.tone, 20) || "brand",
    status: APPLICATION_STATUSES.includes(raw?.status) ? raw.status : "draft",
    sections: (Array.isArray(raw?.sections) ? raw.sections : []).slice(0, 20).map(normalizeSection),
    requirements: {
      minAgeYears: Math.max(0, int(req.minAgeYears, 0)),
      requireSignIn: bool(req.requireSignIn, true),
      requireRoleKeys: (Array.isArray(req.requireRoleKeys) ? req.requireRoleKeys : [])
        .map((k) => str(k, 64))
        .filter(Boolean)
        .slice(0, 40),
      cooldownDays: Math.max(0, int(req.cooldownDays, 0)),
      maxOpenSubmissions: Math.max(1, int(req.maxOpenSubmissions, 1)),
    },
    discord: {
      channelId: /^\d{17,20}$/.test(String(dc.channelId ?? "")) ? String(dc.channelId) : "",
      pingRoleIds: cleanRoleIds(dc.pingRoleIds),
      reviewerRoleIds: cleanRoleIds(dc.reviewerRoleIds),
      approvedRoleIds: cleanRoleIds(dc.approvedRoleIds),
      mentionApplicant: bool(dc.mentionApplicant, true),
      embedColor: /^#?[0-9a-f]{6}$/i.test(String(dc.embedColor ?? "")) ? String(dc.embedColor) : "",
      footer: str(dc.footer, 200),
    },
    outcome: {
      confirmation: str(out.confirmation, 600) || base.outcome.confirmation,
      approvedMessage: str(out.approvedMessage, 600),
      deniedMessage: str(out.deniedMessage, 600),
    },
  };
}

export function slugify(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/* ------------------------------------------------------------------ *
 * Builder-side validation
 * ------------------------------------------------------------------ */

/**
 * What is wrong with the document itself, as a list the builder renders beside
 * the publish button. Blocking problems are `error`; the rest are `warning`,
 * because an application with no ping role is odd but not broken.
 */
export const EMBED_FIELD_LIMIT = 25;

export function validateApplication(app) {
  const problems = [];
  const add = (level, message, tab) => problems.push({ level, message, tab });

  if (!app.title.trim()) add("error", "The application needs a title.", "basics");
  if (!app.slug) add("error", "The application needs a web address.", "basics");
  if (!app.departmentId) add("error", "Pick the department this application belongs to.", "basics");

  const fields = allFields(app);
  const asked = fields.filter((f) => !isContentField(f.type));
  if (!asked.length) add("error", "The application does not ask anything yet.", "fields");
  fields.forEach((field) => {
    if (!field.label.trim()) add("error", `A ${FIELD_TYPE_MAP[field.type].label.toLowerCase()} field has no question.`, "fields");
    if (fieldHasOptions(field.type) && field.options.length < 2) {
      add("warning", `"${field.label || "Untitled"}" only offers one choice.`, "fields");
    }
    if (field.showIf && !fields.some((f) => f.id === field.showIf.fieldId)) {
      add("error", `"${field.label || "Untitled"}" depends on a field that no longer exists.`, "fields");
    }
  });

  const ids = fields.map((f) => f.id);
  if (new Set(ids).size !== ids.length) add("error", "Two fields share an id.", "fields");

  // Discord shows at most 25 fields in an embed and drops the rest without
  // saying so. buildEmbed truncates to match; this is where somebody finds out.
  if (asked.length > EMBED_FIELD_LIMIT) {
    add(
      "warning",
      `${asked.length} questions, but a Discord embed only shows ${EMBED_FIELD_LIMIT}. The last ${asked.length - EMBED_FIELD_LIMIT} will not appear in the channel — reviewers would have to open the submission on the site.`,
      "fields",
    );
  }

  if (!app.discord.channelId) {
    add(app.status === "open" ? "error" : "warning", "No Discord channel, so submissions have nowhere to go.", "discord");
  }
  if (!app.discord.reviewerRoleIds.length) {
    add("warning", "No reviewer roles, so nobody in Discord can approve or deny.", "discord");
  }
  return problems;
}

/** Every field across every section, in order. */
export function allFields(app) {
  return (app?.sections ?? []).flatMap((section) => section.fields ?? []);
}

export function blockingProblems(app) {
  return validateApplication(app).filter((p) => p.level === "error");
}

/* ------------------------------------------------------------------ *
 * Filling one in
 * ------------------------------------------------------------------ */

/** True when a field's condition is met by the answers so far. */
export function fieldVisible(field, answers = {}) {
  if (!field?.showIf?.fieldId) return true;
  const value = answers[field.showIf.fieldId];
  const want = field.showIf.equals;
  if (Array.isArray(value)) return value.includes(want);
  if (typeof value === "boolean") return String(value) === want;
  return String(value ?? "") === want;
}

/** The sections and fields to render for the answers given so far. */
export function visibleSections(app, answers = {}) {
  return (app?.sections ?? [])
    .map((section) => ({ ...section, fields: (section.fields ?? []).filter((f) => fieldVisible(f, answers)) }))
    .filter((section) => section.fields.length > 0);
}

function isBlank(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "boolean") return value === false;
  return String(value).trim() === "";
}

/**
 * Checks the answers against the document. Returns `{ errors, answers }` where
 * errors is keyed by field id and answers is the cleaned set — hidden fields are
 * dropped, so a conditional branch the applicant never saw cannot smuggle a
 * value through.
 */
export function validateAnswers(app, raw = {}) {
  const errors = {};
  const answers = {};

  for (const field of allFields(app)) {
    if (isContentField(field.type)) continue;
    if (!fieldVisible(field, raw)) continue;

    const value = raw[field.id];
    if (isBlank(value)) {
      if (field.required) {
        errors[field.id] = field.type === "agree" ? "You have to agree to continue." : "This one is required.";
      }
      continue;
    }

    const spec = FIELD_TYPE_MAP[field.type];

    if (fieldHasOptions(field.type)) {
      const chosen = Array.isArray(value) ? value : [value];
      const unknown = chosen.filter((v) => !field.options.includes(String(v)));
      if (unknown.length) {
        errors[field.id] = "That is not one of the choices.";
        continue;
      }
      answers[field.id] = field.type === "checkboxes" || field.type === "availability" ? chosen.map(String) : String(chosen[0]);
      continue;
    }

    if (field.type === "agree") {
      answers[field.id] = true;
      continue;
    }

    if (spec.input === "number" || field.type === "scale") {
      const n = Number(value);
      if (!Number.isFinite(n)) {
        errors[field.id] = "Enter a number.";
        continue;
      }
      if (field.min != null && n < field.min) {
        errors[field.id] = field.type === "age" ? `You have to be at least ${field.min}.` : `Must be ${field.min} or more.`;
        continue;
      }
      if (field.max != null && n > field.max) {
        errors[field.id] = `Must be ${field.max} or less.`;
        continue;
      }
      answers[field.id] = n;
      continue;
    }

    const text = String(value).trim();
    if (spec.pattern && !PATTERNS[spec.pattern].test(text)) {
      errors[field.id] = PATTERNS[spec.pattern].message;
      continue;
    }
    if (field.minLength && text.length < field.minLength) {
      errors[field.id] = `At least ${field.minLength} characters — you have ${text.length}.`;
      continue;
    }
    if (field.maxLength && text.length > field.maxLength) {
      errors[field.id] = `At most ${field.maxLength} characters — you have ${text.length}.`;
      continue;
    }
    answers[field.id] = text.slice(0, 4000);
  }

  return { errors, answers, ok: Object.keys(errors).length === 0 };
}

/* ------------------------------------------------------------------ *
 * Submissions
 * ------------------------------------------------------------------ */

export const SUBMISSION_STATUSES = ["pending", "approved", "denied", "withdrawn"];

export function submissionTone(status) {
  return { pending: "amber", approved: "green", denied: "rose", withdrawn: "slate" }[status] ?? "slate";
}

/**
 * Whether somebody may apply, and why not when they may not. The cooldown is
 * measured from the last *decision*, not the last submission, so a pending
 * application does not also start the clock.
 */
export function canApply(app, { user, history = [], now = Date.now() } = {}) {
  if (app.status !== "open") return { ok: false, reason: "This application is not open right now." };
  if (app.requirements.requireSignIn && !user) {
    return { ok: false, reason: "Sign in with Discord first — it is how you get an answer." };
  }
  if (app.requirements.requireRoleKeys.length) {
    const held = new Set(user?.roles ?? []);
    if (!app.requirements.requireRoleKeys.some((key) => held.has(key))) {
      return { ok: false, reason: "Your Discord roles do not qualify you for this one yet." };
    }
  }
  const mine = history.filter((s) => s.applicationId === app.id);
  const open = mine.filter((s) => s.status === "pending");
  if (open.length >= app.requirements.maxOpenSubmissions) {
    return { ok: false, reason: "You already have one of these waiting on a decision." };
  }
  if (app.requirements.cooldownDays > 0) {
    const decided = mine
      .filter((s) => s.decidedAt && s.status === "denied")
      .map((s) => new Date(s.decidedAt).getTime())
      .filter((t) => Number.isFinite(t));
    const last = decided.length ? Math.max(...decided) : null;
    if (last != null) {
      const until = last + app.requirements.cooldownDays * 86_400_000;
      if (now < until) {
        const days = Math.ceil((until - now) / 86_400_000);
        return { ok: false, reason: `You can apply again in ${days} day${days === 1 ? "" : "s"}.` };
      }
    }
  }
  return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Who may build and who may review
 * ------------------------------------------------------------------ */

/**
 * The command role key that owns each department's applications. Department
 * heads build for their own department; `applications.manage` is the
 * community-wide grant that covers every one of them.
 */
export const DEPARTMENT_COMMAND = {
  fhp: "fhp_colonel",
  hcso: "hcso_sheriff",
  tpd: "tpd_chief",
  hcfr: "hcfr_fire_chief",
  dhs: "dhs_director",
};

/** True when these roles and permissions may edit this department's applications. */
export function canManageApplications(departmentId, { roleKeys = [], permissions = new Set() } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  if (perms.has("applications.manage")) return true;
  const command = DEPARTMENT_COMMAND[departmentId];
  return Boolean(command) && new Set(roleKeys).has(command);
}

/** Every department id these roles may build applications for. */
export function manageableDepartments(departmentIds, ctx) {
  return departmentIds.filter((id) => canManageApplications(id, ctx));
}

/**
 * Whether somebody may read and decide this application's submissions.
 *
 * The reviewer list is raw Discord role IDs, because that is what the bot needs
 * to gate the buttons inside Discord. On the site we only know mapped role keys,
 * so `roleIdToKey` translates what it can — an unmapped reviewer role still
 * works in Discord, it just cannot be recognised here. `applications.review`
 * covers the whole community regardless.
 */
export function canReviewApplication(app, { roleKeys = [], permissions = new Set(), roleIdToKey = {} } = {}) {
  const perms = permissions instanceof Set ? permissions : new Set(permissions);
  if (perms.has("applications.review")) return true;
  if (canManageApplications(app?.departmentId, { roleKeys, permissions: perms })) return true;
  const held = new Set(roleKeys);
  return (app?.discord?.reviewerRoleIds ?? []).some((id) => {
    const key = roleIdToKey[id];
    return key && held.has(key);
  });
}

/* ------------------------------------------------------------------ *
 * The Discord embed
 * ------------------------------------------------------------------ */

const TONE_COLORS = {
  primary: 0xf2800d, brand: 0x3b82f6, green: 0x10b981,
  amber: 0xf59e0b, rose: 0xf43f5e, slate: 0x94a3b8,
};

const STATUS_COLORS = { approved: 0x10b981, denied: 0xf43f5e, withdrawn: 0x94a3b8 };

/** Discord truncates silently; doing it here means the preview tells the truth. */
function clamp(value, max) {
  const text = String(value ?? "");
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function renderAnswer(field, value) {
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ") || "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field?.type === "scale") return `${value} / ${field.max}`;
  if (field?.type === "discord") return `<@${value}> (\`${value}\`)`;
  return String(value);
}

/**
 * The message the bot posts. Returned as plain data rather than sent from here:
 * a website cannot post an interactive component to Discord, and it cannot
 * receive the click either — only the bot application can do both. So this
 * builds the payload, the outbox carries it, and the bot owns the buttons.
 *
 * `custom_id`s are built here anyway, so the bot has nothing to invent and the
 * ids it sees on a click match the submission it was given.
 */
export function buildEmbed(app, submission, { fields } = {}) {
  const byId = Object.fromEntries((fields ?? allFields(app)).map((f) => [f.id, f]));
  const answers = submission.answers ?? {};

  const embedFields = Object.entries(answers)
    .map(([id, value]) => {
      const field = byId[id];
      if (!field) return null;
      return {
        name: clamp(field.label || "Question", 256),
        value: clamp(renderAnswer(field, value), 1024) || "—",
        inline: ["short", "number", "email", "age", "date", "time", "discord", "steam", "scale"].includes(field.type),
      };
    })
    .filter(Boolean)
    .slice(0, EMBED_FIELD_LIMIT);

  const decided = submission.status && submission.status !== "pending";
  const color = decided
    ? STATUS_COLORS[submission.status]
    : app.discord.embedColor
      ? parseInt(app.discord.embedColor.replace("#", ""), 16)
      : (TONE_COLORS[app.tone] ?? TONE_COLORS.brand);

  const embed = {
    title: clamp(`${app.title}${app.subdivisionId ? ` · ${app.subdivisionId}` : ""}`, 256),
    description: clamp(
      [
        submission.applicantName ? `**Applicant** ${submission.applicantName}` : null,
        submission.applicantDiscordId ? `<@${submission.applicantDiscordId}>` : null,
        `**Reference** \`${submission.reference}\``,
        decided ? `**Decision** ${submission.status.toUpperCase()}${submission.decidedByName ? ` by ${submission.decidedByName}` : ""}` : null,
        decided && submission.decisionReason ? `> ${clamp(submission.decisionReason, 300)}` : null,
      ].filter(Boolean).join("\n"),
      4096,
    ),
    color,
    fields: embedFields,
    timestamp: submission.submittedAt ?? new Date().toISOString(),
    footer: { text: clamp(app.discord.footer || "Florida Roleplay · Applications", 2048) },
  };

  const content = app.discord.pingRoleIds.map((id) => `<@&${id}>`).join(" ");

  // Components are an application's to send, so this is what the bot should
  // attach — not something this site could post itself.
  const components = decided
    ? []
    : [
        {
          type: 1,
          components: [
            { type: 2, style: 3, label: "Approve", custom_id: `app_approve:${submission.reference}` },
            { type: 2, style: 4, label: "Deny", custom_id: `app_deny:${submission.reference}` },
          ],
        },
      ];

  return {
    channelId: app.discord.channelId,
    content,
    embeds: [embed],
    components,
    allowedMentions: {
      roles: app.discord.pingRoleIds,
      users: app.discord.mentionApplicant && submission.applicantDiscordId ? [submission.applicantDiscordId] : [],
    },
    // Everything the bot needs to enforce the decision itself.
    meta: {
      reference: submission.reference,
      applicationId: app.id,
      applicationSlug: app.slug,
      departmentId: app.departmentId,
      subdivisionId: app.subdivisionId,
      applicantDiscordId: submission.applicantDiscordId ?? null,
      reviewerRoleIds: app.discord.reviewerRoleIds,
      approvedRoleIds: app.discord.approvedRoleIds,
    },
  };
}

/** A short human-quotable reference — what the applicant is told to mention. */
export function makeReference(now = new Date(), random = Math.random) {
  const stamp = now.toISOString().slice(2, 10).replace(/-/g, "");
  const tail = Math.floor(random() * 46_656).toString(36).toUpperCase().padStart(3, "0");
  return `APP-${stamp}-${tail}`;
}
