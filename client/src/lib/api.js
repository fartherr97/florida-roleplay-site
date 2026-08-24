/**
 * Thin fetch wrapper over the Express API. Every read passes a mock fallback, so
 * the UI renders fully even when the backend is down or not yet provisioned.
 * Flip USE_API to false to develop entirely against src/data/mockData.js.
 */
import * as mock from "../data/mockData";
import * as hub from "../data/staffHubData";
import * as civ from "../data/civilianHubData";
import * as rosterMock from "../data/rosterData";
import { DEPARTMENT_CONFIGS } from "../data/departmentConfigs";
import * as formsMock from "../data/formsData";
import * as promotionMock from "../data/promotionData";
import * as disciplineSeed from "../data/disciplineSeed";
import * as supportSeed from "../data/supportSeed";
import { gradeSubmission } from "./forms";
import { normalizeConfig, summarize } from "./departmentConfig";
import { projectRoster } from "./deptRoster";
import { BASE_ROLES, DEFAULT_GRANTS, PERMISSION_GROUPS } from "../data/permissions";

export const USE_API = true;

const BASE = "/api";

/**
 * While Discord OAuth is stubbed, the Staff Hub can browse as any rank. The
 * chosen rank rides along on every request so the API resolves the same rank the
 * UI is rendering — otherwise a previewed Head Admin would see the page and then a
 * 403 for its data. The server only honours this outside production.
 */
const PREVIEW_KEY = "flrp.previewRank";

function previewHeaders() {
  try {
    const rank = sessionStorage.getItem(PREVIEW_KEY);
    return rank ? { "x-preview-rank": rank } : {};
  } catch {
    return {};
  }
}

/** Raised when the API answers 403 so callers can surface the denial code. */
export class ApiForbiddenError extends Error {
  constructor(code, message) {
    super(message || "Forbidden");
    this.name = "ApiForbiddenError";
    this.status = 403;
    this.code = code || "AUTH_ROLE_MISSING";
  }
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...previewHeaders(),
      ...(options.headers || {}),
    },
    ...options,
  });

  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (res.status === 403) {
    throw new ApiForbiddenError(body?.code, body?.message);
  }
  if (!res.ok) {
    const err = new Error(body?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.errors = body?.errors;
    throw err;
  }
  return body;
}

/** GET with a mock fallback — network and parse failures resolve to `fallback`. */
async function get(path, fallback) {
  if (!USE_API) return fallback;
  try {
    const data = await request(path);
    return data ?? fallback;
  } catch (err) {
    if (err instanceof ApiForbiddenError) throw err;
    return fallback;
  }
}

/** POST that surfaces validation errors rather than silently falling back. */
async function post(path, body, fallback) {
  if (!USE_API) return fallback();
  try {
    return await request(path, { method: "POST", body: JSON.stringify(body) });
  } catch (err) {
    if (err instanceof ApiForbiddenError || err.status === 400) throw err;
    return fallback();
  }
}

/** Shown wherever a write is accepted but the API could not persist it. */
const NOT_PERSISTED =
  "Accepted, but not persisted — no database is configured, so this will reset on reload.";

/** PUT with the same contract as post(): validation and denials surface. */
async function put(path, body, fallback) {
  if (!USE_API) return fallback();
  try {
    return await request(path, { method: "PUT", body: JSON.stringify(body) });
  } catch (err) {
    if (err instanceof ApiForbiddenError || err.status === 400) throw err;
    return fallback();
  }
}

/** PATCH with the same contract as put(). */
async function patchJson(path, body, fallback) {
  if (!USE_API) return fallback();
  try {
    return await request(path, { method: "PATCH", body: JSON.stringify(body) });
  } catch (err) {
    if (err instanceof ApiForbiddenError || err.status === 400) throw err;
    return fallback();
  }
}

/** DELETE with the same contract as put(). */
async function del(path, fallback) {
  if (!USE_API) return fallback();
  try {
    return await request(path, { method: "DELETE" });
  } catch (err) {
    if (err instanceof ApiForbiddenError || err.status === 400) throw err;
    return fallback();
  }
}

/**
 * The shape GET /dept/:id/config returns, computed locally. Capabilities are
 * left empty in the fallback: without the API there is nothing to authorise
 * against, and an empty set renders the read-only view rather than offering
 * edit controls that would have nowhere to save to.
 */
