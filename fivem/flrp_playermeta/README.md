# flrp_playermeta

Feeds the website's `/bgcheck` embed a player's **play time, join date, and last
connection** — straight from the server's own `players` table (the one
`flrp_core` maintains, keyed by license, carrying `discord_id`,
`active_playtime_seconds`, `total_playtime_seconds`, `first_seen`, `last_seen`).

Like duty hours, the game **pushes** these rows to the website (FiveM servers
don't reliably expose their HTTP port), reusing the **same convars and shared
secret** the config/duty sync already use. If you already have `flrp_onduty`
pushing to the site, this needs **no new configuration** — just add the resource.

## Install

1. Copy the `flrp_playermeta` folder into your server's `resources/` (it needs
   `oxmysql`, which the FLRP server already runs).
2. In `server.cfg`, if they aren't already set for the duty/config sync:
   ```
   set flrp_site_api_url    "https://your-website"          # site root — NO trailing /api
   set flrp_site_api_secret "the-same-value-as-the-site-FIVEM_CONFIG_SECRET"
   ensure flrp_playermeta
   ```
   - `flrp_site_api_url` — your website's base URL. The resource POSTs to
     `<url>/api/fivem/players` and `<url>/api/fivem/players_bulk`.
   - `flrp_site_api_secret` — must equal the website's `FIVEM_CONFIG_SECRET`.
3. Restart (or `ensure flrp_playermeta`). The console prints
   `[flrp_playermeta] ready — pushing player meta to <url>`.

## What it does

- **On boot** it backfills every player that has a Discord id (in batches).
- **Every 15 minutes** it re-syncs, so play time and last-seen stay current.
- **On disconnect** it pushes that one player, so their session updates promptly.

The website mirrors what it receives into a `fivem_players` table and the
`/bgcheck` embed reads it back by Discord id. Nothing configured on the site
side beyond `FIVEM_CONFIG_SECRET` (already required for config + duty sync).

## No website setup needed

The website endpoint is already built (`POST /api/fivem/players[_bulk]`,
authenticated with `X-FLRP-Secret: <FIVEM_CONFIG_SECRET>`). Until the first push
arrives, `/bgcheck` just omits the play-time / join / last-connection lines —
everything else works unchanged.

## Payload

```
POST /api/fivem/players_bulk
X-FLRP-Secret: <FIVEM_CONFIG_SECRET>
{ "players": [
  { "discordId": "1052403544944283680", "license": "abc123",
    "name": "John Doe", "activePlaytimeSeconds": 297840,
    "totalPlaytimeSeconds": 305000, "firstSeen": 1753833600, "lastSeen": 1758000000 }
] }
```
Timestamps may be unix seconds, milliseconds, or ISO strings — the website
normalizes them.
