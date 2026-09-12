import {ensureMessageEdits} from './messageEdits.js';
import { query, transaction } from '../db.js';
import { randomUUID } from 'node:crypto';
import { guildDisplayName } from './guildDisplayName.js';
export const personalTypes = ['leo_personal', 'civ_personal', 'supporter_personal'];
export const activeStatuses = ['pending', 'approved', 'in_progress'];
export const modelApprover = ctx => ctx.roleKeys.some(r => ['directorship','ownership'].includes(r));
export const liveryApprover = ctx => modelApprover(ctx) || ctx.roleKeys.some(r => ['fhp_colonel','bso_sheriff','mpd_chief'].includes(r));
export const approvalViewer = (request,ctx) => (personalTypes.includes(request.type) || request.type === 'department_work' || request.type === 'personal_change') && liveryApprover(ctx);
let ready;
export function ensureApprovals() {
  if (!ready) ready = (async () => {
    await ensureMessageEdits('development');
    await query('ALTER TABLE dev_vehicle_claims ADD COLUMN IF NOT EXISTS request_id VARCHAR(40) REFERENCES dev_requests(id)');
    await query(`CREATE TABLE IF NOT EXISTS dev_request_approvals (
      id UUID PRIMARY KEY, request_id VARCHAR(40) NOT NULL REFERENCES dev_requests(id),
      kind VARCHAR(16) NOT NULL CHECK(kind IN ('model','liveries')), target_key VARCHAR(40) NOT NULL,
      actor_id VARCHAR(20) NOT NULL, actor_name VARCHAR(128) NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(request_id,kind,target_key))`);
    await query(`ALTER TABLE dev_request_approvals
      ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS revoked_by_id VARCHAR(20),
      ADD COLUMN IF NOT EXISTS revoked_by_name VARCHAR(128)`);
    await query('ALTER TABLE dev_request_approvals DROP CONSTRAINT IF EXISTS dev_request_approvals_request_id_kind_target_key_key');
    await query('CREATE UNIQUE INDEX IF NOT EXISTS dev_approval_current ON dev_request_approvals(request_id,kind,target_key) WHERE revoked_at IS NULL');
  })().catch(error => {ready=null;throw error;});
  return ready;
}
const fail = (status,message) => Object.assign(new Error(message),{status});
export async function claimInTicket(ctx, vehicleId, requestId, note) {
  await ensureApprovals();
  const actor = await guildDisplayName(ctx.user);
  return transaction(async q => {
    const [ticket] = await q('SELECT * FROM dev_requests WHERE id=$1 FOR UPDATE',[requestId]);
    if (!ticket || ticket.opened_by_discord_id !== ctx.user.id) throw fail(403,'Select one of your own personal tickets.');
    if (!personalTypes.includes(ticket.type) || !activeStatuses.includes(ticket.status)) throw fail(409,'Select an active personal vehicle ticket.');
    const [vehicle] = await q('SELECT * FROM dev_vehicles WHERE id=$1 FOR UPDATE',[vehicleId]);
    if (!vehicle?.claimable || !vehicle.available) throw fail(409,'That vehicle is not available to claim.');
    const occupied = await q("SELECT id FROM dev_vehicle_claims WHERE (vehicle_id=$1 OR request_id=$2) AND status IN ('pending','active')",[vehicleId,requestId]);
    if (occupied.length) throw fail(409,'This vehicle or ticket already has an open claim. Withdraw or release it before choosing another.');
    const id = `vc-${randomUUID()}`;
    await q(`INSERT INTO dev_vehicle_claims(id,vehicle_id,discord_id,member_name,status,note,request_id) VALUES($1,$2,$3,$4,'pending',$5,$6)`,[id,vehicleId,ctx.user.id,actor,note,requestId]);
    await q(`INSERT INTO dev_request_messages(id,request_id,internal,author_id,author_name,body,system_generated) VALUES($1,$2,false,$3,$4,$5,true)`,[`msg-${randomUUID()}`,requestId,ctx.user.id,actor,`Requested model approval: ${vehicle.name}. ${note || ''}`]);
    await q('UPDATE dev_requests SET last_message_at=CURRENT_TIMESTAMP WHERE id=$1',[requestId]);
    return {id,requestId,vehicleId,status:'pending'};
  });
}
export async function approvalData(requestId) {
  await ensureApprovals();
  const approvals = await query('SELECT id,kind,target_key AS "targetKey",actor_id AS "actorId",actor_name AS "actorName",created_at AS "createdAt",revoked_at AS "revokedAt",revoked_by_id AS "revokedById",revoked_by_name AS "revokedByName" FROM dev_request_approvals WHERE request_id=$1 ORDER BY created_at',[requestId]);
  const claims = await query(`SELECT c.id,c.status,c.vehicle_id AS "vehicleId",v.name FROM dev_vehicle_claims c JOIN dev_vehicles v ON v.id=c.vehicle_id WHERE c.request_id=$1 AND c.status IN ('pending','active')`,[requestId]);
  return {approvals,claim:claims[0] || null};
}
export async function approveTicket(ctx, requestId, kind, action = 'approve', approvalId = null) {
  if (!(kind === 'model' ? modelApprover(ctx) : kind === 'liveries' && liveryApprover(ctx))) throw fail(403,'Your role cannot make this approval.');
  if (!['approve','revoke'].includes(action)) throw fail(400,'Unknown approval action.');
  await ensureApprovals();
  const actor = await guildDisplayName(ctx.user);
  return transaction(async q => {
    const [ticket] = await q('SELECT * FROM dev_requests WHERE id=$1 FOR UPDATE',[requestId]);
    if (!ticket || !approvalViewer(ticket,ctx)) throw fail(403,'This ticket is not available for vehicle approval.');
    if (action === 'approve' && !activeStatuses.includes(ticket.status)) throw fail(409,'This ticket is no longer active.');
    const [claim] = await q("SELECT * FROM dev_vehicle_claims WHERE request_id=$1 AND status IN ('pending','active') FOR UPDATE",[requestId]);
    const target = claim?.id || 'external';
    if (action === 'revoke') {
      const revoked = await q(`UPDATE dev_request_approvals SET revoked_at=CURRENT_TIMESTAMP,revoked_by_id=$4,revoked_by_name=$5
        WHERE request_id=$1 AND kind=$2 AND target_key=$3 AND id::text=$6 AND revoked_at IS NULL RETURNING id`,[requestId,kind,target,ctx.user.id,actor,approvalId]);
      if (!revoked.length) throw fail(409,'This approval changed or was already revoked. Refresh the ticket.');
    } else {
      const inserted = await q(`INSERT INTO dev_request_approvals(id,request_id,kind,target_key,actor_id,actor_name) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(request_id,kind,target_key) WHERE revoked_at IS NULL DO NOTHING RETURNING id`,[randomUUID(),requestId,kind,target,ctx.user.id,actor]);
      if (!inserted.length) throw fail(409,'This item has already been approved.');
    }
    if (kind === 'model' && claim) {
      await q("UPDATE dev_vehicle_claims SET status=$4,decided_by_id=$2,decided_by_name=$3,decided_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=$1",[claim.id,ctx.user.id,actor,action === 'revoke' ? 'pending' : 'active']);
    }
    await q(`INSERT INTO dev_request_messages(id,request_id,internal,author_id,author_name,body,system_generated) VALUES($1,$2,false,$3,$4,$5,true)`,[`msg-${randomUUID()}`,requestId,ctx.user.id,actor,`${action === 'revoke' ? 'Revoked approval of' : 'Approved'} ${kind === 'model' ? 'model' : 'liveries'}${claim ? ` for claim ${claim.id}` : ' for this request'}.`]);
    await q('UPDATE dev_requests SET last_message_at=CURRENT_TIMESTAMP WHERE id=$1',[requestId]);
    return {ok:true};
  });
}
