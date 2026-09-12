import { sessionFrom, canViewTicket, canUseInternal } from './portal.js';
import { query } from '../db.js';
import { fetchGuildMember } from './discord.js';
import { resolveRoleKeys } from './roleSync.js';
import { permissionsFor } from '../permissions.js';
import { loadGrants } from '../middleware/requirePermission.js';
import { canWorkType, normalizeTicketTypes, DEFAULT_TICKET_TYPES } from './support.js';
import { isDevTeam } from './devhub.js';
import { createHash } from 'node:crypto';
const idPattern = /^\d{17,20}$/;
let ready, running = false, pausedUntil = 0;
export async function ensureTicketDms() {
  ready ??= query(`CREATE TABLE IF NOT EXISTS ticket_dm_outbox (
    id bigserial PRIMARY KEY, kind text NOT NULL, ticket_id text NOT NULL, message_id text NOT NULL,
    recipient_id text NOT NULL, attempts integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'pending',
    available_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(kind,message_id,recipient_id)
  )`).catch(e=>{ready=null;throw e;});
  await ready;
}
export function replyRecipients(ticket,message) {
  const workers = [...(ticket.assignees || []).map(p=>p.discordId),ticket.assignedToDiscordId];
  const ids = message.internal ? workers : [ticket.openedByDiscordId,...(ticket.participants || []).map(p=>p.discordId),...workers];
  return [...new Set(ids.filter(id=>idPattern.test(id) && id!==message.authorId))];
}
export async function enqueueTicketDms(kind,ticket,message,sql) {
  for(const id of replyRecipients(ticket,message))await sql(`INSERT INTO ticket_dm_outbox(kind,ticket_id,message_id,recipient_id)
    VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING`,[kind,ticket.id,message.id,id]);
}
async function deliveryContext(job) {
  if(job.kind==='transfer') {
    const [ticket]=await query('SELECT * FROM transfers WHERE id=$1',[job.ticket_id]);
    const [message]=await query('SELECT * FROM transfer_messages WHERE id=$1 AND transfer_id=$2',[job.message_id,job.ticket_id]);
    if(!ticket || !message || message.author_id===job.recipient_id) return null;
    const transfer={createdById:ticket.created_by_id,subjectDiscordId:ticket.subject_discord_id,fromDept:ticket.from_dept,toDept:ticket.to_dept};
    let allowed=!message.internal && [transfer.createdById,transfer.subjectDiscordId].includes(job.recipient_id);
    if(!allowed) {
      const member=await fetchGuildMember(process.env.DISCORD_GUILD_ID,job.recipient_id);
      const session=sessionFrom({id:job.recipient_id,roles:await resolveRoleKeys(member?.roles || [])});
      allowed=member && (message.internal ? canUseInternal(session,transfer) : canViewTicket(session,transfer));
    }
    return allowed ? {ticket:{...ticket,subject:`${ticket.member_name}: ${ticket.from_dept} → ${ticket.to_dept}`},message} : null;
  }
  const dev=job.kind==='development';
  const [ticket]=await query(`SELECT * FROM ${dev?'dev_requests':'support_tickets'} WHERE id=$1`,[job.ticket_id]);
  const [message]=await query(`SELECT * FROM ${dev?'dev_request_messages':'support_messages'} WHERE id=$1 AND ${dev?'request_id':'ticket_id'}=$2`,[job.message_id,job.ticket_id]);
  if(!ticket || !message || message.author_id===job.recipient_id)return null;
  const assigned = ticket.assigned_to_discord_id===job.recipient_id || ticket.assignees?.some(p=>p.discordId===job.recipient_id);
  let allowed = false;
  if(!message.internal) {
    allowed = ticket.opened_by_discord_id===job.recipient_id;
    if(!allowed)allowed = (await query(`SELECT 1 FROM ${dev?'dev_request_participants':'support_ticket_participants'} WHERE ${dev?'request_id':'ticket_id'}=$1 AND discord_id=$2`,[job.ticket_id,job.recipient_id])).length>0;
  }
  if(!allowed && assigned) {
    const member=await fetchGuildMember(process.env.DISCORD_GUILD_ID,job.recipient_id);
    const permissions=permissionsFor(await resolveRoleKeys(member?.roles || []),await loadGrants());
    if(dev)allowed = Boolean(member && (member.roles.includes('1542499913957376140') || isDevTeam({permissions})));
    else {
      const [stored]=await query("SELECT document FROM support_type_config WHERE id='default'");
      const types=stored?.document ? normalizeTicketTypes(stored.document) : DEFAULT_TICKET_TYPES;
      const type=types.find(t=>t.id===ticket.type);
      if(type?.workGuildId) {
        const queueMember=await fetchGuildMember(type.workGuildId,job.recipient_id);
        if(type.workRoleIds?.some(id=>queueMember?.roles?.includes(id)))permissions.add('support.discordqueue.'+type.id);
      }
      allowed=canWorkType(type,permissions);
    }
  }
  return allowed ? {ticket,message} : null;
}
export function replyDmPayload(kind,ticket,message,nonce) {
  const origin=new URL(process.env.SITE_URL || process.env.PUBLIC_SITE_URL || 'https://www.flrp.us').origin;
  const link=origin+(kind==='development'?'/development/requests/':kind==='transfer'?'/transfers/t/':'/support/')+encodeURIComponent(ticket.id);
  const plain=v=>String(v || '').replace(/[\\*_`~|<>]/g,'\\$&');
  return {nonce,enforce_nonce:true,allowed_mentions:{parse:[],users:[],roles:[]},embeds:[{
    title:String(ticket.subject || 'Ticket reply').slice(0,256),url:link,color:0xf59e0b,
    description:`**${plain(message.author_name).slice(0,200)}** posted ${message.internal?'an internal reply':'a reply'}.\n\n${plain(message.body).slice(0,1200)}\n\n[Open ticket](${link})`,
    footer:{text:`${kind==='development'?'Development':kind==='transfer'?'ES Transfer':'Support'} · ${ticket.id}`},timestamp:new Date().toISOString(),
  }]};
}
async function discordPost(path,body) {
  const response=await fetch('https://discord.com/api/v10'+path,{method:'POST',headers:{Authorization:`Bot ${process.env.DISCORD_BOT_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
  if(!response.ok) {
    const details=await response.json().catch(()=>({}));
    throw Object.assign(new Error('Discord delivery failed'),{status:response.status,retryAfter:Number(details.retry_after) || 0});
  }
  return response.json();
}
export async function drainTicketDms() {
  if(running || Date.now()<pausedUntil || !process.env.DISCORD_BOT_TOKEN)return;
  running=true;
  try {
    await ensureTicketDms();
    for(let i=0;i<20;i++) {
      const [job]=await query(`UPDATE ticket_dm_outbox SET available_at=CURRENT_TIMESTAMP+interval '5 minutes',attempts=attempts+1
        WHERE id=(SELECT id FROM ticket_dm_outbox WHERE status='pending' AND available_at<=CURRENT_TIMESTAMP ORDER BY id FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`);
      if(!job)break;
      try {
        const context=await deliveryContext(job);
        if(!context){await query("UPDATE ticket_dm_outbox SET status='skipped' WHERE id=$1",[job.id]);continue;}
        const channel=await discordPost('/users/@me/channels',{recipient_id:job.recipient_id});
        const nonce=createHash('sha256').update(job.kind+':'+job.message_id+':'+job.recipient_id).digest('hex').slice(0,24);
        await discordPost('/channels/'+channel.id+'/messages',replyDmPayload(job.kind,context.ticket,context.message,nonce));
        await query("UPDATE ticket_dm_outbox SET status='sent' WHERE id=$1",[job.id]);
      } catch(e) {
        const permanent=[400,403,404].includes(e.status) || job.attempts>=5;
        const delay=Math.max(30*Math.pow(2,job.attempts-1),Math.ceil(e.retryAfter || 0));
        await query("UPDATE ticket_dm_outbox SET status=$1,available_at=CURRENT_TIMESTAMP+($2 * interval '1 second') WHERE id=$3",[permanent?'failed':'pending',delay,job.id]);
        console.warn('[ticket-dm] Delivery deferred or unavailable',e.status || 'network');
        if(e.status===429){pausedUntil=Date.now()+delay*1000;break;}
      }
    }
  } catch {console.warn('[ticket-dm] Queue unavailable');}
  finally {running=false;}
}
export function startTicketDms() {
  void drainTicketDms();
  setInterval(()=>void drainTicketDms(),15000).unref();
}