function deptFallback(id) {
  const config = DEPARTMENT_CONFIGS[id];
  return config ? { config: normalizeConfig(config, id), capabilities: [] } : null;
}

/**
 * The forms list, computed locally. `canTake`/`canReview` are left false: the
 * server resolves them against the caller's Discord roles, and guessing here
 * would offer a form that then 403s on open.
 */
function formsFallback(audience) {
  return formsMock.forms
    .filter((form) => !audience || form.audience === audience || form.audience === "all")
    .filter((form) => form.published)
    .map((form) => ({
      ...form,
      canTake: false,
      canReview: false,
      submissionCount: formsMock.submissions.filter((entry) => entry.formId === form.id).length,
    }));
}

/** Seed submissions, graded through the same engine the server uses. */
function submissionsFallback(formId) {
  const form = formsMock.forms.find((entry) => entry.id === formId);
  if (!form) return [];
  return formsMock.submissions
    .filter((entry) => entry.formId === formId)
    .map((entry) => ({ ...entry, ...gradeSubmission(form, entry.answers) }));
}

/**
 * One application, computed locally. `eligibility` is refused rather than
 * guessed: the server decides it against the caller's Discord roles and their
 * submission history, and an optimistic guess here would open a form that then
 * refuses the submission at the end of it.
 */

/**
 * One ticket, computed locally. `can` is all false: the server resolves it from
 * the caller's permissions, and guessing would offer a status control that 403s.
 */
function supportFallback(id) {
  const ticket = supportSeed.TICKETS.find((entry) => entry.id === id);
  if (!ticket) return null;
  return { ticket, can: { work: false, lead: false } };
}

/** Reference ids are generated client-side only when the API is unreachable. */
function localReference(prefix) {
  const n = Math.floor(Math.random() * 90000) + 10000;
  return `${prefix}-${new Date().getFullYear()}-${n}`;
}

