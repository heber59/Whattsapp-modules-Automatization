# Estructura del repositorio

Estructura del monorepo; las funcionalidades se incorporan por bloques.

```text
Whattsapp-modules-Automatization/
├── .ai                       # Reglas de trabajo y aprobación humana
├── .github/
│   ├── workflows/            # CI selectivo y análisis de seguridad
│   └── dependabot.yml        # Actualización de dependencias
├── scripts/ci/               # Selección de cambios y empaquetado
├── apps/
│   ├── web/                  # Next.js + React Flow
│   └── api/                  # NestJS; módulos de negocio y entrada del worker
├── packages/
│   └── contracts/            # Tipos y esquemas públicos de API
├── docs/
│   ├── estructura.md         # Organización del repositorio
│   ├── frontend.md           # Arquitectura y carpetas del frontend
│   ├── backend.md            # Arquitectura y responsabilidades del backend
│   ├── plan-trabajo.md       # Bloques y criterios de cierre
│   ├── desarrollo-local.md   # Arranque y verificación local
│   ├── ci-cd.md              # Verificaciones y artefactos por servicio
│   ├── bd.md                 # Modelo, restricciones y migraciones
│   ├── auth-seguridad.md     # Supabase Auth y controles de acceso
│   ├── postman.md            # Recorrido manual de la API
│   └── whattsapp-local.postman_collection.json
├── package.json              # Scripts del monorepo
├── pnpm-workspace.yaml       # Workspaces: apps/* y packages/*
└── README.md                 # Presentación del producto
```
