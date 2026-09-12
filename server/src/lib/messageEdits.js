import {query,transaction} from '../db.js';
const sources={support:{table:'support_messages',parent:'ticket_id'},development:{table:'dev_request_messages',parent:'request_id'}};
const ready=new Map();
export function ensureMessageEdits(kind){
 const source=sources[kind];if(!source)throw new Error('Unknown message source');
 if(!ready.has(kind))ready.set(kind,(async()=>{
  await query(`ALTER TABLE ${source.table} ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ, ADD COLUMN IF NOT EXISTS system_generated BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS edit_history JSONB NOT NULL DEFAULT '[]'::jsonb`);
  if(kind==='development')await query(`UPDATE dev_request_messages SET system_generated=true WHERE id ~ '^msg-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' AND system_generated=false`);
 })().catch(e=>{ready.delete(kind);throw e;}));
 return ready.get(kind);
}
const fail=(status,message)=>Object.assign(new Error(message),{status});
export async function editMessage(kind,parentId,messageId,userId,body,originalBody,canInternal){
 if(typeof body!=='string' || !body.trim() || body.length>8000)throw fail(400,'Enter a message between 1 and 8,000 characters.');
 if(typeof originalBody!=='string')throw fail(400,'Reload the message before editing.');
 await ensureMessageEdits(kind);
 const {table,parent}=sources[kind];
 return transaction(async q=>{
  const [message]=await q(`SELECT * FROM ${table} WHERE id=$1 AND ${parent}=$2 FOR UPDATE`,[messageId,parentId]);
  if(!message || message.author_id!==userId || message.system_generated || (message.internal && !canInternal))throw fail(403,'You can only edit your own chat messages.');
  if(message.body!==originalBody)throw fail(409,'This message changed while you were editing. Cancel and reopen the editor.');
  const text=body.trim();
  if(text===message.body)return {ok:true,id:message.id,body:message.body,editedAt:message.edited_at};
  const [updated]=await q(`UPDATE ${table} SET body=$2,edited_at=CURRENT_TIMESTAMP,edit_history=edit_history || $3::jsonb WHERE id=$1 RETURNING id,body,edited_at AS "editedAt"`,[messageId,text,JSON.stringify([{body:message.body,actorId:userId,at:new Date().toISOString()}])]);
  return {ok:true,...updated};
 });
}
