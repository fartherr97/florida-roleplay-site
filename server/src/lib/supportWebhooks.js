/**
 * Announcing a new support ticket to Discord.
 *
 * Ownership configures where each ticket type is announced. There are two shapes:
 *
 *   - the **support team** webhook, used for every ticket type without its own
 *     department webhook — it posts the embed and pings the support team role above it;
 *   - a **per-department** webhook (keyed by ticket type id), used for that type's
 *     tickets — it posts the same embed with no ping, into the department's own Discord.
 *
 * A type with a department webhook set goes there; everything else falls to the support
 * webhook. Both carry a link back to the ticket in the portal. Everything here is
 * best-effort: a missing or dead webhook never blocks the ticket the member just opened.
 *
 * The settings live in a self-creating singleton table because production does not re-run
 * the schema — the same pattern the Truth Social and rules features use.
 */
import { query } from "../db.js";
import { cleanWebhookUrl } from "./portal.js";

/** The public origin used to build ticket links, e.g. https://www.flrp.us. */
function siteOrigin() {
  const raw = String(process.env.SITE_URL ?? process.env.PUBLIC_SITE_URL ?? "").trim();
  if (raw) return raw.replace(/\/$/, "");
  return "https://www.flrp.us";
}

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await query(`CREATE TABLE IF NOT EXISTS support_webhook_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      support_webhook_url TEXT NOT NULL DEFAULT '',
      support_ping_role_id TEXT NOT NULL DEFAULT '',
      dept_webhooks JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT support_webhook_singleton CHECK (id = 1)
    )`);
  ensured = true;
}

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * The stored settings. Shape:
 *   { supportWebhookUrl, supportPingRoleId, deptWebhooks: { [typeId]: url } }
 * Returns empty defaults when nothing is configured or the database is unreachable.
 */
export async function loadSupportWebhooks() {
  try {
    await ensureTable();
    const rows = await query("SELECT * FROM support_webhook_settings WHERE id = 1");
    const row = rows[0];
    if (!row) return { supportWebhookUrl: "", supportPingRoleId: "", deptWebhooks: {} };
    const dept = typeof row.dept_webhooks === "object" && row.dept_webhooks ? row.dept_webhooks : {};
    return {
      supportWebhookUrl: row.support_webhook_url || "",
      supportPingRoleId: row.support_ping_role_id || "",
      deptWebhooks: dept,
    };
  } catch {
    return { supportWebhookUrl: "", supportPingRoleId: "", deptWebhooks: {} };
  }
}

/**
 * Save the settings. Each webhook URL is passed through the Discord-only sanitiser, so a
 * junk or non-Discord URL is stored as empty rather than becoming a server-side request
 * at an arbitrary host. Returns the cleaned settings that were stored.
 */
export async function saveSupportWebhooks({ supportWebhookUrl, supportPingRoleId, deptWebhooks }) {
  await ensureTable();

  const cleanSupport = cleanWebhookUrl(supportWebhookUrl);
  const pingRole = SNOWFLAKE.test(String(supportPingRoleId ?? "").trim())
    ? String(supportPingRoleId).trim()
    : "";
  const cleanDept = {};
  for (const [typeId, url] of Object.entries(deptWebhooks ?? {})) {
    const cleaned = cleanWebhookUrl(url);
    // Store only real webhooks; a blank clears that department's override.
    if (cleaned) cleanDept[String(typeId)] = cleaned;
  }

  await query(
    `INSERT INTO support_webhook_settings (id, support_webhook_url, support_ping_role_id, dept_webhooks, updated_at)
       VALUES (1, $1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (id) DO UPDATE SET
       support_webhook_url = EXCLUDED.support_webhook_url,
       support_ping_role_id = EXCLUDED.support_ping_role_id,
       dept_webhooks = EXCLUDED.dept_webhooks,
       updated_at = CURRENT_TIMESTAMP`,
    [cleanSupport, pingRole, JSON.stringify(cleanDept)],
  );

  return { supportWebhookUrl: cleanSupport, supportPingRoleId: pingRole, deptWebhooks: cleanDept };
}

/**
 * Post the "new ticket" announcement for a freshly opened ticket. Chooses the
 * department webhook when the ticket's type has one, otherwise the support webhook with a
 * ping. Never throws — a webhook problem must not fail the ticket.
 *
 * @param {{id: string}} ticket the created ticket
 * @param {{id: string, label: string}} type the ticket's category
 */
export async function notifyTicketOpened(ticket, type) {
  try {
    const settings = await loadSupportWebhooks();
    const label = type?.label || "support";
    const deptUrl = cleanWebhookUrl(settings.deptWebhooks?.[type?.id] ?? "");

    // A department queue with its own webhook goes there, silently (no ping). Everything
    // else is a support-team ticket: the support webhook, pinging the support role.
    const url = deptUrl || settings.supportWebhookUrl;
    if (!url) return;
    const ping = deptUrl ? "" : settings.supportPingRoleId;

    const link = `${siteOrigin()}/support/${encodeURIComponent(ticket.id)}`;
    const body = {
      embeds: [
        {
          title: `New ${label} ticket`,
          url: link,
          description: `A new **${label}** ticket has been created. [Click this link to access.](${link})`,
          color: 0x2f81f7,
          timestamp: new Date().toISOString(),
          footer: { text: `Ticket ${ticket.id}` },
        },
      ],
    };
    if (ping) {
      body.content = `<@&${ping}>`;
      body.allowed_mentions = { roles: [ping] };
    } else {
      // A department post carries no ping, so make sure nothing in it is treated as one.
      body.allowed_mentions = { parse: [] };
    }

    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  } catch {
    // Best-effort: announcing a ticket must never break opening one.
  }
}
