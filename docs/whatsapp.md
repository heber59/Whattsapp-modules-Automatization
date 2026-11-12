# WhatsApp pilot integration

The pilot uses one server-approved Meta phone and business. Configure `META_ACCESS_TOKEN`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_PHONE_NUMBER_ID`, `META_BUSINESS_ID`, and `META_GRAPH_VERSION` privately in both API and worker. Missing settings disable processing without inventing credentials. Graph requests target Meta's origin; a localhost simulator is permitted only in test mode.

## Setup and access

GET/POST `/businesses/:businessId/whatsapp` require membership. Only owners/admins of the server-approved business can assign a published `flowId` and `version`. Client-supplied credentials or phone IDs are rejected. Other businesses cannot claim the pilot number. Saved assignment means configured routing, not verified delivery. See [first pilot setup](whatsapp-pilot-setup.md).

## Reception and execution

GET `/webhooks/whatsapp` verifies the token and echoes the challenge. POST validates `X-Hub-Signature-256` against the exact raw request body before accepting events. The standard JSON body-size limit applies. Unknown phone numbers and unsupported message types produce no reply.

Migration 005 stores channels, deduplicated inbox events, conversation state, ordered outbox replies, and delivery events. Webhooks acknowledge after persistence. Ingest sequence preserves batch order; workers serialize each sender's conversation with transaction locks.

The worker executes published Start, Message, Menu, and End steps. Customers choose by number or matching label; invalid choices repeat the menu. Active conversations keep their published snapshot. Completed conversations or a day of inactivity start with the channel's current version. Replies are split below provider text limits without breaking Unicode surrogate pairs.

## Delivery and recovery

Run the separate worker with PostgreSQL and Redis. WhatsApp uses a durable PostgreSQL polling loop alongside the existing BullMQ diagnostic worker. Restarting preserves pending work. Only customer-initiated text replies within the conservative 23-hour-50-minute limit are eligible; expired work is not sent.

An explicit 429 response retries with bounded backoff. Network failures, server errors, malformed acknowledgements, and abandoned sending claims require manual review and pause the conversation. This avoids blind duplicate sends when provider acceptance is uncertain. Permanent rejections also pause the conversation. No exactly-once external-delivery guarantee is claimed.

Inspect operational state through trusted database access:

```sql
SELECT state, count(*) FROM app.whatsapp_outbox GROUP BY state;
SELECT state, count(*) FROM app.whatsapp_inbox GROUP BY state;
```

Investigate failed/manual-review rows individually against provider records before resolving them; never bulk-requeue uncertain sends. There is no operator recovery UI yet. Delivery callbacks record sent/delivered/read/failed status; API acceptance alone does not prove device delivery.

Tests use signed payloads, isolated PostgreSQL, and a local Graph simulator. Real Meta setup and a real-phone acceptance test remain required. Media replies, templates, billing, and multi-number onboarding are outside this pilot.
