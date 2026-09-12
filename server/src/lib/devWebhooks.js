import { query } from '../db.js';
import { cleanWebhookUrl } from './portal.js';

export const DEV_PING_ROLES = ['1542499913957376140', '1535994278193528912', '1542221148102725642'];
let ready;
async function ensureTable() {
  ready ??= query(`CREATE TABLE IF NOT EXISTS dev_webhook_settings (
    id integer PRIMARY KEY CHECK (id = 1), webhook_url text NOT NULL,
    updated_by text, updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).catch(error => { ready = null; throw error; });
  await ready;
}
async function webhookUrl() {
  await ensureTable();
  const rows = await query('SELECT webhook_url FROM dev_webhook_settings WHERE id = 1');
  return cleanWebhookUrl(rows[0]?.webhook_url ?? process.env.DEV_TICKET_WEBHOOK_URL ?? '');
}
export async function devWebhookStatus() {
  return { configured: Boolean(await webhookUrl()), roleIds: DEV_PING_ROLES };
}
export async function saveDevWebhook(raw, actor) {
  const url = cleanWebhookUrl(raw);
  if (!url) throw Object.assign(new Error('Enter a valid Discord webhook URL.'), {status:400});
  await ensureTable();
  await query(`INSERT INTO dev_webhook_settings (id, webhook_url, updated_by) VALUES (1,$1,$2)
    ON CONFLICT (id) DO UPDATE SET webhook_url=EXCLUDED.webhook_url,
    updated_by=EXCLUDED.updated_by, updated_at=CURRENT_TIMESTAMP`, [url, actor]);
  return devWebhookStatus();
}
export function devTicketPayload(ticket) {
  const base = process.env.SITE_URL || process.env.PUBLIC_SITE_URL || 'https://www.flrp.us';
  const link = `${new URL(base).origin}/development/requests/${encodeURIComponent(ticket.id)}`;
  const plain = value => String(value ?? '').replace(/[\\*_`~|<>]/g, '\\$&');
  return {
    content: DEV_PING_ROLES.map(id => `<@&${id}>`).join(' '),
    allowed_mentions: { parse: [], roles: DEV_PING_ROLES, users: [] },
    embeds: [{
      title: String(ticket.subject || 'New development ticket').slice(0, 256),
      url: link, color: 0xf59e0b,
      description: `A new development ticket has been opened. [Open ticket](${link})`,
      fields: [
        {name:'Opened by', value:`${plain(ticket.openedByName).slice(0, 800)}\nDiscord ID: ${String(ticket.openedByDiscordId).slice(0, 22)}`},
        {name:'Ticket category', value:plain(ticket.category || 'Development').slice(0, 1024)},
      ],
      footer: {text:`Ticket ${ticket.id}`}, timestamp:new Date().toISOString(),
    }],
  };
}
export async function notifyDevTicketOpened(ticket) {
  try {
    const url = await webhookUrl();
    if (!url) return false;
    const response = await fetch(url, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify(devTicketPayload(ticket)), signal:AbortSignal.timeout(8000),
    });
    if (!response.ok) console.warn('[dev-webhook] Delivery failed:', response.status);
    return response.ok;
  } catch {
    // Never log the webhook credential or make a saved ticket fail.
    console.warn('[dev-webhook] Delivery unavailable');
    return false;
  }
}
