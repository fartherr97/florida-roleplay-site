# FLRP Store (Tebex integration)

A custom, FLRP-styled storefront on top of Tebex. Tebex stays the authorized
payment platform — the site never touches card data. Players browse packages on
`/store`, buying one creates a Tebex basket server-side and sends them to Tebex's
hosted checkout, and only Tebex's payment **webhook** confirms the purchase and
grants the mapped FLRP entitlements.

```
/store  →  pick package  →  Tebex checkout  →  payment  →  Tebex webhook
        →  FLRP records the purchase  →  FLRP grants entitlements (idempotent)
```

## Environment variables

All optional — the store stays dormant (empty state on `/store`) until
`TEBEX_STORE_TOKEN` is set. See `server/.env.example` for the annotated block.

| Variable | Required for | What it is |
| --- | --- | --- |
| `TEBEX_STORE_TOKEN` | listing packages, checkout | The **public webstore token** from the Tebex panel (the Headless API identifier). Not secret, but kept server-side. |
| `TEBEX_WEBHOOK_SECRET` | fulfillment | The **webhook signing secret** from Tebex → Developers → Webhooks. Real payment webhooks are refused without it. |
| `TEBEX_STORE_URL` | optional | Public store URL for "Open in Tebex" links. Defaults to `https://<token>.tebex.io`. |
| `SITE_URL` | optional | The site's public origin, used to build checkout return URLs. Defaults to `https://www.flrp.us`. |
| `DISCORD_BOT_TOKEN`, `DISCORD_GUILD_ID` | Discord-role entitlements | Already used by the roster sync; reused to grant/remove roles. |

## Tebex panel setup

1. **Store token** — copy your project's public token (webstore identifier) into
   `TEBEX_STORE_TOKEN`.
2. **Webhook** — in Tebex → Developers → Webhooks, add an endpoint pointing at:
   ```
   https://<your-site>/api/store/webhook
   ```
   Copy the signing secret into `TEBEX_WEBHOOK_SECRET`. When you save the
   endpoint Tebex sends a one-off `validation.webhook`; our endpoint answers it
   automatically by echoing the id, so it validates on the spot.
3. Subscribe the endpoint to at least: `payment.completed`, `payment.refunded`,
   `payment.chargeback` (and the `recurring-payment.*` events if you sell
   subscriptions).

## Managing the store (Ownership only)

**Management → Store Management** (`/management/store`). The link, the page, and
every `/api/store/manage/...` endpoint are gated by the `store.manage`
permission, which is Ownership-only by default — the server enforces it, not just
the UI.

- **Overview** — package/purchase counts, settled revenue, last sync, and the
  **Sync now** button.
- **Packages** — everything synced from Tebex. Edit a package to set its FLRP
  display name, descriptions, image, category, featured/visible flags and sort
  order. Tebex name, price, currency and status are read-only here — pricing and
  deliverables stay in Tebex (use **Open in Tebex**). New packages arrive
  **hidden** so a sync never publishes something before it's been set up.
- **Entitlements** (inside the package editor) — what a purchase grants. Types:
  `discord_role` (applied by the bot; pick from live roles), `fivem_permission`,
  `queue_priority`, `website_badge`, `cosmetic`, `other`. Each can be permanent
  or time-limited (duration in days) and individually enabled/disabled.
- **Purchases** — searchable, filterable list. Open one to see its fulfillment
  ledger, **Retry fulfillment** (idempotent — never double-grants) or **Revoke
  entitlements**.
- **Audit Log** — every Ownership action and system fulfillment event.

### Sync behaviour

A sync only ever updates the *synced* columns (Tebex name, price, currency,
status). Your display settings and entitlement mappings are never overwritten. A
package that disappears from Tebex is marked inactive, not deleted, so its
configuration survives a mistake or an API blip and returns when the package
does. A failed Tebex request changes nothing.

## Fulfillment & idempotency

- The **webhook is the only authority**. Returning from the Tebex checkout page
  never grants anything.
- Every webhook is verified (`X-Tebex-Signature` = HMAC-SHA256 of the SHA-256 of
  the raw body, keyed by the webhook secret) and de-duplicated by event id.
- Each `(purchase, entitlement, action)` is a unique row in `store_fulfillments`.
  A webhook delivered twice finds the grant already recorded and does nothing.
- Discord roles are applied through the bot token (same path as the roster).
  Everything else is written to `store_player_entitlements`, the authoritative
  "what this player holds now" table.

## FiveM integration

FiveM reads entitlements from the database — no per-purchase ACE edits. The
authoritative table is `store_player_entitlements`:

| Column | Meaning |
| --- | --- |
| `discord_id` | The player (their Discord id) |
| `type`, `value` | e.g. `queue_priority` / `queue.priority.2` |
| `active` | `false` once refunded/expired/revoked |
| `expires_at` | Null = permanent; else the expiry |

Query active, unexpired rows for a player to decide queue priority, ACE perms,
cosmetics, etc. A refund or subscription-end flips `active` to `false` (and pulls
the Discord role) automatically.

## Refunds / revocation

`payment.refunded`, `payment.chargeback`, `payment.dispute.*` and
`recurring-payment.ended` revoke the purchase's entitlements idempotently: the
Discord role is removed, the player-entitlement rows are deactivated, the
purchase status is updated, and revoke rows are written to the ledger.

## Database tables (self-creating)

Created automatically on first use — no manual migration:
`store_packages`, `store_package_entitlements`, `store_purchases`,
`store_fulfillments`, `store_player_entitlements`, `store_webhook_events`,
`store_audit_log`, `store_settings`.

## Compliance

Tebex remains the sole payment layer. No Stripe/PayPal/Venmo/Cash App/direct card
processing is added. Any package can be hidden (display disabled) to pull it from
the store without touching Tebex if it needs review under Tebex/Cfx monetization
rules.
