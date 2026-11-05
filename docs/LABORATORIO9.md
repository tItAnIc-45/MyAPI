# Laboratorio 9 — inventario completo

## Ejecutar

Ambos repositorios deben permanecer en `feat/laboratorios-9-11`.

Backend, desde PowerShell:

```powershell
cd C:\SENATI\MyAPI
npm.cmd ci
npm.cmd run db:check
# Solo la primera vez, con APIDB vacía, tras autorización del propietario:
npm.cmd run db:init -- --confirm-empty
npm.cmd run dev
```

Frontend, en otra terminal:

```powershell
cd C:\SENATI\appInventario
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir `http://127.0.0.1:5173`. Backend: `http://localhost:3006`.
No repetir `db:init` cuando existan tablas: se bloquea, incluso si están sin filas.
No crea bases de datos, no borra ni modifica tablas existentes. Solo carga
los cinco modelos y ejecuta `sequelize.sync()` sin opciones force/alter, tras
inspeccionar APIDB vacía. El arranque normal solo autentica la conexión.
El DDL no es completamente transaccional; ante fallo parcial, detenerse y revisar.

`.env` local: `PORT`, `DB_HOST`, `DB_PORT`, `DB_NAME=APIDB`, `DB_USER`, `DB_PASS`.
Frontend: `VITE_API_URL` opcional, valor predeterminado `http://localhost:3006/api`.
No publicar archivos `.env`, contraseñas ni hashes en capturas.

## Contrato API

La ruta `GET /` conserva el mensaje del Laboratorio 7. Todos los recursos tienen
prefijo `/api` y alias sin prefijo para continuidad con Laboratorio 8.

| Recurso | Operaciones |
| --- | --- |
| `/api/productos` | GET colección, POST; GET/PUT/DELETE `/:id` |
| `/api/categorias` | GET colección, POST; GET/PUT/DELETE `/:id` |
| `/api/proveedores` | GET colección, POST; GET/PUT/DELETE `/:id` |
| `/api/usuarios` | GET colección, POST; GET/PUT/DELETE `/:id` |
| `/api/movimientos` | GET, POST; GET `/:id`; filtro `?productoId=1` |
| `/api/dashboard` | GET estadísticas y cinco movimientos recientes |

POST devuelve 201, PUT 200, DELETE 204. Datos inválidos: 400; inexistentes:
404; duplicados, relaciones inválidas o stock insuficiente: 409. PUT/DELETE
de movimientos se rechazan con 405. Las FK bloquean borrar registros referenciados.

Producto requiere categoría y proveedor existentes. No enviar stock al editar:
solo Kardex puede cambiarlo. Al crear comienza en cero; se tolera `stock: 0`
por compatibilidad parcial con el formulario antiguo. El panel nuevo usa el
contrato relacional completo. No se permite eliminar productos con stock.

Entrada y Salida requieren `cantidad` entera positiva; Ajuste requiere
`stock_objetivo` entero no negativo y `observaciones`. El servidor calcula
la diferencia, bloquea la fila del producto y guarda saldo y movimiento en una
transacción. Si falla cualquiera de los pasos, revierte ambos.
El historial no se edita ni elimina: corregir mediante movimiento compensatorio.

Usuarios se crean como Operador; no se puede elevar el rol desde esta API sin
autenticación. No se implementó login, JWT ni permisos del Laboratorio 10.
Contraseñas de al menos 8 caracteres se guardan mediante scrypt con sal aleatoria
de 16 bytes; jamás aparecen en respuestas. Al editar, omitir contraseña la conserva.
El esquema reserva Administrador para el mecanismo seguro del siguiente laboratorio.
La identidad del responsable se selecciona manualmente en este laboratorio.
Usar solo en el entorno local: el backend escucha en 127.0.0.1.

Dashboard obtiene los KPI de MariaDB dentro de una instantánea transaccional:
conteos, unidades, productos con stock <= 5 y valor precio × stock. El valor se
calcula en céntimos enteros para evitar errores de coma flotante. No hay seeds
ni cifras ficticias. Una base recién inicializada muestra ceros.

## Pruebas

```powershell
cd C:\SENATI\MyAPI
npm.cmd test
cd C:\SENATI\appInventario
npm.cmd run lint
npm.cmd run build
```

La suite incluye la regresión del CRUD original aislado en `app.js`, la API de
inventario de producción en `inventory/app.js`, validaciones, hashing, rollback,
concurrencia simulada y barreras del inicializador. Ninguna de estas pruebas
conecta con MySQL. La prueba de base real se describe por separado y requiere
autorización; no atribuir a los dobles en memoria una validación real de bloqueos.

DER: [DER.md](./DER.md), [DER.svg](./DER.svg). Postman: [POSTMAN.md](./POSTMAN.md).

La comprobación autorizada de solo lectura es `npm.cmd run db:verify`: inspecciona
tablas, motores, FK y reglas, y consulta los seis endpoints sin modificar filas.

Solo si se autoriza adicionalmente una prueba reversible de datos:
`npm.cmd run test:db -- --confirm-rollback`. Comprueba las cuatro FK, relaciones,
actualización de producto, hash, entradas/salidas/ajustes, rechazo de stock negativo,
rollback ante fallo y seis rutas HTTP de lectura. Usa datos temporales en una
transacción exterior y los revierte; no elimina filas. Los autoincrementales pueden
avanzar aunque se reviertan las filas, por lo que los IDs reales no tienen que
comenzar en 1. No ejecutar mientras otros usuarios estén modificando la base.

## Capturas del laboratorio

Primero crea desde la interfaz una categoría, un proveedor, un operador y un
producto vinculado. Usa datos que realmente quieras registrar en el laboratorio.
No se cargan ejemplos automáticamente. Las capturas requieren registros propios.

1. Categorías y proveedores: guardar un registro de cada uno, capturar formulario
   y tabla. Editar un dato si necesitas evidenciar actualización.
2. Usuarios: guardar un operador y capturar su fila sin contraseñas.
3. Productos: capturar el formulario con selectores dinámicos y la fila con
   categoría, proveedor y precio.
4. Kardex: entrada 10, salida 3 y ajuste a 5 con motivo; capturar saldos 0→10,
   10→7 y 7→5. Intentar salida 6 y capturar rechazo por stock insuficiente.
5. Dashboard: después de los movimientos, abrir o actualizar y capturar KPI reales.
   Si solo existe ese producto, habrá 5 unidades y valor igual a precio × 5.
6. Vista móvil: reducir a 390 px y capturar menú desplegable y formulario.
7. Terminal backend: mensaje de conexión y puerto, sin `.env` ni secretos.
8. phpMyAdmin: APIDB con las cinco tablas; Diseñador mostrando cuatro FK;
   examinar Movimientos con saldos y Productos con stock final. No capturar password.
9. Postman: GET productos con relaciones, POST movimiento 201, rechazo 409,
   GET dashboard y bloqueo 405 de edición del historial.
10. DER: abrir `docs/DER.svg` en el navegador y capturar el diagrama completo.

La aplicación contiene seis pantallas: Dashboard y cinco módulos. Para cinco
capturas agrupadas, poner Categorías y Proveedores en una misma evidencia;
conservar ambas pantallas si la rúbrica exige cada vista por separado.
