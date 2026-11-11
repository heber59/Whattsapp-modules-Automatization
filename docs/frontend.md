# Frontend architecture

Next.js App Router + TypeScript + React Flow. Target structure:

```text
apps/web/
├── public/                              # Static assets
└── src/
    ├── app/                             # Routing and page composition
    │   ├── layout.tsx                   # Root layout
    │   ├── providers.tsx                # React providers; no route
    │   ├── globals.css                  # Global styles
    │   ├── (auth)/                      # Route group, excluded from URLs
    │   │   └── login/
    │   │       └── page.tsx             # /login
    │   └── (dashboard)/
    │       ├── layout.tsx               # Dashboard layout
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
    │   ├── flows/                       # Example feature layout
    │   │   ├── components/              # Editor, panels, visual nodes
    │   │   ├── hooks/                   # Editor behavior
    │   │   ├── api/                     # Flow queries and mutations
    │   │   ├── model/                   # State, types, local rules
    │   │   └── utils/                   # Pure transformations
    │   ├── orders/
    │   ├── conversations/
    │   ├── catalog/
    │   └── settings/
    └── shared/
        ├── components/
        │   ├── ui/                      # Buttons, fields, dialogs
        │   └── layout/                  # Navigation, sidebar, header
        ├── hooks/                       # Cross-feature reusable hooks
        ├── lib/                         # HTTP client and common settings
        ├── types/                       # Shared interface types
        └── utils/                       # Shared pure functions
```

## Implementation rules
- Keep pages small: compose screens and delegate behavior to features.
- Keep components focused and API operations separate from presentation.
- Give hooks a purpose; do not turn every function into a hook.
- Keep specific behavior in its feature. Move it to shared when reuse exists.
- Dependency direction: app → features → shared. Shared does not import features; avoid cycles.
- App Router uses app/.../page.tsx. Do not also create src/pages.
- Default to server components. Use client components for interactions such as React Flow; keep secrets on the server.
- Separate interface state from remote state; avoid one global store for everything.
- Place focused unit tests next to the code they verify and end-to-end flows in apps/web/e2e/. Prioritize graph rules, transformations, and critical journeys.
- Create directories when code needs them; avoid empty placeholders.
