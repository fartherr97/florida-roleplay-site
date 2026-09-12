/**
 * Announcing a new support ticket to Discord.
 *
 * Ownership configures where each ticket type is announced. There are two shapes:
 *
 *   - the **support team** webhook, used for every ticket type without its own
 *     department webhook — it posts the embed and pings the support team role above it;
 *   - a **per-department** webhook (keyed by ticket type id), used for that type's
 *     tickets — it posts the embed and pings the queue's selected Discord worker roles.
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
export async function ensureTable() {
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

/** Validate only edited webhook fields. Omitted fields keep their stored secret. */
export async function queueWebhookEdits(rawTypes, types, previousTypes = []) {
  const edits = {};
  const saved = await loadSupportWebhooks();
  for (const original of rawTypes || []) {
    const raw = {...original};
    if (!Object.hasOwn(raw, 'webhookUrl') && previousTypes.find(t=>t.id===raw.id)?.workGuildId !== raw.workGuildId && saved.deptWebhooks[raw.id]) raw.webhookUrl = saved.deptWebhooks[raw.id];
    if (!Object.hasOwn(raw, 'webhookUrl')) continue;
    const type = types.find(t => t.id === raw.id);
    if (!type) continue;
    const value = String(raw.webhookUrl ?? '').trim();
    if (!value) { edits[type.id] = ''; continue; }
    const url = cleanWebhookUrl(value);
    if (!url) throw Object.assign(new Error(type.label + ': enter a valid Discord webhook URL.'), {status:400});
    // Read webhook metadata only; saving never sends a message or pings anyone.
    const response = await fetch(url, {redirect:'error',signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw Object.assign(new Error(type.label + ': Discord could not verify that webhook.'), {status:400});
    const webhook = await response.json();
    if (type.workGuildId && webhook.guild_id !== type.workGuildId) throw Object.assign(new Error(type.label + ': the webhook must belong to the guild selected under Worked by.'), {status:400});
    edits[type.id] = url;
  }
  return edits;
}

export async function saveQueueWebhookEdits(edits, sql = query) {
  if (!Object.keys(edits).length) return;
  // Merge only edited keys; do not replace other queues or the general webhook.
  await sql(`INSERT INTO support_webhook_settings(id,dept_webhooks) VALUES(1,$1::jsonb)
    ON CONFLICT(id) DO UPDATE SET dept_webhooks=support_webhook_settings.dept_webhooks || EXCLUDED.dept_webhooks,
    updated_at=CURRENT_TIMESTAMP`,[JSON.stringify(edits)]);
}

export function supportTicketPayload(ticket, type, roleIds = []) {
  const roles = [...new Set(roleIds.filter(id=>SNOWFLAKE.test(id)))].slice(0,50);
  const link = `${siteOrigin()}/support/${encodeURIComponent(ticket.id)}`;
  const plain = value => String(value ?? '').replace(/[\\*_`~|<>]/g, '\\$&');
  return {
    content:roles.map(id=>`<@&${id}>`).join(' '),
    allowed_mentions:{parse:[],roles,users:[]},
    embeds:[{
      title:String(ticket.subject || 'New support ticket').slice(0,256),url:link,color:0xf59e0b,
      description:`A new support ticket has been opened. [Open ticket](${link})`,
      fields:[
        {name:'Opened by',value:`${plain(ticket.openedByName || 'Unknown').slice(0,800)}\nDiscord ID: ${String(ticket.openedByDiscordId || 'Unknown').slice(0,22)}`},
        {name:'Ticket queue',value:plain(type?.label || 'Support').slice(0,1024)},
      ],
      footer:{text:`Ticket ${ticket.id}`},timestamp:new Date().toISOString(),
    }],
  };
}

export async function notifyTicketOpened(ticket, type) {
  try {
    const settings = await loadSupportWebhooks();
    const queueUrl = cleanWebhookUrl(settings.deptWebhooks?.[type?.id] ?? '');
    // Confidential queues never fall back to a general support channel.
    const url = queueUrl || (type?.exclusive ? '' : cleanWebhookUrl(settings.supportWebhookUrl));
    if (!url) return false;
    const roles = queueUrl ? (type?.workRoleIds || []) : [settings.supportPingRoleId].filter(Boolean);
    const response = await fetch(url, {
      method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(supportTicketPayload(ticket,type,roles)),signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) console.warn('[support-webhook] Delivery failed:',response.status);
    return response.ok;
  } catch {
    console.warn('[support-webhook] Delivery unavailable');
    return false;
  }
}
