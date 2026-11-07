# Pruebas desde Postman

Requisitos: API reiniciada, PostgreSQL y Redis locales encendidos y usuario creado en Supabase Auth. SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY deben corresponder al mismo proyecto.

En Postman usa Import y selecciona whattsapp-local.postman_collection.json de esta carpeta. Completa email y password en el cuerpo del login. Al ejecutarlo correctamente, la colección guarda el token para las siguientes peticiones. No exportes los valores de sesión.

## 1. Iniciar sesión
POST http://localhost:3001/auth/login

Body → raw → JSON:
```json
{
  "email": "correo-del-usuario",
  "password": "contraseña-del-usuario"
}
```

Respuesta esperada: 200 con access_token, token_type y vigencia. Si Supabase exige CAPTCHA, enviar también captchaToken con una respuesta válida del desafío; no se desactiva desde la API. El acceso con Google y la renovación de sesiones son flujos pendientes.

Opcional, para conservar el token en la colección de pruebas, añadir en Scripts → Post-response:
```javascript
if (pm.response.code === 200) {
  pm.collectionVariables.set("access_token", pm.response.json().access_token);
} else {
  pm.collectionVariables.unset("access_token");
}
```

El token permite actuar como ese usuario. No sincronizarlo en espacios compartidos ni incluir valores reales al exportar la colección.

## 2. Verificar el perfil
GET http://localhost:3001/identity/me

Authorization → Bearer Token → pegar access_token o usar {{access_token}} si se guardó como variable.

Resultado: 200 con el perfil local. No es necesario insertar el usuario en PostgreSQL manualmente.

## 3. Crear un negocio
POST http://localhost:3001/businesses

Misma autorización y cuerpo JSON:
```json
{ "name": "Mi comercio" }
```

Resultado: 201 con ID, nombre y rol owner.

## 4. Consultarlo
- GET /businesses → lista de negocios del usuario.
- GET /businesses/{id} → detalle de un negocio donde tiene membresía.

## Respuestas de control
| Estado | Significado |
| --- | --- |
| 400 | Campos inválidos o adicionales. |
| 401 | Falta sesión válida o login rechazado. |
| 404 | Negocio inexistente o ajeno. |
| 429 | Esperar el tiempo de Retry-After. |
| 503 | Dependencia no disponible o autenticación sin configurar. |

Login aplica un bucket por IP y otro por cuenta normalizada antes de consultar Supabase. Las rutas privadas aplican IP + usuario verificado. Los contadores caducan; no se guardan contraseñas ni tokens en la base local. Los cambios sensibles siguen requiriendo diseño de MFA y permisos antes de implementarse.

Los mismos endpoints pueden probarse desde /docs. La API no abre el navegador automáticamente.
