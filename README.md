# Florida Roleplay

Public community site and API for **Florida Roleplay**, a FiveM roleplay server —
rules, applications, departments, store, supporters, events, knowledge base and
reports, plus two gated sub-applications: a **Staff Hub** and a **Civilian Hub**.

```
florida-roleplay/
  package.json        # orchestration only — no dependencies of its own
  railway.json
  client/             # Vite 8 + React 19 + Tailwind v4 (JSX, no TypeScript)
  server/             # Express + MariaDB
```

## Quick start

```bash
npm run install:all   # install client and server dependencies
npm run dev           # client on http://localhost:5173 (proxies /api → :4000)
npm run dev:server    # API on http://localhost:4000
```

The site is fully usable **with no database running**: every API read falls back
to seed data, and every client read falls back to `client/src/data/mockData.js`.
Bring MariaDB up when you want persistence.

```bash
cp server/.env.example server/.env   # then fill in your DB credentials
npm run db:init                      # creates the schema
```

## Production

```bash
npm run build   # installs deps, builds the client, prunes server dev deps
npm start       # one process serves the API and the built client
```

`server/src/index.js` serves `client/dist` with SPA history fallback, so deep
links such as `/patch-notes` survive a hard refresh. Deployment config for
Railway lives in `railway.json`.

## Stack

**Client** — Vite 8, React 19, JSX only. Tailwind CSS v4 through
`@tailwindcss/vite`, with all theme tokens in an `@theme` block in
`src/index.css` (there is no `tailwind.config.js` and no PostCSS config).
`react-router-dom` v7 with `BrowserRouter`, `framer-motion` for page and modal
transitions, `lucide-react` for UI icons and `react-icons/fa6` for brand icons.

**Server** — Express 4 and the `mariadb` driver, ESM throughout. No ORM: queries
are hand-written and always parameterised.

## How things are wired

- **Design system** — dark theme only. Deep-navy surfaces, `#f2800d` orange for
  primary actions and active states, blue/sky as the secondary accent, Ubuntu
  type, a dot-grid glow background and hairline borders. Shared primitives live
  in `client/src/components/ui/`; pages never hand-roll a button or a panel.
- **Data flow** — every read goes through `client/src/lib/api.js`, which passes a
  mock fallback per call. Set `USE_API = false` there to develop entirely against
  mock data.
- **Role gating** — `client/src/lib/guards.js` is the single client-side table of
  which routes need which roles. `PublicLayout` applies it around the whole
  shell, so a denial replaces the header and footer with the Access Denied page
  **at the requested URL** rather than redirecting — the link stays refreshable
  and shareable, and starts working the moment the user's roles change. The top
  bar reads the same table to hide unreachable destinations.
  That hiding is a convenience, not a boundary: `server/src/middleware/requireRole.js`
  is the real check, and it answers `403 { ok, code, message }` with one of
  `AUTH_SIGNED_OUT`, `AUTH_ROLE_MISSING`, `AUTH_DEPT_MISMATCH` or
  `AUTH_NOT_WHITELISTED` — the code the Access Denied panel prints in its footer.
  Each maps to a distinct denial page, so add a code only when the copy the user
  should read genuinely differs.
- **Roles** — the role list is deliberately duplicated between
  `server/src/seed.js` and `client/src/data/mockData.js`; both files say so. Add
  a role to one, add it to the other. The same applies to the hub's seed data
  (`server/src/staffHubSeed.js` mirrors `client/src/data/staffHubData.js`, and
  `server/src/civilianHubSeed.js` mirrors `client/src/data/civilianHubData.js`).
- **Validation** — POST bodies are re-validated server-side in
  `server/src/validate.js`. Client-side checks are for feedback only.
- **Navigation breakpoint** — the full mega-nav carries nine links, three
  dropdown groups, the Connect CTA and the user chip. Measured, that needs more
  room than `xl` provides, so `src/index.css` defines a `nav` breakpoint
  (1700px) where it un-collapses; below that everything lives in the drawer. The
  hubs carry far less, so they get their own `hub` breakpoint at 1120px.

## The hubs

Both hubs are gated sub-applications living in this repo alongside the public
site, sharing its design system, UI primitives, auth context and guard table.
Each has a **public landing page** — the sign-in entry point, which explains what
the hub is — and behind it a shell with its own top bar carrying that hub's
sections. Both are defined in `client/src/data/hubs.js`; adding a section is a
one-line change there.

