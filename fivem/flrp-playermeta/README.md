# flrp-playermeta

A small FiveM resource that lets the website's `/bgcheck` embed show a player's
**play time, join date, and last connection** — the numbers txAdmin already
tracks. txAdmin has no clean API to look a player up by Discord id, so this
resource reads txAdmin's own player database and serves that one player's
metadata over an authenticated HTTP endpoint the website calls.

## Install

1. Copy the `flrp-playermeta` folder into your server's `resources/`.
2. In `server.cfg`, before the `ensure`:
   ```
   set flrp_meta_token "a-long-random-secret"
   set flrp_playersdb  "/absolute/path/to/txData/<your-profile>/data/playersDB.json"
   ensure flrp-playermeta
   ```
   - `flrp_meta_token` — any long random string. It must match `TXADMIN_META_TOKEN` on the website.
   - `flrp_playersdb` — the absolute path to txAdmin's `playersDB.json`. It's inside your `txData` folder under your server profile (`.../data/playersDB.json`).
3. Restart the server (or `ensure flrp-playermeta` + `restart flrp-playermeta`). The console prints `[flrp-playermeta] ready`.

## Point the website at it

On the website server set:
```
TXADMIN_META_URL=http://<your-fivem-host>:30120/flrp-playermeta/meta
TXADMIN_META_TOKEN=<the same secret as flrp_meta_token>
```
The site appends `?discord=<id>` and reads the JSON back. If `TXADMIN_META_URL`
is unset, `/bgcheck` simply omits the play-time / join / last-connection lines —
everything else works unchanged.

The endpoint must be reachable from the website's host. If your FiveM server
isn't publicly reachable on 30120, put it behind your reverse proxy (e.g.
`https://tx.flrp.us/flrp-playermeta/meta`) and use that URL instead.

## Response

```
GET /flrp-playermeta/meta?discord=1052403544944283680
Authorization: Bearer <flrp_meta_token>

200 { "playTimeMinutes": 4964, "joinedAt": 1753833600, "lastConnection": 1758000000 }
404 { "error": "player not found" }
```
Timestamps may be unix seconds, milliseconds, or ISO strings — the website
normalizes them either way.

## txAdmin version note

This targets txAdmin v7's `playersDB.json` shape: players carry an `ids` array
containing `discord:<id>`, plus `playTime` (minutes), `tsJoined`, and
`tsLastConnection` (unix seconds). If your txAdmin stores it differently, adjust
`readDb()` in `server.lua` — the HTTP/auth wiring stays the same.
