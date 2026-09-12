# Personal vehicle claims and approvals

Members claiming a library vehicle can attach it to an active personal ticket or start a new personal ticket. After creating a ticket, Vehicle review lets them select and claim an available vehicle. A ticket and a vehicle can each hold only one open claim. Transactional ticket/vehicle locks and the existing unique vehicle index prevent competing claims. Failed writes roll back the reservation and message together.

Approve Liveries requires a department-head role (fhp_colonel, bso_sheriff, mpd_chief), Directorship or Ownership. Approve Model requires Directorship or Ownership. Server-resolved roles enforce these checks independently of generic development permissions. Model approval activates the linked library claim; it does not install a vehicle or change FiveM permissions.

The approval log records the Discord ID, main-guild display name, timestamp, kind and claim reference. Duplicate approvals return a conflict. Linked claims activated through the library use the same approval operation. Legacy unlinked claims remain manageable in the library. Replacement claims require new approvals.

Support and development message names resolve against DISCORD_GUILD_ID with a five-minute cache, including old messages. Missing nicknames fall back to the main-guild user's global name/username. Discord outages preserve stored names. Bot labels remain unchanged.

An idempotent migration runs on first workflow access. It adds a nullable claim request_id and dev_request_approvals, preserving existing data. The database user needs ALTER/CREATE rights.

Validation: Node 24 `node --experimental-test-module-mocks --test server/test/*.test.mjs`, production client build and mocked browser checks. SQL tests use PGlite with production table definitions. Live database migration and Discord integration need deployment verification.

Approved buttons become Revoke Model/Revoke Liveries with the same role gates. Revocation preserves the original approval and adds the revoker ID, name and time plus a public thread message. Model revocation returns the linked claim to pending and hides its spawn code from the claimant through the existing library rules. Reapproval creates a new approval row. Stale revocation requests cannot revoke a newer decision. Revocation is available even on closed tickets; new approval requires an active ticket.

Support and development chats support editing your own human-authored messages. Hover or keyboard focus reveals the pencil; touch users see it directly. Save adds an Edited timestamp, and Cancel discards the draft. The server rechecks ticket access, ownership and internal-note permissions. Closed-ticket restrictions match posting permissions. Old message text is retained in a server-only edit history; automatic claim/approval records cannot be edited. The lazy migration adds edited_at, system_generated and edit_history columns.
