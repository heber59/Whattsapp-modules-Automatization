# Flow storage and publication

All flow endpoints require authentication and business membership. Owners/admins can create, save, and publish. Operators can read drafts and versions. The flows module obtains membership through BusinessesService; it does not query another module's tables.

| Endpoint under /businesses/:businessId/flows | Request / result |
| --- | --- |
| GET / | Lists summaries in flows. |
| POST / | name, steps → flow, revision 1. |
| GET /:flowId | Returns flow including draft steps. |
| PATCH /:flowId | name, steps, expectedRevision → updated flow. |
| POST /:flowId/publish | expectedRevision → version snapshot. |
| GET /:flowId/versions/:version | Returns an immutable version. |

Shared TypeScript shapes live in packages/contracts. Steps contain id, kind, text, x/y positions, and labelled choices pointing to step IDs. Supported kinds: Start, Message, Menu, End. Requests are capped at 64 KiB, 200 steps, 20 choices per step, and 4,000 text characters per step. Drafts may be incomplete, but structure must be bounded and IDs unique.

Publication requires exactly one Start, text on every step, valid labelled destinations, unique choice labels, and every node reachable from Start with a path to End. Start and Message have one outgoing choice; End has none. Automatic cycles are rejected. Loops through Menu are allowed because they wait for a customer choice. Replies cannot target Start.

Saving atomically checks expectedRevision and increments the draft revision. A stale edit returns 409; reload before retrying to avoid overwriting another editor. Publishing locks the draft row, validates its saved graph, and inserts a numbered immutable snapshot in one transaction. Concurrent publications of the same revision return the same version. Retrying an already published revision returns that historical snapshot even if the draft subsequently changed. Editing a draft never changes its published versions.

Migration 004 creates business-scoped flow/version tables with RLS and a trigger rejecting version updates. Composite foreign keys prevent cross-business version references. Business deletion cascades to its flows and versions. API routes do not expose deletion or modification of publications.

Publishing stores a version; it does not activate Meta webhooks, connect a WhatsApp number, or execute conversations. Those remain separate work.
