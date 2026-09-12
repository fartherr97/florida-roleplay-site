// Chat identity always comes from the configured main guild, never a department roster.
const cache = new Map();
export async function guildDisplayName(user) {
  const fallback = user?.displayName || user?.username || 'Unknown';
  const id = String(user?.id || '');
  if (!/^\d{15,22}$/.test(id) || !process.env.DISCORD_GUILD_ID || !process.env.DISCORD_BOT_TOKEN) return fallback;
  const cached = cache.get(id);
  if (cached && cached.until > Date.now()) return (await cached.value) || fallback;
  const value = (async () => {
    try {
      const response = await fetch(`https://discord.com/api/v10/guilds/${process.env.DISCORD_GUILD_ID}/members/${id}`, {
        headers: {Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`}, signal: AbortSignal.timeout(4000),
      });
      if (!response.ok) return null;
      const member = await response.json();
      return member.nick?.trim() || member.user?.global_name || member.user?.username || null;
    } catch { return null; }
  })();
  if (cache.size > 5000) cache.clear();
  cache.set(id, {value, until:Date.now() + 300000});
  return (await value) || fallback;
}
export async function withGuildNames(messages) {
  const names = new Map();
  const authors = [...new Map(messages.filter(m => /^\d{15,22}$/.test(m.authorId)).map(m => [m.authorId, m])).values()];
  // Bound concurrent Discord lookups; the cache coalesces simultaneous requests.
  for (let i = 0; i < authors.length; i += 4) {
    await Promise.all(authors.slice(i,i+4).map(async m => names.set(m.authorId, await guildDisplayName({id:m.authorId, displayName:m.authorName}))));
  }
  return messages.map(m => ({...m, authorName:names.get(m.authorId) || m.authorName, internal:Boolean(m.internal)}));
}
