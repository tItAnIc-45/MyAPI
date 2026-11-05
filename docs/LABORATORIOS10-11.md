# Laboratorios 10 y 11 — seguridad y sesión React

## Arranque mínimo

No ejecutar db:init, sync, migraciones ni cambios de esquema sobre APIDB existente.
Las cinco tablas y sus relaciones se conservan. La validación de Usuario ahora
acepta hashes scrypt anteriores y bcrypt nuevos sin modificar el tipo SQL.

```powershell
cd C:\SENATI\MyAPI
npm.cmd ci
# Solo al preparar otro entorno; en esta PC ya quedó configurado:
npm.cmd run auth:configure
npm.cmd run dev
```

En otra terminal:

```powershell
cd C:\SENATI\appInventario
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir http://127.0.0.1:5173/login. Mantener MariaDB de XAMPP activo.
Utilizar el email y contraseña reales de tu cuenta del Laboratorio 9.
No hace falta restablecer la contraseña scrypt para entrar.

## Variables y primera cuenta administradora

`.env` del backend conserva las variables DB/PORT y añade JWT_SECRET y
JWT_EXPIRES_IN (por defecto 1h). `auth:configure` genera un secreto aleatorio local
de 64 bytes si falta y conserva uno válido existente. Nunca imprime el secreto.
`.env.example` mantiene JWT_SECRET vacío. No exportar `.env` ni usar VITE_JWT_SECRET.
Rotar JWT_SECRET invalida los tokens anteriores. Reiniciar backend después de
cambiar el entorno. JWT usa HS256 y comprueba algoritmo, emisor, audiencia y exp.

Si todavía no hay administrador, ejecutar en una terminal interactiva:

```powershell
cd C:\SENATI\MyAPI
npm.cmd run admin:bootstrap
```

El comando pide nombre, email y contraseña oculta con confirmación; crea una
cuenta nueva Administrador con bcrypt. No cambia el rol de un usuario existente.
Rechaza un email ocupado y se deshabilita si ya existe un administrador. No se
ejecuta automáticamente al arrancar ni existe un endpoint público de promoción.
La comprobación y creación se hacen en una transacción SERIALIZABLE. No pasar
contraseñas por argumentos, archivos, capturas ni chat.

## Contraseñas y transición compatible

Registro y cambios de contraseña generan bcrypt de coste 12 con sal aleatoria.
Las nuevas contraseñas requieren 8 caracteres y máximo 72 bytes UTF-8: evita
la truncación propia de bcrypt. Se conservan espacios intencionales.

Login reconoce los hashes scrypt del Laboratorio 9 y los verifica con comparación
constante. Solo después de verificar la contraseña genera bcrypt y reemplaza el
hash mediante una actualización condicionada al hash anterior. No cambia email,
rol, ID ni relaciones; la contraseña del usuario sigue siendo la misma.
Un login fallido no actualiza nada. Contraseñas scrypt antiguas que excedan 72
bytes o no cumplan la longitud mínima siguen verificándose con scrypt y no se
convierten automáticamente: pueden renovarse mediante la gestión autenticada.
No se ejecuta ninguna conversión masiva ni se almacenan contraseñas en texto plano.

## API y permisos

| Ruta | Acceso y resultado |
| --- | --- |
| POST /api/auth/register | Público: nombre, email, password; crea Operador, 201 |
| POST /api/auth/login | Público: email, password; devuelve token y usuario, 200 |
| GET /api/auth/me | Bearer válido: usuario actual sin hash |
| GET productos, categorías, proveedores, movimientos y dashboard | Administrador u Operador |
| POST/PUT/DELETE productos, categorías y proveedores | Solo Administrador |
| Todas las operaciones /api/usuarios | Solo Administrador |
| POST /api/movimientos | Administrador u Operador; responsable tomado del token |
| PUT/DELETE de movimientos | 405; historial inmutable |

Todas las rutas administrativas /api y sus alias anteriores requieren JWT.
Solo GET / conserva el mensaje público de disponibilidad. Nunca se confía en
un rol enviado dentro del JWT: el middleware lee la cuenta y rol actual en DB.
Cuenta eliminada: 401. Permisos insuficientes: 403. Email duplicado o relaciones:
409. JWT ausente, inválido o expirado: 401. El registro público no permite
Administrador. Un administrador no puede borrarse ni cambiar su propio rol.

Kardex mantiene bloqueo de fila, transacción, saldos y prevención de stock
negativo. No permite atribuir un movimiento a otra cuenta mediante usuarioId.
El historial existente no se modifica.

Helmet está activo; Express no anuncia x-powered-by. CORS admite únicamente
http://localhost:5173 y http://127.0.0.1:5173. Postman sin Origin funciona.
Límite general: 1000 peticiones/15 min/IP; registro/login: 30/15 min/IP,
con respuesta JSON 429. El limitador es local al proceso y reinicia sus contadores
al reiniciar el servidor. El backend sigue escuchando solo en 127.0.0.1.

## Sesión React y límites educativos

ProtectedRoute protege Dashboard, Productos, Categorías, Proveedores, Kardex y
Usuarios. Usuarios requiere Administrador; el menú oculta esa opción al Operador.
Operador ve el catálogo en modo consulta y puede registrar sus propios movimientos.
El Dashboard y los módulos del Laboratorio 9 se conservan.

La sesión guarda JWT y usuario público en localStorage, siguiendo el enfoque
educativo. Axios añade Bearer; al recargar se valida /auth/me; 401 elimina sesión
y redirige al login, mientras 403 conserva la sesión. Hay temporizador de expiración
y sincronización de cierre entre pestañas. No se guarda contraseña ni hash.

localStorage es accesible a JavaScript y un XSS podría robar el JWT. Cambiar el
rol en el navegador no concede permisos: los comprueba el backend. Para producción,
evaluar cookies HttpOnly/Secure y una estrategia de renovación y revocación.
Cerrar sesión elimina el token del cliente, pero no revoca copias ya emitidas:
un JWT firmado sigue vigente hasta expirar. No se añadió una tabla de sesiones.

## Comprobaciones y evidencias

```powershell
cd C:\SENATI\MyAPI
npm.cmd test
npm.cmd run db:verify
cd C:\SENATI\appInventario
npm.cmd test
npm.cmd run lint
npm.cmd run build
```

Las pruebas HTTP de registro, login, CRUD autenticado, transición de hashes y roles
usan modelos en memoria y no escriben en APIDB. db:verify hace solo lecturas y
verifica tablas, FK, 401 sin token y lecturas autenticadas mediante un token interno
que nunca se imprime. No equivale a probar login con una contraseña real.
`scripts/integrity.js` compara cantidades y huellas de las cinco tablas, incluido
Kardex, contra la captura previa guardada en el directorio temporal del sistema.
No guarda filas ni hashes de contraseñas individuales en los repositorios.

Postman: [POSTMAN-10-11.md](./POSTMAN-10-11.md).

Capturas mínimas Laboratorio 10:
1. Código de hashing/transición y consulta de formato de hash sin mostrar el hash.
2. Registro Operador 201 y rechazo de rol Administrador 400.
3. Login 200 con campo token oculto; /auth/me o productos 200 con Bearer local.
4. Sin token 401, token inválido 401 y Operador intentando editar catálogo 403.

Capturas mínimas Laboratorio 11:
1. Login en escritorio y móvil, con contraseña oculta.
2. Dashboard con usuario/rol visible y navegación a Productos y Kardex.
3. Acceso directo sin sesión a /productos o /kardex redirigido a /login.
4. Cerrar sesión y comprobar que volver atrás o recargar no abre las vistas.
5. Sesión expirada: redirección y mensaje de expiración; sin mostrar el JWT.

Conservar adicionalmente terminales con pruebas/build/lint y Kardex con su
historial. No capturar Authorization, valores del entorno, contraseña ni JWT.
