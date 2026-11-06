# Plan de trabajo

Referencia: checklist HTML Whattsapp Automatization. Fechas objetivo: viernes 6 y sábado 7 de noviembre de 2026; domingo 8 descanso; lunes 9 salida condicionada.

| Bloque | HTML | Entregable y cierre |
| --- | --- | --- |
| 1. Alcance y accesos | f1–f2 | Piloto definido; acceso Meta comprobado o bloqueo documentado. |
| 2. Base ejecutable | f3 | Workspace, web, API, worker y servicios locales; arranque y build verificados. CI selectivo; despliegue pendiente. |
| 3. Datos y acceso | f4–f5 | Migraciones, autenticación, roles y aislamiento probado entre dos negocios. |
| 4. Canal asíncrono | f6–f7 | Webhook firmado, inbox/outbox, reintentos y recuperación. |
| 5. Primer recorrido | f8–f10 | Grafo configurable, editor y confirmación única de pedido en COP. |
| 6. Completar producto | s2–s5 | Nodos restantes, versiones, simulación y atención humana. |
| 7. Validar candidato | s6–s12 | Seguridad, concurrencia, infraestructura, restauración y aceptación interna. |
| 8. Piloto | m1–m7 | Aceptación, despliegue controlado, validación real y cobro acordado. |

f11 cierra viernes; s1 revisa bloqueos y reajusta sábado. La aprobación de Meta y el piloto comercial no se presuponen.

## Bloque 2: alcance actual
- pnpm workspaces con apps/web, apps/api y packages/contracts.
- Next.js App Router con pantalla inicial, sin editor ni autenticación.
- NestJS con /health para PostgreSQL y Redis.
- Worker separado con trabajo de diagnóstico de sistema.
- PostgreSQL y Redis locales mediante Docker Compose.
- Variables de ejemplo sin credenciales productivas.
- Build, comprobación de tipos, pruebas unitarias de configuración y recorrido end-to-end de API/cola.

La base no incluye migraciones del producto, integración Meta, pedidos ni flujo comercial. f3 queda parcial respecto al HTML: CI está configurado y requiere publicación para validarse en GitHub. El despliegue espera hosting; React Flow se incorpora en el bloque del editor.

## Seguimiento
Pendiente → En curso → Implementado → Verificado. Registrar bloqueos con responsable y siguiente acción. Una tarea se verifica con evidencia; el calendario no sustituye la aceptación.

## Evidencia de la base local
Verificados: tipos, build, pruebas unitarias y recorridos end-to-end separados de API y worker. Comprobación adicional de compilados: frontend y API por HTTP, trabajo procesado por el worker, respuesta 503 sin Redis y recuperación al reiniciarlo. La comprobación temporal se eliminó. Bloques de negocio pendientes; CI y entrega por artefactos configurados; sin despliegue.
