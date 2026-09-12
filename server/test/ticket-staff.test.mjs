import {test,mock} from 'node:test';
import assert from 'node:assert/strict';
const members=[{id:'111111111111111111',nick:'Guild Developer',roles:['1542499913957376140']},{id:'222222222222222222',username:'Support',roles:['1542234301322629130']},{id:'333333333333333333',username:'Director',roles:['1534380748247666796']},{id:'444444444444444444',username:'Owner',roles:['1534911171319042159']},{id:'555555555555555555',username:'Member',roles:[]}];
mock.module('../src/lib/discord.js',{namedExports:{fetchGuildMembers:async()=>members,fetchGuildMember:async(g,id)=>members.find(m=>m.id===id)}});
const {ticketStaff,validateTicketStaff}=await import('../src/lib/ticketStaff.js');
test('developer picker lists only developer-role members and uses guild nickname',async()=>{assert.deepEqual(await ticketStaff('dev'),[{discordId:members[0].id,name:'Guild Developer'}]);});
test('support participants accept support, director and owner roles only',async()=>{assert.equal((await ticketStaff('support')).length,3);for(const m of members.slice(1,4))assert.equal((await validateTicketStaff(m.id,'support')).discordId,m.id);await assert.rejects(validateTicketStaff(members[4].id,'support'),{status:403});});
test('assignment validation rejects missing users, wrong roles and invalid IDs',async()=>{await assert.rejects(validateTicketStaff(members[1].id,'dev'),{status:403});await assert.rejects(validateTicketStaff('999999999999999999','dev'),{status:403});await assert.rejects(validateTicketStaff('123','dev'),{status:400});});
