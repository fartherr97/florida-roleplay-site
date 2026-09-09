--[[
  flrp-playermeta — a tiny bridge that hands the website one player's txAdmin
  metadata (play time, join date, last connection) by Discord id, so the
  /bgcheck embed can show it. txAdmin has no clean public API for this, so this
  reads txAdmin's own player database file and serves it over an authenticated
  HTTP endpoint.

  Set two convars in your server.cfg (before this resource starts):

    set flrp_meta_token "a-long-random-secret"      # must match TXADMIN_META_TOKEN on the website
    set flrp_playersdb  "/path/to/txData/<profile>/data/playersDB.json"

  Then point the website's TXADMIN_META_URL at this resource, e.g.
    https://<your-fivem-host>:30120/flrp-playermeta/meta
  (the site appends ?discord=<id>). Restart the resource after changing convars.

  Response shape (what the website expects):
    { "playTimeMinutes": 4964, "joinedAt": 1753833600, "lastConnection": 1758000000 }
  Timestamps may be unix seconds, milliseconds, or ISO strings — the website
  normalizes them. Returns 404 when the player is not in the DB.

  Note: this targets txAdmin v7's playersDB.json (players keyed with an `ids`
  array containing "discord:<id>", plus `playTime`, `tsJoined`,
  `tsLastConnection`). If your txAdmin stores it differently, adjust readDb().
]]

local TOKEN = GetConvar('flrp_meta_token', '')
local DB_PATH = GetConvar('flrp_playersdb', '')
local CACHE_MS = 30000 -- re-read the DB at most this often

local cache = { at = 0, byDiscord = nil }

--- Read and index the txAdmin player DB by discord id, cached briefly.
local function readDb()
  local now = GetGameTimer()
  if cache.byDiscord and (now - cache.at) < CACHE_MS then
    return cache.byDiscord
  end
  if DB_PATH == '' then return nil end

  local file = io.open(DB_PATH, 'r')
  if not file then
    print('[flrp-playermeta] could not open players DB at: ' .. DB_PATH)
    return nil
  end
  local contents = file:read('*a')
  file:close()

  local ok, parsed = pcall(json.decode, contents)
  if not ok or type(parsed) ~= 'table' then
    print('[flrp-playermeta] players DB is not valid JSON')
    return nil
  end

  local players = parsed.players or parsed
  local byDiscord = {}
  for _, p in pairs(players) do
    local ids = p.ids or {}
    for _, id in ipairs(ids) do
      local discord = tostring(id):match('^discord:(%d+)$')
      if discord then
        byDiscord[discord] = {
          playTimeMinutes = p.playTime,
          joinedAt = p.tsJoined,
          lastConnection = p.tsLastConnection,
        }
      end
    end
  end

  cache.byDiscord = byDiscord
  cache.at = now
  return byDiscord
end

SetHttpHandler(function(req, res)
  local function send(status, body)
    res.writeHead(status, { ['Content-Type'] = 'application/json' })
    res.send(json.encode(body))
  end

  -- Auth: a bearer token that must match the website's TXADMIN_META_TOKEN.
  if TOKEN ~= '' then
    local auth = req.headers['Authorization'] or req.headers['authorization'] or ''
    if auth ~= ('Bearer ' .. TOKEN) then
      return send(401, { error = 'unauthorized' })
    end
  end

  local discord = req.path:match('[?&]discord=(%d+)')
  if not discord then
    return send(400, { error = 'missing discord id' })
  end

  local byDiscord = readDb()
  if not byDiscord then
    return send(503, { error = 'players db unavailable' })
  end

  local meta = byDiscord[discord]
  if not meta then
    return send(404, { error = 'player not found' })
  end
  return send(200, meta)
end)

print('[flrp-playermeta] ready' ..
  (TOKEN == '' and ' (WARNING: no flrp_meta_token set — endpoint is unauthenticated)' or '') ..
  (DB_PATH == '' and ' (ERROR: flrp_playersdb not set)' or ''))
