# Whattsapp Automatization

Proyecto de micro-SaaS colombiano para automatizar la recepción y gestión de pedidos por WhatsApp mediante flujos visuales configurables por nodos.

## Producto previsto

El comerciante podrá construir conversaciones desde un lienzo vacío: añadir nodos, conectarlos, configurar variables, validar el grafo, simularlo y publicar una versión. Los ejemplos de flujo no sustituirán la configuración libre dentro del catálogo de nodos disponible.

### Módulos core

| Módulo | Alcance previsto |
| --- | --- |
| Cuenta y negocio | Autenticación, roles y aislamiento de datos entre negocios. |
| Conexión WhatsApp | Meta Cloud API directa, configuración del número y webhooks. |
| Editor y motor | Flujos visuales, validación, versiones, simulación y ejecución persistida. |
| Catálogo y pedidos | Productos, carrito, totales en COP, confirmación y estados del pedido. |
| Bandeja humana | Contexto de conversación, asignación, pausa del bot y retoma controlada. |
| Colas y operación | Procesamiento asíncrono, reintentos, idempotencia, auditoría y recuperación. |
| Administración comercial | Alcance del piloto, condiciones, soporte y estado de suscripción. |

### Nodos del motor

Inicio, mensaje o menú, captura validada, condición, variable, catálogo y carrito, pedido, espera y temporizador, acción HTTP restringida, transferencia humana y fin.

## Stack confirmado para el SaaS

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js + React Flow |
| Backend | NestJS + TypeScript |
| Base de datos | PostgreSQL / Supabase |
| Mensajería | Meta Cloud API directa |
| Procesamiento asíncrono | Colas y workers; BullMQ + Redis o equivalente durable por evaluar |
| Infraestructura | Hosting económico o gratuito compatible con uso comercial, pendiente de validación |

## Documentación

- [Estructura del repositorio](docs/estructura.md)
- [Arquitectura del frontend](docs/frontend.md)
- [Arquitectura del backend](docs/backend.md)
- [Reglas de trabajo con IA](.ai)
