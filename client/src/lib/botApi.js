/**
 * Client for the Discord bot's REST API.
 *
 * Deliberately separate from src/lib/api.js, which talks to this repo's own
 * Express server. The two are different services with different auth: this one
 * is a cookie session issued by the bot API on a different origin, and nothing
 * here should ever be routed through our server. The dashboard is a frontend
 * only — every rule is enforced by the bot API, and this module re-implements
 * none of it.
 */
const BASE = import.meta.env.VITE_API_URL;

/** The CSRF token the API set, or null when signed out. */
function csrfToken() {
  return (
    document.cookie
      .split("; ")
      .find((c) => c.startsWith("frm_csrf="))
      ?.split("=")[1] ?? null
  );
}

export class ApiError extends Error {
  constructor({ status, code, message, requestId }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }

  get isUnauthenticated() {
    return this.status === 401;
  }

  get isForbidden() {
    return this.status === 403;
  }

  /**
   * A 401 has two meanings: no session, or a session belonging to somebody the
   * bot does not consider staff. The second is not an error to recover from —
   * it is a state to explain — and the message is what distinguishes them.
   */
  get isNotStaff() {
    return this.status === 401 && /website access/i.test(this.message ?? "");
  }
}

/** Raised before any request when VITE_API_URL was never set. */
export class ApiNotConfiguredError extends Error {
  constructor() {
    super(
      "VITE_API_URL is not set, so there is no bot API to call. See client/.env.example.",
    );
    this.name = "ApiNotConfiguredError";
  }
}

export const isConfigured = Boolean(BASE);

export async function api(path, { method = "GET", body, signal } = {}) {
  if (!BASE) throw new ApiNotConfiguredError();

  const headers = {};
  if (body !== undefined) headers["content-type"] = "application/json";

  // Unsafe methods must echo the CSRF cookie back in a header. The API rejects
  // them outright otherwise, and the failure looks like an auth error rather
  // than a CSRF one.
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = csrfToken();
    if (token) headers["x-csrf-token"] = token;
  }

  const response = await fetch(`${BASE}/api${path}`, {
    method,
    headers,
    credentials: "include", // required: this is what sends the session cookie
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      code: payload?.error?.code ?? "UNKNOWN",
      message: payload?.error?.message ?? "Something went wrong.",
      requestId: payload?.requestId,
    });
  }

  return payload;
}

/** Where to send the browser to start Discord OAuth. A navigation, not a fetch. */
export function signInUrl() {
  return `${BASE}/api/auth/discord`;
}

export function signOut() {
  return api("/auth/logout", { method: "POST" });
}

/**
 * Anything that changes Discord is queued, so the response is a job id rather
 * than a result. Poll until it finishes instead of assuming it worked.
 */
export const TERMINAL_JOB_STATUSES = [
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
  "PAUSED",
];

export async function waitForJob(
  jobId,
  { timeoutMs = 30000, intervalMs = 1000, onTick, signal } = {},
) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const job = await api(`/sync/jobs/${jobId}`, { signal });
    onTick?.(job);
    if (TERMINAL_JOB_STATUSES.includes(job.status)) return job;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  throw new Error("Timed out waiting for the job to finish");
}

/** Query string from a params object, dropping empty values. */
export function query(params = {}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const string = search.toString();
  return string ? `?${string}` : "";
}
