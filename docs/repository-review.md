# Repository review

Reviewed on November 11, 2026, against the current working tree, including pre-existing uncommitted changes.

## Assessment

The repository provides a coherent, tested technical foundation. It is still an early product: the frontend is a development page, and WhatsApp integration, the workflow editor, execution engine, orders, and human inbox are not implemented.

The modular monolith and separate worker are appropriate for the current scope. Avoid adding abstractions before a complete customer journey needs them.

## Strengths

- Strict TypeScript, focused modules, parameterized SQL, and transactional business/owner creation.
- Private routes by default, verified provider identities, membership-filtered business access, and atomic Redis rate limits.
- Versioned migrations with checksums, advisory locking, and transactions.
- Selective CI, dependency auditing, CodeQL configuration, and separate delivery artifacts.
- Documentation distinguishes implemented features from planned ones.

## Findings and priorities

1. **Deployment prerequisite:** the API binds to `127.0.0.1`, and proxy trust is not configured. Define the hosting topology before release. Container ingress may require a configurable bind address; a reverse proxy requires explicit trusted-proxy configuration so IP limits do not group every customer together.
2. **Product blocker:** implement a small complete journey: authenticated merchant, signed Meta webhook, persisted message, configurable conversation, and one confirmed order. The broad node catalog can follow proven demand.
3. **Authentication scope:** the login endpoint returns access tokens, but frontend login, recovery, refresh, and sign-out remain pending. Automated tests simulate Supabase; real provider acceptance is still required.
4. **Resilience evidence:** retained tests cover successful health checks and worker execution, but do not exercise Redis/PostgreSQL outages, recovery, failed jobs, or migration checksum/concurrency behavior. Add focused checks as those paths become release requirements. Fix fixture cleanup on initialization errors: failed database startup left the initial test process open.
5. **Authorization scope:** memberships contain roles, but current endpoints do not demonstrate privileged role enforcement. Add explicit permission checks when administrative mutations are introduced. RLS without policies is not independent tenant protection for an owner connection.
6. **Planning:** the November 6–9 target dates have passed. Replace calendar assumptions with current owners, blockers, and acceptance evidence. Identify or remove the unavailable HTML checklist reference.

## Verification

- ESLint, all workspace type checks, and API/frontend production builds passed.
- Five CI detector tests, two configuration tests, and nine integration tests passed.
- Dependency audit reported no known vulnerabilities at review time.
- PostgreSQL and Redis were started locally for integration verification.
- Current source, configuration, interface copy, and documentation are already in English. Product names and publication command aliases are preserved.

Deployment, artifact execution, real Supabase login, and Meta integration were not verified.
