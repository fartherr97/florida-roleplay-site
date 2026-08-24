# Deploying Florida Roleplay

The site is one Node process that serves both the API and the built client, and
one Postgres database. That is the whole topology, and it is deliberate: same
origin means no CORS to configure and no way for the `SameSite=Lax` session
cookie to be dropped, which is the failure that looks like nothing is wrong.

Railway first, Northflank later. Nothing below is Railway-specific except the
console clicks — the app reads `DATABASE_URL` and `PORT`, which is what every
platform provides.

---

## 1. The Postgres service

Your bot already has a Postgres on Railway. **Give the site its own**, in the
same project:

> New → Database → Add PostgreSQL

Not because one instance could not hold both, but because both schemas want a
`users` table. Sharing one means either a rename or a `search_path` you have to
remember in every session, and a restore for one is a restore for both. A second
Postgres is a few dollars and removes the whole class of problem.

Railway puts it on the project's private network. Nothing else is needed — no
IP allowlist, no public proxy.

## 2. The site service

> New → GitHub Repo → `fartherr97/florida-roleplay-site`

`railway.json` in the repo root already sets the three things that matter:

| Setting | Value | Why |
| --- | --- | --- |
| Build | `npm run build` | Installs both workspaces and builds the client into `client/dist` |
| Start | `npm run db:init && npm start` | Applies the schema, then boots |
| Health check | `/healthz` | Returns 200 with `{ database: true \| false }` |

