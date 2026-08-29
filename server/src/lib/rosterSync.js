/**
 * Keeping the community roster in step with Discord — automatically.
 *
 * Two things feed the roster. An external bot may POST one member at a time to
 * /api/roster/sync (see routes/roster.js). And, when the site has its own bot
 * token, this module pulls the whole guild on an interval and after role-map
 * edits, resolves every member against the role map, and upserts them — so a
 * department roster fills in on its own once its roles are mapped, with no bot
 * to run and no button to press.
 *
 * The member resolution and upsert live here so both paths share exactly one
 * implementation; routes/roster.js imports them for its push endpoint.
 */
import { query } from "../db.js";
import * as seed from "../rosterSeed.js";
import { DEPARTMENT_CONFIGS } from "../departmentSeed.js";
import { normalizeConfig } from "./departmentConfig.js";
import { resolveRole, buildNickname, renderDisplayName } from "./roster.js";
import { fetchGuildMembers } from "./discord.js";

/**
 * Pull a callsign and a display name out of a server nickname.
 *
 * Communities nickname members "901 | Trooper | Jamison" — callsign, rank, then
 * name — which is exactly the template the bot builds. So the leading number is
 * the callsign and the last segment is the name to show. A bare nickname with no
 * separators ("Jamison") is just the name; an empty one yields nothing and the
 * caller falls back to what it already had.
 */
export function parseNick(nick) {
  const raw = String(nick ?? "").trim();
  if (!raw) return { callsign: "", name: "" };
  const parts = raw.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0];
    // A callsign is a short number, optionally with a one-letter prefix (A-12).
    const callsign = /^[A-Za-z]?\d{1,4}$/.test(first) ? first : "";
    return { callsign, name: parts[parts.length - 1] };
  }
  return { callsign: "", name: raw };
}

/**
 * Resolves one member against the role map and returns what the roster should
 * look like for them. Pure, so every caller shares it.
 */
export function resolveMember(payload, roleMap, departments) {
  const matched = resolveRole(payload.roles, roleMap);
  if (!matched) return { action: "remove", reason: "no mapped roles" };

  const department = departments.find((d) => d.id === matched.department) ?? null;
  const entry = {
    discordId: payload.discordId,
    characterName: payload.characterName,
    department: matched.department,
    rank: matched.rank,
    callsign: payload.callsign ?? "",
  };

  return {
    action: "upsert",
    entry: {
      ...entry,
      displayName: renderDisplayName(matched.displayTemplate, entry, department),
      nickname: buildNickname(entry, department, matched.displayTemplate),
      status: payload.status ?? "Active",
    },
    matchedRole: matched.key,
  };
}

/**
 * Insert or update one resolved member.
 *
 * `roleIds` is every mapped role the member holds, stored so a department roster
 * can show them under their rank in *that* department even when their highest
 * rank sits elsewhere. It is optional: the bot's push endpoint sends one member
 * without it, so a null leaves whatever was last stored in place rather than
 * wiping it.
 *
 * A change of rank or department stamps the staff activity overlay's `last_move`
 * with today, so a promotion or transfer shows when it happened with nothing to
 * update by hand. The first time a member is seen is not a move.
 */
