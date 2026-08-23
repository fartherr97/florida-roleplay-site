# Florida Roleplay

Public community site and API for **Florida Roleplay**, a FiveM roleplay server —
rules, applications, departments, store, supporters, events, knowledge base and
reports, plus gated sub-applications: a **Staff Hub**, a **Civilian Hub**, and a
**department hub** that renders a whole site per department from a saved config.

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
Admin → Directorship, each granting the roles below it, over a civilian floor of
Member → Cert. Civ. I → II → III.

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

## Department hubs

Every department runs its own internal site at `/departments/<id>/hub` — FHP,
HCSO, TPD, HCFR and DHS ship with one, and more are created from the Builder
Portal without a deploy.

**One engine, many sites.** A department site *is* a config document. There is a
single route; the `:deptId` segment picks which config loads, and the pages
inside come out of that config rather than out of the route table. Adding a
department is a row in `department_configs`, not a migration.

```
client/src/data/departmentConfigs.js   # the saved sites (seeds + templates)
client/src/lib/departmentConfig.js     # the engine — normalise, authorise, theme
client/src/lib/deptRoster.js           # projecting the community roster
client/src/components/dept/DeptShell.jsx   # the page-type registry
server/src/routes/departmentHub.js     # /api/dept
```

### Page types

`home`, `content`, `roster`, `fleet`, `uniforms`, `chain`, `calendar`,
`adminlog`, `activity`, `hours`, `audit`, `access`, `builder`. Adding one means
writing a component, registering it in `PAGE_COMPONENTS` in `DeptShell.jsx`, and
listing it in `PAGE_TYPES` in `lib/departmentConfig.js`. Every department gets it
at once.

### The roster is a projection, not a copy

A department's roster is the **community roster**, filtered to that department
and bucketed into the department's own bands by the Discord role map. The config
owns presentation — which bands exist, their colours, which columns show — and
nothing else. Promote someone in Discord and they move bands on their department
site with nothing else to update, because there is no second roster for the bot
to keep in step. A rank no band claims shows under "Unassigned" rather than
vanishing.

Activity status is edited against the community roster too, so it asks for the
site-wide `roster.edit_status` permission: a status set on a department site is
the same status the Civilian Hub's roster shows.

### Capabilities

Inside a department, a Discord role can hold `manage`, `editRoster`,
`editStructure`, `manageCalendar`, `manageLog`, `manageAccess` and `viewAudit`
(`manage` implies the rest). Those are granted on the department's own Access
page, scoped to that department.

The community-wide `departments.*` permissions are the counterpart: they grant
the same capabilities in **every** department, and `departments.manage` is the
way back into a department whose own access table locks everyone out — which is
why the access table refuses to save without at least one role able to manage
the site, in the UI and again on the server.

### Two write surfaces

`PUT /api/dept/:id/config` replaces the whole document and needs `manage` — that
is the Builder Portal. `PUT /api/dept/:id/pages/:pageId` writes one page's own
data and needs whatever capability that page type declares, so the fleet editor
cannot reach the access table on its way past. Every write versions the config it
replaced; the Audit page restores one.

### Hostname resolution

Departments resolve from the URL path, because the community is one site on one
domain. `server/src/lib/tenant.js` also resolves from the `Host` header — an
explicit `DEPARTMENT_MAP` entry, then the first label of a real subdomain — so
pointing `fhp.floridarp.gg` at this deployment later needs no code change.

### One roster layout

The Staff Hub, the Civilian Hub and every department site render their roster
through the same components in `client/src/components/roster/`:

| Component | What it is |
| --- | --- |
| `RosterHeader` | Title strip: mark, views, refresh, total and the per-status counts |
| `RosterFilters` | Search plus the dropdowns that roster filters by |
| `RosterTable` | The grouped table — bands as full-width rows inside **one** table |
| `RosterStats` | The breakdown beside it, with percentages |

`RosterTable` is one table rather than one per band on purpose. A stack of
separate tables lets each band size its own columns, so "Callsign" lands
somewhere different in every group and the roster stops reading as a single
list. Columns declare `hideBelow` so the low-priority ones (Discord UID, notes)
drop at narrow widths instead of pushing the status column into a horizontal
scroll, and the two roster pages get a wider container than the rest of the hub
(`client/src/lib/hubLayout.js`) because a dense table with a sidebar beside it
does not fit the site's usual measure.

