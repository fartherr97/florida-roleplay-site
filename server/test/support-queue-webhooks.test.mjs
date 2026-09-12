import {test,mock,after} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();const originalFetch=globalThis.fetch;after(async()=>{globalThis.fetch=originalFetch;await db.close();});
mock.module('../src/db.js',{namedExports:{query:async(sql,args=[]) => (await db.query(sql,args)).rows}});
const {ensureTable,queueWebhookEdits,saveQueueWebhookEdits,loadSupportWebhooks,supportTicketPayload,notifyTicketOpened}=await import('../src/lib/supportWebhooks.js');
const guild='111111111111111111',role='222222222222222222',url='https://discord.com/api/webhooks/333333333333333333/test-token';
const type={id:'ia',label:'Internal Affairs',workGuildId:guild,workRoleIds:[role],exclusive:true};
const ticket={id:'TEST',subject:'Department report',openedByName:'Main guild name',openedByDiscordId:'444444444444444444'};
test('queue save verifies guild without posting, persists privately, and preserves other queues',async()=>{
 await ensureTable();let reads=0;globalThis.fetch=async(_,opts)=>{assert.notEqual(opts.method,'POST');reads++;return {ok:true,json:async()=>({guild_id:guild})};};
 const edits=await queueWebhookEdits([{...type,webhookUrl:url}],[type],[type]);assert.equal(reads,1);
 await saveQueueWebhookEdits({other:url});await saveQueueWebhookEdits(edits);
 assert.equal((await loadSupportWebhooks()).deptWebhooks.ia,url);assert.equal((await loadSupportWebhooks()).deptWebhooks.other,url);
 assert.deepEqual(await queueWebhookEdits([type],[type],[type]),{});
 await assert.rejects(queueWebhookEdits([{...type,webhookUrl:'https://example.com/hook'}],[type]),{status:400});
 globalThis.fetch=async()=>({ok:true,json:async()=>({guild_id:'999999999999999999'})});
 await assert.rejects(queueWebhookEdits([{...type,webhookUrl:url}],[type]),{status:400});
 await assert.rejects(queueWebhookEdits([{...type,workGuildId:'888888888888888888'}],[{...type,workGuildId:'888888888888888888'}],[type]),{status:400});
});
test('notification sends one embed with title/opener/link and only selected role pings',async()=>{
 const body=supportTicketPayload(ticket,type,[role,role,'invalid']);assert.equal(body.content,`<@&${role}>`);assert.deepEqual(body.allowed_mentions,{parse:[],roles:[role],users:[]});assert.equal(body.embeds[0].title,ticket.subject);assert(body.embeds[0].url.endsWith('/support/TEST'));assert(body.embeds[0].fields[0].value.includes(ticket.openedByName));
 let posts=0;globalThis.fetch=async(dest,opts)=>{posts++;assert.equal(dest,url);assert.equal(opts.method,'POST');assert.deepEqual(JSON.parse(opts.body).allowed_mentions,body.allowed_mentions);return {ok:true};};
 assert.equal(await notifyTicketOpened(ticket,type),true);assert.equal(posts,1);
 globalThis.fetch=async()=>{throw Error('offline');};assert.equal(await notifyTicketOpened(ticket,type),false);
});
test('clearing webhook keeps other queues and confidential tickets never fall back to general',async()=>{
 await saveQueueWebhookEdits(await queueWebhookEdits([{...type,webhookUrl:''}],[type],[type]));
 await db.query('UPDATE support_webhook_settings SET support_webhook_url=$1',[url]);
 globalThis.fetch=async()=>{assert.fail('confidential ticket must not use general webhook');};
 assert.equal(await notifyTicketOpened(ticket,type),false);assert.equal((await loadSupportWebhooks()).deptWebhooks.other,url);
});
