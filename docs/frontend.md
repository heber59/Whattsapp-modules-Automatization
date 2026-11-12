# Frontend architecture

Next.js App Router and TypeScript. The visual editor uses SVG; React Flow remains a future option. See the accepted [product scope](product-scope.md).

## Portal and sessions

The shared header provides English/Spanish labels, light/dark themes, and locally persisted preferences. Visitors submit contact requests with consent. Plan requests are saved for personal follow-up; checkout and paid entitlement activation remain unavailable.

Registration, login, session refresh, sign-out, and password recovery use same-origin server proxies. Provider tokens remain in HttpOnly cookies. Real Supabase acceptance remains pending.

## Configurable flow authoring

/flows requires a verified session and business selection. Owners/admins create and save drafts and publish immutable versions; operators view and preview. Optimistic revisions reject conflicting saves. Navigation warns about unsaved changes, and scoped device recovery copies preserve valid draft edits.

The editor supports Start, Message, Menu, End, Input, Set, Calculate, Condition, Document, Image, Catalog, Cart, Order, Notify, and Handoff. Businesses choose node sequence, customer questions, product options, pricing, shipping conditions, confirmation mode, and notification content. Availability remains the business's responsibility.

Node settings provide fields for common values and editable configuration JSON for expressions, products, comparisons, and order fields. Expressions support flat variable references and add/subtract/multiply/divide operations; they cannot run arbitrary code or access nested paths. Text interpolation uses {{variable}}. Conditions use their first destination for true and second for false. Media requires an HTTPS URL. Catalogs support text-based product selection; they are not Meta Commerce catalogs.

JSON import/export uses the same versioned declarative definition as MCP tooling. Imports replace the local draft only after confirmation when it contains steps; saving and publishing remain separate actions. Invalid configuration JSON blocks saving and step switches and warns before navigation.

Customer preview uses the shared runtime for input validation, variables, branching, calculations, carts, and intended actions. It displays media references, proposed orders, notifications, and human pauses without sending messages or creating operational records. Human approval and handoff stop the preview for operator attention.

## Operations

/operations provides business-scoped notifications, conversations and history, captured variables, order search/status filters, pending-order approval/cancellation, operator replies, bot pause/resume, and delivery review. Manual operator pauses and flow pauses both enable human attention.

Notify/Handoff selects workspace notifications or WhatsApp alerts to a consenting owner's/advisor's E.164 number. WhatsApp requires an approved template name and language, with one body placeholder for notification text. Operations shows delivery state; provider acceptance does not prove device receipt. Owners/admins can verify or discard uncertain/failed alerts after provider review. Email/push alerts remain unavailable. Operator replies require an eligible customer messaging window. Recovery never blindly resends; backend authorization remains authoritative.

Same-origin operations proxies enforce session renewal, request-origin checks, bounded JSON bodies, allowed paths, and noncached responses. /whatsapp assigns a published version to the server-configured pilot number; assignment does not prove live delivery.

## Implementation rules

Keep routes focused, secrets server-only, and interface state separate from remote state. Validate sessions, input, and business access server-side. Maintain focused tests and critical end-to-end journeys.