The staff roster is structured around **positions**, not people: a team shows the
seats it is meant to have, and a seat nobody holds renders greyed out rather than
being filtered away — an empty Junior Administrator slot is exactly the sort of
thing a roster exists to surface.

## Forms and exams

One engine serves both hubs: `/staff-hub/forms` and `/civilian-hub/forms` render
the same component with a different audience.

**A form and an exam are the same document.** Questions carry points and an
optional answer key; set them and you have an exam, leave them at zero (or set
`feedback: true`) and you have a survey. Building two systems for that would have
meant two builders, two renderers and two ways to read the results.

```
client/src/lib/forms.js                    # the engine — pure, mirrored server-side
client/src/data/formsData.js               # the forms the community ships with
client/src/components/forms/               # runner, builder, review, summary
server/src/routes/forms.js                 # /api/forms
```

### The two rules that matter

**The server grades, the client does not.** A submission posts answers only; the
score, the pass/fail and the needs-review flag are computed on the server from
the stored form. A client that posted its own score would be posting its own exam
result.

**The answer key never reaches a candidate.** `GET /api/forms` strips `correct`
from every question unless the caller may review or manage that form — otherwise
passing an exam would take opening devtools.

### Grading

Ten question types. Objective ones auto-grade; paragraphs always go to a human;
scale, rating, date and time auto-grade only when a key is set. A scored question
whose key was never filled in is flagged for review rather than silently marked
wrong, and the builder warns about those, because the alternative is failing
people for the author's omission.

Reviewer scores live in their own table, so the original auto-grade is never
overwritten — the machine's result and the human's adjustment are two different
facts. And scores are computed on read, so correcting an answer key re-grades the
whole history instead of leaving old results wrong.

### Access

Each form names Discord role keys in `submitRoles` and `reviewRoles`; empty means
"anyone who can open this hub". On top of that the `forms.*` permissions apply
community-wide: `forms.review` grades anything, `forms.manage` authors. An
anonymous form records no name and no Discord id — the identity is not stored
rather than stored and hidden.

## Promotion board

`/staff-hub/promotion-board`. Someone nominates a member for a rank, a timed
vote opens, and the nomination carries when approval clears 50% of the
**decisive** ballots — abstentions count toward turnout but not the outcome,
because declaring you have no view should not drag a nomination down the way a
deny would. A voter can change their ballot until the window closes; a board
where a misclick is permanent gets fewer honest votes, not more.

### Results stay hidden until publication

This is the part worth preserving from the reference implementation. Live
tallies and ballots are withheld until a nomination is published, so people vote
on the merits rather than piling onto whichever way it is already going. Two
exceptions:

- anyone holding `promotions.manage` always sees live;
- a configurable rule grants a role live sight **up to a rank ceiling** —
  Senior Admin can watch moderator votes without seeing the vote on their own
  peers.

The server enforces it. `GET /api/promotions` strips the ballots and the tally
from any vote the caller may not watch, and reports an unpublished vote's status
as open even after it closes, so the outcome cannot leak from a badge. Turnout is
still shown: "12 have voted" says nothing about which way, and it is what tells
someone whether the board is engaged.

Ballots live in their own table rather than inside the vote document, because
voting is the concurrent operation here — two people voting at once on one JSON
blob would lose a ballot.

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
is a `TODO`. Rather than editing that file, map them on the **Discord Role
Mapping** page before pointing the bot at a live guild — it validates the
snowflakes and flags anything still unmapped. The keys, ranks and ordering are
already correct.

## Access control

Two management pages sit under each other, both Directorship-only:

| Page | Answers |
| --- | --- |
| **Discord Role Mapping** (`/staff-hub/discord-roles`) | Which Discord role *is* each rank, tier and tag? |
| **Permissions** (`/staff-hub/permissions`) | Which of those roles may do what? |

They are both Directorship rather than Head Admin on purpose: anyone who can edit
permissions can grant themselves everything else, so gating role mapping any
lower would be cosmetic.

### Discord Role Mapping

Everything the community binds to a Discord role is edited here — base roles
(membership, whitelisting), civilian certification tiers, the staff ladder, every
department's ranks, and status tags like LOA. Each row carries its Discord
snowflake, precedence order, short rank (the one that appears in nicknames), full
label and nickname template, with a live preview of what the template produces.

Two things the save refuses, because either would make rank resolution arbitrary
rather than merely wrong: a malformed snowflake, and the same snowflake bound to
two different roles. Rows still holding a shipped placeholder are counted and
flagged so nothing is silently left unmapped.

