# Arquitectura del backend

Monolito modular en NestJS + TypeScript, con servicios de responsabilidad única y arquitectura hexagonal ligera. Los módulos se comunican mediante operaciones internas, sin llamadas de red entre ellos. El worker ejecuta trabajos asíncronos como proceso separado y reutiliza los módulos.

Estructura objetivo:

```text
apps/api/src/
├── main.ts                         # Entrada HTTP
├── worker.ts                       # Entrada del proceso de trabajos
├── app.module.ts                   # Composición de la API
├── modules/
│   ├── orders/
│   │   ├── orders.module.ts         # Conecta dependencias y exporta operaciones
│   │   ├── orders.controller.ts     # Entrada HTTP y respuesta
│   │   ├── orders.dto.ts            # Contratos y validación de entrada
│   │   ├── orders.service.ts        # Casos de uso de pedidos
│   │   ├── orders.rules.ts          # Reglas puras, cuando hagan falta
│   │   └── orders.repository.ts     # Consultas y persistencia
│   ├── identity/                   # Usuarios, membresías y permisos
│   ├── businesses/                 # Configuración del comercio
│   ├── whatsapp/                   # Conexión Meta, recepción y envío
│   ├── conversations/              # Historial, estado y transferencia humana
│   ├── flows/                      # Definición, validación y publicación de grafos
│   ├── automation/                 # Ejecución de nodos, variables y reanudación
│   └── catalog/                    # Productos, precios y disponibilidad
└── shared/
    ├── database/                   # Conexión y transacciones
    ├── queue/                      # Conexión y publicación de trabajos
    ├── auth/                       # Guards y contexto autenticado del negocio
    └── config/                     # Configuración validada del entorno
```

## Responsabilidades y dependencias
- Cada servicio tiene una responsabilidad concreta. Puede incluir varias operaciones relacionadas; no crear una clase por método.
- Si un servicio mezcla responsabilidades, dividirlo por comportamiento: confirmar pedidos, enviar mensajes o ejecutar nodos.
- Controllers y consumidores de cola reciben entradas y delegan; no contienen reglas de negocio.
- Los servicios coordinan casos de uso sin depender de HTTP ni de detalles de Meta, SQL o Redis.
- Las reglas puras no dependen de NestJS ni de infraestructura.
- Repositorios y clientes externos concentran persistencia e integraciones.
- Introducir puertos pequeños en dependencias que requieran aislamiento: Meta, persistencia del motor o publicación de trabajos. Conectarlos mediante inyección en el módulo; evitar interfaces por formalismo.
- Cada módulo expone operaciones públicas. Otros módulos no acceden a sus tablas ni repositorios; evitar dependencias circulares.
- Flows define y publica versiones; automation las ejecuta y conserva el estado.
- Compartir infraestructura en shared; las reglas específicas permanecen en su módulo.

## Validación y pruebas
- Validar entradas externas, permisos, aislamiento entre negocios e invariantes de negocio. No repetir la misma comprobación en todas las capas.
- Priorizar integridad de pedidos, grafos válidos, idempotencia y recuperación del worker.
- Conservar pruebas unitarias específicas y end-to-end de recorridos críticos. Ejecutar las afectadas por cada cambio.
- Crear archivos y carpetas cuando exista una necesidad real; el árbol no obliga a generar clases vacías.
