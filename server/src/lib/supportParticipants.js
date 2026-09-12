import { query, transaction } from '../db.js';
import { canWorkTicket } from './support.js';
import { validateTicketStaff } from './ticketStaff.js';
import { ensureMessageEdits } from './messageEdits.js';
import { guildDisplayName } from './guildDisplayName.js';
import { randomUUID } from 'node:crypto';

let ready;
export async function ensureParticipants() {
  ready ??= query(`CREATE TABLE IF NOT EXISTS support_ticket_participants (
    ticket_id varchar(40) NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
    discord_id varchar(20) NOT NULL, display_name text NOT NULL,
    added_by varchar(20) NOT NULL, added_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (ticket_id, discord_id)
  )`).catch(error => { ready = null; throw error; });
  await ready;
}
export function managesParticipants(request, ctx) {
  return Boolean(ctx.user && (request.openedByDiscordId === ctx.user.id || canWorkTicket(request,ctx,ctx.types)));
}
export function isParticipant(request, userId) {
  return Boolean(userId && request.participants?.some(p => p.discordId === userId));
}
export async function changeParticipant(requestId, discordId, action, ctx) {
  if (!/^\d{17,20}$/.test(discordId)) throw Object.assign(new Error('Enter a valid Discord user ID.'), {status:400});
  await ensureParticipants();
  await ensureMessageEdits('support');
  const actorName = await guildDisplayName(ctx.user);
  const memberName = action === 'add' ? (await validateTicketStaff(discordId,'support')).name : discordId;
  return transaction(async sql => {
    const [request] = await sql('SELECT id, type, status, opened_by_discord_id AS "openedByDiscordId" FROM support_tickets WHERE id=$1 FOR UPDATE', [requestId]);
    if (!request || !managesParticipants(request,ctx)) throw Object.assign(new Error('Only the ticket opener or support team can manage participants.'), {status:403});
    if (discordId === request.openedByDiscordId) throw Object.assign(new Error('The ticket opener already has access and cannot be removed.'), {status:409});
    if (action === 'add' && request.status === 'closed') throw Object.assign(new Error('Reopen the ticket before adding participants.'), {status:409});
    let name = memberName;
    if (action === 'add') {
      const added = await sql(`INSERT INTO support_ticket_participants(ticket_id,discord_id,display_name,added_by)
        VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING RETURNING discord_id`, [requestId,discordId,memberName,ctx.user.id]);
      if (!added.length) throw Object.assign(new Error('That person is already a participant.'), {status:409});
    } else {
      const removed = await sql('DELETE FROM support_ticket_participants WHERE ticket_id=$1 AND discord_id=$2 RETURNING display_name', [requestId,discordId]);
      if (!removed.length) throw Object.assign(new Error('That person is not a participant.'), {status:404});
      name = removed[0].display_name;
    }
    await sql(`INSERT INTO support_messages(id,ticket_id,author_id,author_name,body,internal,system_generated)
      VALUES($1,$2,$3,$4,$5,false,true)`, ['msg-'+randomUUID(),requestId,ctx.user.id,actorName,
      `${actorName} ${action === 'add' ? 'added' : 'removed'} ${name} (${discordId}) ${action === 'add' ? 'to' : 'from'} the ticket.`]);
    await sql('UPDATE support_tickets SET last_message_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1',[requestId]);
    return {ok:true};
  });
}
