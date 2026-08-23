# Florida Roleplay

Public community site and API for **Florida Roleplay**, a FiveM roleplay server —
rules, applications, departments, store, supporters, events, knowledge base and
reports, sitting in front of a role-gated staff area.

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
  a role to one, add it to the other.
- **Validation** — POST bodies are re-validated server-side in
  `server/src/validate.js`. Client-side checks are for feedback only.
- **Navigation breakpoint** — the full mega-nav carries nine links, three
  dropdown groups, the Connect CTA and the user chip. Measured, that needs more
  room than `xl` provides, so `src/index.css` defines a `nav` breakpoint
  (1700px) where it un-collapses; below that everything lives in the drawer.

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
