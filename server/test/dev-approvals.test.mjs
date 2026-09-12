import {test,mock,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
const db=new PGlite();
const schema=await readFile(new URL('../src/schema.sql',import.meta.url),'utf8');
// Use the actual production tables, including constraints and column lengths.
for(const table of ['dev_requests','dev_request_messages','dev_vehicles','dev_vehicle_claims']) {
 const sql=schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`))[0];
 await db.exec(sql);
}
await db.exec("ALTER TABLE dev_vehicles ADD COLUMN claimable BOOLEAN DEFAULT true; CREATE UNIQUE INDEX claim_open ON dev_vehicle_claims(vehicle_id) WHERE status IN ('pending','active');");
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
mock.module('../src/db.js',{namedExports:{query,transaction:fn=>db.transaction(tx=>fn(async(sql,args=[]) => (await tx.query(sql,args)).rows))}});
mock.module('../src/lib/guildDisplayName.js',{namedExports:{guildDisplayName:async u=>u.displayName}});
const {claimInTicket,approveTicket,approvalData,ensureApprovals,modelApprover,liveryApprover}=await import('../src/lib/devApprovals.js');
const ctx=(roles,id='111111111111111111')=>({user:{id,displayName:'Main Guild Name'},roleKeys:roles});
await ensureApprovals();
await query("INSERT INTO dev_requests(id,type,subject,status,opened_by_discord_id,opened_by_name) VALUES ('ticket','leo_personal','Test','pending','111111111111111111','Owner'),('closed','leo_personal','Closed','closed','111111111111111111','Owner'),('other','civ_personal','Other','pending','222222222222222222','Other')");
await query("INSERT INTO dev_vehicles(id,name,claimable) VALUES('car','Test Car',true),('car2','Second Car',true)");
test('role gates distinguish department heads, directors, owners and other staff',()=>{
 for(const role of ['fhp_colonel','bso_sheriff','mpd_chief']){assert(liveryApprover(ctx([role])));assert(!modelApprover(ctx([role])));}
 for(const role of ['directorship','ownership']){assert(liveryApprover(ctx([role])));assert(modelApprover(ctx([role])));}
 for(const role of ['member','head_admin','developer']){assert(!liveryApprover(ctx([role])));assert(!modelApprover(ctx([role])));}
});
test('claims are ticket-owned, transactional and approved once with immutable actor logs',async()=>{
 await assert.rejects(claimInTicket(ctx(['member']),'car','other',''),{status:403});
 await assert.rejects(claimInTicket(ctx(['member']),'car','closed',''),{status:409});
 const claim=await claimInTicket(ctx(['member']),'car','ticket','Please review');
 await assert.rejects(claimInTicket(ctx(['member']),'car2','ticket',''),{status:409});
 await assert.rejects(claimInTicket(ctx(['member'],'222222222222222222'),'car','other',''),{status:409});
 await assert.rejects(approveTicket(ctx(['fhp_colonel']),'ticket','model'),{status:403});
 await approveTicket(ctx(['fhp_colonel']),'ticket','liveries');
 assert.equal((await approvalData('ticket')).claim.status,'pending');
 await approveTicket(ctx(['directorship']),'ticket','model');
 await assert.rejects(approveTicket(ctx(['ownership']),'ticket','model'),{status:409});
 const data=await approvalData('ticket');assert.equal(data.claim.status,'active');assert.equal(data.approvals.length,2);
 assert(data.approvals.every(a=>a.actorId==='111111111111111111' && a.actorName==='Main Guild Name' && a.targetKey===claim.id));
 const messages=await query('SELECT * FROM dev_request_messages WHERE request_id=$1',['ticket']);assert.equal(messages.length,3);
 const model=data.approvals.find(a=>a.kind==='model');
 await assert.rejects(approveTicket(ctx(['mpd_chief']),'ticket','model','revoke',model.id),{status:403});
 await approveTicket(ctx(['ownership']),'ticket','model','revoke',model.id);
 const revoked=await approvalData('ticket');assert.equal(revoked.claim.status,'pending');
 assert(revoked.approvals.find(a=>a.id===model.id).revokedAt);
 assert.equal(revoked.approvals.find(a=>a.id===model.id).revokedByName,'Main Guild Name');
 await assert.rejects(approveTicket(ctx(['ownership']),'ticket','model','revoke',model.id),{status:409});
 await approveTicket(ctx(['directorship']),'ticket','model');
 await assert.rejects(approveTicket(ctx(['ownership']),'ticket','model','revoke',model.id),{status:409});
 const again=await approvalData('ticket');assert.equal(again.claim.status,'active');assert.equal(again.approvals.length,3);
 const livery=again.approvals.find(a=>a.kind==='liveries');
 await query("UPDATE dev_requests SET status='closed' WHERE id='ticket'");
 await approveTicket(ctx(['mpd_chief']),'ticket','liveries','revoke',livery.id);
 assert.equal((await approvalData('ticket')).claim.status,'active');
 await assert.rejects(approveTicket(ctx(['mpd_chief']),'ticket','liveries'),{status:409});
 assert.equal((await query('SELECT * FROM dev_request_messages WHERE request_id=$1',['ticket'])).length,6);

});
test('own messages edit safely in support and development, without changing system logs',async()=>{
 const {editMessage,ensureMessageEdits}=await import('../src/lib/messageEdits.js');
 await db.exec('CREATE TABLE support_messages (LIKE dev_request_messages INCLUDING ALL); ALTER TABLE support_messages RENAME COLUMN request_id TO ticket_id;');
 for(const [kind,table,parent] of [['support','support_messages','ticket_id'],['development','dev_request_messages','request_id']]){
  await ensureMessageEdits(kind);
  await query(`INSERT INTO ${table}(id,${parent},author_id,author_name,body) VALUES('editable','ticket','111111111111111111','Name','Original')`);
  await assert.rejects(editMessage(kind,'ticket','editable','222222222222222222','Changed','Original',true),{status:403});
  await assert.rejects(editMessage(kind,'wrong','editable','111111111111111111','Changed','Original',true),{status:403});
  await assert.rejects(editMessage(kind,'ticket','editable','111111111111111111','  ','Original',true),{status:400});
  const result=await editMessage(kind,'ticket','editable','111111111111111111','Corrected','Original',false);assert(result.editedAt);assert.equal(result.body,'Corrected');
  await assert.rejects(editMessage(kind,'ticket','editable','111111111111111111','Stale overwrite','Original',true),{status:409});
  const [stored]=await query(`SELECT * FROM ${table} WHERE id='editable'`);assert.equal(stored.edit_history[0].body,'Original');assert.equal(stored.internal,false);
  await query(`UPDATE ${table} SET internal=true WHERE id='editable'`);
  await assert.rejects(editMessage(kind,'ticket','editable','111111111111111111','Changed','Corrected',false),{status:403});
  await query(`UPDATE ${table} SET system_generated=true WHERE id='editable'`);
  await assert.rejects(editMessage(kind,'ticket','editable','111111111111111111','Changed','Corrected',true),{status:403});
 }
});
after(()=>db.close());
