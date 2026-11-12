# WhatsApp integration

The pilot supports one server-approved Meta phone and business. Configure `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PHONE_NUMBER_ID`, `META_BUSINESS_ID`, and `META_GRAPH_VERSION` privately in API and worker. Missing settings disable processing. A localhost Graph simulator is allowed only in test mode.

## Setup and reception

Authenticated owners/admins of the approved business assign a published flow through `/businesses/:businessId/whatsapp`; operators view setup. Credentials and phone IDs cannot be supplied by the browser. Assignment configures routing, not verified device delivery. Follow [pilot setup](whatsapp-pilot-setup.md).

Webhook GET verifies the token and echoes the challenge. POST verifies the exact raw-body signature before persistence. Unknown phones and unsupported inbound message types do not trigger replies. Inbox IDs deduplicate events and ingest sequence preserves batch ordering.

## Configurable execution

The worker executes published graphs with menus, validated questions, variables, conditions, calculations, documents/images, embedded catalogs/cart, optional orders, notifications, and handoff. Businesses define customer fields, product questions, availability policy, and shipping rules. Active conversations retain their published version; completed or inactive conversations restart on the channel's current version.

Variables, checkpoints, order snapshots, notifications, and outbound actions persist atomically. Text actions are grouped; media actions retain their place in the outbound sequence. Document/image payloads use Meta links. Actual URL accessibility and provider acceptance still require real-provider testing.

Human Order nodes pause. Confirm/cancel records `orderStatus`; a persisted internal event continues to downstream conditions without waiting for another customer message. Explicit operator pauses remain in force. Handoff pauses automation and creates a configured notification. Resume explicitly continues the flow. Customer messages received during human attention remain visible in history and update the messaging window without running the bot.

## Human response and notifications

The operations inbox provides history, operator replies, order decisions, pause/resume, and delivery review. Notifications default to the internal inbox. Notify/Handoff can select WhatsApp, an E.164 recipient, and a merchant-approved template name/language. The template must contain one body text placeholder for the rendered message (maximum 1,024 characters). Durable polling dispatches alerts independently of the customer messaging window. Template approval must already exist in Meta; API acceptance does not prove device delivery. Email, push, and recipient-specific routing remain pending.

Manual pause blocks queued bot output; operator replies can still be delivered. Failed or uncertain sends require review before resuming. Owners/admins can record verified provider acceptance or discard a delivery; no blind resend action exists.

## Delivery and acceptance

PostgreSQL polling runs alongside the BullMQ diagnostic worker. The conservative messaging window is 23 hours 50 minutes; expiry is retained through approval/resumption. Explicit 429 responses retry with bounded backoff. Network/server errors, malformed acknowledgements, or abandoned sending claims pause for manual review. Exactly-once external delivery is not guaranteed. Callbacks record sent/delivered/read/failed status.

Migrations 006–007 are required and verified only in isolated tests. External alerts retry explicit 429 responses; uncertain acceptance or stale sending claims require owner/admin review, never blind retries. Simulated-provider tests cover ordering, deduplication, media persistence, custom data, decisions, manual handling, and recovery. Real Meta/Supabase acceptance, deployment, and device delivery remain pending. Billing and multi-number onboarding remain pending.
