import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guildDisplayName,withGuildNames} from '../src/lib/guildDisplayName.js';
test('main guild names replace roster names and preserve bot labels',async()=>{
 const previousFetch=globalThis.fetch;
 const oldGuild=process.env.DISCORD_GUILD_ID;
 const oldToken=process.env.DISCORD_BOT_TOKEN;
 process.env.DISCORD_GUILD_ID='main-guild';
 process.env.DISCORD_BOT_TOKEN='test-placeholder';
 const urls=[];
 globalThis.fetch=async url=>{urls.push(url);return {ok:true,json:async()=>({nick:'100 | Owner | Mike',user:{global_name:'Global Name'}})};};
 try {
   const user={id:'999999999999999999',displayName:'Department Nick'};
   assert.equal(await guildDisplayName(user),'100 | Owner | Mike');
   const rows=await withGuildNames([{authorId:user.id,authorName:'Old Department Nick'},{authorId:user.id,authorName:'Stale name'},{authorId:null,authorName:'FLRP Dev Hub'}]);
   assert.equal(rows[0].authorName,'100 | Owner | Mike');
   assert.equal(rows[1].authorName,rows[0].authorName);
   assert.equal(rows[2].authorName,'FLRP Dev Hub');
   assert.deepEqual(urls,[`https://discord.com/api/v10/guilds/main-guild/members/${user.id}`]);
 } finally {
   globalThis.fetch=previousFetch;
   if(oldGuild===undefined) delete process.env.DISCORD_GUILD_ID; else process.env.DISCORD_GUILD_ID=oldGuild;
   if(oldToken===undefined) delete process.env.DISCORD_BOT_TOKEN; else process.env.DISCORD_BOT_TOKEN=oldToken;
 }
});
