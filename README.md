# Whattsapp Automatization

A micro-SaaS project for businesses to receive and manage WhatsApp orders through configurable visual workflows.

## Planned product

Merchants build conversations from an empty canvas: add and connect nodes, configure variables, validate the graph, simulate execution, and publish a version. Example workflows do not replace free configuration within the supported node catalog.

| Core module | Planned responsibility |
| --- | --- |
| Accounts and businesses | Authentication, roles, and isolation between businesses. |
| WhatsApp connection | Direct Meta Cloud API integration, phone numbers, and webhooks. |
| Editor and execution engine | Visual workflows, validation, versions, simulation, and persisted execution. |
| Catalog and orders | Products, cart, COP totals, confirmation, and order states. |
| Human inbox | Conversation context, assignment, bot pause, and controlled handoff. |
| Queues and operations | Background processing, retries, idempotency, auditing, and recovery. |
| Commercial administration | Pilot scope, terms, support, and subscription status. |

### Workflow nodes

Start, message/menu, validated input, condition, variable, catalog/cart, order, wait/timer, restricted HTTP action, human handoff, and end.

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
- [Frontend architecture](docs/frontend.md)
- [Backend architecture](docs/backend.md)
- [Work plan](docs/work-plan.md)
- [Local development](docs/local-development.md)
- [CI and service delivery](docs/ci-cd.md)
- [Database](docs/database.md)
- [Authentication and security](docs/authentication-security.md)
- [AI working rules](.ai)

## Current state

Local frontend, API, and worker use PostgreSQL and Redis. Supabase Auth protects business access. Merchants can register, manage businesses, save drafts, and publish immutable flows using Start, Message, Menu, and End. The WhatsApp pilot implements signed webhooks, durable menu execution, and replies. Simulator tests pass; real Meta setup and phone acceptance remain pending. See [pilot setup](docs/whatsapp-pilot-setup.md). Orders and subscriptions remain pending.

CI selects affected services and runs ESLint and security checks. Delivery artifacts are prepared; deployment awaits a hosting decision.
