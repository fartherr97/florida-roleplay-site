/**
 * Thin fetch wrapper over the Express API. Every read passes a mock fallback, so
 * the UI renders fully even when the backend is down or not yet provisioned.
 * Flip USE_API to false to develop entirely against src/data/mockData.js.
 */
import * as mock from "../data/mockData";

export const USE_API = true;

const BASE = "/api";

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
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
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

  assistant: (message) =>
    post("/assistant", { message }, () => ({
      reply:
        "I'm offline right now, but the rules page has the answer to most questions — or open a ticket in Discord and a staff member will help.",
    })),
};

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
