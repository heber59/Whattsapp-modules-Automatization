# Arquitectura del frontend

Next.js App Router + TypeScript + React Flow. Estructura objetivo:

```text
apps/web/
├── public/                              # Recursos estáticos
└── src/
    ├── app/                             # Routing y composición de pantallas
    │   ├── layout.tsx                   # Layout raíz
    │   ├── providers.tsx                # Providers de React; no crea rutas
    │   ├── globals.css                  # Estilos globales
    │   ├── (auth)/                      # Grupo; no aparece en la URL
    │   │   └── login/
    │   │       └── page.tsx             # /login
    │   └── (dashboard)/
    │       ├── layout.tsx               # Layout del panel
    │       ├── flows/
    │       │   ├── page.tsx             # /flows
    │       │   └── [flowId]/
    │       │       └── page.tsx         # /flows/:flowId
    │       ├── orders/
    │       │   └── page.tsx
    │       ├── conversations/
    │       │   └── page.tsx
    │       ├── catalog/
    │       │   └── page.tsx
    │       └── settings/
    │           └── page.tsx
    ├── features/
    │   ├── auth/
    │   ├── flows/                       # Ejemplo de organización por funcionalidad
    │   │   ├── components/              # Editor, paneles y nodos visuales
    │   │   ├── hooks/                   # Comportamiento del editor
    │   │   ├── api/                     # Consultas y operaciones de flujos
    │   │   ├── model/                   # Estado, tipos y reglas locales
    │   │   └── utils/                   # Transformaciones puras
    │   ├── orders/
    │   ├── conversations/
    │   ├── catalog/
    │   └── settings/
    └── shared/
        ├── components/
        │   ├── ui/                      # Botones, campos y diálogos
        │   └── layout/                  # Navegación, sidebar y encabezado
        ├── hooks/                       # Hooks reutilizados entre funcionalidades
        ├── lib/                         # Cliente HTTP y configuración común
        ├── types/                       # Tipos transversales de interfaz
        └── utils/                       # Funciones puras compartidas
```

## Reglas de implementación
- Páginas pequeñas: componen la pantalla y delegan comportamiento a su funcionalidad.
- Componentes enfocados; operaciones de API separadas de la presentación.
- Hooks con propósito; no convertir cada función en un hook.
- Mantener lo específico en su funcionalidad. Mover a shared cuando exista reutilización real.
- Dependencias: app → features → shared. Shared no importa funcionalidades; evitar dependencias circulares.
- App Router usa app/.../page.tsx; no crear también src/pages.
- Componentes de servidor por defecto; componentes de cliente donde se necesite interacción, como React Flow. Secretos solo en servidor.
- Separar estado de interfaz del estado remoto; evitar un almacén global para todo.
- Pruebas unitarias junto al código que verifican; recorridos end-to-end en apps/web/e2e/. Priorizar reglas del grafo, transformaciones y recorridos críticos.
- Crear carpetas cuando exista código que las necesite; no generar carpetas vacías.