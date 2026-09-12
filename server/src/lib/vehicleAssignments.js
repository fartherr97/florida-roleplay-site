import { query } from '../db.js';

export async function vehicleAssignments(search = '', page = 1) {
  const term = String(search).trim().slice(0, 200);
  const currentPage = Math.max(1, Math.min(100000, Number.parseInt(page, 10) || 1));
  const filter = `c.status = 'active' AND ($1 = '' OR strpos(lower(concat_ws(' ',
    v.name, v.year, v.make, v.model, v.spawn_code, c.member_name,
    u.display_name, u.username, c.discord_id)), lower($1)) > 0)`;
  const from = `FROM dev_vehicle_claims c JOIN dev_vehicles v ON v.id = c.vehicle_id
    LEFT JOIN users u ON u.id = c.discord_id WHERE ${filter}`;
  const [count] = await query(`SELECT count(*)::int AS total ${from}`, [term]);
  const assignments = await query(`SELECT c.id, c.discord_id AS "discordId",
    coalesce(nullif(u.display_name, ''), nullif(c.member_name, ''), u.username, c.discord_id) AS "memberName",
    c.request_id AS "requestId", c.decided_at AS "assignedAt", c.decided_by_name AS "approvedBy",
    v.id AS "vehicleId", v.name, v.year, v.make, v.model, v.spawn_code AS "spawnCode",
    v.library, v.liveries, v.resource ${from}
    ORDER BY lower(v.name), c.id LIMIT 100 OFFSET $2`, [term, (currentPage - 1) * 100]);
  return { assignments, total: count.total, page: currentPage, pageSize: 100 };
}
