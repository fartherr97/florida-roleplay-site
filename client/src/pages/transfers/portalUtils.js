// ─────────────────────────────────────────────────────────────────────────────
// Transfer Portal — shared helpers
//
// The Utils block of app/page.jsx from github.com/fartherr97/es-transfer-portal.
// A module of its own rather than sitting beside the components, following this
// repo's convention: a file that exports both components and plain functions
// loses fast refresh for everything in it.
// ─────────────────────────────────────────────────────────────────────────────

import { AVATAR_COLORS } from "./portalConfig";

/**
 * Thin fetch wrapper — throws on non-2xx so callers can catch with try/catch.
 *
 * `credentials: 'include'` is not optional. Without it the browser does not send
 * the session cookie, every call comes back 401, and nothing in the network tab
 * looks wrong.
 */
export async function api(path, opts) {
  const r = await fetch(`/api/transfers${path}`, { credentials: "include", ...opts });
  if (!r.ok) {
    // The status is carried on the error because callers act on it — a 409 from
    // the request form means "you already have one open", which has its own
    // screen rather than a generic retry message.
    const err = new Error(`${path} → ${r.status}`);
    err.status = r.status;
    throw err;
  }
  return r.json();
}

export function initials(name = "") {
  return (
    name
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "?"
  );
}

export function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function avatarColor(name = "") {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export function fmtMsgTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " at " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  );
}
