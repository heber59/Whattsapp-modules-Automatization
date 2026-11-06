# CI y entrega por servicio

GitHub Actions verifica PR hacia develop/main y cambios publicados en esas ramas. No hay hosting elegido: se generan artefactos; el despliegue permanece pendiente.

| Cambio | Verificación |
| --- | --- |
| apps/web/ | Frontend: ESLint, tipos y build; sin PostgreSQL ni Redis. |
| Entrada HTTP o health | API: ESLint, tipos, unitarios, end-to-end y build; PostgreSQL y Redis temporales. |
| Entrada o consumidor del worker | Worker: ESLint, tipos, unitarios, end-to-end y build; solo Redis. |
| Infraestructura o código compartido del backend | API y worker. |
| packages/contracts/ | Contratos y sus consumidores: frontend, API y worker. |
| Lockfile, configuración global o lógica del CI | Todos, por precaución. |
| Solo documentación | Detector y estado final; sin arrancar servicios. |

Los cambios se calculan contra la base del PR o el commit anterior del push. Un historial incompleto verifica todo. Las pruebas unitarias del detector protegen estas reglas. Los módulos futuros del backend se consideran compartidos salvo clasificación explícita.

## Calidad y seguridad
- ESLint detecta problemas de código; se ejecuta también con pnpm lint.
- pnpm audit revisa dependencias, incluidas las de desarrollo, y bloquea el CI ante avisos de gravedad alta o crítica.
- CodeQL analiza JavaScript/TypeScript y publica hallazgos en Security. También se ejecuta semanalmente. Sus alertas deben revisarse: no equivalen automáticamente a una aprobación o bloqueo por vulnerabilidad.
- Dependabot propone actualizaciones semanales hacia develop.
- Las acciones están fijadas a revisiones concretas. Los PR no reciben secretos de despliegue.

CodeQL está disponible en repositorios públicos; los runners estándar de Actions son gratuitos para ellos. Los artefactos tienen retención de siete días y están sujetos a las cuotas de GitHub.

## Entrega
Después de verificar un servicio, los pushes a develop/main y las ejecuciones manuales en esas ramas producen su archivo tar.gz: web standalone, API o worker con dependencias productivas y release.json. Los PR verifican sin generar entregas. El tar conserva permisos y enlaces de dependencias.

Para generar un artefacto local: ejecutar el build del servicio y luego pnpm package:web, pnpm package:api o pnpm package:worker. Usar Linux y la versión de Node del proyecto.

No se reinicia ningún servicio por cambiar documentación. Las variables productivas futuras pertenecerán a cada servicio; editar secretos del hosting no dispara por sí solo este CI. Los cambios de variables del frontend incorporadas durante el build requerirán recompilarlo.

Al publicar, recomendar configurar CI / Resultado como comprobación obligatoria de las ramas; esta protección no se cambia automáticamente.

Fuentes: [CodeQL](https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning) y [uso de Actions](https://docs.github.com/en/actions/concepts/billing-and-usage).
