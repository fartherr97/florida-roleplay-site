# ES transfer processing

Both departments must approve a transfer. Only directors and ownership can process it. Completion is permanent; closing a completed ticket does not allow it to be reopened and processed again.

New requests store the transferee's Discord ID separately from the person who filed the request. Staff filing on behalf of someone else must enter that person's ID. Existing unprocessed tickets require management to confirm the transferee ID in the processing dialog. Names are never used to choose whose roles to change.

The website bot must be in both department guilds with Manage Roles and above the roles being changed. The member must have joined both guilds. Existing configuration is used:

- `DISCORD_BOT_TOKEN` and `DISCORD_GUILD_ID`: bot authentication and main guild for staff authorization/DM delivery.
- `BOT_API_URL` and `WHITELIST_INGEST_TOKEN`: existing bot transfer configuration endpoint, `/api/transfers/sync-config`.
- Department Hub guild IDs and roster rank mappings: destination guild and selected rank role.
- Bot dashboard incoming grant roles: base roles to assign, excluding all ranks other than the selected rank.

Incoming grants happen first. After successful grants, old incoming rank roles are removed and outgoing guild roles are stripped, preserving roles named Admin/Administrator, Staff, Mod/Moderator, Owner/Ownership, Director or Developer (including prefixes such as Senior Admin and Admin Access), bot-managed roles, and any explicit `protectedRoleIds` supplied by the bot configuration. These exceptions override the outgoing strip list. Failed changes keep the ticket open, with an attempt recorded in its history; retries skip roles already present or already removed.

Completion writes Transfer Out and Transfer In entries into the respective Department Hub admin logs, plus audit entries naming the processor. Those records and completion save in one database transaction. Configured department admin-log webhooks are notified after commit. Background checks read transfer, resignation, hire, promotion, retirement and commendation entries from the source admin logs within the background check's date window, separately from discipline counts.

Reply DMs use the persistent `ticket_dm_outbox`. Public replies notify the creator, transferee and participating staff (previous message authors and approvers), excluding the sender. Internal replies notify only participating staff who still have access, checked against current main-guild roles before delivery. Blocked DMs do not fail the ticket message; transient delivery errors retry. No live role changes or DMs are performed by the automated tests.

The additive transferee-ID migration runs automatically when the transfer router is used and is also in `schema.sql`. Existing personnel log entries need a subject Discord ID and date to appear in the background.
