import { fetchGuildMember, fetchGuildRoles } from './discord.js';
import { guildIdForDept } from './transferRoles.js';
const snowflake = /^\d{17,20}$/;
const cache = new Map();
export async function queueGuilds() {
  const entries = [{id:process.env.DISCORD_GUILD_ID,name:'FLRP Main Guild'}];
  for (const [dept,name] of [['fhp','FHP'],['bso','BSO'],['mpd','MPD'],['civilian','Civilian']]) {
    entries.push({id:await guildIdForDept(dept),name:name+' Guild'});
  }
  const unique = new Map();
  for(const guild of entries)if(snowflake.test(guild.id) && !unique.has(guild.id))unique.set(guild.id,guild);
  return [...unique.values()];
}
export async function queueRoles(guildId) {
  if (!(await queueGuilds()).some(g=>g.id===guildId)) throw Object.assign(new Error('Choose a configured guild.'),{status:400});
  const roles = await fetchGuildRoles(guildId);
  if (!roles) throw Object.assign(new Error('Discord roles are unavailable.'),{status:503});
  return roles;
}
export async function grantQueueRoles(user,types,permissions) {
  // Membership is fetched on the server. Never accept client-supplied role lists.
  if (!user?.id) return;
  const guilds = [...new Set(types.map(t=>t.workGuildId).filter(Boolean))];
  for (const guild of guilds) {
    const key = guild+':'+user.id;
    let entry = cache.get(key);
    if (!entry || entry.until < Date.now()) {
      if(cache.size>5000)cache.clear();
      entry = {until:Date.now()+30000,value:fetchGuildMember(guild,user.id).then(m=>m?.roles || []).catch(()=>[])};
      cache.set(key,entry);
    }
    const held = new Set(await entry.value);
    for (const type of types) if(type.workGuildId===guild && type.workRoleIds?.some(id=>held.has(id))) {
      permissions.add('support.discordqueue.'+type.id);
    }
  }
}
export async function validateQueueRoles(types) {
  const byGuild = new Map();
  for(const type of types) if(type.workGuildId) {
    if(!byGuild.has(type.workGuildId))byGuild.set(type.workGuildId,await queueRoles(type.workGuildId));
    const roles = byGuild.get(type.workGuildId);
    if(type.workRoleIds.some(id=>!roles.some(r=>r.id===id)))throw Object.assign(new Error(type.label+': a selected role no longer exists in that guild.'),{status:400});
    type.workRoleNames = Object.fromEntries(roles.filter(r=>type.workRoleIds.includes(r.id)).map(r=>[r.id,r.name]));
  }
}
