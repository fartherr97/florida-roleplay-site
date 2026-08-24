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

The staff bar is a **flat row of tabs**, not dropdown groups. Seventeen
destinations do not fit in one row, so the split is by how often a page is
opened rather than by what it is about: the eleven a moderator touches in a
shift are tabs, and everything configured once and then left alone lives behind
the last one.

| Tab | What it is | Permission |
| --- | --- | --- |
| Home | Reminders, staff member of the month, quick notes | `staff.view` |
| Roster | The staff roster, projected from Discord roles | `staff.view` |
| DA Hub | File a disciplinary action; see yours and, with the permission, everyone's | `staff.view` |
| Reports | The moderation queue — what members filed through `/reports` | `site.moderation` |
| Forms | Forms and exams shared with the department hubs | `staff.view` |
| Training Dashboard | Who is in training, who has them, how long it has run | `staff.view` |
| DA Database | Look up one member's disciplinary background | `staff.da_view` |
| Analytics | Counted from disciplinary actions, tickets and the roster | `staff.view` |
| Promotion Board | Nominations and the vote | `promotions.view` |
| Applications | The review queue for `/apply` | `staff.view` |
| Site Administration | Everything below | `staff.view` |

A tab whose permission the viewer does not hold is dropped rather than rendered
as a dead end — the route gate and the API still enforce it either way. Below
the `hub` breakpoint (1120px) the row collapses into the same right-hand drawer
the public site uses, fed from the same tab list.

Between those two points the row **measures itself and moves what will not fit
into a More dropdown**. Eleven tabs only fit above about 1900px; as a plain
scrolling strip, Site Administration was simply absent on a 1440px laptop with
nothing on screen to say so, and a menu nobody can see is a page nobody opens.
The widths are taken on the first pass while every tab is still rendered and
kept — re-measuring a truncated row would lose the ones already moved into the
menu. When the current page is one of the tabs inside it, the More trigger
carries the active underline, so the bar never looks like nothing is selected.

Two pages the bar no longer carries — the Staff Dashboard (this week's claim
volume and response times) and the Trial Mod Checklist — sit as cards on Home
instead. They fall either side of the split the bar is built on: not what a
moderator opens every shift, not what a director configures once a month. A
twelfth tab would have cost the ten that matter more than those two gain.

**Site Administration** is a page, not a menu: four groups — access control
(Permissions, Discord Role Mapping), the exam backend (Recent Submissions,
Members, Audit Log, Thresholds & Questions), rank resources (Resources,
Administrators, Senior Admins+, Head Admin) and the support portal (Ticket
queue, Response flows, Transfer portal). Each entry carries its own permission
and a group with nothing left in it disappears, so a moderator opening the page
sees three links rather than fourteen refusals.

Three of the tabs are worth a note:

- **Reports** reads `GET /reports` and moves rows with `POST
  /reports/:reference/status`. Reports had a write path and no read path — they
  went into the table and nobody could see them; this is the other half. A
  status change that the API refuses says so on the page rather than letting the
  dropdown snap back and look broken.
- **Training Dashboard** flags any pairing running past thirty days. That number
  is the point of the page: a trial who has been shadowing for six weeks is
  either being neglected or is not going to make it, and both want somebody to
  notice. The clock is stamped once per render, so a row does not tick over from
  29 to 30 days while it is being read.
- **Analytics** counts rows that already exist — disciplinary actions, support
  tickets, the roster — over a 30/90/180-day window. Nothing on it is a metric
  invented for a dashboard, because a number nobody can trace back to a row is a
  number nobody trusts the moment it looks wrong.

The user chip in a hub carries the rank and the band it sits in (Ownership,
Leadership, Administration, Moderation). The rank is derived server-side from
the caller's role keys in `requireRole.js` (`rankFor`), so it is the same value
the gates are using rather than something the client guessed.

