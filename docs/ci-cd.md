# CI and service delivery

GitHub Actions checks PRs targeting develop/main and pushes to those branches. Hosting is not selected: delivery artifacts are generated, while deployment remains pending.

| Changed area | Verification |
| --- | --- |
| apps/web/ | Frontend: ESLint, types, build; no PostgreSQL or Redis. |
| HTTP, health, identity, authentication | API: ESLint, types, unit/end-to-end tests, build; temporary PostgreSQL and Redis. |
| Worker entry point or consumer | Worker: ESLint, types, unit/end-to-end tests, build; Redis only. |
| Shared backend code or infrastructure | API and worker. |
| packages/contracts/ | Contracts and their consumers: frontend, API, worker. |
| Lockfile, global settings, CI logic | All services, conservatively. |
| Documentation only | Change detection and final result; no application services. |

Changes are calculated against the PR merge base or previous push commit. Missing history triggers all checks. Focused detector tests protect these rules. Future backend modules are shared unless explicitly classified.

## Quality and security
- ESLint checks code; run it locally with pnpm lint.
- pnpm audit scans production and development dependencies. High or critical findings fail CI.
- CodeQL scans JavaScript/TypeScript and publishes Security alerts, including a weekly run. Alerts require review; scan completion alone does not automatically approve or reject vulnerabilities.
- Dependabot proposes weekly updates targeting develop.
- Actions are pinned to specific revisions. PRs do not receive deployment secrets.

CodeQL is available for public repositories. Standard Actions runners are free for them. Artifact retention is seven days, subject to GitHub quotas.

## Delivery
Verified services produce tar.gz artifacts on develop/main pushes and manual runs on those branches: standalone frontend, API, or worker with production dependencies and release.json. PRs verify without generating delivery artifacts. Archives preserve dependency links and permissions.

For local artifacts, build the service, then run pnpm package:web, pnpm package:api, or pnpm package:worker. Use Linux and the project's Node version.

Documentation changes do not restart services. Future production variables belong to each service. Hosting-secret edits do not automatically trigger CI; frontend variables embedded during build require rebuilding the frontend.

Configure CI / Result as a required branch check when publishing. Repository protection is not changed automatically.

References: [CodeQL](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning), [Actions usage](https://docs.github.com/en/actions/concepts/billing-and-usage).