export async function applyUpsert(resolved, joinedAt, roleIds = null, nicks = null) {
  const e = resolved.entry;
  const nicksJson = nicks && Object.keys(nicks).length ? JSON.stringify(nicks) : null;

  let prior = null;
  try {
    const rows = await query(
      "SELECT rank_label, department FROM roster_members WHERE discord_id = $1 LIMIT 1",
      [e.discordId],
    );
    prior = rows.length ? rows[0] : null;
  } catch {
    // No database — nothing to compare against; the upsert below is a no-op too.
  }

  await query(`INSERT INTO roster_members
       (id, discord_id, character_name, display_name, department, rank_label,
        callsign, status, joined_at, synced_at, source, role_ids, nicks)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, CURRENT_DATE), CURRENT_TIMESTAMP, 'discord-sync', $10::text[], $11::jsonb)
     ON CONFLICT (discord_id) DO UPDATE SET
       character_name = EXCLUDED.character_name,
       display_name   = EXCLUDED.display_name,
       department     = EXCLUDED.department,
       rank_label     = EXCLUDED.rank_label,
       callsign       = EXCLUDED.callsign,
       status         = EXCLUDED.status,
       synced_at      = CURRENT_TIMESTAMP,
       source         = 'discord-sync',
       role_ids       = COALESCE(EXCLUDED.role_ids, roster_members.role_ids),
       nicks          = COALESCE(EXCLUDED.nicks, roster_members.nicks)`,
    [
      `rm-${e.discordId}`,
      e.discordId,
      e.characterName,
      e.displayName,
      e.department,
      e.rank,
      e.callsign,
      e.status,
      joinedAt || null,
      roleIds && roleIds.length ? roleIds : null,
      nicksJson,
    ],
  );

  if (prior && (prior.rank_label !== e.rank || prior.department !== e.department)) {
    try {
      await query(
        `INSERT INTO staff_activity (discord_id, last_move, updated_at)
           VALUES ($1, CURRENT_DATE, CURRENT_TIMESTAMP)
         ON CONFLICT (discord_id)
           DO UPDATE SET last_move = CURRENT_DATE, updated_at = CURRENT_TIMESTAMP`,
        [e.discordId],
      );
    } catch {
      // The activity overlay is best-effort; a missed stamp is not worth failing a sync.
    }
  }
}

/** The rank role map, live from the database, falling back to the seed. */
async function loadRankMap() {
  try {
    const rows = await query(
      "SELECT * FROM roster_role_map WHERE kind = 'rank' ORDER BY sort_order DESC",
    );
    if (rows.length) {
      return rows.map((row) => ({
        roleId: row.role_id,
        key: row.role_key,
        department: row.department,
        rank: row.rank_label,
        rankFull: row.rank_full,
        order: row.sort_order,
        displayTemplate: row.display_template,
      }));
    }
  } catch {
    // No database — the seed stands.
  }
  return seed.ROLE_MAP;
}

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * Every Discord server the roster spans: the main guild, plus each department's
 * own server when it runs one. Reads the stored configs, falling back to the
 * seeds, so a department head can point their hub at a new server from the
 * Builder without a redeploy.
 */
async function collectGuildIds() {
  const ids = new Set();
  const main = String(process.env.DISCORD_GUILD_ID ?? "").trim();
  if (SNOWFLAKE.test(main)) ids.add(main);

  const add = (cfg) => {
    const g = String(cfg?.guildId ?? "").trim();
    if (SNOWFLAKE.test(g)) ids.add(g);
  };
  try {
    const rows = await query("SELECT config FROM department_configs");
    for (const row of rows) {
      const cfg = typeof row.config === "object" ? row.config : JSON.parse(row.config);
      add(cfg);
    }
  } catch {
    // No database — the seed configs below stand.
  }
  for (const cfg of Object.values(DEPARTMENT_CONFIGS)) add(cfg);
  return [...ids];
}

/**
 * Per-department callsign settings and the guild each reads nicknames from:
 * `{ deptId: { guildId, min, max, auto } }`. Seeds set the shipped ranges; a
 * stored config overrides them, but an empty guild or a zero range falls back to
 * the seed so an older save that predates these fields does not blank them.
 */
async function loadDeptMeta() {
  const meta = {};
  const setFrom = (cfg, id) => {
    const c = normalizeConfig(cfg, id);
    const cur = meta[c.id] || { guildId: "", min: 0, max: 0, auto: true };
    const guildId = SNOWFLAKE.test(String(c.guildId ?? "")) ? String(c.guildId) : "";
    const cs = c.roster?.callsigns ?? {};
    meta[c.id] = {
      guildId: guildId || cur.guildId,
      min: cs.min || cur.min,
      max: cs.max || cur.max,
      auto: cs.auto !== false,
    };
  };
  for (const [id, cfg] of Object.entries(DEPARTMENT_CONFIGS)) setFrom(cfg, id);
  try {
    const rows = await query("SELECT id, config FROM department_configs");
    for (const row of rows) {
      setFrom(typeof row.config === "object" ? row.config : JSON.parse(row.config), row.id);
    }
  } catch {
    // No database — the seed meta stands.
  }
  return meta;
}