Ranks run Trial Mod → Mod → Sr. Mod → Jr. Admin → Admin → Sr. Admin → Head
Admin → Directorship → Ownership, each granting the roles below it, over a
civilian floor of Member → Cert. Civ. I → II → III. Ownership sits at the top and
holds every permission there is.

**Ownership is never rostered.** It is not a rank in `ROLE_MAP`, so it appears on
no roster — not the staff roster, not the community roster, not a department's.
It lives in `SPECIAL_ROLES` as a `tier` instead: bound to a Discord role like
everything else, and grantable, but not a seat on a team. That is also what
distinguishes it from Directorship, which *is* rostered under Management.

**Ownership holds every permission unconditionally.** `permissionsFor` and
`grantsPermission` short-circuit on it rather than consulting the grant table,
and every gate goes through those two — `requirePermission` included, which is
why it no longer does a lookup of its own.

That is not a shortcut, it is what stops the tier being a lie. The rank ladder is
a preview convenience: somebody who really holds the Ownership Discord role holds
*only* that role, so otherwise every grant would have to name it or they get
nothing at all. An install whose permissions were saved before the tier existed
has stored grants that cannot name it — and the page that would fix that is
itself behind a permission, so one careless edit could lock the owner out of
their own site with no way back in. Nothing is given away by it either:
`permissions.manage` already lets its holder grant themselves everything else, so
a revocable Ownership was never a real limit.

The ladder is declared once as `STAFF_LADDER` in `src/data/permissions.js` (and
its server mirror), and `staffFrom("admin")` slices it — so a tier added to that
array is picked up by every "and up" grant without touching them individually.

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

## Applications — `/apply`

Department command staff build their own application forms; anybody can fill one
in; every submission is posted to Discord with an Approve and Deny button under
it. The **Apply** button in the top bar is the front door.

An application is one JSON document: sections, fields, who may apply, and where
in Discord it goes. The engine is `src/lib/applicationConfig.js`, mirrored at
`server/src/lib/applicationConfig.js`, and both sides read the same document —
so what the builder previews is what the applicant fills in and what the bot
receives.

### Not the same thing as a form

`src/lib/forms.js` is graded, lives inside a hub, and answers to somebody who is
already a member. An application is filled in by somebody who may hold no roles
at all, is routed to a channel for a decision, and its outcome is a yes or a no
rather than a score. Sharing one document type would have meant every field
carrying a `points` value nobody uses.

The older fixed whitelist form at `/applications` is still there and still
works. This system does not replace it yet; it uses its own tables
(`custom_applications`, `application_submissions`, `application_dispatches`) and
its own `/api/apply` router so the two do not collide.

### What a department can configure

Eighteen field types, including the identity fields that validate themselves —
Discord ID, Steam hex, email, link, age. Sections, headings and read-only
statements. Per-field length and number ranges. **Conditional fields**: any field
can be shown only when an earlier multiple-choice, dropdown, checkbox or
agreement field has a particular answer, which is how one form covers "have you
done this before?" without asking everybody the follow-up.

One condition per field, deliberately — a rule builder that nests is one nobody
can read back six months later.

### Who may build, and who may decide

Each department's command role (Colonel, Sheriff, Chief, Fire Chief, Director)
builds that department's applications and its subdivisions'. `applications.manage`
and `applications.review` are the community-wide versions for people who oversee
every department. A Sheriff editing an FHP application is refused, and so is
moving an application into a department you do not command.

Per-application **reviewer role IDs** are raw Discord snowflakes rather than the
site's role keys, because the bot enforces them on the buttons inside Discord,
where a key means nothing. On the site those ids are translated through the
Discord Role Mapping page where they happen to be mapped — an unmapped reviewer
role still works in Discord, it just cannot be recognised here.

### The Discord half, and what your bot has to do

**This site never talks to Discord.** It cannot: a website cannot attach an
interactive component to a message, and it cannot receive the click either. Only
a bot application can do both. So every message is queued and the bot owns the
buttons.

