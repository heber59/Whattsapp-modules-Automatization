# Work plan

Reviewed November 12, 2026. The accepted [scope](product-scope.md) is business-configurable conversations: content, questions, pricing, confirmation, and advisor routes. No universal store journey or customer form is imposed.

## Delivery status

| Delivery | Implementation | Acceptance or remaining work |
| --- | --- | --- |
| Accounts and businesses | Registration, login, refresh, recovery, permissions, isolation | Real Supabase acceptance pending. |
| Declarative authoring | Versioned JSON, editor import/export, shared validation/simulation, revisions and immutable publications | Existing four-node definitions remain supported. Terraform is inspiration, not a dependency. |
| MCP tools | Authenticated list/read/validate/simulate/diff/apply/publish over HTTP | Revision 2025-11-25; configure an authenticated client. Applying, publishing, and channel assignment are separate. |
| Conversation engine | Fifteen node kinds; inputs, variables, conditions, arithmetic, media/PDF, optional catalog/cart | Catalog is text selection. Stock belongs to the business. Media needs reachable merchant URLs. |
| Configurable orders | Captured data, calculated amounts, automatic confirmation or human approval, queries | Approval/cancellation exposes orderStatus for downstream conditions. No payment processing. |
| Human attention | Inbox history, replies, pause/resume, advisor routes, delivery review, external template alerts | Configure approved templates and recipient phones; real notification acceptance pending. |
| WhatsApp delivery | Signed webhooks, durable inbox/outbox, media/text actions, pinned conversations, deduplication and recovery | Real-phone reception, replies, media and restart acceptance pending. One server-approved number/business. |
| Hosting and pilot | CI and delivery packaging | Select ingress/provider, validate proxies, execute artifacts and accept a merchant journey. |

## Verification

Development verification on November 12 passed types, lint, 20 unit tests, 20 backend integration tests (one additional fixture probe skipped), five CI tests, web-proxy integration, production builds and API packaging with compiled contracts. Record checks against a candidate commit before release. Simulators and isolated databases do not establish real-provider acceptance.

Migrations 006–007 add variables, typed outbound payloads, orders and durable notifications. Apply them explicitly to the intended environment; testing does not migrate an existing merchant database.

## Next delivery

Configure approved owner-notification templates and recipients. Validate a merchant-created flow on Meta's test number, including media, external alerts, advisor handoff and human confirmation. Complete real authentication and hosting acceptance. Subscriptions, additional phone onboarding, timers, and restricted HTTP actions remain future work.

Use Pending → In progress → Implemented → Verified. Track owner, blocker, candidate commit and evidence. Configuration alone never proves live delivery.
