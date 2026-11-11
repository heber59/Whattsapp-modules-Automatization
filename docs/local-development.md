# Local development

Requirements: Node 22.22.2 (nvm), Corepack, and Docker Compose. Run from the repository root.

```bash
nvm use
corepack pnpm install
cp .env.example .env   # First setup only; preserve existing credentials
corepack pnpm infra:up
corepack pnpm db:migrate
corepack pnpm dev
```

In another terminal:
```bash
corepack pnpm dev:worker
```

| Service | Local address |
| --- | --- |
| Frontend | http://localhost:3000 |
| Swagger | http://localhost:3001/docs |
| API health | http://localhost:3001/health |
| PostgreSQL | 127.0.0.1:55432 |
| Redis | 127.0.0.1:56379 |

Local connections are bound to this machine. Example credentials are for development only. Update DATABASE_URL or REDIS_URL when changing ports or credentials. Changing a PostgreSQL password in .env does not update an existing database volume.

The public /health endpoint returns 200 when PostgreSQL and Redis respond, or 503 when a dependency is unavailable. It does not certify worker readiness; the worker end-to-end test processes a real diagnostic job.

## Verification
With local infrastructure running:
```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:ci
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm build
```

End-to-end tests start an API on an available port and test the diagnostic worker separately. Security tests use a simulated authentication provider and local PostgreSQL; they do not authenticate against remote Supabase.

To run compiled applications:
```bash
corepack pnpm --filter @wa/api start
corepack pnpm --filter @wa/api start:worker
corepack pnpm --filter @wa/web start
```

Stop processes with Ctrl+C and containers with pnpm infra:down. Volumes retain data. See ci-cd.md for selective CI and artifacts. Hosting deployment and Meta credentials remain unconfigured.

Identity and business endpoints require SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Missing configuration returns 503 when a session is presented. See authentication-security.md and database.md.

## Swagger
Development API requests to / redirect to /docs. Startup logs show the direct documentation URL. /docs-json exposes OpenAPI. Production disables both documentation and redirect.

Authorize accepts a Supabase access_token; private routes keep their permissions and limits. Tokens are not persisted between page reloads. Restart the API after changing startup configuration.

POST /auth/login accepts an existing Supabase user's email and password and returns an access token for HTTP testing. Then call GET /identity/me and the business endpoints.