export const api = {
  health: () => get("/health", { ok: true }),

  serverStatus: () => get("/server-status", mock.serverStatus),

  departments: () => get("/departments", mock.departments),
  department: (id) =>
    get(
      `/departments/${encodeURIComponent(id)}`,
      mock.departments.find((d) => d.id === id) ?? null,
    ),

  rules: (q = "") => {
    const trimmed = q.trim();
    const fallback = trimmed ? filterRules(mock.rules, trimmed) : mock.rules;
    return get(`/rules${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`, fallback);
  },

  staff: () => get("/staff", mock.staff),

  patchNotes: () => get("/patch-notes", mock.patchNotes),
  latestPatchNote: () => get("/patch-notes/latest", mock.patchNotes[0]),

  applicationTypes: () => get("/applications/types", mock.applicationTypes),
  submitApplication: (payload) =>
    post("/applications", payload, () => ({
      ok: true,
      id: localReference("APP"),
    })),
  application: (id) =>
    get(`/applications/${encodeURIComponent(id)}`, {
      id,
      status: "Pending Review",
    }),

  me: () => get("/me", mock.mockUser),

  storeTiers: () => get("/store/tiers", mock.storeTiers),
  supporters: () => get("/supporters", mock.supporters),
  events: () => get("/events", mock.events),

  knowledgeBase: (q = "") => {
    const trimmed = q.trim();
    const fallback = trimmed
      ? filterArticles(mock.knowledgeBase, trimmed)
      : mock.knowledgeBase;
    return get(
      `/knowledge-base${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`,
      fallback,
    );
  },
  article: (slug) =>
    get(
      `/knowledge-base/${encodeURIComponent(slug)}`,
      mock.knowledgeBase.find((a) => a.slug === slug) ?? null,
    ),

  submitReport: (payload) =>
    post("/reports", payload, () => ({ ok: true, id: localReference("RPT") })),

  /* ----------------------------- Staff Hub ----------------------------- */

  hubPortal: () =>
    get("/staff-hub/portal", { ...hub.portal, links: hub.portalLinks }),
  saveHubPortal: (section, payload) =>
    post(`/staff-hub/portal/${section}`, payload, () => ({
      ok: true,
      message: "Saved locally — the API is unreachable, so this will not persist.",
    })),

  hubRoster: () => get("/staff-hub/roster", hub.roster),
  hubTraining: () => get("/staff-hub/training", hub.training),
  hubDashboard: () => get("/staff-hub/dashboard", hub.dashboard),
  hubChecklist: () => get("/staff-hub/checklist", hub.checklist),
  hubDisciplinary: () => get("/staff-hub/disciplinary", hub.disciplinaryActions),

  hubExamDashboard: () =>
    get("/staff-hub/exams/dashboard", buildExamDashboard(hub.attempts)),
  hubAttempt: (attemptId) =>
    get(`/staff-hub/exams/attempts/${encodeURIComponent(attemptId)}`, {
      ...(hub.attempts.find((a) => a.attemptId === attemptId) ?? null),
      questions: hub.attemptQuestions[attemptId] ?? [],
    }),
  hubSaveOverride: (attemptId, payload) =>
    post(`/staff-hub/exams/attempts/${encodeURIComponent(attemptId)}/override`, payload, () => ({
      ok: true,
      data: { attemptId, ...payload },
    })),
  hubExamMembers: (query = "") => {
    const trimmed = query.trim();
    const fallback = filterMembers(buildMembers(hub.attempts), trimmed);
    return get(
      `/staff-hub/exams/members${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`,
      fallback,
    );
  },
  hubExamMember: (identifier) =>
    get(
      `/staff-hub/exams/members/${encodeURIComponent(identifier)}`,
      buildMembers(hub.attempts).find(
        (m) => m.memberKey === identifier || m.discordId === identifier,
      ) ?? null,
    ),
  hubAuditLog: () => get("/staff-hub/exams/audit-log", hub.auditLog),
  hubExamSettings: () => get("/staff-hub/exams/settings", hub.examSettings),
  hubSaveExamSettings: (payload) =>
    post("/staff-hub/exams/settings", payload, () => ({ ok: true })),
  hubQuestionCatalog: () =>
    get("/staff-hub/exams/question-catalog", hub.questionCatalog),
  hubSaveQuestion: (rowNumber, payload) =>
    post(`/staff-hub/exams/question-catalog/${rowNumber}`, payload, () => ({
      ok: true,
    })),

  /* --------------------------- Civilian Hub --------------------------- */

  civCharacters: () => get("/civilian-hub/characters", civ.characters),
  civVehicles: () => get("/civilian-hub/vehicles", civ.vehicles),
  civProperties: () => get("/civilian-hub/properties", civ.properties),
  civLicences: () => get("/civilian-hub/licences", civ.licences),
  discordRoleMap: () =>
    get("/roster/role-map", {
      divisions: rosterMock.DIVISIONS,
      departments: rosterMock.DEPARTMENTS,
      roles: rosterMock.ROLE_MAP,
      special: rosterMock.SPECIAL_ROLES,
    }),
  saveDiscordRoleMap: (payload) =>
    post("/roster/role-map", payload, () => ({
      ok: true,
      message:
        "Accepted, but not persisted — no database is configured, so this will reset on reload.",
    })),

  permissionGrants: () => get("/permissions/grants", DEFAULT_GRANTS),
  permissionCatalogue: () =>
    get("/permissions/catalogue", {
      groups: PERMISSION_GROUPS,
      baseRoles: BASE_ROLES,
      roles: rosterMock.ROLE_MAP,
      departments: rosterMock.DEPARTMENTS,
    }),
  savePermissionGrants: (grants) =>
    post("/permissions/grants", { grants }, () => ({
      ok: true,
      message:
        "Accepted, but not persisted — no database is configured, so this will reset on reload.",
    })),

  roster: () => get("/roster", rosterMock.roster),
  updateRosterStatus: (id, payload) =>
    post(`/roster/${encodeURIComponent(id)}/status`, payload, () => ({
      ok: true,
      message:
        "Accepted, but not persisted — no database is configured, so this will reset on reload.",
    })),
  rosterRoleMap: () =>
    get("/roster/role-map", {
      divisions: rosterMock.DIVISIONS,
      departments: rosterMock.DEPARTMENTS,
      roles: rosterMock.ROLE_MAP,
    }),
  rosterSyncLog: () => get("/roster/sync-log", rosterMock.syncLog),

  civBusinesses: () => get("/civilian-hub/businesses", civ.businesses),
  civJobs: () => get("/civilian-hub/jobs", civ.jobs),
  civClassifieds: () => get("/civilian-hub/classifieds", civ.classifieds),
  civPenalCode: (q = "") => {
    const trimmed = q.trim();
    const fallback = trimmed ? filterPenalCode(civ.penalCode, trimmed) : civ.penalCode;
    return get(
      `/civilian-hub/penal-code${trimmed ? `?q=${encodeURIComponent(trimmed)}` : ""}`,
      fallback,
    );
  },
  civGuides: () => get("/civilian-hub/guides", civ.guides),

  /* -------------------------- Department hubs -------------------------- */

  /**
   * The department sites. Each id loads a different saved config through the
   * same engine, which is what lets one repo serve every department.
   *
   * The fallback shapes mirror what the server computes so a department hub is
   * fully browsable with no database — including the roster projection, which is
   * derived from the same mock roster the community roster page renders.
   */
  deptList: () =>
    get(
      "/dept",
      Object.values(DEPARTMENT_CONFIGS).map((config) => summarize(normalizeConfig(config))),
    ),

  deptConfig: (id) => get(`/dept/${encodeURIComponent(id)}/config`, deptFallback(id)),

  deptRoster: (id) => {
    const config = DEPARTMENT_CONFIGS[id];
    return get(`/dept/${encodeURIComponent(id)}/roster`, {
      subdivisions: config
        ? projectRoster(normalizeConfig(config, id), rosterMock.roster, rosterMock.ROLE_MAP)
        : [],
    });
  },

  deptVersions: (id) => get(`/dept/${encodeURIComponent(id)}/versions`, []),
  deptAudit: (id) => get(`/dept/${encodeURIComponent(id)}/audit`, []),

  saveDeptConfig: (id, config) =>
    put(`/dept/${encodeURIComponent(id)}/config`, { config }, () => ({
      ok: true,
      config,
      message: NOT_PERSISTED,
    })),

  /** One page's own data — never anything else in the document. */
  saveDeptPage: (id, pageId, config) =>
    put(
      `/dept/${encodeURIComponent(id)}/pages/${encodeURIComponent(pageId)}`,
      { config },
      () => ({ ok: true, message: NOT_PERSISTED }),
    ),

  saveDeptAccess: (id, access) =>
    put(`/dept/${encodeURIComponent(id)}/access`, { access }, () => ({
      ok: true,
      message: NOT_PERSISTED,
    })),

  restoreDeptVersion: (id, versionId) =>
    post(
      `/dept/${encodeURIComponent(id)}/versions/${encodeURIComponent(versionId)}/restore`,
      {},
      () => ({ ok: false, message: "Version history needs a database." }),
    ),

  createDept: (id, config) =>
    post("/dept", { id, config }, () => ({ ok: true, config, message: NOT_PERSISTED })),

  /* ---------------------------- Forms & exams --------------------------- */

  /**
   * The form engine. Note what the fallbacks do NOT do: they never grade a
   * submission locally and call it a result. The server is what grades — a
   * client that scored its own exam would be scoring its own exam — so an
   * unreachable API reports that the submission did not land rather than
   * inventing a pass.
   */
  forms: (audience) =>
    get(`/forms?audience=${encodeURIComponent(audience)}`, formsFallback(audience)),

  form: (id) =>
    get(`/forms/${encodeURIComponent(id)}`, formsMock.forms.find((f) => f.id === id) ?? null),

  formSubmissions: (id) =>
    get(`/forms/${encodeURIComponent(id)}/submissions`, submissionsFallback(id)),

  submitForm: (id, answers) =>
    post(`/forms/${encodeURIComponent(id)}/submit`, { answers }, () => ({
      ok: false,
      message:
        "The API is unreachable, so this submission was not recorded. Try again once it is back.",
    })),

  reviewSubmission: (formId, submissionId, points) =>
    post(
      `/forms/${encodeURIComponent(formId)}/submissions/${encodeURIComponent(submissionId)}/review`,
      { points },
      () => ({ ok: true, message: NOT_PERSISTED }),
    ),

  saveForm: (id, form) =>
    put(`/forms/${encodeURIComponent(id)}`, { form }, () => ({
      ok: true,
      form,
      message: NOT_PERSISTED,
    })),

  /* -------------------------- Moderation queue --------------------------- */

  moderationQueue: () => get("/reports", { reports: mock.reportQueue ?? [] }),

  setReportStatus: (reference, status) =>
    post(`/reports/${encodeURIComponent(reference)}/status`, { status }, () => ({
      ok: false,
      message: "The API is unreachable, so nothing was changed.",
    })),

  /* ---------------------------- Support portal ---------------------------- */

  /**
   * Tickets. Reads fall back to the seeds; writes do not — a ticket that only
   * exists in one browser is somebody waiting for an answer nobody can see.
   */
  supportTickets: (scope) =>
    get(`/support${scope ? `?scope=${encodeURIComponent(scope)}` : ""}`, {
      tickets: supportSeed.TICKETS,
      scope: scope ?? "mine",
      agent: false,
      lead: false,
    }),

  supportTicket: (id) =>
    get(`/support/${encodeURIComponent(id)}`, supportFallback(id)),

  openSupportTicket: (payload) =>
    post("/support", payload, () => ({
      ok: false,
      message: "The API is unreachable, so nothing was submitted. Nobody has seen this — try again once it is back.",
    })),

  /** Status, priority and assignment are one call — they are one action. */
  updateSupportTicket: (id, patch) =>
    patchJson(`/support/${encodeURIComponent(id)}`, patch, () => ({
      ok: false,
      message: "The API is unreachable, so nothing was changed.",
    })),

  supportMessages: (id) =>
    get(`/support/${encodeURIComponent(id)}/messages`, {
      messages: supportSeed.MESSAGES.filter((m) => m.ticketId === id && !m.internal),
    }),

  postSupportMessage: (id, payload) =>
    post(`/support/${encodeURIComponent(id)}/messages`, payload, () => ({
      ok: false,
      message: "The API is unreachable, so that message was not posted.",
    })),

  supportFlows: () =>
    get("/support/flows/list", { flows: supportSeed.FLOWS, canEdit: false }),

  saveSupportFlow: (id, flow) =>
    put(`/support/flows/${encodeURIComponent(id)}`, { flow }, () => ({
      ok: true,
      flow,
      message: NOT_PERSISTED,
    })),

  deleteSupportFlow: (id) =>
    del(`/support/flows/${encodeURIComponent(id)}`, () => ({ ok: true, message: NOT_PERSISTED })),

  /* ------------------------- Disciplinary actions ------------------------- */

  /**
   * The DA Hub's store. Reads fall back to the seeds; writes do not — an action
   * that only exists in one browser is a record nobody else can see, which is
   * the one thing a disciplinary record must never be.
   */
  disciplinaryActions: () =>
    get("/discipline", {
      actions: disciplineSeed.ACTIONS,
      mine: [],
      canViewAll: false,
      totals: { mine: 0, all: disciplineSeed.ACTIONS.length },
    }),

  fileDisciplinaryAction: (payload) =>
    post("/discipline", payload, () => ({
      ok: false,
      message: "The API is unreachable, so nothing was filed.",
    })),

  updateDisciplinaryAction: (id, payload) =>
    put(`/discipline/${encodeURIComponent(id)}`, payload, () => ({
      ok: false,
      message: "The API is unreachable, so nothing was changed.",
    })),

  voidDisciplinaryAction: (id, reason) =>
    post(`/discipline/${encodeURIComponent(id)}/void`, { reason }, () => ({
      ok: false,
      message: "The API is unreachable, so nothing was voided.",
    })),

  background: (discordId, days) =>
    get(
      `/discipline/background/${encodeURIComponent(discordId)}${days ? `?days=${days}` : ""}`,
      null,
    ),

  /* --------------------------- Promotion board --------------------------- */

  /**
   * The board. The server decides which votes the caller may see results for
   * and strips the ballots from the rest — the fallback below shows every vote
   * with its ballots because there is no caller to gate against without an API,
   * and the gating that matters is the server's.
   */
  promotions: () =>
    get("/promotions", { votes: promotionMock.votes, rules: promotionMock.visibilityRules }),

  nominate: (payload) =>
    post("/promotions", payload, () => ({ ok: true, message: NOT_PERSISTED })),

  castBallot: (voteId, choice, reason) =>
    post(`/promotions/${encodeURIComponent(voteId)}/ballot`, { choice, reason }, () => ({
      ok: true,
      message: NOT_PERSISTED,
    })),

  publishVote: (voteId) =>
    post(`/promotions/${encodeURIComponent(voteId)}/publish`, {}, () => ({
      ok: true,
      message: NOT_PERSISTED,
    })),

  withdrawVote: (voteId) =>
    post(`/promotions/${encodeURIComponent(voteId)}/withdraw`, {}, () => ({
      ok: true,
      message: NOT_PERSISTED,
    })),

  savePromotionRules: (rules) =>
    put("/promotions/rules", { rules }, () => ({ ok: true, rules, message: NOT_PERSISTED })),

  assistant: (message) =>
    post("/assistant", { message }, () => ({
      reply:
        "I'm offline right now, but the rules page has the answer to most questions — or open a ticket in Discord and a staff member will help.",
    })),
};

