/**
 * Thin fetch wrapper over the Express API. Every read passes a mock fallback, so
 * the UI renders fully even when the backend is down or not yet provisioned.
 * Flip USE_API to false to develop entirely against src/data/mockData.js.
 */
import * as mock from "../data/mockData";
import * as hub from "../data/staffHubData";
import * as civ from "../data/civilianHubData";
import * as rosterMock from "../data/rosterData";
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
