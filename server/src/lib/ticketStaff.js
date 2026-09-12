import { fetchGuildMembers, fetchGuildMember } from './discord.js';
export const SUPPORT_STAFF_ROLES = ['1542234301322629130','1534380748247666796','1534911171319042159'];
export const DEV_STAFF_ROLES = ['1542499913957376140'];
const cache = new Map();
const eligible = (m, roles) => m?.roles?.some(r => roles.includes(String(r)));
const shape = m => ({discordId:String(m.id),name:m.nick?.trim() || m.displayName || m.username || String(m.id)});
export async function ticketStaff(kind) {
  const roles=kind==='support' ? SUPPORT_STAFF_ROLES : DEV_STAFF_ROLES;
  const old=cache.get(kind);
  if(old && old.until>Date.now())return old.members;
  const all=await fetchGuildMembers();
  if(!all)throw Object.assign(new Error('Discord member list unavailable. Please retry.'),{status:503});
  const members=all.filter(m=>eligible(m,roles)).map(shape).sort((a,b)=>a.name.localeCompare(b.name));
  cache.set(kind,{members,until:Date.now()+30000});return members;
}
export async function validateTicketStaff(id,kind) {
  if(!/^\d{17,20}$/.test(id))throw Object.assign(new Error('Invalid Discord user ID.'),{status:400});
  const member=await fetchGuildMember(process.env.DISCORD_GUILD_ID,id);
  if(!eligible(member,kind==='support' ? SUPPORT_STAFF_ROLES : DEV_STAFF_ROLES))throw Object.assign(new Error('That member does not hold an eligible team role.'),{status:403});
  return shape(member);
}
