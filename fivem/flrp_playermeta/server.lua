--[[
  flrp_playermeta — feeds the website's /bgcheck embed a player's play time,
  join date and last connection.

  The source of truth is the server's own `players` table (see the flrp-server
  repo, database/migrations/001_players.sql), which flrp_core keeps up to date:
  one row per player keyed by license, carrying discord_id, active/total
  playtime seconds, first_seen and last_seen.

  FiveM servers don't reliably expose their HTTP port, so — exactly like duty
  hours (flrp_onduty) — we PUSH these rows to the website rather than letting it
  pull from us, using the same convars and shared secret the config/duty sync
  already use:

    set flrp_site_api_url    "https://your-website"      # site root, no trailing /api
    set flrp_site_api_secret "same-as-FIVEM_CONFIG_SECRET"

  The website mirrors what we send into its own table and reads it back by
  Discord id. If either convar is unset this resource does nothing (and the
  /bgcheck embed simply omits the play-time lines). Requires oxmysql.

  Push cadence:
    - on boot: one full backfill of every player with a Discord id (batched);
    - every FULL_SYNC_MINUTES: another full backfill (keeps the mirror fresh);
    - on playerDropped: that one player, so their last_seen/play time update
      promptly after a session.
]]

local FULL_SYNC_MINUTES = 15
local BATCH_SIZE = 200

local function siteBase() return (GetConvar('flrp_site_api_url', '') or ''):gsub('/+$', '') end
local function siteSecret() return GetConvar('flrp_site_api_secret', '') end

--- POST a body to the website (best-effort; logs non-2xx). path is like '/api/fivem/players_bulk'.
local function sitePush(path, body)
  local base, sec = siteBase(), siteSecret()
  if base == '' or sec == '' then return end
  PerformHttpRequest(base .. path, function(status)
    if status ~= 200 and status ~= 204 then
      print(('^3[flrp_playermeta] site push %s -> HTTP %s^0'):format(path, tostring(status)))
    end
  end, 'POST', json.encode(body), { ['Content-Type'] = 'application/json', ['X-FLRP-Secret'] = sec })
end

--- Shape one DB row into the payload the website expects. Timestamps go out as
--- unix seconds; the website normalizes seconds/ms/ISO either way.
local function rowToPayload(r)
  if not r or not r.discord_id or r.discord_id == '' then return nil end
  return {
    discordId = tostring(r.discord_id),
    license = r.license and tostring(r.license) or nil,
    name = r.name,
    activePlaytimeSeconds = tonumber(r.active_playtime_seconds) or 0,
    totalPlaytimeSeconds = tonumber(r.total_playtime_seconds) or 0,
    firstSeen = tonumber(r.first_seen),
    lastSeen = tonumber(r.last_seen),
  }
end

-- UNIX_TIMESTAMP() makes MySQL hand us plain unix seconds instead of a DATETIME
-- string, so no timezone parsing is needed on either side.
local SELECT_COLS = [[
  discord_id, license, name, active_playtime_seconds, total_playtime_seconds,
  UNIX_TIMESTAMP(first_seen) AS first_seen, UNIX_TIMESTAMP(last_seen) AS last_seen
]]

--- Push every player that has a Discord id, in batches.
local function fullBackfill()
  if siteBase() == '' or siteSecret() == '' then return end
  MySQL.query('SELECT ' .. SELECT_COLS .. ' FROM `players` WHERE `discord_id` IS NOT NULL', {},
    function(rows)
      if not rows or #rows == 0 then return end
      local batch = {}
      for _, r in ipairs(rows) do
        local p = rowToPayload(r)
        if p then batch[#batch + 1] = p end
        if #batch >= BATCH_SIZE then
          sitePush('/api/fivem/players_bulk', { players = batch })
          batch = {}
        end
      end
      if #batch > 0 then sitePush('/api/fivem/players_bulk', { players = batch }) end
    end)
end

--- Push one player by license (used after they disconnect).
local function pushByLicense(license)
  if not license or license == '' or siteBase() == '' then return end
  MySQL.query('SELECT ' .. SELECT_COLS .. ' FROM `players` WHERE `license` = ? LIMIT 1', { license },
    function(rows)
      local p = rows and rows[1] and rowToPayload(rows[1])
      if p then sitePush('/api/fivem/players', { player = p }) end
    end)
end

AddEventHandler('playerDropped', function()
  local src = source
  local license
  for _, id in ipairs(GetPlayerIdentifiers(src) or {}) do
    local lic = id:match('^license:(.+)$')
    if lic then license = lic break end
  end
  if not license then return end
  -- Let flrp_core finish writing the row for this session before we read it.
  SetTimeout(5000, function() pushByLicense(license) end)
end)

CreateThread(function()
  Wait(10000) -- let the DB + flrp_core come up first
  if siteBase() == '' or siteSecret() == '' then
    print('^3[flrp_playermeta] flrp_site_api_url / flrp_site_api_secret not set — nothing will be pushed.^0')
    return
  end
  print('^2[flrp_playermeta] ready — pushing player meta to ' .. siteBase() .. '^0')
  fullBackfill()
  while true do
    Wait(FULL_SYNC_MINUTES * 60 * 1000)
    fullBackfill()
  end
end)