/**
 * Give every member of one department a callsign from its range, keeping the one
 * they already have. A member who carries a callsign in their nickname keeps it
 * and reserves that number; everyone else keeps a still-valid stored number or
 * is handed the next free one. Rows for members who left, or who now carry a
 * nickname callsign, are removed. Best-effort — a failure never fails the sync.
 */
async function assignDeptCallsigns(deptId, members, meta) {
  try {
    const rows = await query(
      "SELECT discord_id, callsign FROM dept_callsigns WHERE department = $1",
      [deptId],
    );
    const existing = new Map(rows.map((r) => [r.discord_id, String(r.callsign)]));

    // Numbers already spoken for: every present member's nickname callsign.
    const occupied = new Set();
    for (const m of members) if (m.nickCallsign) occupied.add(String(m.nickCallsign));

    const assign = new Map(); // discordId -> number string, for members without a nick callsign
    // Keep a still-valid stored number that no nickname now claims.
    for (const m of members) {
      if (m.nickCallsign) continue;
      const prev = existing.get(m.discordId);
      const n = prev ? Number(prev) : NaN;
      if (Number.isFinite(n) && n >= meta.min && n <= meta.max && !occupied.has(prev)) {
        assign.set(m.discordId, prev);
        occupied.add(prev);
      }
    }
    // Hand the next free number to anyone still without one.
    let cursor = meta.min;
    for (const m of members) {
      if (m.nickCallsign || assign.has(m.discordId)) continue;
      while (cursor <= meta.max && occupied.has(String(cursor))) cursor += 1;
      if (cursor > meta.max) break; // range exhausted — leave the rest blank
      assign.set(m.discordId, String(cursor));
      occupied.add(String(cursor));
      cursor += 1;
    }

    for (const [discordId, cs] of assign) {
      await query(
        `INSERT INTO dept_callsigns (department, discord_id, callsign, assigned_at)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (department, discord_id) DO UPDATE SET callsign = EXCLUDED.callsign`,
        [deptId, discordId, cs],
      );
    }
    const keep = [...assign.keys()];
    if (keep.length) {
      await query(
        "DELETE FROM dept_callsigns WHERE department = $1 AND NOT (discord_id = ANY($2))",
        [deptId, keep],
      );
    } else {
      await query("DELETE FROM dept_callsigns WHERE department = $1", [deptId]);
    }
  } catch {
    // Auto-callsigns are a convenience; never let them break a roster sync.
  }
}

/** The role segment of a "callsign | role | name" nickname, e.g. "Owner". */
function nickRole(nick) {
  const parts = String(nick ?? "").split("|").map((p) => p.trim()).filter(Boolean);
  return parts.length >= 3 ? parts[1] : "";
}

/**
 * The leadership Discord roles, keyed by their real snowflake in the main FLRP
 * guild. Membership of one of these roles is what puts someone on the home
 * page's Leadership section — no site login or nickname parsing needed. The
 * ownership titles and the director seats are fixed here, in order of seniority.
 */
const LEADERSHIP_ROLES = {
  ownership: [
    { id: "1534380747689824276", label: "Owner" },
    { id: "1534911243142303744", label: "Co-Owner" },
  ],
  directorSeats: [
    { id: "1535994200808497162", label: "Staff Director" },
    { id: "1535994241392582706", label: "ES Director" },
    { id: "1535994278193528912", label: "Dev. Director" },
    { id: "1535994315258724415", label: "Civilian Director" },
    { id: "1542221076216676422", label: "Asst. Staff Director" },
    { id: "1542221112442618027", label: "Asst. ES Director" },
    { id: "1542221148102725642", label: "Asst. Dev. Director" },
    { id: "1542221004561190983", label: "Asst. Civilian Director" },
  ],
};

/**
 * The Discord roles that mark someone as leadership, split into the two groups
 * the home page shows: the Ownership tier role(s), and every role mapped to the
 * `management` department (Directorship). Read from the live role map, falling
 * back to the seed so it works before anything is stored.
 */
