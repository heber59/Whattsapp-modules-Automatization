# Autenticación y límites

Supabase Auth identifica al cliente del SaaS; PostgreSQL local guarda perfiles, negocios y membresías. No se almacenan contraseñas ni tokens en nuestras tablas.

```text
POST /auth/login → bucket IP → validar cuerpo → bucket cuenta → Supabase → access_token
Ruta privada → bucket IP → verificar token en Supabase → bucket usuario → operación autorizada
/health → bucket IP → comprobación de servicios
```

## Implementado
- POST /auth/login recibe email, password y captchaToken opcional. Devuelve access_token y vigencia, sin requerir un token previo.
- El SDK oficial realiza el login; cada operación usa un cliente sin persistencia ni renovación automática de sesiones. No se comparten sesiones entre usuarios.
- El correo se normaliza para el límite por cuenta; la contraseña conserva exactamente sus caracteres.
- Rutas privadas por defecto. GET /identity/me sincroniza el perfil local.
- POST /businesses crea negocio y membresía owner; las consultas solo muestran negocios del usuario.
- Buckets atómicos en Redis con vencimiento: IP 120, usuario 60 y login por cuenta 5, por cada ventana de 60 segundos. Son valores iniciales configurables, con ráfaga equivalente a la capacidad.
- Exceso: 429 y Retry-After; no hay bloqueo permanente. Credenciales incorrectas y cuentas inexistentes reciben el mismo mensaje.
- Autenticación sin configurar o proveedor no disponible: 503. El login devuelve Cache-Control: no-store.
- No se confía en X-Forwarded-For. El proxy se configurará con el hosting.

## Configuración
SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY deben pertenecer al mismo proyecto. No usar service_role ni claves secretas.

Los límites locales no cubren llamadas directas a Supabase: mantener allí las políticas de autenticación, CAPTCHA y MFA. Si CAPTCHA está activo, el cliente debe aportar captchaToken válido; el backend no lo omite.

## Pendiente
Login y recuperación en el frontend, flujo Google, renovación/cierre de sesiones desde la API y exigencia de MFA en acciones sensibles. Un token de login por contraseña no certifica por sí mismo el segundo factor.

El hosting cubrirá protección DDoS adicional. Facturación y cambios de números o permisos no se habilitan hasta definir sus controles.

Pruebas manuales: postman.md y whattsapp-local.postman_collection.json. Las pruebas automatizadas usan proveedor simulado, PostgreSQL y Redis reales.

Referencias: [login](https://supabase.com/docs/reference/javascript/auth-signinwithpassword), [verificar usuario](https://supabase.com/docs/reference/javascript/auth-getuser), [límites](https://supabase.com/docs/guides/auth/rate-limits).