Precedence is highest-wins, which is why a promotion works without removing the
old role first, and why staff ranks outrank department ranks.

### Permissions

Nothing in the codebase checks a rank. Every gated page, button and endpoint
names a **permission**, and `client/src/data/permissions.js` maps each permission
onto a set of Discord roles. That indirection is the point: access changes from
the Permissions page without a deploy.

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

## Bot dashboard — `/management/bot`

A management surface for the Discord bot: its rosters, the capabilities people
hold, the servers and role mappings it acts through, its sync issues and jobs,
and its audit log.

**It is frontend only.** It does not touch this repo's database, this repo's
Express API, or this repo's permission model. It talks to the bot's own REST API
over `fetch`, and that API authenticates with Discord and re-checks authorisation
on every single call. Nothing here decides what anybody is allowed to do:

- Every request sends `credentials: "include"`, which is what carries the session
  cookie. Without it everything 401s.
- Every `POST`/`PATCH`/`DELETE` echoes the `frm_csrf` cookie back in an
  `x-csrf-token` header. `GET` does not.
- The permissions screen is built from `GET /permissions/capabilities`, not from
  a list in this repo, so a capability added on the bot side appears here without
  a deploy. The catalogue decides what the dashboard *offers*. It never decides
  what is *allowed* — hiding a button prevents nothing.
- Rosters are computed from Discord roles. There is no "add member" anywhere,
  because there is no endpoint for one and there should not be a UI implying it.

### The API has to be on a subdomain of this site

`VITE_API_URL` (see `client/.env.example`) is the only place the address is
configured. In production it must be a subdomain of whatever domain serves the
site — `api.example.com` for `example.com`.

The bot's session cookies are `SameSite=Lax`. Point the dashboard at a different
site and the browser silently declines to send them: every signed-in request
comes back 401, there is no CORS error, and the network tab shows requests that
look completely ordinary. `client/src/lib/botSameSite.js` checks for this at
runtime and names it on screen, but the fix is a deployment one. The check
compares the last two labels of each hostname, so it does not warn for
multi-part suffixes like `example.co.uk`; it only ever warns, never blocks.

### Signed in but not staff is not an error

Someone can authenticate with Discord perfectly well and still get `401 "Your
account does not have website access."` That is the API working correctly, and
`BotGate` gives it its own page saying what is missing and who to ask — not an
error, and not an invitation to sign in again, which would do the same thing.

### The menu entry, and why it is not a route guard

`bot.dashboard` keeps the Management menu entry out of everybody's menu but
Directorship's. It is marked `menuOnly` in `src/lib/guards.js`, so it filters the
menu and nothing else: `routeGuardFor` drops `menuOnly` entries, and the route
opens for anyone who asks for it. Blocking the route on a site permission would
be a second, weaker copy of a decision the bot API already makes, and it could
lock out somebody the bot would have let in.

### Async work

Sync runs return `202` with a job. `JobProgress` polls until the status is
terminal — `COMPLETED`, `PARTIAL`, `FAILED`, `CANCELLED` or `PAUSED`. `PAUSED` is
not a failure: a safety check stopped the job before it applied anything, usually
because it would have touched an unusual number of people at once, so it is shown
in amber with that explanation rather than in red.

`message` from the API is always safe to display. `requestId` is shown on every
error screen with a copy button, because it is what identifies the call in the
bot's own logs.

## Authentication

Discord OAuth is **not implemented yet**. Until it is, the API resolves the
caller from `DEV_USER_ID` (or an `x-discord-id` header) and logs a warning at
boot. That path is hard-disabled when `NODE_ENV=production`, so it cannot become
a live bypass. `/sign-in` and `/create-account` are stubs that link to Discord.

## Placeholders

Everything that needs a real value is defined once at the top of
`client/src/data/mockData.js` under `SITE`, each marked `TODO:` — hero photo,
FiveM connect address, Discord invite, Tebex store URL, the assistant's name and
the social handles.

The **logo is real**: `client/public/logo.png`, square-cropped and resized from
the 1024px original so a 32px nav mark does not pull a 1.75 MB file. It is the
only place to change it — `SITE.logoUrl` points at it, and both `Logo` and
`HubBrandMark` read that, which covers the top bars, drawers, footer, hub landing
plates, roster headers and the 403/404 panels. `favicon.png` and
`apple-touch-icon.png` beside it are the same artwork at 64px and 180px.

## Checks

```bash
npm run lint                       # oxlint over the client
npm run build                      # production build
```
