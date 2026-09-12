import {test,mock,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import express from 'express';
const db=new PGlite();
const schema=await readFile(new URL('../src/schema.sql',import.meta.url),'utf8');
for(const table of ['transfers','transfer_messages','department_configs','department_audit_log']) await db.exec(schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`))[0]);
const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
mock.module('../src/db.js',{namedExports:{query,execute:query,transaction:fn=>db.transaction(tx=>fn(async(sql,args=[]) => (await tx.query(sql,args)).rows))}});
const owner='111111111111111111',subject='222222222222222222',head='333333333333333333';
mock.module('../src/middleware/requireRole.js',{namedExports:{resolveUser:async req=>({id:req.headers['x-user'] || owner,displayName:'Test User',username:'test',roles:(req.headers['x-roles'] || 'ownership').split(',')})}});
mock.module('../src/lib/roleSync.js',{namedExports:{resolveRoleKeys:async roles=>roles}});
mock.module('../src/lib/discord.js',{namedExports:{fetchGuildMember:async()=>({roles:[]})}});
let calls=[], success=false;
mock.module('../src/lib/transferRoles.js',{namedExports:{applyProcessedTransfer:async args=>{calls.push(args);return {applied:success,reason:success?undefined:'discord_preflight_failed',removed:[],added:[],failed:[]};}}});
delete process.env.DISCORD_BOT_TOKEN;
const {default:router}=await import('../src/routes/transfers.js');
const {withEmploymentHistory}=await import('../src/lib/transferRecords.js');
const {backgroundFor}=await import('../src/lib/discipline.js');
const app=express();app.use(express.json());app.use('/api/transfers',router);
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const url=`http://127.0.0.1:${server.address().port}/api/transfers`;
after(async()=>{await new Promise(r=>server.close(r));await db.close();});
async function request(path,body,roles='ownership',id=owner,method='PATCH') {
  const response=await fetch(url+path,{method,headers:{'Content-Type':'application/json','x-roles':roles,'x-user':id},body:JSON.stringify(body)});
  return {status:response.status,body:await response.json()};
}
let ticket;
test('creation binds subject, not opener; nonstaff cannot impersonate another subject',async()=>{
 const body={member:'Transferee',discord:'person',rank:'Trooper',fromDept:'FHP',toDept:'BSO',reason:'Detailed transfer reason. '.repeat(10),subjectDiscordId:subject};
 const created=await request('',body,'ownership',owner,'POST');assert.equal(created.status,201);ticket=created.body.id;assert.equal(created.body.subjectDiscordId,subject);assert.equal(created.body.createdById,owner);
 const own=await request('',{...body,subjectDiscordId:owner},'member',subject,'POST');assert.equal(own.status,201);assert.equal(own.body.subjectDiscordId,subject);
});
test('internal messages are rejected, public replies queue participants without echoing sender',async()=>{
 const denied=await request('/chat',{transferId:ticket,message:'Private',internal:true},'member',subject,'POST');assert.equal(denied.status,403);
 const sent=await request('/chat',{transferId:ticket,message:'Hello'},'member',subject,'POST');assert.equal(sent.status,201);
 const jobs=await query('SELECT * FROM ticket_dm_outbox WHERE message_id=$1',[sent.body.id]);assert.deepEqual(jobs.map(j=>j.recipient_id),[owner]);
});
test('processing requires management and two approvals; Discord failure does not complete',async()=>{
 const args={action:'process',assignedRank:'Deputy'};
 assert.equal((await request('/'+ticket,args,'fhp_colonel',head)).status,403);
 assert.equal((await request('/'+ticket,args)).status,409);assert.equal(calls.length,0);
 assert.equal((await request('/'+ticket,{action:'approve'})).status,200);
 const failed=await request('/'+ticket,args);assert.equal(failed.status,409);assert.equal(failed.body.transfer.status,'approved');assert.equal(calls[0].discordUserId,subject);
 assert.equal((await query('SELECT * FROM department_audit_log')).length,0);
});
test('success records both departments and background exactly once; completed requests cannot reprocess',async()=>{
 success=true;
 const done=await request('/'+ticket,{action:'process',assignedRank:'Deputy'});assert.equal(done.status,200);assert.equal(done.body.status,'completed');
 assert.equal((await query('SELECT * FROM department_audit_log')).length,2);
 const bg=await withEmploymentHistory(backgroundFor([],{discordId:subject}));assert.equal(bg.total,0);assert.equal(bg.employment.length,2);assert(bg.employment.some(e=>e.type==='Transfer In'));
 const count=calls.length;assert.equal((await request('/'+ticket,{action:'process',assignedRank:'Deputy'})).status,409);assert.equal(calls.length,count);
 assert.equal((await request('/'+ticket,{action:'close'})).status,200);assert.equal((await request('/'+ticket,{action:'reopen'})).status,409);
});
test('resignations appear in personnel history for only the named member',async()=>{
 const [row]=await query("SELECT config FROM department_configs WHERE id='bso'");
 row.config.pages.find(p=>p.type==='adminlog').config.entries.push({id:'resign',type:'Resignation',subject:{discordId:subject},at:new Date().toISOString(),by:{name:'Sheriff'},values:[]});
 await query("UPDATE department_configs SET config=$1 WHERE id='bso'",[JSON.stringify(row.config)]);
 const bg=await withEmploymentHistory(backgroundFor([],{discordId:subject}));assert.equal(bg.total,0);assert.equal(bg.employment.length,3);
 assert.equal((await withEmploymentHistory(backgroundFor([],{discordId:head}))).employment.length,0);
});