On submission the site writes a row to `application_dispatches` — always — and
then, if `BOT_DISPATCH_URL` is set, pushes it to the bot as well. The push is an
optimisation; the queue is the contract, and it is what makes a bot outage cost
nothing but time.

The payload is complete: channel id, the ping mentions, the embed, the two
buttons with their `custom_id`s already built, and a `meta` block carrying the
reviewer and on-approval role ids. Your bot has nothing to invent.

| Your bot calls | To |
| --- | --- |
| `GET /api/apply/bot/outbox` | Collect what has not been posted yet, oldest first |
| `POST /api/apply/bot/outbox/:id/delivered` | Confirm it posted, with `messageId` so it can edit later |
| `POST /api/apply/bot/outbox/:id/failed` | Report a failure, so it shows up rather than vanishing |
| `POST /api/apply/bot/submissions/:reference/decision` | Report an Approve or Deny press |

All four take `Authorization: Bearer $BOT_TOKEN`, the same shared secret the
roster sync uses. Button `custom_id`s are `app_approve:<reference>` and
`app_deny:<reference>`, so the reference to report back is in the id.

The bot is trusted to have checked the reviewer roles, because it is the only
thing that can. What is not trusted is the transition: a decision from Discord
and a decision from the site go through the same guarded `UPDATE ... WHERE
status = 'pending'`, so two people deciding at once cannot both win — the second
is told who got there first.

Deciding also queues a follow-up dispatch, so the bot can edit the original
message: the embed turns green or red, the outcome and reason are written into
it, and the buttons come off.

### Two things the site will not pretend about

A submission that could not be stored is reported as **not received**. An
application is a message to a department, and telling somebody theirs arrived
when it did not is the one answer that costs them something real — so unlike
every other read on this site, the apply path has no seed fallback for writes.

Each submission stores its own copy of the application. A question edited
tomorrow never rewrites what somebody was asked today, and deleting an
application leaves its submissions readable.

## Support portal — `/support`

Members open tickets, the team works them. `/support` is a member's own list,
`/support/queue` is the team's, and `/support/flows` is where the branching
replies are built.

### The type decides the form

Picking what a ticket is about first is what makes the rest of it worth filling
in — a ban appeal asks where and when, a bug asks what you were doing. One box
labelled "describe your issue" just means every reply starts by chasing details
the form could have asked for.

**Report a staff member** is the type that shapes the access model: it is worked
only by `support.escalated` (Directorship), so an ordinary agent cannot see it
even though they work every other queue. A report about the staff team that the
staff team triages is not a report.

### Internal notes

They sit inline in the thread, badged, rather than behind a tab — that is how
the team's existing portal shows them, and threading a note next to the message
it is about is most of its value. The safety is in the composer instead: the
note toggle recolours the whole box amber while it is on.

What is *not* a UI decision — an internal note never reaches a member's browser.
The server drops them from the query. Asking to post one without the standing is
a denial rather than a quiet downgrade to the public thread.

### Status moves itself

An agent replying moves a ticket to **waiting on member**; the member replying
moves it back to **open**. An internal note moves nothing. Without that a queue
fills with tickets nobody can act on, and "open" stops meaning anything.

### The rail

Status, priority and assignment are one endpoint, because they are one action:
picking a ticket up means assigning it to yourself and moving it off `open` in
the same breath, and two round trips leave a window where it is assigned but
untouched. Every change writes history — who reassigned a ticket and when is the
first thing anybody asks when one goes wrong.

Taking a ticket needs `support.work`. **Handing one to somebody else** needs
`support.manage`, so an agent cannot clear their own queue by pushing everything
onto a colleague.

### Response flows

A tree of prompts whose leaves are reply text. An agent picks a flow, answers
the follow-ups the answer actually depends on — "which server", "was it
permanent" — and lands on the reply.

**It inserts, it does not send.** That is the whole safety of the feature: a
canned answer that posts itself is how somebody gets a reply about the wrong
server. `{user}`, `{agent}`, `{ticket}` and `{subject}` are filled in on the way
into the box.

