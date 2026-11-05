# Validación de laboratorios 10 y 11

5 de noviembre de 2026, zona America/Lima. Cambios locales sobre
`feat/laboratorios-9-11`; sin commits, push ni merge de estos laboratorios.

## Ejecutado

- Backend: 22 pruebas aprobadas con `npm.cmd test`. Incluyen registro, login,
  bcrypt, compatibilidad scrypt, conversión tras login válido, contraseñas scrypt
  largas sin truncación, JWT incorrecto/expirado, roles actuales, cuenta eliminada,
  CRUD con autenticación, protección de alias, 401, 403, Helmet, CORS y 429.
- Frontend: 4 pruebas aprobadas con `npm.cmd test`. Comprueban almacenamiento,
  recuperación y cierre de sesión, tokens expirados/corruptos, Bearer automático,
  peticiones sin token tras logout y tratamiento distinto de 401 y 403.
- `npm.cmd run lint`: correcto, sin advertencias.
- `npm.cmd run build`: correcto.
- MariaDB mediante `db:verify`: cinco tablas InnoDB, cuatro claves foráneas,
  401 sin token, lecturas autenticadas 200 y Usuarios 403 para Operador.
- Integridad: cantidades y huellas de los registros completos de las cinco tablas
  iguales antes y después. APIDB conserva 1 categoría, 1 proveedor, 1 usuario,
  1 producto y 3 movimientos. No se cambiaron sus contraseñas durante las pruebas.

## Alcance real

Registro, login, conversión de hash y CRUD de prueba se ejecutaron por HTTP con
modelos en memoria; no se insertaron cuentas ni filas de prueba en APIDB.
Los tokens internos de la comprobación real de lectura se generaron en memoria y
no se imprimieron. Esa comprobación no sustituye un login con tu contraseña real.
No se ejecutó `test:db`, `db:init`, sincronización ni ningún cambio de esquema.
No se creó ni promovió un administrador sobre los datos existentes.

El primer administrador se prepara con `npm.cmd run admin:bootstrap`, que pide
datos y contraseña oculta en tu terminal. La cuenta anterior Operador sigue
siendo válida para consultar y registrar movimientos. Los permisos de escritura
de catálogo y gestión de usuarios requieren una cuenta Administrador.

No se realizó una interacción automatizada de navegador: las pruebas frontend
validan sesión e interceptores, además del lint/build. Seguir las capturas de
`LABORATORIOS10-11.md` para comprobar visualmente login, navegación y logout.

npm reportó cuatro vulnerabilidades moderadas en las dependencias del backend;
no se aplicaron actualizaciones forzadas. La instalación del frontend no cambió
sus dependencias. No se exponen valores de JWT_SECRET, contraseñas ni JWT activos.
