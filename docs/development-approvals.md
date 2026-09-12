# Personal vehicle claims and approvals

Members claiming a library vehicle can attach it to an active personal ticket or start a new personal ticket. After creating a ticket, Vehicle review lets them select and claim an available vehicle. A ticket and a vehicle can each hold only one open claim. Transactional ticket/vehicle locks and the existing unique vehicle index prevent competing claims. Failed writes roll back the reservation and message together.

Approve Liveries requires a department-head role (fhp_colonel, bso_sheriff, mpd_chief), Directorship or Ownership. Approve Model requires Directorship or Ownership. Server-resolved roles enforce these checks independently of generic development permissions. Model approval activates the linked library claim; it does not install a vehicle or change FiveM permissions.

The approval log records the Discord ID, main-guild display name, timestamp, kind and claim reference. Duplicate approvals return a conflict. Linked claims activated through the library use the same approval operation. Legacy unlinked claims remain manageable in the library. Replacement claims require new approvals.

Support and development message names resolve against DISCORD_GUILD_ID with a five-minute cache, including old messages. Missing nicknames fall back to the main-guild user's global name/username. Discord outages preserve stored names. Bot labels remain unchanged.

An idempotent migration runs on first workflow access. It adds a nullable claim request_id and dev_request_approvals, preserving existing data. The database user needs ALTER/CREATE rights.

Validation: Node 24 `node --experimental-test-module-mocks --test server/test/*.test.mjs`, production client build and mocked browser checks. SQL tests use PGlite with production table definitions. Live database migration and Discord integration need deployment verification.
