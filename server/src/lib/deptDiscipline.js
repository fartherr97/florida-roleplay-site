/**
 * Bridge from a department's admin log to the disciplinary store the DA Hub and
 * `/bgcheck` read.
 *
 * An Emergency-Services department files rank actions and discipline on its own
 * Admin Log page. The disciplinary ones are exactly what a background check must
 * surface, so when such an entry is filed here it is also written into
 * `disciplinary_actions` under that department's body — keyed to the member's
 * Discord id, which is what folds it into the right person's record. Promotions
 * and commendations are not discipline and are never filed.
 *
 * The department id is the body id: fhp/bcso/mpd are both a department config id
 * and an ACTION_BODY, so a filing lands under the department that made it. The
 * issuer is the signed-in editor, never the form — a record filed under someone
 * else's name is not a record.
 */
import { query } from "../db.js";
import { ACTION_BODY_MAP } from "./discipline.js";

/**
 * Map an admin-log entry TYPE (a free-form label, since logbooks and their types
 * are configurable) to a disciplinary action type. Only the entries that follow
 * a member onto a background check match; hires, trainings, interviews, rank
 * changes and commendations resolve to null and are skipped.
 */
function disciplinaryType(type = "") {
  const t = String(type).toLowerCase();
  if (/terminat|removal|removed|fired/.test(t)) return "termination";
  if (/suspen/.test(t)) return "suspension";
  if (/demot/.test(t)) return "demotion";
  if (/written warning|\bwarning\b|\bwarn\b|strike/.test(t)) return "written_warning";
  return null;
}

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * Pull the free-text detail out of a snapshot entry's `values` — the notes-style
 * field is the body of the entry; fall back to joining every filled field.
 */
function entryDetail(entry) {
  const values = Array.isArray(entry?.values) ? entry.values : [];
  const filled = values.filter((v) => v && v.value && v.type !== "checkbox");
  const note = filled.find((v) => /note/i.test(v.label || ""));
  if (note) return String(note.value);
  return filled.map((v) => `${v.label}: ${v.value}`).join(" · ");
}

/**
 * File every newly-added disciplinary admin-log entry into the discipline store.
 * `before`/`after` are the page's `entries` arrays; an entry is new when its id
 * was not present before, so re-saving the page never double-files. Never
 * throws — a filing failure must not fail the save that already landed.
 */
export async function fileAdminLogDiscipline(deptId, before, after, user) {
  // The department must be a disciplinary body (fhp/bcso/mpd…). Staff/management
  // file through the DA Hub itself, not a department admin log.
  if (!ACTION_BODY_MAP[deptId] || ACTION_BODY_MAP[deptId].source !== "department") return;
  if (!user?.id) return;

  const seen = new Set((Array.isArray(before) ? before : []).map((e) => e?.id));
  const fresh = (Array.isArray(after) ? after : []).filter((e) => e?.id && !seen.has(e.id));

  for (const entry of fresh) {
    const type = disciplinaryType(entry.type);
    const discordId = String(entry.subject?.discordId ?? "").trim();
    // Only disciplinary entries that name a member by Discord id can be folded
    // into a background check; the rest stay department-local log lines.
    if (!type || !SNOWFLAKE.test(discordId)) continue;
    // Filing one against yourself is always a mistake.
    if (discordId === user.id) continue;

    try {
      await query(
        `INSERT INTO disciplinary_actions
           (type, body_id, target_name, target_discord_id, issued_by_name, issued_by_discord_id, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          type,
          deptId,
          String(entry.subject?.name ?? "").slice(0, 128),
          discordId,
          user.displayName ?? user.username ?? "Unknown",
          user.id,
          entryDetail(entry).slice(0, 1000),
        ],
      );
    } catch {
      // No database, or a transient failure — the log entry itself is saved; a
      // missed background-check row must not fail the page save.
    }
  }
}
