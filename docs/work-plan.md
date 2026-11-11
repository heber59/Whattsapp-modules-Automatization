# Work plan

Reviewed November 11, 2026. Delivery follows dependencies and acceptance evidence. The previous November 6–9 targets are retired; the unavailable HTML checklist is no longer a planning dependency.

## Delivery sequence

Owner roles identify areas of responsibility. Rows describe dependencies; independent preparation may run in parallel.

| Delivery | Status | Owner role | Blocker and next action | Acceptance evidence |
| --- | --- | --- | --- | --- |
| Reproducible foundation | Locally verified | Engineering / QA | Record the candidate commit and CI run. | Lint, types, five CI tests, two configuration tests, nine integration tests, and API/web builds passed locally before publication. |
| Hosting topology | HTTP configuration prepared locally; ingress pending | Infrastructure | Select ingress, process topology, and provider; validate bind address and trusted proxies accordingly. | Reachable API and correct client IP limits through the selected ingress; forwarding headers from untrusted peers are ignored. |
| Merchant session and permissions | Partial | Frontend / backend | Verify real Supabase sessions, add recovery, and define administrative permissions. | Login, refresh, recovery, sign-out, business isolation, and role restrictions; real Supabase acceptance recorded separately. |
| Persistent WhatsApp channel | Pending | Integration / backend | Obtain Meta access and HTTPS endpoint; implement signed reception and durable processing. | Invalid signatures rejected; repeated delivery creates one event; messages survive retry and recovery. |
| Configurable first order | Pending | Product / frontend / backend | Approve initial node catalog and required order fields; build editor, versioned execution, and orders. | Merchant builds from an empty canvas; customer confirms exactly one order with server-calculated COP totals. |
| Release candidate and pilot | Pending | QA / operations / pilot lead | Complete the journey, resilience checks, and pilot agreement. | Recorded recovery checks, real-provider journey, deployment validation, and explicit pilot acceptance. |

## Tracking

Use Pending → In progress → Implemented → Verified. Each change records its owner, blocker, next action, candidate commit, and test or CI evidence. A configured integration is not verified until acceptance succeeds. Recheck evidence after relevant implementation changes.

Current implementation includes local API/web/worker processes, migrations, identity, memberships, business isolation, and IP/user/account limits. The worker processes diagnostic jobs. Web login, session renewal, sign-out and business selection are implemented. Password recovery, Meta integration, workflow execution, orders, and commercial workflows remain pending. See [backend](backend.md), [authentication](authentication-security.md), and [delivery](ci-cd.md).

Historical temporary checks reported Redis outage/recovery behavior; those checks were removed and are not retained regression coverage. Automated authentication tests use a simulated provider. Real-user Supabase login, Meta acceptance, production deployment, and artifact execution remain unverified.

## Product scope

The first journey must preserve freely configurable graphs within the supported node catalog. Initial nodes and order fields are proposals until approved. Broader nodes, simulation, human inbox, and commercial administration follow explicit acceptance needs; they are not implied complete by the first order.
