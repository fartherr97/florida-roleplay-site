import {test,mock,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();const query=async(sql,args=[]) => (await db.query(sql,args)).rows;
const originalFetch=globalThis.fetch,oldToken=process.env.DISCORD_BOT_TOKEN;
after(async()=>{globalThis.fetch=originalFetch;if(oldToken===undefined)delete process.env.DISCORD_BOT_TOKEN;else process.env.DISCORD_BOT_TOKEN=oldToken;await db.close();});
process.env.DISCORD_BOT_TOKEN='mock-token';
mock.module('../src/db.js',{namedExports:{execute:query,query}});
mock.module('../src/lib/roleSync.js',{namedExports:{resolveRoleKeys:async roles=>roles}});
mock.module('../src/middleware/requirePermission.js',{namedExports:{loadGrants:async()=>({})}});
mock.module('../src/permissions.js',{namedExports:{permissionsFor:roles=>new Set(roles)}});
mock.module('../src/lib/discord.js',{namedExports:{fetchGuildMember:async(g,id)=>({roles:id==='555555555555555555'?[]:['1542499913957376140','support.work',...(id==='222222222222222222'?['ownership']:[])]})}});
mock.module('../src/lib/supportQueueRoles.js',{namedExports:{grantQueueRoles:async()=>{}}});
const {ensureTicketDms,enqueueTicketDms,replyRecipients,drainTicketDms}=await import('../src/lib/ticketDms.js');
await db.exec(`CREATE TABLE dev_requests(id text primary key,subject text,opened_by_discord_id text,assigned_to_discord_id text,assignees jsonb);
CREATE TABLE dev_request_messages(id text primary key,request_id text,internal boolean,author_id text,author_name text,body text);
CREATE TABLE dev_request_participants(request_id text,discord_id text);
CREATE TABLE support_tickets(id text primary key,type text,subject text,opened_by_discord_id text,assigned_to_discord_id text);
CREATE TABLE support_messages(id text primary key,ticket_id text,internal boolean,author_id text,author_name text,body text);
CREATE TABLE support_ticket_participants(ticket_id text,discord_id text);
CREATE TABLE support_type_config(id text,document jsonb);`);
const opener='111111111111111111',worker='222222222222222222',guest='333333333333333333',sender='444444444444444444',revoked='555555555555555555';
const ticket={id:'T1',openedByDiscordId:opener,participants:[{discordId:guest}],assignees:[{discordId:worker},{discordId:revoked}],assignedToDiscordId:worker};
await query('INSERT INTO dev_requests VALUES($1,$2,$3,$4,$5)',['T1','Test ticket',opener,worker,JSON.stringify(ticket.assignees)]);
await query('INSERT INTO dev_request_participants VALUES($1,$2)',['T1',guest]);
await ensureTicketDms();
let posts=[];
function accept(){globalThis.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);if(url.endsWith('/users/@me/channels'))return {ok:true,json:async()=>({id:body.recipient_id})};posts.push({url,body});return {ok:true,json:async()=>({id:'sent'})};};}
async function queue(id,internal=false){await query('INSERT INTO dev_request_messages VALUES($1,$2,$3,$4,$5,$6)',[id,'T1',internal,sender,'Writer','Reply text']);await enqueueTicketDms('development',ticket,{id,internal,authorId:sender},query);}
test('public reply reaches opener, participant and eligible assignee once; sender and revoked worker excluded',async()=>{
 assert.deepEqual(replyRecipients(ticket,{authorId:opener,internal:true}),[worker,revoked]);
 await queue('m1');await enqueueTicketDms('development',ticket,{id:'m1',authorId:sender},query);accept();await drainTicketDms();assert.equal(posts.length,3);assert(posts.every(p=>!p.url.includes(revoked)));assert(posts[0].body.embeds[0].description.includes('Open ticket'));assert(posts.every(p=>p.body.enforce_nonce && p.body.allowed_mentions.parse.length===0));await drainTicketDms();assert.equal(posts.length,3);
});
test('internal replies reach only current workers, never the opener or participants',async()=>{posts=[];await queue('m2',true);accept();await drainTicketDms();assert.equal(posts.length,1);assert(posts[0].url.includes(worker));});
test('removed participants are rechecked before delivery and blocked DMs do not prevent others',async()=>{
 await queue('m3');await query('DELETE FROM dev_request_participants');posts=[];globalThis.fetch=async(url,opts)=>{const body=JSON.parse(opts.body);if(body.recipient_id===opener)return {ok:false,status:403,json:async()=>({})};if(body.recipient_id)return {ok:true,json:async()=>({id:body.recipient_id})};posts.push(body);return {ok:true,json:async()=>({id:'ok'})};};await drainTicketDms();assert.equal(posts.length,1);assert.equal((await query("SELECT status FROM ticket_dm_outbox WHERE message_id='m3' AND recipient_id=$1",[opener]))[0].status,'failed');
});
test('network errors remain queued for retry instead of dropping notifications',async()=>{await queue('m4',true);globalThis.fetch=async()=>{throw Error('offline');};await drainTicketDms();assert.equal((await query("SELECT status FROM ticket_dm_outbox WHERE message_id='m4' AND recipient_id=$1",[worker]))[0].status,'pending');await query("UPDATE ticket_dm_outbox SET available_at=CURRENT_TIMESTAMP WHERE message_id='m4'");accept();await drainTicketDms();assert.equal((await query("SELECT status FROM ticket_dm_outbox WHERE message_id='m4' AND recipient_id=$1",[worker]))[0].status,'sent');});
test('support replies notify opener and assigned worker with support ticket link',async()=>{
 await query('INSERT INTO support_tickets VALUES($1,$2,$3,$4,$5)',['S1','general','Support test',opener,worker]);await query('INSERT INTO support_messages VALUES($1,$2,false,$3,$4,$5)',['s1','S1',sender,'Writer','Help']);await enqueueTicketDms('support',{id:'S1',openedByDiscordId:opener,assignedToDiscordId:worker},{id:'s1',authorId:sender},query);posts=[];accept();await drainTicketDms();assert.equal(posts.length,2);assert(posts.every(p=>p.body.embeds[0].url.endsWith('/support/S1')));
});

test('transfer public DMs include creator and subject; internal DMs recheck staff and never expose notes to transferee',async()=>{
 await db.exec('CREATE TABLE transfers(id text,member_name text,from_dept text,to_dept text,created_by_id text,subject_discord_id text); CREATE TABLE transfer_messages(id text,transfer_id text,author_id text,author_name text,body text,internal boolean);');
 await query('INSERT INTO transfers VALUES($1,$2,$3,$4,$5,$6)',['TR1','Member','FHP','BSO',opener,guest]);
 const transfer={id:'TR1',openedByDiscordId:opener,participants:[{discordId:guest}],assignees:[{discordId:worker},{discordId:revoked},{discordId:guest}]};
 for(const internal of [false,true]) {
   const id=internal?'ti':'tp';
   await query('INSERT INTO transfer_messages VALUES($1,$2,$3,$4,$5,$6)',[id,'TR1',sender,'Author','Transfer update',internal]);
   await enqueueTicketDms('transfer',transfer,{id,internal,authorId:sender},query);posts=[];accept();await drainTicketDms();
   assert.equal(posts.length,internal?1:3);assert(posts.every(p=>p.body.embeds[0].url.endsWith('/transfers/t/TR1')));
   if(internal)assert(posts[0].url.includes(worker));
 }
});
