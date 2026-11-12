# Accepted product scope

Confirmed November 12, 2026. The product is a configurable WhatsApp workflow platform. Each business defines its conversation and commercial process through reusable capabilities; implementation must not require custom code for each merchant.

## Merchant configuration

| Capability | Merchant control |
| --- | --- |
| Content and navigation | Arrange messages, menus, catalogs, images, and PDFs in any supported graph sequence. A three-option menu may lead to a catalog or a PDF containing shirts. |
| Customer information | Choose fields, questions, required answers, validation, and variables. There is no mandatory universal customer form. |
| Product options and availability | Ask for sizes, flavors, extras, or availability when needed. Businesses decide what they offer and remain responsible for stock; inventory automation is not a prerequisite. |
| Pricing and shipping | Configure values, conditions, and calculations, including shipping prices by location. Execute validated calculations on the server and retain the values used when recording an order. |
| Orders and confirmation | Optionally collect selections and create an order. Configure automatic confirmation or human approval, what information is included, and the customer acknowledgement. |
| Notifications | Configure authorized recipients and relevant order/customer information. Notify the owner or responsible advisor when attention or approval is needed. |
| Advisor contact | Make advisor contact available as a configurable flow route. Pause automation, preserve context, notify the responsible person, support human replies, and resume through a controlled transition. |

The platform guarantees business isolation, permissions, validated graphs, persisted execution, and idempotent business actions. Business-specific questions and decisions belong to flow configuration. External message delivery cannot guarantee exactly-once acceptance.

## Creation interfaces

A shared, versioned JSON definition represents nodes, connections, variables, and configuration. The visual editor and authenticated MCP tools operate on that model. Tools create, inspect, modify, validate, simulate, compare, apply, and publish flows with revision conflict protection and immutable publications. The editor imports and exports definitions.

Terraform inspires declaring desired state and reviewing changes before applying them; it is not a dependency. Secrets stay outside exported definitions. Tool access enforces the same business permissions as the editor. See [authoring](operations-and-authoring.md).

## Delivery boundary

Implementation includes fifteen node kinds, drafts/publications, document/image delivery, custom fields, calculations, optional catalog/cart/orders, notifications, operator inbox, and MCP authoring. Notifications support inbox records or configured approved WhatsApp templates. Real Meta/Supabase acceptance and deployment remain separate verification work; implementation is not evidence of live delivery.

A complete acceptance journey lets a merchant build a flow, collect custom answers, apply a shipping rule, choose human or automatic confirmation, notify configured recipients, and hand the conversation to an advisor without changing application code.