/**
 * Exam rollups. The server computes these from stored attempts; these mirrors
 * keep the fallback path identical rather than shipping a second set of numbers
 * that could drift from the attempt list.
 */
export function buildExamDashboard(list) {
  const totals = {
    totalProfiles: new Set(list.map((a) => a.discordId || a.name)).size,
    totalAttempts: list.length,
    pass: list.filter((a) => a.status === "Pass").length,
    needsReview: list.filter((a) => a.status === "Needs Review").length,
    fail: list.filter((a) => a.status === "Fail").length,
  };
  const recent = [...list].sort(
    (a, b) => new Date(b.submittedAt) - new Date(a.submittedAt),
  );
  return {
    totals,
    recentSubmissions: recent,
    recentByExam: Object.fromEntries(
      hub.EXAMS.map((exam) => [
        exam.key,
        recent.filter((a) => a.examType === exam.key).slice(0, 5),
      ]),
    ),
  };
}

/** Collapses attempts into one profile per person, newest attempt first. */
export function buildMembers(list) {
  const map = new Map();
  list.forEach((attempt) => {
    const key = attempt.discordId || attempt.name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, {
        memberKey: key,
        name: attempt.name,
        discordId: attempt.discordId,
        attemptsByExam: { trial: [], senior: [], admin: [] },
      });
    }
    map.get(key).attemptsByExam[attempt.examType]?.push(attempt);
  });
  return [...map.values()].map((member) => {
    const all = Object.values(member.attemptsByExam).flat();
    return {
      ...member,
      totalAttempts: all.length,
      latestAt: all
        .map((a) => a.submittedAt)
        .sort()
        .at(-1),
      // The highest exam this member has passed decides the badge on their row.
      highestPass:
        [...hub.EXAMS]
          .reverse()
          .find((exam) =>
            member.attemptsByExam[exam.key]?.some((a) => a.status === "Pass"),
          )?.short ?? null,
    };
  });
}

function filterMembers(members, q) {
  if (!q) return members;
  const needle = q.toLowerCase();
  return members.filter(
    (m) =>
      m.name.toLowerCase().includes(needle) ||
      String(m.discordId).includes(needle),
  );
}

function filterPenalCode(entries, q) {
  const needle = q.toLowerCase();
  return entries.filter(
    (entry) =>
      entry.title.toLowerCase().includes(needle) ||
      entry.code.toLowerCase().includes(needle) ||
      entry.degree.toLowerCase().includes(needle) ||
      entry.notes.toLowerCase().includes(needle),
  );
}

/** Mirrors the server-side `?q=` filter so the fallback behaves identically. */
function filterRules(groups, q) {
  const needle = q.toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.title.toLowerCase().includes(needle) ||
          item.body.toLowerCase().includes(needle) ||
          item.number.includes(needle) ||
          group.category.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.items.length > 0);
}

function filterArticles(articles, q) {
  const needle = q.toLowerCase();
  return articles.filter(
    (a) =>
      a.title.toLowerCase().includes(needle) ||
      a.summary.toLowerCase().includes(needle) ||
      a.category.toLowerCase().includes(needle),
  );
}

export default api;
