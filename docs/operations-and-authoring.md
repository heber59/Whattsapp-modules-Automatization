# Operations and programmatic authoring

## Setup

Build with the project Node/pnpm versions, apply migrations explicitly with pnpm db:migrate, and run web, API, and worker. Migrations 006–007 add operational storage and external alerts. Test migrations in an isolated database before upgrading an existing environment.

Open /flows, choose a business, configure nodes and connections, validate, and preview. Import/export uses JSON with schemaVersion: 1, name, and steps. Applying a definition updates a draft; publish explicitly and assign its version under /whatsapp.

The [shirts example](../examples/flows/configurable-shirts.json) demonstrates menus, PDF, products, custom questions, quantities, location-based shipping, confirmation and advisor routing. Replace its example PDF URL and recipient labels before live use.

## Node configuration

Input captures a configured variable with type and bounds. Set assigns values; Calculate evaluates bounded add/subtract/multiply/divide expressions. Reference variables with {"var":"name"}; interpolate text with {{name}}. Condition destinations are ordered: first true, second false. Expressions cannot execute code.

Catalog presents products as text choices. Cart maintains items and subtotal; calculate total explicitly when adding shipping or other charges. Businesses own availability decisions. Order persists configured fields and amounts; automatic mode confirms immediately, human mode pauses. Following approval or cancellation, branch using orderStatus, which becomes confirmed or cancelled.

Document/Image require public HTTPS URLs. Notify/Handoff always create inbox records. Choose inbox routing labels or WhatsApp delivery with an E.164 recipient, approved template name and language. The template must have exactly one body text placeholder, filled with the rendered message (maximum 1024 characters). Handoff pauses until controlled resumption.

## Operations

Open /operations for orders, conversations, variables, notifications and uncertain deliveries. Members can reply, pause/resume and decide pending orders. Owners/admins review failed or uncertain sends against provider records, marking verified sends or discarding them without blind retries. Resolve pending approvals and unsafe deliveries before resuming. Replies remain subject to the customer messaging window.

Inbox notifications require opening or refreshing the page. External alerts are dispatched durably by the worker; 429 responses retry with limits. Unknown acceptance requires manual review, without blind resends. An accepted alert is not evidence of handset delivery. Approved templates and real-phone acceptance remain external setup.

## MCP

Endpoint: POST /businesses/:businessId/mcp. Configure a client with an existing bearer session and MCP revision 2025-11-25. This JSON-response transport supports initialize, ping, tools/list, tools/call, and notifications; GET streams return 405. Browser origins must match WEB_ORIGIN. No OAuth discovery or automatic token refresh is provided for MCP clients.

Tools: flow_list, flow_read, flow_validate, flow_simulate, flow_diff, flow_apply and flow_publish. Tools expose input schemas. Writes require owner/admin membership; updates require expectedRevision. Simulations return intended actions without sending messages or creating orders. Read can export an immutable version. Terraform is not required.