`npm run db:init` on every boot is safe and intentional: every statement in
`server/src/schema.sql` is `IF NOT EXISTS` or `CREATE OR REPLACE`, so on a
database that is already current it is a no-op that takes a second. It is not a
migration tool — see [Schema changes](#6-schema-changes) below.

The health check returns 200 even when the database is down, reporting
`database: false`. That is on purpose: the site serves seed data without a
database, so failing the check would pull a working site out of rotation. Watch
the flag, not the status code.

## 3. Variables

On the **site** service:

| Variable | Value | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | A **reference**, not a paste. Rotate the password and it follows. |
| `NODE_ENV` | `production` | Hard-disables the dev auth path. Not optional. |
| `CORS_ORIGIN` | `https://flrp.us` | |
| `TRUST_PROXY` | `2` | Cloudflare, then Railway's router. |
| `DB_SSL_REJECT_UNAUTHORIZED` | `false` | Railway's internal hostname presents a cert that does not match it. The traffic is still encrypted — this relaxes verification, it does not turn TLS off. |
| `BOT_TOKEN` | a long random string | The bot presents this as `Authorization: Bearer`. Leave it unset and the bot endpoints refuse with 503 rather than sitting open. |
| `DISCORD_CLIENT_ID` | from the Discord app | OAuth2 → General. |
| `DISCORD_CLIENT_SECRET` | from the Discord app | OAuth2 → General. A secret — set it here, never in the repo. |
| `DISCORD_BOT_TOKEN` | a bot token for that app | Reads guild membership and roles. The bot must be in the guild with the **Server Members Intent** on. |
| `DISCORD_GUILD_ID` | the community's server ID | Only members of this guild can sign in. |
| `DISCORD_REDIRECT_URI` | `https://flrp.us/api/auth/callback` | Must match a redirect added in the Discord portal **verbatim**. |
| `DB_CONNECTION_LIMIT` | `5` | Times the number of running instances, this has to stay under the plan's connection cap. |

`PORT` is injected by Railway; do not set it.

`DATABASE_URL` as a reference is the only part of this list that is not
obviously cosmetic. Pasting the value works right up until the password is
rotated, at which point the site is down and the variable still looks correct.

## 4. The domain

Railway → the site service → Settings → Networking → Custom Domain → `flrp.us`.
It gives you a CNAME target. In Cloudflare:

| Type | Name | Content | Proxy |
| --- | --- | --- | --- |
| CNAME | `@` | the Railway target | Proxied |
| CNAME | `www` | `flrp.us` | Proxied |
| CNAME | `api` | wherever the **bot's** API runs | Proxied |

SSL/TLS mode must be **Full (strict)**. Flexible would have Cloudflare talk to
Railway over plain HTTP, which is a lock icon in the browser and cleartext for
the last hop.

`api.flrp.us` is the bot's API, not this one. It has to be a subdomain of
`flrp.us` rather than a separate domain, because the bot's session cookies are
`SameSite=Lax`: on any other domain the browser silently declines to send them,
every signed-in request comes back 401, there is no CORS error, and the network
tab looks completely ordinary.

Department hostnames work with no code change whenever you want them —
`fhp.flrp.us`, `hcso.flrp.us` — because `server/src/lib/tenant.js` reads the
first DNS label. Add the CNAME and the custom domain; that is all.

## 5. Discord sign-in

Sign-in is Discord OAuth (see **Authentication** in the README for the flow).
Set it up once in the [Discord Developer Portal](https://discord.com/developers/applications):

1. **Create an application** (or reuse the bot's). Copy the **Client ID** and,
   under **OAuth2 → General**, the **Client Secret**.
2. **OAuth2 → Redirects** → add `https://flrp.us/api/auth/callback` exactly. For
   local development also add `http://localhost:5173/api/auth/callback`. Discord
   rejects any redirect that is not on this list, character for character.
3. **Bot** → make sure the application has a bot, copy its token, turn on the
   **Server Members Intent**, and invite the bot to the community guild. The
   callback reads roles through this bot, so it has to be a member.
4. Copy the community **server (guild) ID** (right-click the server icon → Copy
   Server ID, with Developer Mode on).
5. Put all five values into the site service's variables (table above).

Then map your real Discord roles to this site's role keys on the **Discord role
mapping** page, so a signed-in member resolves to the ranks and permissions they
should hold. Until a role is mapped, every guild member still signs in as a plain
`member`.

If any of the five variables is missing the site stays up, `GET
/api/auth/config` returns `configured: false`, and the sign-in button says so
rather than dead-ending.

## 6. First deploy

```
Deploy → watch the build log → check /healthz
```

Then, in order:

1. `curl https://flrp.us/healthz` → `{"ok":true,"database":true}`. If `database`
   is false, the connection string or TLS is wrong; the deploy log will say
   which.
2. Open the site. Every page renders from seed data whether or not the database
   has rows, so a page that loads is not yet proof the database is wired.
   `/healthz` is.
3. Point the bot at `POST /api/roster/sync` with the `BOT_TOKEN` and let it fill
   the roster. That is the first real write.

## 7. Schema changes

`db:init` creates what is missing. It does not alter what exists — an added
column, a widened type or a dropped index needs a real migration.

Until there is a migration tool, the honest procedure is: write the `ALTER` by
hand, run it against the database once (`railway connect Postgres`), and put the
same change into `schema.sql` so a fresh database comes out identical. Two
places, deliberately, and the second one is the one people forget.

If this outlives being a two-person job, the thing to add is a `migrations/`
directory with numbered files and a table recording which have run. Do not
reach for an ORM's migration tool just to get that.

## 8. Backups

Railway takes daily snapshots on paid plans. That is a floor, not a plan — it
does not protect you from a bad `DELETE` noticed a week later.

```bash
railway run --service Postgres pg_dump --no-owner --format=custom > flrp-$(date +%F).dump
```

Run it before anything that touches the schema, and keep the file somewhere that
is not Railway.

---

## Deploying on Northflank

Northflank ignores `railway.json` and its buildpacks do not cleanly handle a
monorepo that has to run `db:init` before start, so the repo carries a
`Dockerfile`. It builds the client, installs the server's production
dependencies, and starts `db:init && start` — nothing platform-specific, so the
same image runs anywhere.

1. **Project.** Create a Northflank project (pick a region near your players).
2. **Postgres addon.** Addons → **PostgreSQL** → create it. When it is ready,
   open it and note the **connection details**: Northflank exposes them as a
   secret you can link into the service, including a `DATABASE_URL`/`POSTGRES_URI`.
3. **Combined service.** Create a **Combined service** (build + deploy) from the
   GitHub repo, branch `claude/florida-roleplay-site-nih7ub`.
   - **Build type: Dockerfile**, path `/Dockerfile`, context `/`.
   - **Port:** `4000`, public, HTTP. That is what the container listens on.
   - **Health check:** HTTP `GET /healthz`.
4. **Link the database.** In the service's **Environment**, add the Postgres
   addon as a linked secret so its connection variables are injected. Make sure
   one of them is named **`DATABASE_URL`** — if the addon only provides
   `POSTGRES_URI` (or similar), add `DATABASE_URL` yourself referencing it. The
   app reads `DATABASE_URL` and nothing else for the connection.
5. **Variables.** Set the rest as service environment variables:

   | Variable | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `CORS_ORIGIN` | `https://flrp.us` |
   | `TRUST_PROXY` | `1` — **recount it**; it is the number of proxies in front of the process on Northflank + Cloudflare, and wrong by default |
   | `DB_SSL` | `disable` if you connect over the project's **private** network (plaintext, trusted); leave unset for an external/TLS endpoint |
   | `BOT_TOKEN` | the roster-sync shared secret |
   | `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_BOT_TOKEN` / `DISCORD_GUILD_ID` | from the Discord app |
   | `DISCORD_REDIRECT_URI` | `https://flrp.us/api/auth/callback` |

   Do **not** copy Railway's `DB_SSL_REJECT_UNAUTHORIZED=false`; that was for
   Railway's internal certificate. On Northflank either the private network is
   plaintext (`DB_SSL=disable`) or the endpoint presents a valid cert (leave the
   SSL vars unset and it verifies).
6. **Deploy.** Northflank builds the image and starts it. Check
   `https://<northflank-url>/healthz` → `{"ok":true,"database":true}`.
7. **Domain.** Add `flrp.us` under the service's **Domains**, then point
   Cloudflare's `@` CNAME at the Northflank target. SSL/TLS mode **Full
   (strict)**. Lower the DNS TTL to 60s a day before if you are cutting over
   from another host.

`db:init` runs on every start and is idempotent (every statement is
`IF NOT EXISTS`), so the first deploy creates the schema with no manual step —
see **Schema changes** for why it never *alters* an existing table.

## Migrating an existing Railway deployment to Northflank

The app was written so this is configuration, not a rewrite. What actually
changes:

| | Railway | Northflank |
| --- | --- | --- |
| Build | `railway.json` | A build service, or the same commands in the UI |
| Start | `npm run db:init && npm start` | Identical |
| Postgres | Add-on, `DATABASE_URL` reference | Addon → secret, same variable name |
| Port | `PORT` injected | `PORT` injected |
| Health | `/healthz` | `/healthz` |
| Proxy depth | `TRUST_PROXY=2` | Recount it — Northflank's ingress may be a different number of hops |
| TLS to the database | `DB_SSL_REJECT_UNAUTHORIZED=false` | Northflank's certs verify, so **remove it** |

The migration itself:

1. `pg_dump` from Railway (above).
2. Create the Northflank Postgres addon, `pg_restore` into it.
3. Bring up the service with the same variables, minus
   `DB_SSL_REJECT_UNAUTHORIZED`, and check `/healthz`.
4. Move the Cloudflare CNAME. Lower the TTL to 60s a day beforehand so the cut
   is minutes rather than hours.
5. Keep the Railway Postgres for a week before deleting it.

Two things to watch, because they are the ones that bite:

- **Nothing may hardcode Railway.** Nothing does today — grep for `railway` and
  you will find only this file and `railway.json`. Keep it that way; the moment
  a `RAILWAY_*` variable is read in application code, this table stops being
  true.
- **Recount `TRUST_PROXY`.** It is the count of proxies in front of the process,
  and it is wrong by default on any new platform. Getting it wrong does nothing
  visible until something rate-limits by IP, at which point it does the wrong
  thing quietly.

---

## Local development

```bash
# Postgres, however you like it
docker run -d --name flrp-db -e POSTGRES_PASSWORD=devonly \
  -e POSTGRES_DB=florida_rp -p 5432:5432 postgres:16

cp server/.env.example server/.env
# set DATABASE_URL=postgres://postgres:devonly@127.0.0.1:5432/florida_rp
# and DB_SSL=disable

npm run install:all
npm run db:init
npm run dev:server     # API on :4000
npm run dev            # client on :5173
```

Without a database everything still renders from seeds, which is the point — but
writes refuse rather than pretending, so test anything that saves against a real
Postgres.
