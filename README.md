# MyAPI — preparación del CRUD de productos

**Laboratorios 10 y 11 implementados localmente:** [seguridad, sesión React, ejecución y capturas](docs/LABORATORIOS10-11.md)
y [Postman actualizado](docs/POSTMAN-10-11.md). Instalar con `npm.cmd ci`, preparar
variables JWT con `npm.cmd run auth:configure` e iniciar con `npm.cmd run dev`.
Todas las rutas administrativas requieren Bearer. APIDB existente no se reinicializa.
Para la primera cuenta administradora: `npm.cmd run admin:bootstrap` en terminal
interactiva; no promueve cuentas anteriores. `npm.cmd test` no escribe en MySQL.
La documentación del Laboratorio 9 que sigue se conserva como referencia histórica.

**Laboratorio 9 implementado:** consultar [guía actual de ejecución, API y evidencias](docs/LABORATORIO9.md),
[DER](docs/DER.md) y [Postman](docs/POSTMAN.md). El servidor utiliza
`inventory/app.js` y los cinco modelos de `models/index.js`. Las secciones
siguientes conservan el registro histórico de preparación de los laboratorios 7–8
y la fase 1; para inicialización y stock, prevalece la guía del Laboratorio 9.

## Fase 1: conexión y preparación controlada

- `npm.cmd run db:check` verifica la conexión a APIDB y cuenta sus tablas/vistas,
  rutinas y eventos con consultas de lectura. No publica credenciales.
- `.env` es configuración local ignorada por Git; `.env.example` es la plantilla.
  La carga de `.env` se resuelve desde la carpeta del backend, independientemente
  del directorio desde donde se invoque Node.
- `npm.cmd test` prueba el CRUD HTTP y las barreras de inicialización sin MySQL.
- `npm.cmd run db:init` sin argumentos se niega a inicializar.
- `npm.cmd run db:init -- --confirm-empty` comprueba de nuevo la conexión y que
  APIDB esté completamente vacía antes de sincronizar los modelos actuales,
  sin eliminar ni alterar tablas existentes. Rechaza cualquier otro DB_NAME.

**No ejecutar todavía la inicialización:** en esta fase solo está definido el
modelo Producto. El esquema completo se preparará durante el Laboratorio 9.
El inicializador debe incorporar entonces todos los modelos y asociaciones antes
de ejecutarse por primera vez. Si APIDB tiene objetos existentes, hay que detenerse
y pedir confirmación para un plan específico; no se debe saltar esta barrera.

La inspección y creación del esquema requieren uso exclusivo durante ese paso:
no ejecutar otro inicializador, aplicación que cree tablas ni cambios desde
phpMyAdmin al mismo tiempo. El DDL de MariaDB no ofrece rollback transaccional
de todo el esquema; ante una creación parcial, este script bloqueará el reintento
y habrá que revisar el estado sin borrar tablas automáticamente.

### Evidencias al cerrar la fase 1

1. Terminal con rama `feat/laboratorios-9-11` en ambos repositorios.
2. Salida de `npm.cmd run db:check`: conexión correcta y cero objetos.
3. phpMyAdmin mostrando APIDB sin tablas.
4. Salida de `npm.cmd test` y del build/lint del frontend.

No incluir `.env`, credenciales ni tokens en capturas. Registrar las evidencias
antes de pasar a la implementación del Laboratorio 9.

## Preparación local

1. Instalar las versiones del lockfile con `npm.cmd ci`.
2. Copiar `.env.example` a `.env` y completar usuario y contraseña locales.
3. Confirmar el host y puerto de MySQL/MariaDB y que la base `APIDB` ya existe.
4. Revisar, sin recrear ni sobrescribir datos, que la tabla existente corresponda
   al modelo Sequelize: `Productos` (nombre predeterminado), `id`, `nombre`,
   `descripcion`, `precio`, `stock`, `createdAt` y `updatedAt`.
5. Ejecutar `npm.cmd run dev` desde esta carpeta cuando la configuración esté lista.

El arranque solo ejecuta `sequelize.authenticate()`: no sincroniza tablas ni
ejecuta migraciones. Si falta el esquema, las operaciones de productos fallarán;
su preparación debe revisarse y autorizarse por separado. No usar `force` ni `alter`.

## Contrato compatible con appInventario

- `GET /`: mensaje original de disponibilidad.
- `GET /productos`: 200 y arreglo de productos.
- `POST /productos`: 201 y producto creado.
- `PUT /productos/:id`: 200 y producto actualizado.
- `DELETE /productos/:id`: 204 sin cuerpo.

POST y PUT reciben `nombre`, `descripcion`, `precio` y `stock`. Se aceptan
valores numéricos y cadenas numéricas usadas por los inputs React. El nombre
es obligatorio; el precio debe ser no negativo y caber en DECIMAL(10,2);
el stock debe ser un entero no negativo de 32 bits y se omite con valor 0.
Los campos ajenos al formulario, incluyendo `id`, se ignoran.
PUT espera los datos completos del formulario, como hace el frontend existente.

Datos o IDs inválidos devuelven 400; registros inexistentes, 404;
conflictos de restricciones, 409; errores inesperados, 500 sin detalles internos.
La API todavía no incluye autenticación (pendiente del Laboratorio 10).

## Comprobaciones sin base de datos

`node --test` ejecuta pruebas HTTP con un modelo en memoria. No importa la
configuración de MySQL, no inicia el servidor real y no persiste datos.

El frontend se inicia en otra terminal, desde `appInventario`, con
`npm.cmd run dev`; Axios utiliza `http://localhost:3006`.
