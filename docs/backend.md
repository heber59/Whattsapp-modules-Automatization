# Backend architecture

NestJS + TypeScript modular monolith with focused services and a separate worker. Business-specific behavior is represented by flow definitions; see [product scope](product-scope.md).

## Implemented behavior

Identity, businesses, Supabase authentication, commercial requests, flow drafts and immutable publications exist. Flow authoring exposes declarative definitions and MCP operations alongside the editor. Draft revisions protect concurrent changes. Publication and WhatsApp channel activation remain separate operations.

The shared flow runtime handles menus, custom validated inputs, variables, conditions, calculations, media/document references, embedded product selections, cart operations, orders, notifications, and human handoff. Published versions stay pinned during active conversations. The WhatsApp worker persists variables and ordered actions in transactions; repeated processing does not create duplicate order/notification actions for an inbound event and step.

Order snapshots contain configured data, computed total when supplied, currency, and confirmation state. Human decisions set `orderStatus` to confirmed/cancelled, allowing downstream Conditions to choose the acknowledgement. Automatic confirmation is configured in the node. Explicit operator pauses survive order decisions.

## Operations API

Authenticated members access `/businesses/:businessId/operations`:

| Route | Purpose |
| --- | --- |
| GET / | Recent orders, conversations, internal notifications, failed/uncertain deliveries. |
| GET /conversations/:sender | Recent inbound/outbound history and delivery state. |
| POST /actions | Reply, pause, resume, decide orders, mark notifications read, review deliveries. |

Operators can handle conversations and orders. Only owners/admins can resolve uncertain customer deliveries or external alerts. Membership gates all access; responses prohibit caching. Decisions and resumption serialize with flow execution. Unknown sends cannot be blindly requeued; the operator records a verified provider acknowledgement or discards the delivery.

Notifications default to the business inbox. Notify/Handoff can additionally dispatch an external WhatsApp alert to a configured E.164 number using a merchant-approved template and language. The template must have one body text placeholder containing the rendered message (maximum 1,024 characters). API acknowledgement records acceptance, not handset delivery. Email, push, assignment routing, and recipient-specific access remain pending.

## Boundaries

- Flows owns definitions, validation, revisions, publication, and authoring tools.
- The shared runtime evaluates bounded expressions without arbitrary executable code.
- WhatsApp owns signed reception, conversation execution, media/text delivery, and provider status handling.
- Operations owns order snapshots, internal notifications, history, operator replies, and recovery actions.
- Business membership remains the authorization boundary; provider credentials stay server-only.

Commercial contact/plan requests are stored without automatic email. The full-access plan is COP 50,000/month; checkout, subscriptions, and paid entitlements remain pending.

## Verification and deployment

Migrations 006–007 add operations and durable external alerts. They were exercised only against isolated test infrastructure, not applied to the existing configured database. Integration checks cover custom fields, document ordering, totals, human approval/cancellation, manual pause/reply, and safe failure review. Provider simulation is not real Meta or Supabase acceptance. Hosting, public HTTPS, real-device delivery, and production artifact execution remain pending.