The builder is an indented outline rather than a canvas of boxes and arrows. A
support tree is three or four deep and every branch ends in text — an outline
shows the whole shape on one screen and stays editable on a laptop. A flow can
be saved as a draft with problems, but going live is refused while any branch
points at a step that no longer exists, because that dead-ends an agent
mid-conversation with a member.

## Disciplinary actions — the DA Hub and `/bgcheck`

Every action taken against a member, by the staff team or by a department, in
one record. `/staff-hub/da-hub` files them; `/staff-hub/da-database` reads them;
the Discord bot's `/bgcheck` command reads the same rows folded into an embed.

### One store, not two

A department write-up the staff team cannot see is how somebody with four of
them keeps getting hired, and a background check covering half the community is
worse than none — it reads as a clean record rather than an incomplete one. So
the staff team, the directorship and all five departments file into the same
table, and `body_id` says who filed it.

### Verbal versus non-verbal is the line that matters

A verbal warning is a conversation that was logged; everything else is on paper
and follows the member. `/bgcheck` splits on that first and on staff-versus-
department second, because that is the shape a reviewer actually reads: coaching
in one column, history in the other.

### Nothing is deleted

The hub's delete button voids. The row stays, struck through with the reason it
was withdrawn, and the background check counts it separately rather than
dropping it. An action that quietly vanished is indistinguishable from one that
never happened, and the difference matters to whoever it was filed against.

### Who can file and who can read

Department command file against their own department without a grant, the same
way they build their own applications. `discipline.file` is the community-wide
version. Reading somebody else's whole record is a **separate** grant
(`discipline.view`) — filing an action and pulling a member's history are not
the same act, and without the second somebody sees only what they filed
themselves. Filing one against your own Discord ID is refused outright.

### What the bot calls

```
GET /api/discipline/bot/background/:discordId?days=180&name=C.%20Alex
Authorization: Bearer $BOT_TOKEN
```

Answers with the folded record **and** a finished Discord embed. The bot can
post the embed as it stands or build its own from the data, but the default
costs it nothing and means the site owns what a record looks like rather than
two renderers drifting apart. `days` defaults to 180 — the six months the
command is specified against — and is clamped to a sane range.

The embed leads with anything still in effect (a suspension that has not expired
is what stops somebody being hired mid-suspension), then the four buckets, then
anything voided.

## Transfer portal — `/transfers`

Moving a member from one emergency services department to another. Both
departments' command staff have to sign before anybody moves, and the receiving
department decides the rank they start on. It sits under Emergency Services in
the nav.

