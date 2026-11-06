# Whattsapp Automatization

Proyecto de micro-SaaS colombiano para automatizar la recepción y gestión de pedidos por WhatsApp mediante flujos visuales configurables por nodos.

Este repositorio contiene actualmente un **HTML autónomo e interactivo para documentar el producto y hacer seguimiento de su construcción**. El backend, el frontend del SaaS y las integraciones descritas son el alcance previsto; no se presentan como implementados.

## Qué incluye hoy

- Documentación de producto, módulos core, requisitos y criterios de aceptación.
- Especificación del editor visual y del motor de ejecución por nodos.
- Checklist de 30 tareas, con progreso global y por día.
- Distinción entre tareas pendientes, completadas y verificadas con evidencia.
- Notas por tarea, bitácora general y registro de riesgos con estado.
- Persistencia en `localStorage`, exportación e importación JSON.
- Restablecimiento con confirmación, búsqueda, filtros e impresión.
- Diseño responsive, sin dependencias externas ni instalación.

## Cómo usar el documento

1. Descarga o clona el repositorio.
2. Abre `Whattsapp-Automatization.html` en un navegador moderno. Si conservas la estructura de entrega original, el archivo está en `outputs/`.
3. Marca las tareas realizadas y registra sus resultados o evidencias.
4. Marca **Verificada con evidencia** únicamente después de revisar el resultado. El documento exige que la tarea esté completada y tenga una nota.
5. Actualiza los riesgos y exporta una copia JSON al terminar cada jornada.

El archivo funciona sin servidor y sin conexión a internet. Los enlaces a documentación externa sí requieren conexión.

### Guardado y respaldos

El progreso se guarda en el navegador y en la ubicación desde la que se abre el HTML. No existe sincronización entre dispositivos. Mover el archivo, cambiar de navegador, usar navegación privada o borrar los datos del navegador puede separar o eliminar el progreso.

**Exportar JSON** genera un respaldo de casillas, verificaciones, notas y riesgos. **Importar JSON** valida el archivo y solicita confirmación antes de reemplazar el estado actual. **Restablecer** también requiere confirmación.

No incluyas tokens, contraseñas, credenciales ni datos reales de clientes en las notas o respaldos. Mantén los archivos de progreso fuera de un repositorio público.

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

La especificación contempla versiones publicadas inmutables, estado durable por conversación, límites de ejecución, control de concurrencia y protección ante eventos repetidos. El objetivo es evitar pedidos duplicados y permitir recuperar la operación tras fallos.

## Stack confirmado para el SaaS

| Capa | Tecnología |
| --- | --- |
| Frontend | Next.js + React Flow |
| Backend | NestJS + TypeScript |
| Base de datos | PostgreSQL / Supabase |
| Mensajería | Meta Cloud API directa |
| Procesamiento asíncrono | Colas y workers; BullMQ + Redis o equivalente durable por evaluar |
| Infraestructura | Hosting económico o gratuito compatible con uso comercial, pendiente de validación |

Este stack corresponde al producto por construir. El documento de seguimiento usa únicamente HTML, CSS y JavaScript integrados en un archivo.

## Plan de ejecución

Fechas fijas de noviembre de 2026, en la zona horaria de Colombia (`America/Bogota`).

| Día | Enfoque |
| --- | --- |
| Viernes 6 | Alcance, dependencias Meta, entornos, datos, acceso, mensajería y primer recorrido funcional. |
| Sábado 7 | Completar el motor, simulación, bandeja, seguridad, recuperación y aceptación interna. |
| Domingo 8 | Descanso, sin tareas ni entregables programados. |
| Lunes 9 | Habilitación productiva, aceptación del cliente, despliegue controlado, validación y cobro condicionado. |

La fecha de lanzamiento es una meta, no una garantía. Si el motor, la seguridad, la integridad de pedidos o las dependencias externas no están validados, se conserva la demo y se reprograma la salida comercial.

## Condiciones para desplegar y cobrar

- Tareas de construcción verificadas con evidencia.
- Acceso productivo a Meta y número habilitado para el caso de uso.
- Aislamiento entre negocios, integridad de pedidos y recuperación probados.
- Sin defectos críticos abiertos; riesgos revisados y tratados.
- Infraestructura compatible, presupuesto, monitoreo, backup y rollback disponibles.
- Alcance, precio en COP y condiciones aceptados explícitamente por el cliente.
- Validación del recorrido real en producción antes del cobro.

Los indicadores del HTML reflejan lo declarado por quien lo utiliza. No constituyen una auditoría independiente, no ejecutan despliegues y no procesan pagos.

## Dependencias externas y hosting
