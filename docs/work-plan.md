# Work plan

Reference: the Whattsapp Automatization HTML checklist. Target dates: Friday November 6 and Saturday November 7, 2026; Sunday November 8 off; conditional release on Monday November 9.

| Block | HTML | Deliverable and completion |
| --- | --- | --- |
| 1. Scope and access | f1–f2 | Pilot defined; Meta access verified or blockers recorded. |
| 2. Executable foundation | f3 | Workspace, frontend, API, worker, local services; startup/build checked. Selective CI, deployment pending. |
| 3. Data and access | f4–f5 | Migrations, authentication, roles, isolation tested between businesses. |
| 4. Async channel | f6–f7 | Signed webhook, inbox/outbox, retries, recovery. |
| 5. First journey | f8–f10 | Configurable graph, editor, unique COP order confirmation. |
| 6. Complete product | s2–s5 | Remaining nodes, versions, simulator, human inbox. |
| 7. Validate candidate | s6–s12 | Security, concurrency, infrastructure, restoration, internal acceptance. |
| 8. Pilot | m1–m7 | Acceptance, controlled deployment, live validation, agreed payment. |

f11 closes Friday; s1 reviews blockers and adjusts Saturday. Meta approval and commercial acceptance are not assumed.

## Foundation
- pnpm workspaces: apps/web, apps/api, packages/contracts.
- Next.js App Router initial screen; editor and frontend authentication pending.
- NestJS health endpoint for PostgreSQL/Redis and a separate diagnostic worker.
- Local PostgreSQL/Redis through Docker Compose.
- Environment examples without production credentials.
- Build, type checking, focused unit tests, API/worker end-to-end flows.

The initial migration covers identity, businesses, phone numbers, and products. Meta, orders, and commercial workflows remain pending. CI is configured; review the relevant MR run. Deployment awaits hosting; React Flow belongs to the editor block.

## Tracking
Pending → In progress → Implemented → Verified. Record blockers with an owner and next action. Evidence, not the calendar, verifies completion.

## Local evidence
Types, builds, unit tests, and separate API/worker flows passed. Additional compiled-process checks covered HTTP responses, real worker jobs, Redis outage responses, and recovery. Temporary checks were removed. Delivery artifacts are configured; no deployment has occurred.

## Data and access progress
Local migrations, profiles, memberships, isolation, and IP/user/account buckets are implemented and tested. Automated tests simulate Supabase; the local environment connects to the real Auth project. CAPTCHA/MFA configuration and frontend access remain pending. Billing scope is undecided. See database.md and authentication-security.md.

POST /auth/login returns access_token for HTTP clients and applies IP/account limits. Automated login tests use a controlled provider; a real-user login still requires manual validation.
