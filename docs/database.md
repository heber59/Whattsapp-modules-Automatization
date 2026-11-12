# Database

PostgreSQL uses a private `app` schema accessed by NestJS. Supabase Auth owns identities and credentials; application profiles contain no passwords.

| Tables | Purpose |
| --- | --- |
| users, businesses, memberships | Verified identities and owner/admin/operator business access. |
| whatsapp_numbers, products | Original phone/product storage foundations; not the source of flow-embedded product options. |
| commercial_requests | Consent-bearing contact/plan requests, follow-up state; no payment credentials. |
| flows, flow_versions | Revision-protected drafts and immutable publication snapshots. |
| whatsapp_channels | Pilot phone routing to a business and published flow version. |
| whatsapp_inbox | Deduplicated inbound events with ordered ingest sequence. |
| whatsapp_conversations | Pinned flow version, execution checkpoint, variables, state, last inbound time, explicit operator pause. |
| whatsapp_outbox | Ordered text/media payloads, expiry, attempts, operator reply marker, delivery/review state. |
| whatsapp_status_events | Provider delivery callbacks. |
| flow_orders | Flow-defined data snapshots, total when provided, currency, pending approval/confirmed/cancelled state. |
| operation_notifications | Inbox entries with configured recipient/text, read timestamp, optional template payload, attempts, dispatch state, and provider acknowledgement. |
| schema_migrations | Migration checksum and application date. |

## Integrity and isolation

Business reads/actions require authenticated membership. Composite references bind flow versions and WhatsApp conversations to the correct business. Orders reference their conversation and source inbound event. Unique `(inbox_id,step_id)` constraints deduplicate order and notification actions; `(inbox_id,sequence)` deduplicates outbound actions.

Flow execution writes its checkpoint, variables, orders, notifications, and outbound work in one transaction. Operator actions serialize against execution. Human decisions persist `orderStatus` for configurable downstream branches. Order data snapshots preserve configured values; the platform does not impose universal customer fields or inventory rules.

RLS is enabled without direct browser policies, and PUBLIC access is revoked. Privileged table owners can bypass RLS, so backend authorization is mandatory. Do not expose these tables through browser APIs.

Notifications default to internal records. Optional external WhatsApp templates use pending/sending/sent/retry/manual_review/failed/discarded states. Sent records API acceptance, not device delivery. Ambiguous or stale claims require owner/admin review and are never automatically resent. Original product rows do not implement inventory synchronization. Billing and generalized contacts/assignment remain future work.

## Migrations

Versioned SQL lives in `apps/api/migrations`. Migration execution uses locks, transactions, and checksums. Never edit an applied migration. Startup does not apply migrations automatically.

```bash
corepack pnpm db:migrate
```

Migrations 001–005 define the existing foundation and WhatsApp pilot. Migration 006 adds variables, operator pause, media payloads, orders, and notifications. Migration 007 adds durable external-template delivery. Both were verified against isolated local test infrastructure; application to the existing configured database remains pending. Back up and review the target before rollout.

## Consultation follow-up

Review `app.commercial_requests` through trusted database access and mark requests contacted or closed. There is no public lead-list endpoint or automatic commercial notification.
