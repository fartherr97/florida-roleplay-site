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
});
after(()=>db.close());
