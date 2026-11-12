# Work plan

Reviewed November 11, 2026. Delivery follows dependencies and acceptance evidence.

## Delivery sequence

Owner roles identify areas of responsibility. Rows describe dependencies; independent preparation may run in parallel.

| Delivery | Status | Owner role | Blocker and next action | Acceptance evidence |
| --- | --- | --- | --- | --- |
| Reproducible foundation | Locally verified | Engineering / QA | Record the candidate commit and CI run. | Lint, types, five CI tests, two configuration tests, nine integration tests, and API/web builds passed locally before publication. |
| Hosting topology | HTTP configuration prepared locally; ingress pending | Infrastructure | Select ingress, process topology, and provider; validate bind address and trusted proxies accordingly. | Reachable API and correct client IP limits through the selected ingress; forwarding headers from untrusted peers are ignored. |
| Merchant session and permissions | Partial | Frontend / backend | Verify real Supabase sessions, add recovery, and define administrative permissions. | Login, refresh, recovery, sign-out, business isolation, and role restrictions; real Supabase acceptance recorded separately. |
| Persistent WhatsApp channel | Simulator verified; Meta acceptance pending | Integration / backend | Create Meta application, configure test number and HTTPS webhook. | Signed reception, deduplication, ordered menus, retry and restart recovery pass local integration tests. Real-phone acceptance is pending. |
| Configurable first order | Pending | Product / frontend / backend | Approve initial node catalog and required order fields; build editor, versioned execution, and orders. | Merchant builds from an empty canvas; customer confirms exactly one order with server-calculated COP totals. |
| Release candidate and pilot | Pending | QA / operations / pilot lead | Complete the journey, resilience checks, and pilot agreement. | Recorded recovery checks, real-provider journey, deployment validation, and explicit pilot acceptance. |

## Tracking

Use Pending → In progress → Implemented → Verified. Each change records its owner, blocker, next action, candidate commit, and test or CI evidence. A configured integration is not verified until acceptance succeeds. Recheck evidence after relevant implementation changes.

Current implementation includes identity, business isolation, authentication, contact requests, server flow drafts, and immutable publications. Migrations 001–005 are applied to the configured database. The worker executes published text menus with persistent inbox/outbox and conversation state. Twelve unit tests, eighteen API integration tests, web-proxy integration, lint, and builds passed; one fixture probe is intentionally skipped. Real Meta credentials, HTTPS hosting, phone acceptance, orders, and subscriptions remain pending. See [WhatsApp setup](whatsapp-pilot-setup.md), [flows](flows.md), and [delivery](ci-cd.md).

Authentication tests use a simulated provider. Real-user Supabase login, Meta acceptance, production deployment, and artifact execution remain unverified.

## Product scope

The first journey must preserve freely configurable graphs within the supported node catalog. Initial nodes and order fields are proposals until approved. Broader nodes, simulation, human inbox, and commercial administration follow explicit acceptance needs; they are not implied complete by the first order.
