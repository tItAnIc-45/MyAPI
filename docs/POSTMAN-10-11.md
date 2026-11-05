# Postman — Laboratorios 10 y 11

Base: http://localhost:3006/api. No exportar contraseñas ni tokens en colecciones.
Usar variables locales sensibles; en capturas dejar token y Authorization ocultos.

1. POST /auth/register, raw JSON con nombre, email nuevo y password elegida por ti:
   201 y user.rol Operador. Con rol Administrador: 400. Repetir email: 409.
2. POST /auth/login, raw JSON con email y password: 200, token y user sin password.
   Contraseña incorrecta: 401. Guardar token solo como valor local no compartido.
3. GET /productos, Authorization → No Auth: 401.
4. GET /productos, Authorization → Bearer Token con variable local: 200.
5. GET /auth/me con ese token: 200 y cuenta actual; no aparece hash.
6. Bearer inválido: 401. Para expiración, usar un token que haya expirado; puede
   configurarse JWT_EXPIRES_IN=30s localmente, reiniciar backend y hacer un login
   nuevo, esperar 31 segundos y consultar. Restaurar 1h después. No modificar firmas.
7. Con cuenta Operador: POST /categorias, body {"nombre":"Prueba"}: 403.
8. Con Administrador creado mediante admin:bootstrap: POST /categorias 201;
   PUT /categorias/ID con nombre actualizado: 200. No borrar registros reales.
9. POST /movimientos con productoId real, tipo_movimiento Entrada y cantidad 1:
   201 y usuarioId de la cuenta autenticada. Esto sí cambia stock y agrega historial;
   realizarlo solo si deseas registrar esa entrada para el laboratorio.
10. POST /movimientos con usuarioId de otra cuenta: 403, sin movimiento.
11. GET /dashboard y GET /movimientos: 200, datos reales conservados.

Para constatar formato de contraseña sin exponerlo, en phpMyAdmin:

```sql
SELECT id,
       CASE WHEN password LIKE '$2%' THEN 'bcrypt'
            WHEN password LIKE 'scrypt$%' THEN 'scrypt'
            ELSE 'otro' END AS formato,
       LENGTH(password) AS longitud
FROM usuarios;
```

Tras el primer login válido de una cuenta scrypt compatible, su formato será bcrypt,
sin cambio de contraseña. No hay endpoint público para crear administradores.
El logout de React elimina el token del navegador; Postman conserva su copia
hasta que la borres o expire. No presentar esto como revocación del lado servidor.
