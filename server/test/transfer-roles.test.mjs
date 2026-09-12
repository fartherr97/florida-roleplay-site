import {test,mock,after} from 'node:test';
import assert from 'node:assert/strict';
const from='111111111111111111',to='222222222222222222',user='333333333333333333';
const oldFetch=globalThis.fetch;after(()=>globalThis.fetch=oldFetch);
process.env.BOT_API_URL='https://bot.invalid';process.env.WHITELIST_INGEST_TOKEN='test';
let operations=[],failAdd=false,failRemove=false;
mock.module('../src/db.js',{namedExports:{execute:async()=>[],query:async(sql,args)=>sql.includes('roster_role_map')?[{role_id:'rank',department:'bso',rank_label:'Deputy',rank_full:'Deputy'},{role_id:'oldrank',department:'bso',rank_label:'Sergeant'}]:[{config:{guildId:args[0]==='fhp'?from:to}}]}});
mock.module('../src/lib/discord.js',{namedExports:{fetchGuildMember:async guild=>({roles:guild===from?['trooper','admin','bot','custom']:['oldrank']}),
 addMemberRole:async(g,u,r)=>{operations.push(['add',g,r]);return !failAdd;},removeMemberRole:async(g,u,r)=>{operations.push(['remove',g,r]);return !failRemove;}}});
globalThis.fetch=async url=>({ok:true,json:async()=>url.includes('sync-config')?{guilds:[{discordGuildId:from,stripRoleIds:['admin'],protectedRoleIds:['custom']},{discordGuildId:to,grantRoleIds:['base','oldrank','rank']}]}
 :url.includes(from)?[{id:'trooper',name:'Trooper'},{id:'admin',name:'Senior Admin Access'},{id:'bot',name:'Integration',managed:true},{id:'custom',name:'Special access'}]
 :[{id:'base',name:'Member'},{id:'rank',name:'Deputy'},{id:'oldrank',name:'Sergeant'}]});
const {applyProcessedTransfer,protectedTransferRole}=await import('../src/lib/transferRoles.js');
const args={discordUserId:user,fromDept:'FHP',toDept:'BSO',assignedRank:'Deputy'};
test('staff names and explicit protected IDs survive; unknown ranks fail before writes',async()=>{
 for(const name of ['Admin Access','Senior Admin','Administrator','Staff','Moderator','Director','Ownership','Developer'])assert(protectedTransferRole({name}));
 assert(!protectedTransferRole({name:'Trooper'}));
 assert.equal((await applyProcessedTransfer({...args,assignedRank:'Made Up'})).applied,false);assert.equal(operations.length,0);
});
test('incoming grant failures never strip outgoing roles',async()=>{failAdd=true;operations=[];const result=await applyProcessedTransfer(args);assert.equal(result.applied,false);assert(operations.every(o=>o[0]==='add'));});
test('success assigns selected rank, removes previous incoming rank and only outgoing nonstaff roles',async()=>{
 failAdd=false;operations=[];const result=await applyProcessedTransfer(args);assert.equal(result.applied,true);
 assert.deepEqual(operations,[['add',to,'base'],['add',to,'rank'],['remove',to,'oldrank'],['remove',from,'trooper']]);
});
test('removal failure is not reported as a successful transfer',async()=>{failRemove=true;assert.equal((await applyProcessedTransfer(args)).applied,false);});
