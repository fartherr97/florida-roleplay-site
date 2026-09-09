fx_version 'cerulean'
game 'gta5'

name 'flrp_playermeta'
author 'Florida Roleplay (FLRP)'
description 'Pushes the players table (play time, first/last seen) to the FLRP website for the /bgcheck embed.'
version '2.0.0'

-- oxmysql provides the MySQL global. This resource only reads the `players`
-- table that flrp_core already maintains; it never writes to it.
server_scripts {
  '@oxmysql/lib/MySQL.lua',
  'server.lua',
}