They are deliberately self-contained (own data module, own server router, own
seed file) so either could be lifted into its own repo if the staff tooling ever
needs to be private. Until then one repo means one build, one deploy, and no
shared-package overhead.

### Staff Hub — `/staff-hub`

| Group | Pages |
| --- | --- |
| Staff Portal | Overview (reminders, staff member of the month, quick notes), Staff Roster, Staff Dashboard, Trial Mod Checklist, Staff DA Database |
| Rank Access | Resources, Administrators, Senior Admins+, Director panel |
| Exam Backend | Recent Submissions (with attempt review and manual override), Members, Audit Log, Management (thresholds and question catalog) |

Ranks run Trial Mod → Mod → Sr. Mod → Jr. Admin → Admin → Sr. Admin → Head
Admin, each granting the roles below it, over a civilian floor of Member →
Cert. Civ. I → II → III.

Exam results are never edited in place. An override writes an append-only row
carrying the reviewer and their reason, and the Audit Log renders those rows; the
attempt keeps its original score alongside the new one.

### Civilian Hub — `/civilian-hub`

| Group | Pages |
| --- | --- |
| My Records | Overview, Characters, Vehicles, Properties, Licences |
| Community | Community Roster, Business Directory, Job Board, Classifieds |
| Resources | Penal Code, Civilian Guides |

Two gates apply. Personal records need a **whitelisted** character; the community
and resource pages are open to any signed-in member, because someone deciding
whether to apply should be able to read the penal code and see who is hiring. A
member who simply is not whitelisted yet gets its own denial page
(`AUTH_NOT_WHITELISTED`) pointing at the whitelist application rather than the
staff copy about contacting a supervisor.

## Community roster and the Discord bot

`/civilian-hub/roster` lists everyone across every department — civilians, law
enforcement, fire and EMS, staff and management. It is written by a Discord bot,
not by hand: when someone's roles change, the bot posts the change here and the
roster and their Discord nickname update together.

The contract is deliberately one-way. **The bot holds no copy of what a role
means.** It reads the map from the API, posts the roles a member now holds, and
applies whatever nickname comes back — so a rank rename or a new department is a
change in one place.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/roster` | member | The roster |
| GET | `/api/roster/role-map` | none | Divisions, departments and the Discord role → rank map |
| GET | `/api/roster/sync-log` | member | What the bot changed, newest first |
| POST | `/api/roster/sync` | bot | One member's roles changed |
| POST | `/api/roster/sync/bulk` | bot | Full reconciliation sweep |

Both POSTs accept `?dryRun=1`, which computes the result without writing — use it
to preview a rename before applying it.

```jsonc
// POST /api/roster/sync
{ "discordId": "402118844500000902", "characterName": "Aaron Jones",
  "roles": ["100000000000000041"], "callsign": "122" }

// →
{ "ok": true, "action": "upserted", "matchedRole": "senior_admin",
  "nickname": "122 | Sr. Admin | Jones",
  "member": { "rank": "Sr. Admin", "rankFull": "Senior Administrator", … } }
