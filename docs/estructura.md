# Estructura del repositorio

Estructura objetivo. Por ahora solo se crean los documentos.

```text
Whattsapp-modules-Automatization/
├── .ai                       # Reglas de trabajo y aprobación humana
├── apps/
│   ├── web/                  # Next.js + React Flow
│   └── api/                  # NestJS; módulos de negocio y entrada del worker
├── packages/
│   └── contracts/            # Tipos y esquemas públicos de API
├── docs/
│   ├── estructura.md         # Organización del repositorio
│   ├── frontend.md           # Arquitectura y carpetas del frontend
│   └── backend.md            # Arquitectura y responsabilidades del backend
├── package.json              # Scripts del monorepo
├── pnpm-workspace.yaml       # Workspaces: apps/* y packages/*
└── README.md                 # Presentación del producto
```