async function loadLeadershipRoles() {
  const ownership = new Set();
  const directors = new Set();
  try {
    const rows = await query("SELECT role_id, role_key, department, kind FROM roster_role_map");
    if (rows.length) {
      for (const r of rows) {
        const id = String(r.role_id);
        if (r.role_key === "ownership" || (r.kind === "tier" && /owner/i.test(r.role_key || ""))) ownership.add(id);
        if (r.department === "management") directors.add(id);
      }
      return { ownership, directors };
    }
  } catch {
    // No database — fall through to the seed.
  }
  for (const r of seed.SPECIAL_ROLES ?? []) if (r.key === "ownership") ownership.add(String(r.roleId));
  for (const r of seed.ROLE_MAP) if (r.department === "management") directors.add(String(r.roleId));
  return { ownership, directors };
}

/**
 * Replace the public leadership team from the members just read. Ownership rows
 * sort before directors; within a group, by callsign then name. Best-effort —
 * a write failure never fails the roster sync that already landed.
 */
async function writeLeadership(rows, prune = true) {
  try {
    if (!rows.length) {
      // Only clear the table on a clean read — a partial read that happened to
      // see no leaders must not blank the section.
      if (prune) await query("DELETE FROM site_leadership");
      return;
    }
    for (const [i, r] of rows.entries()) {
      await query(
        `INSERT INTO site_leadership (discord_id, name, role_label, handle, avatar, grp, callsign, sort_order, synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP)
         ON CONFLICT (discord_id) DO UPDATE SET
           name = EXCLUDED.name, role_label = EXCLUDED.role_label, handle = EXCLUDED.handle,
           avatar = EXCLUDED.avatar, grp = EXCLUDED.grp, callsign = EXCLUDED.callsign,
           sort_order = EXCLUDED.sort_order, synced_at = CURRENT_TIMESTAMP`,
        [r.discordId, r.name.slice(0, 128), r.roleLabel.slice(0, 64), r.handle.slice(0, 64), r.avatar, r.grp, r.callsign.slice(0, 16), i],
      );
    }
    if (prune) {
      await query("DELETE FROM site_leadership WHERE NOT (discord_id = ANY($1))", [rows.map((r) => r.discordId)]);
    }
  } catch {
    // Best-effort; a stale leadership row is harmless.
  }
}

/**
 * Diagnose why the leadership section is empty: which guilds were read, and how
 * many members hold each leadership role the site sees. If a role shows 0
 * holders the bot isn't seeing it (wrong guild, Members Intent off, or a role
 * id mismatch); if holders are found but `storedCount` is 0 the write is
 * failing (usually a missing table). Gated to staff by its route.
 */
export async function leadershipDebug() {
  const guildIds = await collectGuildIds();
  const perGuild = [];
  const byId = new Map();
  for (const gid of guildIds) {
    try {
      const members = await fetchGuildMembers(gid);
      if (!members) {
        perGuild.push({ guildId: gid, ok: false, error: "not-configured" });
        continue;
      }
      perGuild.push({ guildId: gid, ok: true, count: members.length });
      for (const m of members) {
        const cur = byId.get(m.id) ?? { roles: new Set() };
        for (const r of m.roles) cur.roles.add(String(r));
        byId.set(m.id, cur);
      }
    } catch (err) {
      perGuild.push({ guildId: gid, ok: false, error: err?.code || err?.message || "failed" });
    }
  }
  const holders = {};
  for (const role of [...LEADERSHIP_ROLES.ownership, ...LEADERSHIP_ROLES.directorSeats]) {
    let n = 0;
    for (const [, data] of byId) if (data.roles.has(role.id)) n += 1;
    holders[role.label] = n;
  }
  let tableOk = true;
  let storedCount = null;
  try {
    const rows = await query("SELECT COUNT(*)::int AS n FROM site_leadership");
    storedCount = rows[0]?.n ?? 0;
  } catch {
    tableOk = false;
  }
  return { guildIds, perGuild, scanned: byId.size, holders, tableOk, storedCount };
}

let lastSyncAt = 0;
let inProgress = false;
const MIN_INTERVAL_MS = 60_000;

/**
 * Reconcile the roster to Discord across every guild it spans: a member's roles
 * from all the servers they share with the bot are merged and resolved once (so
 * someone in the main guild and a department guild lands under the higher rank),
 * everyone matched is upserted, and the bot-synced rows for anyone who resolves
 * nowhere are pruned. Never throws. Pruning only runs when every guild was read
 * cleanly, so a single server's outage never wipes the roster.
 */
