# Database

PostgreSQL uses a private app schema accessed through NestJS. Supabase Auth manages identities and credentials; app.users stores application profiles without passwords.

```mermaid
erDiagram
    SUPABASE_AUTH ||--o| USERS : identifies
    USERS ||--o{ MEMBERSHIPS : joins
    BUSINESSES ||--|{ MEMBERSHIPS : authorizes
    BUSINESSES ||--o{ WHATSAPP_NUMBERS : connects
    BUSINESSES ||--o{ PRODUCTS : sells
```

| Implemented table | Main fields and constraints |
| --- | --- |
| users | UUID id, unique auth_user_id, optional email. Identity comes from the verified session. |
| businesses | id, name, created_by. Business creation and owner membership share a transaction. |
| memberships | Composite business_id + user_id key; owner/admin/operator role. Users may join several businesses. |
| whatsapp_numbers | business_id, unique E.164 phone, optional unique Meta phone ID, status. Multiple numbers per business. |
| products | business_id, name, nonnegative decimal price, COP currency, active flag. Multiple products per business. |
| schema_migrations | Version, checksum, and application date. Never edit applied migrations. |

## Isolation
- Business queries filter by the authenticated user's membership.
- Products and phone numbers have unique business_id + id keys to support future composite foreign keys and prevent cross-business references.
- RLS is enabled without direct-access policies. The schema is not exposed to browsers.
- Table owners and privileged roles can bypass RLS. NestJS authorization remains mandatory; design policies before enabling direct client access.
- WhatsApp buyers will be contacts, distinct from SaaS customers who sign in.

## Future model: tables not implemented yet
```text
Business
├── Contacts → conversations → messages
├── Orders → items with historical name and price
├── Flows → published versions → executions
└── Inbox/outbox for idempotent events and actions
Account or business → subscription → charges  # Billing scope undecided
```

Whether one subscription covers one or several businesses remains undecided. Billing is not implemented. Product variants, stock, and carrier integrations are outside this migration.

## Migrations
From the repository root, with local PostgreSQL running:
```bash
corepack pnpm db:migrate
```

Versioned SQL lives in apps/api/migrations. The runner uses a cross-process lock, one transaction per file, and checksums. Run it explicitly before using the modules; API and worker startup do not apply migrations. No migrations have been applied to remote Supabase.
