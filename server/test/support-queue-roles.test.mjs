import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
const main='111111111111111111',dept='222222222222222222',role='333333333333333333';
process.env.DISCORD_GUILD_ID=main;
mock.module('../src/lib/transferRoles.js',{namedExports:{guildIdForDept:async d=>d==='fhp'?dept:main}});
mock.module('../src/lib/discord.js',{namedExports:{fetchGuildRoles:async()=>[{id:role,name:'Command'}],fetchGuildMember:async(g,u)=>{if(u==='error')throw Error('Discord offline');return {roles:g===dept && u==='worker'?[role]:[]};}}});
const {grantQueueRoles,validateQueueRoles,queueGuilds}=await import('../src/lib/supportQueueRoles.js');
const {canWorkType,canViewTicket,canWorkTicket,isAgent,normalizeTicketTypes,validateTicketType}=await import('../src/lib/support.js');
const type={id:'custom_ia',label:'IA',workGuildId:dept,workRoleIds:[role],workPermissions:['support.fhp'],exclusive:true,fields:[]};
test('guild choices deduplicate main without losing main label',async()=>{assert.deepEqual(await queueGuilds(),[{id:main,name:'FLRP Main Guild'},{id:dept,name:'FHP Guild'}]);});
test('correct guild role grants queue work and visibility without global support permissions',async()=>{
 const permissions=new Set();await grantQueueRoles({id:'worker'},[type],permissions);
 const ctx={user:{id:'worker'},permissions};assert(canWorkType(type,permissions));assert(isAgent(ctx,[type]));assert(canViewTicket({type:type.id},ctx,[type]));assert(canWorkTicket({type:type.id},ctx,[type]));
 assert(!canWorkType({...type,id:'other'},permissions));
});
test('wrong guild, no role, legacy permissions and failed Discord lookup cannot enter restricted queue',async()=>{
 for(const user of ['outsider','error']){const permissions=new Set(['support.work','support.fhp']);await grantQueueRoles({id:user},[type],permissions);assert(!canWorkType(type,permissions));}
 const other={...type,workGuildId:main};const permissions=new Set();await grantQueueRoles({id:'worker'},[other],permissions);assert(!canWorkType(other,permissions));
 assert(canWorkType({...type,exclusive:false},new Set(['support.work'])));
});
test('save validates selected roles against guild and preserves settings through normalization',async()=>{
 const [normalized]=normalizeTicketTypes([type]);assert.equal(validateTicketType(normalized).length,0);await validateQueueRoles([normalized]);assert.equal(normalized.workRoleNames[role],'Command');
 await assert.rejects(validateQueueRoles([{...type,workRoleIds:['999999999999999999']}]),{status:400});
 assert(validateTicketType({...normalized,workRoleIds:[]}).length>0);
 assert(canWorkType({workPermissions:['support.fhp'],exclusive:true},new Set(['support.fhp'])));
});
