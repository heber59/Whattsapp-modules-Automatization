# Repository structure

Monorepo features are implemented incrementally.

```text
Whattsapp-modules-Automatization/
├── .ai                           # Working rules and human approval
├── .github/
│   ├── workflows/                # Selective CI and security analysis
│   └── dependabot.yml            # Dependency updates
├── scripts/ci/                   # Change detection and packaging
├── apps/
│   ├── web/                      # Next.js + React Flow
│   └── api/                      # NestJS modules and worker entry point
├── packages/
│   └── contracts/                # Public API types and schemas
├── docs/
│   ├── repository-structure.md   # Monorepo layout
│   ├── frontend.md               # Frontend architecture
│   ├── backend.md                # Backend responsibilities
│   ├── work-plan.md              # Delivery blocks and completion criteria
│   ├── local-development.md      # Startup and local verification
│   ├── ci-cd.md                  # Checks and service artifacts
│   ├── database.md               # Model, constraints, migrations
│   └── authentication-security.md
├── package.json                  # Workspace scripts
├── pnpm-workspace.yaml           # Workspaces: apps/* and packages/*
└── README.md                     # Product overview
```
