# Desarrollo local

Requisitos: Node 22.22.2 (nvm), Corepack y Docker con Compose. Ejecutar desde la raíz del repositorio.

```bash
nvm use
corepack pnpm install
cp .env.example .env
corepack pnpm infra:up
corepack pnpm db:migrate
corepack pnpm dev
```

En otra terminal:

```bash
corepack pnpm dev:worker
```

| Servicio | Dirección local |
| --- | --- |
| Frontend | http://localhost:3000 |
| API / salud | http://localhost:3001/health |
| PostgreSQL | 127.0.0.1:55432 |
| Redis | 127.0.0.1:56379 |

Las conexiones locales están limitadas al equipo. Las credenciales del ejemplo son exclusivas de desarrollo. Si modificas puertos o contraseña, actualiza también DATABASE_URL o REDIS_URL. Con un volumen PostgreSQL existente, cambiar la contraseña del archivo no cambia la del servidor.

El endpoint público /health devuelve 200 si PostgreSQL y Redis responden; 503 si alguna dependencia deja de responder. No certifica la disponibilidad del worker. La prueba end-to-end comprueba el procesamiento real de un trabajo de sistema.

## Verificación
Con infraestructura encendida:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test:ci
corepack pnpm test
corepack pnpm test:e2e
corepack pnpm build
```

Las pruebas end-to-end separan la API en un puerto libre del worker de diagnóstico. Usa los servicios configurados en .env; ejecutarla solo contra infraestructura local de desarrollo.

Para ejecutar los compilados:

```bash
corepack pnpm --filter @wa/api start
corepack pnpm --filter @wa/api start:worker
corepack pnpm --filter @wa/web start
```

Detén los procesos con Ctrl+C. Apaga los contenedores con:

```bash
corepack pnpm infra:down
```

Los volúmenes conservan datos. CI selectivo y entrega por artefactos: ver ci-cd.md. Sin despliegue ni secretos de Meta configurados.

Identidad y negocios requieren SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY. Sin ellas, sus rutas privadas responden 503. Ver auth-seguridad.md. Las pruebas de seguridad usan un proveedor simulado y solo PostgreSQL local; no conectan a Supabase remoto. Ver bd.md para el esquema y las migraciones.

## Swagger
En desarrollo, http://localhost:3001 redirige a /docs. La consola muestra el enlace directo; /docs-json expone OpenAPI. En producción no se montan la documentación ni la redirección. Authorize acepta un access_token de Supabase; las rutas privadas conservan sus permisos y límites. El token no se guarda entre recargas. Reiniciar el proceso de la API después de modificar su arranque.
