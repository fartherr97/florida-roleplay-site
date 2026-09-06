/**
 * Retired department ids, folded into their current ones.
 *
 * The sheriff's office was briefly "BCSO" (id `bcso`) before settling on BSO (id
 * `bso`). The rename touched code and seeds but not the database, so anything
 * mapped or saved during that window — the Discord role map above all — still said
 * `bcso`, and a roster sync looking for `bso` roles found none. This module folds
 * those rows into the current id once, at startup, and is safe to run again.
 */
import { execute } from "../db.js";

/** Old id → current id. Add a pair here for any future rename. */
export const LEGACY_DEPARTMENT_IDS = Object.freeze({ bcso: "bso" });

/** The current id for a possibly-retired department id. */
export function canonicalDepartmentId(id) {
  return LEGACY_DEPARTMENT_IDS[id] ?? id;
}

let ran = null;

/**
 * Rename every stored reference to a retired department id. Each statement is
 * independent and best-effort: a table that does not exist yet, or a row that
 * would collide with one already under the new id, is skipped rather than
 * aborting the rest. Idempotent — once nothing says `bcso`, nothing changes.
 */
export function migrateLegacyDepartmentIds() {
  if (!ran) {
    ran = run().catch(() => {
      ran = null;
    });
  }
  return ran;
}

async function run() {
  const summary = {};
  for (const [oldId, newId] of Object.entries(LEGACY_DEPARTMENT_IDS)) {
    const oldPrefix = `${oldId}_`;
    const newPrefix = `${newId}_`;
    const statements = [
      // The Discord role map — the one that decides who is on a department roster.
      ["roster_role_map.department",
        "UPDATE roster_role_map SET department = $2 WHERE department = $1", [oldId, newId]],
      ["roster_role_map.role_key",
        `UPDATE roster_role_map SET role_key = $2 || substr(role_key, length($1) + 1)
          WHERE role_key LIKE $1 || '%'`, [oldPrefix, newPrefix]],
      // Members and their per-department overlays.
      ["roster_members",
        "UPDATE roster_members SET department = $2 WHERE department = $1", [oldId, newId]],
      ["roster_member_fields",
        `UPDATE roster_member_fields f SET department = $2 WHERE department = $1
          AND NOT EXISTS (SELECT 1 FROM roster_member_fields g
                          WHERE g.department = $2 AND g.member_id = f.member_id)`, [oldId, newId]],
      ["dept_callsigns",
        `UPDATE dept_callsigns c SET department = $2 WHERE department = $1
          AND NOT EXISTS (SELECT 1 FROM dept_callsigns d
                          WHERE d.department = $2 AND d.discord_id = c.discord_id)`, [oldId, newId]],
      ["staff", "UPDATE staff SET department = $2 WHERE department = $1", [oldId, newId]],
      ["dev_requests", "UPDATE dev_requests SET department = $2 WHERE department = $1", [oldId, newId]],
      ["fivem_vehicles", "UPDATE fivem_vehicles SET department = $2 WHERE department = $1", [oldId, newId]],
      // Role keys granted permissions or pay under the old prefix.
      ["permission_grants",
        `UPDATE permission_grants p SET role_key = $2 || substr(role_key, length($1) + 1)
          WHERE role_key LIKE $1 || '%'
          AND NOT EXISTS (SELECT 1 FROM permission_grants q
                          WHERE q.permission_key = p.permission_key
                            AND q.role_key = $2 || substr(p.role_key, length($1) + 1))`,
        [oldPrefix, newPrefix]],
      ["fivem_role_permissions",
        `UPDATE fivem_role_permissions SET role_key = $2 || substr(role_key, length($1) + 1)
          WHERE role_key LIKE $1 || '%'`, [oldPrefix, newPrefix]],
      ["fivem_pay_rates",
        `UPDATE fivem_pay_rates SET role_key = $2 || substr(role_key, length($1) + 1)
          WHERE role_key LIKE $1 || '%'`, [oldPrefix, newPrefix]],
      ["promotion_votes",
        `UPDATE promotion_votes SET
            current_role_key  = CASE WHEN current_role_key  LIKE $1 || '%' THEN $2 || substr(current_role_key,  length($1) + 1) ELSE current_role_key  END,
            proposed_role_key = CASE WHEN proposed_role_key LIKE $1 || '%' THEN $2 || substr(proposed_role_key, length($1) + 1) ELSE proposed_role_key END
          WHERE current_role_key LIKE $1 || '%' OR proposed_role_key LIKE $1 || '%'`,
        [oldPrefix, newPrefix]],
      // The department site itself: its history and audit trail follow the id,
      // and the site row moves only when nothing already lives under the new id
      // (otherwise the newer site is the real one and the old row stays put).
      ["department_config_versions",
        "UPDATE department_config_versions SET department_id = $2 WHERE department_id = $1", [oldId, newId]],
      ["department_audit_log",
        "UPDATE department_audit_log SET department_id = $2 WHERE department_id = $1", [oldId, newId]],
      ["transfer_webhooks",
        `UPDATE transfer_webhooks SET department_id = $2 WHERE department_id = $1
          AND NOT EXISTS (SELECT 1 FROM transfer_webhooks t WHERE t.department_id = $2)`, [oldId, newId]],
      ["department_configs.id",
        `UPDATE department_configs SET id = $2 WHERE id = $1
          AND NOT EXISTS (SELECT 1 FROM department_configs d WHERE d.id = $2)`, [oldId, newId]],
      // Role keys and the id embedded in every saved site document (band role
      // lists, access grants, chain of command), whichever row they live in.
      ["department_configs.config.id",
        `UPDATE department_configs SET config = jsonb_set(config, '{id}', to_jsonb($2::text))
          WHERE config->>'id' = $1`, [oldId, newId]],
      ["department_configs.config.roleKeys",
        `UPDATE department_configs SET config = replace(config::text, $1, $2)::jsonb
          WHERE config::text LIKE '%' || $1 || '%'`, [`"${oldPrefix}`, `"${newPrefix}`]],
    ];

    for (const [label, sql, params] of statements) {
      try {
        const result = await execute(sql, params);
        if (result?.rowCount) summary[label] = result.rowCount;
      } catch {
        // Table missing on this deploy, or a collision — skip, the rest still run.
      }
    }
  }
  return summary;
}
