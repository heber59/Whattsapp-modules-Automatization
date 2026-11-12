# Whattsapp Automatization

A micro-SaaS platform for businesses to create configurable WhatsApp conversations, sales journeys, and human-assisted processes.

## Planned product

Merchants build conversations from an empty canvas and decide what to show, ask, calculate, confirm, and notify. Menus, catalogs, PDFs, customer fields, product options, shipping rules, and human approval are configured in the flow. Businesses remain responsible for their stock and commercial rules. See the accepted [product scope](docs/product-scope.md).

The visual editor and planned MCP tools will share a versioned declarative flow definition. Tools should create, inspect, edit, validate, simulate, and publish flows. Terraform inspires reviewable desired-state changes; adopting Terraform itself is not decided.

| Core module | Planned responsibility |
| --- | --- |
| Accounts and businesses | Authentication, roles, and isolation between businesses. |
| WhatsApp connection | Direct Meta Cloud API integration, phone numbers, and webhooks. |
| Editor and execution engine | Visual workflows, validation, versions, simulation, and persisted execution. |
| Configurable content and commerce | Optional catalog/cart, media/PDFs, custom fields, pricing/shipping rules, and automatic or human order confirmation. |
| Human inbox and notifications | Configurable advisor routes, owner alerts, conversation context, bot pause, operator replies, and controlled resumption. |
| Queues and operations | Background processing, retries, idempotency, auditing, and recovery. |
| Commercial administration | Pilot scope, terms, support, and subscription status. |

### Workflow nodes

Target capabilities include Start, message/menu, media/document, validated input, condition, variable/calculation, optional catalog/cart, order/approval, notification, wait/timer, restricted HTTP action, human handoff, and End. Only Start, Message, Menu, and End are implemented today.

## Confirmed stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js + React Flow |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL / Supabase |
| Messaging | Direct Meta Cloud API |
| Background processing | Queues and workers using BullMQ + Redis |
| Hosting | Affordable or free commercial-compatible hosting; provider not selected yet |

## Documentation

- [Repository structure](docs/repository-structure.md)
- [Accepted product scope](docs/product-scope.md)
- [Frontend architecture](docs/frontend.md)
- [Backend architecture](docs/backend.md)
- [Work plan](docs/work-plan.md)
- [Local development](docs/local-development.md)
- [CI and service delivery](docs/ci-cd.md)
- [Database](docs/database.md)
- [Authentication and security](docs/authentication-security.md)
- [AI working rules](.ai)

## Current state

Local frontend, API, and worker use PostgreSQL and Redis. Merchants manage versioned flows with fifteen node kinds, custom questions, variables, conditions, calculations, PDF/images, catalog/cart, orders, notifications, and human handoff. The editor supports JSON import/export and shared simulation. Authenticated MCP tools create, inspect, validate, simulate, compare, apply, and publish definitions.

The operations inbox exposes conversations, replies, pause/resume, approval, and delivery review. Notifications support inbox records or approved WhatsApp templates with configured recipients. Catalogs are flow-defined text selections. Migrations 006–007 must be applied before use. See [authoring](docs/operations-and-authoring.md) and the [example](examples/flows/configurable-shirts.json).

Real Meta/Supabase acceptance, production deployment and subscriptions remain pending. See [pilot setup](docs/whatsapp-pilot-setup.md).

CI selects affected services and runs ESLint and security checks. Delivery artifacts are prepared; deployment awaits a hosting decision.