export async function syncRosterFromGuild() {
  if (inProgress) return { skipped: "in-progress" };
  inProgress = true;
  try {
    const guildIds = await collectGuildIds();
    if (guildIds.length === 0) return { configured: false };

    // Merge each member's roles across every guild they're in with the bot.
    const byId = new Map(); // discordId -> { roles:Set, name }
    const perGuild = []; // { guildId, ok, count, error } — surfaced to a manual pull
    let errors = 0;
    let ok = 0;
    for (const gid of guildIds) {
      let members;
      try {
        members = await fetchGuildMembers(gid);
      } catch (err) {
        errors += 1;
        const error = err?.code || err?.message || "failed";
        perGuild.push({ guildId: gid, ok: false, count: 0, error });
        // eslint-disable-next-line no-console
        console.warn("[roster-sync] guild", gid, error);
        continue;
      }
      if (!members) {
        // Null means the bot has no token or the id is blank — not an outage.
        perGuild.push({ guildId: gid, ok: false, count: 0, error: "not-configured" });
        continue;
      }
      ok += 1;
      perGuild.push({ guildId: gid, ok: true, count: members.length, error: null });
      for (const m of members) {
        const cur = byId.get(m.id) ?? { roles: new Set(), name: "", nicks: {}, username: "", avatar: null };
        for (const r of m.roles) cur.roles.add(r);
        // Keep each guild's nickname so a department roster can read the name and
        // callsign from its own server.
        if (m.nick) cur.nicks[gid] = m.nick;
        if (!cur.name) cur.name = m.displayName || m.username || "";
        // Handle and avatar for the public leadership team — first seen wins.
        if (!cur.username) cur.username = m.username || "";
        if (!cur.avatar && m.avatar) cur.avatar = m.avatar;
        byId.set(m.id, cur);
      }
    }

    if (ok === 0) return { configured: true, error: errors ? "unreadable" : "no-guilds", perGuild };

    const roleMap = await loadRankMap();
    const deptMeta = await loadDeptMeta();
    // Which held roles to persist per member: only the ones the map knows, so a
    // department roster can bucket a member by any of their mapped ranks.
    const mappedRoleIds = new Set(roleMap.map((r) => String(r.roleId)));
    const byDept = {}; // department -> matched count, for the pull diagnostic
    const deptMembers = {}; // department -> [{ discordId, nickCallsign }] for callsigns
    const keep = [];
    let leadershipCount = 0; // how many leaders were found, for the diagnostic
    for (const [discordId, data] of byId) {
      const held = [...data.roles].map(String);
      const resolved = resolveMember(
        { discordId, characterName: data.name || "Member", roles: held, callsign: "" },
        roleMap,
        seed.DEPARTMENTS,
      );
      if (resolved.action === "upsert") {
        const roleIds = held.filter((id) => mappedRoleIds.has(id));
        await applyUpsert(resolved, null, roleIds, data.nicks);
        keep.push(discordId);
        // A member counts toward every department they hold a mapped role in —
        // the same way they now appear on each of those department rosters.
        const depts = new Set(
          roleIds.map((id) => roleMap.find((r) => String(r.roleId) === id)?.department).filter(Boolean),
        );
        for (const d of depts) {
          byDept[d] = (byDept[d] ?? 0) + 1;
          const gid = deptMeta[d]?.guildId;
          const nickCallsign = gid && data.nicks[gid] ? parseNick(data.nicks[gid]).callsign : "";
          (deptMembers[d] ??= []).push({ discordId, nickCallsign });
        }
      }
    }

    // The public leadership team: whoever holds an Ownership or Director role,
    // named and pictured from Discord even if they never signed in. Placement is
    // by role id first (exact seat), with the mapped ownership-tier / management
    // roles as a fallback. Built from whatever was read — a department guild
    // failing to read must not blank the leadership section, since these roles
    // live in the main guild. Stale rows are only pruned on a fully clean read.
    {
      const lead = await loadLeadershipRoles();
      const mainGuild = String(process.env.DISCORD_GUILD_ID ?? "").trim();
      const leadership = [];
      for (const [discordId, data] of byId) {
        const held = data.roles;
        let grp = null;
        let roleLabel = "";
        let order = 0;

        // 1. Exact leadership roles by id — Owner/Co-Owner, then the director seats.
        const owner = LEADERSHIP_ROLES.ownership.find((r) => held.has(r.id));
        if (owner) {
          grp = "ownership";
          roleLabel = owner.label;
          order = LEADERSHIP_ROLES.ownership.indexOf(owner);
        } else {
          const seatIdx = LEADERSHIP_ROLES.directorSeats.findIndex((r) => held.has(r.id));
          if (seatIdx !== -1) {
            grp = "directors";
            roleLabel = LEADERSHIP_ROLES.directorSeats[seatIdx].label;
            order = seatIdx;
          }
        }

        // 2. Fallback: the mapped ownership-tier / management-department roles,
        //    labelled from the nickname's role segment.
        if (!grp) {
          const isOwner = [...lead.ownership].some((id) => held.has(id));
          const isDirector = !isOwner && [...lead.directors].some((id) => held.has(id));
          if (isOwner) {
            grp = "ownership";
            order = 90;
          } else if (isDirector) {
            grp = "directors";
            order = 90;
          }
        }
        if (!grp) continue;

        const nick = data.nicks[mainGuild] || Object.values(data.nicks)[0] || "";
        const parsed = parseNick(nick);
        leadership.push({
          discordId,
          name: parsed.name || data.name || data.username || "Member",
          roleLabel: roleLabel || nickRole(nick) || (grp === "ownership" ? "Ownership" : "Director"),
          handle: data.username || "",
          avatar: data.avatar || null,
          grp,
          callsign: parsed.callsign || "",
          order,
        });
      }
      leadership.sort(
        (a, b) =>
          (a.grp === b.grp ? 0 : a.grp === "ownership" ? -1 : 1) ||
          a.order - b.order ||
          String(a.callsign).localeCompare(String(b.callsign), undefined, { numeric: true }) ||
          a.name.localeCompare(b.name),
      );
      leadershipCount = leadership.length;
      await writeLeadership(leadership, errors === 0);
    }

    // Prune only on a clean full read, so a transient outage on one server does
    // not delete members the roster still holds. Manually-added rows (a
    // different source) are never touched.
    if (errors === 0) {
      try {
        if (keep.length) {
          await query(
            "DELETE FROM roster_members WHERE source = 'discord-sync' AND NOT (discord_id = ANY($1))",
            [keep],
          );
        } else {
          await query("DELETE FROM roster_members WHERE source = 'discord-sync'");
        }
      } catch {
        // Pruning is best-effort; a failed delete just leaves a stale row.
      }

      // Hand out auto callsigns once the read is clean, so numbers aren't churned
      // by a partial view of a department. Only departments with a real range and
      // auto-assignment on are touched.
      for (const [deptId, meta] of Object.entries(deptMeta)) {
        if (!meta.auto || meta.min <= 0 || meta.max < meta.min) continue;
        await assignDeptCallsigns(deptId, deptMembers[deptId] ?? [], meta);
      }
    }

    lastSyncAt = Date.now();
    return { configured: true, guilds: guildIds.length, scanned: byId.size, matched: keep.length, leadership: leadershipCount, byDept, errors, perGuild };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[roster-sync]", err?.code || err?.message || err);
    return { error: err?.code || "failed" };
  } finally {
    inProgress = false;
  }
}

/**
 * Kick a background sync if one has not run recently — called from the roster
 * reads, so viewing a roster shortly after mapping roles fills it in without
 * waiting for the interval. Throttled and fire-and-forget.
 */
export function maybeSyncRoster() {
  if (inProgress || Date.now() - lastSyncAt < MIN_INTERVAL_MS) return;
  lastSyncAt = Date.now(); // reserve the window before the async work starts
  syncRosterFromGuild().catch(() => {});
}

/** Start the automatic sync: once shortly after boot, then on an interval. */
export function startRosterSync({ intervalMs = 5 * 60_000 } = {}) {
  setTimeout(() => syncRosterFromGuild().catch(() => {}), 8000).unref?.();
  setInterval(() => syncRosterFromGuild().catch(() => {}), intervalMs).unref?.();
}
