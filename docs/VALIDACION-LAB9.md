# Resultado de validación — Laboratorio 9

Fecha local: 5 de noviembre de 2026. Ambos repositorios en `feat/laboratorios-9-11`.

- `npm.cmd test`: 18 pruebas aprobadas; no usan MySQL. Cubren la regresión
  del CRUD original, API de inventario, validación, hashing, saldos, rollback,
  concurrencia simulada y barreras de inicialización.
- Frontend: `npm.cmd run lint` sin advertencias y `npm.cmd run build` correcto.
- Seis rutas de React Router servidas por Vite con HTTP 200.
- Inicialización de APIDB vacía ejecutada con autorización expresa para las
  cinco tablas, mediante `sequelize.sync()` sin opciones force/alter.
- `npm.cmd run db:verify`: cinco tablas InnoDB y cuatro FK con DELETE RESTRICT
  y UPDATE CASCADE; seis endpoints de lectura respondieron 200.
- Todas las tablas quedaron con cero filas; Dashboard devuelve KPI reales en cero.
- `.env` del backend está ignorado por Git. No se hizo push ni merge.

## Límites de las comprobaciones

La autorización concedida fue únicamente para crear el esquema. No se ejecutó
`test:db`, no se insertaron fixtures y no se comprobaron escrituras contra MariaDB.
Las pruebas de movimientos y concurrencia aprobadas usan un modelo en memoria:
no constituyen una prueba real de concurrencia del motor MariaDB.

No se realizó una prueba automatizada de interacción en navegador. El build,
el lint y las comprobaciones de rutas sí se ejecutaron. Los formularios y el
flujo con datos propios deben verificarse al registrar las evidencias descritas
en `LABORATORIO9.md` y `POSTMAN.md`.

No se implementaron login, JWT, protección de rutas ni otras funciones de los
laboratorios 10 y 11. El backend está limitado a la interfaz local 127.0.0.1.
