# Assigned Vehicles

Development → Assigned Vehicles lists active approved library claims, with member name/Discord ID, vehicle/spawn code, approval details, liveries and resource path. Search is literal and pages contain up to 100 assignments. Pending, denied, released and model-revoked claims do not appear. Database failures show an error rather than a misleading empty list.

Both the API and navigation require `development.assignments.view`. Defaults are `developer`, `directorship`, `ownership`; the confirmed main-guild Developer role `1542499913957376140` resolves to `developer`, including on existing installations whose stored role map predates this feature. Ownership can configure this read-only permission in Access & Roles. It does not grant model approvals or ticket access.

The list reflects assignments recorded in the website database. It does not infer ownership from filenames or move files in Git. Older vehicles must have an approved library claim to appear.

## Personal vehicle files

The existing Gitea `FLRP/flrp-vehicles` main branch contains:

- `[Donator]/DonatorFleet/packs/civpersonaldono` — civilian personal metadata and streaming assets.
- `[Donator]/DonatorFleet/packs/leopersonaldono` — law enforcement personals.
- `[Donator]/DonatorFleet/packs/devpersonals` — developer personals.
- `[Donator]/DonatorFleet/packs/diamondpersonaldono` — diamond personals.
- `[Donator]/[Protected]` — separately packaged protected models, including civpersonal10, civpersonal51, civpersonal56 and leopersonal47.

Models live under each pack's `stream`; vehicle configuration is under `data`. The containing DonatorFleet resource is a packaging choice, not a grant allowing every donor to spawn personal vehicles.