```

**Nicknames** follow the community convention `{callsign} | {rank} | {surname}` —
`122 | Sr. Admin | Jones`, `167 | Mod | Jacob`. The response carries two names:
`displayName` is the full form the roster shows, and `nickname` is trimmed to
Discord's 32-character limit. If the full form does not fit, the callsign is
dropped first and the rank second — the person's name is the last thing to go,
because a nickname nobody can be identified by defeats the point. The bot should
apply `nickname` verbatim and never shorten anything itself.

**Precedence.** A member holding several mapped roles is rostered under the
highest `order`, so a promotion takes effect without removing the old role first,
and staff ranks outrank department ranks — a Sr. Admin who also troops for FHP
shows as staff.

**Removal.** A member with no mapped roles left comes off the roster and the
response returns `nickname: null`, meaning clear their nickname. The bulk sweep
also drops anyone rostered but absent from the payload, so a nightly
reconciliation converges even when individual role events were missed.

**Auth.** The bot is not a Discord user, so it authenticates with a shared
secret — `Authorization: Bearer $BOT_TOKEN` — rather than roles. Leave `BOT_TOKEN`
unset and the sync endpoints answer `503`; they are never left open, because an
unauthenticated endpoint that rewrites the roster and everyone's nickname is not
something to leave to a default.

**Role IDs are placeholders.** Every `roleId` in `client/src/data/rosterData.js`
is a `TODO` — swap in the real Discord snowflakes before pointing the bot at a
live guild. The keys, ranks and ordering are already correct.

## Permissions

Nothing in the codebase checks a rank. Every gated page, button and endpoint
names a **permission**, and `client/src/data/permissions.js` maps each permission
onto a set of Discord roles. That indirection is the point: access changes from
the **Permissions page** (`/staff-hub/permissions`, Head Admin only) without a
deploy.

- `src/lib/guards.js` gates each route on a permission.
- Nav entries name the same permission, so a link is hidden exactly when the
  route would deny it.
- `server/src/middleware/requirePermission.js` enforces it on the matching
  endpoint. The client is a convenience; this is the boundary.

Grants live in `permission_grants`. An empty table means the shipped defaults
apply, so a fresh install is neither wide open nor locked out. Two things the
save refuses outright: an unknown permission or role key, and leaving
`permissions.manage` granted to nobody — that last one would need a database edit
to undo.

Grants reference a role by its `key` from `ROLE_MAP`, which is one-to-one with a
Discord role snowflake. The key is the stable handle; the snowflake is the actual
binding, and the page shows both.

## Activity status and LOA

Roster entries carry an activity status — Active, Semi-Active, LOA, Inactive or
Suspended — editable in place on the roster by anyone with `roster.edit_status`.
Granting leave is a separate permission (`roster.manage_loa`), so a Mod can mark
someone inactive without being able to hand out LOA.

**LOA carries a return date, and the site owns it.** The bot does not schedule
anything: it polls `GET /api/roster/loa/expired`, removes the Discord tag from
whoever comes back, and POSTs them to Active. A bot restart, redeploy or outage
therefore cannot lose a pending return — which a `setTimeout` in the bot would.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/api/roster/:id/status` | `roster.edit_status` | Set status from the roster page |
| POST | `/api/roster/loa` | bot | The `/loa` command |
| POST | `/api/roster/loa/end` | bot | Return early or on schedule |
| GET | `/api/roster/loa/expired` | bot | Everyone whose LOA has run out |

### Writing the `/loa` command

Discord has no native date option type, so take a **string option with
autocomplete** rather than a modal. Autocomplete fires as the user types and you
return up to 25 choices, so the value that reaches your handler is one *you*
generated rather than whatever they typed:

```
/loa user:@member until:<autocomplete> reason:[optional]
```

Suggest `Tomorrow (26 Aug)`, `In 7 days (1 Sep)`, `In 30 days (24 Sep)` and a
parse of their partial input. Add a `days:` integer option (min 1, max 180) as an
alternative that cannot be got wrong.

A modal is the worse choice here: it is still free text, validates no earlier,
and adds a step. Either way, parse leniently server-side and reply ephemerally
with "pick one of the suggestions" rather than storing a date you had to guess at
— `POST /api/roster/loa` rejects anything that is not `YYYY-MM-DD` or is in the
past, so a bad value fails loudly rather than silently rostering someone until
the year 2026.

### Where permissions are declared

`client/src/data/permissions.js` is the catalogue and the defaults;
`server/src/permissions.js` mirrors it. Nav entries and `src/lib/guards.js` name
permission keys, never ranks.

### Preview mode

Because Discord OAuth is still stubbed, each hub landing offers a rank switcher —
covering the whole ladder from Member upward — so either portal can be reviewed
as any rank. The chosen rank is kept in
`sessionStorage` and sent as an `x-preview-rank` header, which the API honours —
otherwise a previewed Director would see the page and then a 403 for its data.
Both halves are disabled when `NODE_ENV=production`, and the panel hides itself
as soon as the API reports a real session, so there is no flag to remember to
turn off.

## Authentication

Discord OAuth is **not implemented yet**. Until it is, the API resolves the
caller from `DEV_USER_ID` (or an `x-discord-id` header) and logs a warning at
boot. That path is hard-disabled when `NODE_ENV=production`, so it cannot become
a live bypass. `/sign-in` and `/create-account` are stubs that link to Discord.

## Placeholders

Everything that needs a real value is defined once at the top of
`client/src/data/mockData.js` under `SITE`, each marked `TODO:` — logo URL, hero
photo, FiveM connect address, Discord invite, Tebex store URL, the assistant's
name and the social handles.

## Checks

```bash
npm run lint                       # oxlint over the client
npm run build                      # production build
```
