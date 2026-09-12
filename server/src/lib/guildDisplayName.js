// Chat identity always comes from the configured main guild, never a department roster.
const cache = new Map();
async function guildProfile(user) {
  const id = String(user?.id || '');
  if (!/^\d{15,22}$/.test(id) || !process.env.DISCORD_GUILD_ID || !process.env.DISCORD_BOT_TOKEN) return null;
  const key = `${process.env.DISCORD_GUILD_ID}:${id}`;
  const cached = cache.get(key);
  if (cached && cached.until > Date.now()) return await cached.value;
  const value = (async () => {
    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${id}`, {
        headers: {Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`}, signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return null;
      const member = await response.json();
      const hash = member.user?.avatar;
      return {
        name: member.nick?.trim() || member.user?.global_name || member.user?.username || null,
        avatar: hash ? `https://cdn.discordapp.com/avatars/${id}/${hash}.${hash.startsWith('a_') ? 'gif' : 'png'}?size=128` : null,
      };
    } catch { return null; }
  })();
  if (cache.size > 5000) cache.clear();
  const entry = {value, until:Date.now() + 300000};
  cache.set(key, entry);
  const profile = await value;
  if (!profile) entry.until = Date.now() + 30000;
  return profile;
}
export async function guildDisplayName(user) {
  return (await guildProfile(user))?.name || user?.displayName || user?.username || 'Unknown';
}
export async function withGuildNames(messages) {
  const names = new Map();
  const authors = [...new Map(messages.filter(m => /^\d{15,22}$/.test(m.authorId)).map(m => [m.authorId, m])).values()];
  // Bound concurrent Discord lookups; the cache coalesces simultaneous requests.
  for (let i = 0; i < authors.length; i += 4) {
    await Promise.all(authors.slice(i,i+4).map(async m => names.set(m.authorId, await guildProfile({id:m.authorId}))));
  }
  return messages.map(m => ({...m, authorName:names.get(m.authorId)?.name || m.authorName, authorAvatar:names.get(m.authorId) ? names.get(m.authorId).avatar : m.authorAvatar, internal:Boolean(m.internal)}));
}
