# Backend architecture

A NestJS + TypeScript modular monolith with single-responsibility services and lightweight hexagonal boundaries. Modules communicate through internal operations. A separate worker process reuses modules for background work.

Commercial endpoints: public GET /commercial/plans and POST /commercial/leads; authenticated POST /commercial/purchase-requests. Requests require consent and email or international phone. PostgreSQL stores pending requests; no email notification is sent. One full-access plan costs COP 50,000 monthly. Checkout, charges, subscriptions, and paid entitlements remain pending provider configuration.

Target structure:

```text
apps/api/src/
├── main.ts                         # HTTP entry point
├── worker.ts                       # Background process entry point
├── app.module.ts                   # API composition
├── configure-http.ts               # HTTP and development Swagger setup
├── modules/
│   ├── auth/                       # Login through Supabase Auth
│   ├── orders/
│   │   ├── orders.module.ts         # Wiring and public operations
│   │   ├── orders.controller.ts     # HTTP input and response
│   │   ├── orders.dto.ts            # Input contracts and validation
│   │   ├── orders.service.ts        # Order use cases
│   │   ├── orders.rules.ts          # Pure rules when needed
│   │   └── orders.repository.ts     # Queries and persistence
│   ├── identity/                   # Application user profiles
│   ├── businesses/                 # Business settings and memberships
│   ├── whatsapp/                   # Meta connection, receiving, sending
│   ├── conversations/              # History, state, human handoff
│   ├── flows/                      # Graph definition and publication
│   ├── automation/                 # Node execution and resumption
│   └── catalog/                    # Products, prices, availability
└── shared/
    ├── database/                   # Connections and transactions
    ├── queue/                      # Queue infrastructure
    ├── auth/                       # Guards, rate limits, provider gateway
    └── config/                     # Validated environment configuration
```

## Responsibilities and dependencies
- Give each service one concrete responsibility. Related operations can share a service; avoid one class per method.
- Split services when they mix behaviors such as confirming orders, sending messages, and executing nodes.
- Controllers and queue consumers accept input and delegate business work.
- Use-case services do not depend on transport details or provider internals.
- Pure business rules do not depend on NestJS or infrastructure.
- Repositories and external gateways encapsulate persistence and integrations.
- Introduce small ports where isolation is useful: Meta, execution persistence, or job publication. Wire them through module injection; avoid ceremonial interfaces.
- Modules expose public operations. Do not access another module's tables or repositories; avoid circular dependencies.
- Flows defines and publishes versions; automation executes them and persists execution state.
- Share infrastructure through shared; keep module-specific rules inside their module.

## Validation and tests
- Validate external input, permissions, business isolation, and domain invariants without repeating identical checks at every layer.
- Prioritize order integrity, valid graphs, idempotency, and worker recovery.
- Keep focused unit tests and critical end-to-end flows. Run affected tests after changes.
- Create files and directories when needed, without empty placeholder classes.
