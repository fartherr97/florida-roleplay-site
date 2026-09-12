# Department ticket queues

Support now groups ticket queues under FHP, BSO, MPD and Civilian Department. Community queues remain separate. Existing queue IDs, tickets, permissions and webhooks are retained; no database migration is needed because queue configuration is stored as JSON.

Ownership can open Support > Manage queues (`/support/types`). Existing holders of `support.configure`, including Directorship by default, retain access. Select a queue and choose its Department, or add a new queue. Department queues offer Recruitment and Internal Affairs templates. Edit the label, description, intake fields, access permissions and order, then Save changes. Disable a queue to stop new tickets without removing its configuration.

Templates are added only when selected and saved; deployment does not overwrite the live catalogue or create unsolicited queues. Internal Affairs starts exclusive to `support.escalated`. Recruitment starts with the selected department's support permission and existing general support access. Review Worked by for the desired team. Webhooks remain configured per queue under Support > Webhooks. Exclusive queues require their own webhook and never fall back to the general support webhook.

Validation: `npm run build --prefix client`, `npm run lint --prefix client`, `node --test tests/support-departments.test.mjs`. Browser checks with a mocked API cover expansion, delayed queue deep links, queue template save, failed configuration loading and 390px mobile layout. Production database writes and live Discord notifications were not exercised.
