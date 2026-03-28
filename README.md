# Sistema Financiero Sindical – The Batman Theme

Este repositorio almacena y unifica toda la lógica del **Portal de Rendición de Cuentas Sindicales y Estado Financiero Seguro**. La visualización se apoya en una capa moderna y responsiva de TailwindCSS con un impactante "Modo Batman" por defecto.

## Funciones Principales

- **Gestión Avanzada del Administrador**: Detrás de un inicio de sesión de dos pasos con Firebase Auth, garantizando la seguridad absoluta y el registro inmutable en Firestore Database.
- **Rendiciones Mensuales**: Integración instantánea y cálculo automático del saldo inicial, un resumen de ingresos/egresos y un saldo total final listos para procesar los balances mensuales y trimestrales.
- **Generación de PDF**: Gracias a la librería de `jsPDF` y de autotablas construimos recibos limpios, profesionales y transparentes (incluyendo detalles de cada gasto/ingreso en sub-renglones tabulares) que pueden ser resguardados y publicados por la dirigencia del sindicato.
- **Notificaciones Oficiales**: Área central para comunicados en tiempo directo a los afiliados.

## Despliegue Configurado (Guía de Github Pages)

Si necesitas actualizar la aplicación y subir cambios al portal:
Abre la consola de comandos de tu IDE y asegúrate de ejecutar el comando de construcción estresando nuestro pre-compilador Vite.

```bash
npm run deploy
```

La lógica cargará una emulación, creará la versión para producción minificada y la subirá permanentemente al `gh-pages` branch asegurando la visibilidad del repositorio en `https://[TuUsuario].github.io/rendicion-sindical/`.
