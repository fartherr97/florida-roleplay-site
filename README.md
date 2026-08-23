# Florida Roleplay

Public community site and API for **Florida Roleplay**, a FiveM roleplay server —
rules, applications, departments, store, supporters, events, knowledge base and
reports, sitting in front of a rank-gated **Staff Hub**.

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
  `AUTH_SIGNED_OUT`, `AUTH_ROLE_MISSING` or `AUTH_DEPT_MISMATCH` — the code the
  Access Denied panel prints in its footer.
- **Roles** — the role list is deliberately duplicated between
  `server/src/seed.js` and `client/src/data/mockData.js`; both files say so. Add
  a role to one, add it to the other. The same applies to the hub's seed data
  (`server/src/staffHubSeed.js` mirrors `client/src/data/staffHubData.js`).
- **Validation** — POST bodies are re-validated server-side in
  `server/src/validate.js`. Client-side checks are for feedback only.
- **Navigation breakpoint** — the full mega-nav carries nine links, three
  dropdown groups, the Connect CTA and the user chip. Measured, that needs more
  room than `xl` provides, so `src/index.css` defines a `nav` breakpoint
  (1700px) where it un-collapses; below that everything lives in the drawer.

## Staff Hub

The Staff dropdown leads into `/staff-hub`, a rank-gated sub-application with its
own shell — a sidebar and slim bar, no public TopBar or Footer. Its landing page
is public: it is the sign-in entry point and explains what the hub is.

| Group | Pages |
| --- | --- |
| Staff Portal | Overview (reminders, staff member of the month, quick notes), Staff Roster, Staff Dashboard, Trial Mod Checklist, Staff DA Database |
| Rank Access | Resources, Administrators, Senior Admins+, Director panel |
| Exam Backend | Recent Submissions (with attempt review and manual override), Members, Audit Log, Management (thresholds and question catalog) |

Ranks run Trial Mod → Moderator → Senior Mod → Administrator → Senior Admin →
Director, each granting the roles below it. `client/src/data/hubNavigation.js`
declares the roles for each page next to the sidebar entry that lists it, and
`src/lib/guards.js` folds those into the shared guard table — so the sidebar, the
route gate and the server middleware cannot drift apart.

Exam results are never edited in place. An override writes an append-only row
carrying the reviewer and their reason, and the Audit Log renders those rows; the
attempt keeps its original score alongside the new one.

### Preview mode

Because Discord OAuth is still stubbed, the hub landing offers a rank switcher so
the whole portal can be reviewed as any rank. The chosen rank is kept in
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
