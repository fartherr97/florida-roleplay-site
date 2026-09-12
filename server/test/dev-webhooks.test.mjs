import { test, mock, after } from 'node:test';
import assert from 'node:assert/strict';
let saved = null;
mock.module('../src/db.js', {namedExports:{query:async(sql,args) => {
  if (sql.includes('INSERT INTO')) saved=args[0];
  return sql.startsWith('SELECT') && saved ? [{webhook_url:saved}] : [];
}}});
const { devTicketPayload, DEV_PING_ROLES, saveDevWebhook, devWebhookStatus, notifyDevTicketOpened } = await import('../src/lib/devWebhooks.js');
const ticket={id:'TEST-123',subject:'MPD livery request',openedByName:'Main Guild Name',openedByDiscordId:'111111111111111111',category:'Department work'};
const originalFetch=globalThis.fetch;
after(() => {globalThis.fetch=originalFetch;});
test('embed carries title, opener and ticket link; only three exact roles can ping',()=>{
  const body=devTicketPayload(ticket);
  assert.equal(body.content,DEV_PING_ROLES.map(id=>`<@&${id}>`).join(' '));
  assert.deepEqual(body.allowed_mentions,{parse:[],roles:DEV_PING_ROLES,users:[]});
  assert.equal(body.embeds[0].title,ticket.subject);
  assert(body.embeds[0].url.endsWith('/development/requests/TEST-123'));
  assert(body.embeds[0].fields[0].value.includes('Main Guild Name'));
});
test('settings reject non-Discord URLs, never return the secret and deliver after configuration',async()=>{
  assert.equal((await devWebhookStatus()).configured,false);
  await assert.rejects(saveDevWebhook('https://example.com/hook','owner'),{status:400});
  const result=await saveDevWebhook('https://discord.com/api/webhooks/123456789012345678/test-token','owner');
  assert.equal(result.configured,true);assert(!JSON.stringify(result).includes('test-token'));
  let calls=0;
  globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,saved);assert.equal(JSON.parse(options.body).embeds[0].title,ticket.subject);return {ok:true};};
  assert.equal(await notifyDevTicketOpened(ticket),true);assert.equal(calls,1);
  globalThis.fetch=async()=>{throw new Error('offline');};
  assert.equal(await notifyDevTicketOpened(ticket),false);
});