Ported from [fartherr97/es-transfer-portal](https://github.com/fartherr97/es-transfer-portal),
which was a standalone Next.js app. Three things changed on the way across, and
they are why this is a port rather than a second app deployed beside this one.

### Departments and ranks come from this community

The original hard-coded four departments and invented a rank ladder for each.
Here `TRANSFER_DEPARTMENTS` is derived from `DEPARTMENTS` and every rank from
`ROLE_MAP` — the same tables the roster and the Discord Role Mapping page read.
So the portal covers all five departments including DHS, the ranks are the real
ones (Trooper → Colonel, Deputy → Sheriff, Officer → Chief of Police,
Probationary Firefighter → Fire Chief, Special Agent → Director), and a rank
renamed on the mapping page is renamed here with no second list to update.

The processing modal offers only the **receiving** department's ladder. The
original offered every rank in the community flattened into one list, which let
you post a Fire Chief into the Highway Patrol.

### Access is this site's permission model

The original carried its own Discord OAuth and a `role-map.js` full of
`REPLACE_WITH_ROLE_ID` placeholders to work out who was a department head. Here:

| Portal role | Here |
| --- | --- |
| Department head | Holds that department's command rank — the same rule the application builder uses |
| Management | **Directorship**, via `transfers.manage` |
| Transferee | Everybody else, on their own tickets |

Directorship sees every ticket, and is the only tier that closes or reopens one
or edits the webhook settings. A department head sees tickets where their
department is on either side — both have to sign, so both have to read it.
Everybody else sees only their own, on the public thread only.

The check is named for the permission rather than the rank, so if that oversight
ever moves off Directorship it moves on the permissions page and nowhere else.

The department somebody signs for is resolved from their roles server-side, never
read from the request body — otherwise a Fire Chief could post `{ dept: "fhp" }`
and sign for the Highway Patrol. The Approve button says which side it signs
for, so nobody has to guess.

### It is a section of the site, not an app

One router, one session, one design system. The portal's own top bar, Discord
login, toasts, buttons and inputs did not survive the move and did not need to.

### The two threads

Every ticket has a public thread the member reads and a staff-only thread the two
departments read. They are tabs rather than the original's side-by-side panels:
side by side works on a director's monitor and nowhere else, and the thing that
must never happen is typing into the wrong one.

The internal thread is filtered out **in the query** for anybody who may not see
it. A staff note that reaches the browser has already leaked whatever it says;
hiding it in the UI afterwards is not a control. Asking to post to it without the
standing is a denial rather than a quiet downgrade to the public thread — silently
posting a staff note where the member can read it is the worse failure.

### Presence

One call does both halves: the heartbeat records that you are looking and answers
with everybody else who is. The original polled two endpoints on the same timer
to say the same thing. A viewer counts as present for 25 seconds, and reads
filter on `last_seen` rather than relying on anything having cleaned up.

### Discord notifications

Each department can point new tickets at a Discord webhook, configured under
Settings (Directorship only) with a live preview of the embed.

A webhook posts a message and nothing else, which is the right tool here: a
transfer is decided in this portal by two department heads, so the Discord
message is a notification rather than a control surface and needs no buttons.
Where buttons *are* needed — applications — the bot owns them, because a webhook
cannot carry one.

**The webhook URL is write-only.** It never comes back from the API, not even to
the Directorship that just typed it in, because anybody holding it can post
into that channel as the department forever. The page shows whether one is set,
never what it is, and a blank field means "leave it alone" rather than "delete
it". Only real `discord.com/api/webhooks/…` URLs are accepted.

### Two things that changed because they were wrong

**The schema had fallen behind the code.** The original `schema.sql` had no
`approvals`, `history`, `rejection_reason`, `assigned_rank`, `retired_member` or
`employment_type` columns, and its status ENUM was missing `closed` — all of
which `lib/transfers.js` read and wrote. Anybody running that file and then the
app would have hit errors on the first approval. The schema here is the full set.

**Settings were a process global.** `lib/settings.js` kept every webhook URL in
`globalThis` and reset it on restart. A URL a director typed in should survive a
deploy, so it is a table.

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

Two management pages sit under each other, both restricted to Directorship and
Ownership:

| Page | Answers |
| --- | --- |
| **Discord Role Mapping** (`/staff-hub/discord-roles`) | Which Discord role *is* each rank, tier and tag? |
| **Permissions** (`/staff-hub/permissions`) | Which of those roles may do what? |

They sit at the top of the ladder rather than with Head Admin on purpose: anyone
who can edit permissions can grant themselves everything else, so gating role
mapping any lower would be cosmetic.

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

### It is not in this site's guard table

The link sits in the Management menu for everyone, and the route is not in
`src/lib/guards.js`. Authorisation here belongs to the bot API, which re-checks
every call; gating the route on a site permission as well would be a second,
weaker opinion that could disagree with it, and could lock out somebody the bot
would have let in. Anybody who opens it without a bot session gets the sign-in
page, and anybody who signs in without staff access gets the not-staff page.

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

That development caller (`devUser` in `server/src/seed.js`, mirrored by `mockUser`
in `client/src/data/mockData.js`) holds **Ownership**, so browsing locally shows
the whole site rather than a moderator's slice of it. The preview switcher on
either hub landing page is how you see it as anything lower.

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
