# Pruebas mínimas en Postman — Laboratorio 9

Crear una colección con variable `baseUrl=http://localhost:3006/api`.
Para POST/PUT seleccionar Body → raw → JSON. Sustituir IDs por los reales;
los ejemplos no se ejecutan automáticamente ni son KPI simulados.

1. `POST {{baseUrl}}/categorias` → 201:
   `{"nombre":"Accesorios","descripcion":"Periféricos"}`. Anotar `id`.
2. `POST {{baseUrl}}/proveedores` → 201:
   `{"razon_social":"Proveedor del laboratorio","contacto":"Contacto","telefono":"","email":"proveedor@example.com"}`.
3. `POST {{baseUrl}}/usuarios` → 201: cuerpo con `nombre`, `email`, `rol`:
   `"Operador"` y `password` de al menos 8 caracteres elegido por ti. La respuesta
   no debe contener password. No guardar la contraseña en colección ni captura.
4. `POST {{baseUrl}}/productos` → 201:
   `{"nombre":"Teclado","descripcion":"USB","precio":"25.50","categoriaId":1,"proveedorId":1}`.
5. `GET {{baseUrl}}/productos` → 200, relaciones `categoria` y `proveedor`.
6. `POST {{baseUrl}}/movimientos` → 201:
   `{"productoId":1,"usuarioId":1,"tipo_movimiento":"Entrada","cantidad":10,"observaciones":"Ingreso del laboratorio"}`.
7. Mismo endpoint, tipo `Salida` y cantidad `3` → 201, saldo 7.
8. Mismo endpoint → 201:
   `{"productoId":1,"usuarioId":1,"tipo_movimiento":"Ajuste","stock_objetivo":5,"observaciones":"Conteo físico"}`.
9. Salida de `6` → 409. `GET /productos/1` debe conservar stock 5 y
   `GET /movimientos?productoId=1` debe conservar solo los tres movimientos.
10. `GET {{baseUrl}}/dashboard` → 200. Con solo ese producto, unidades 5,
    valorInventario `"127.50"` y movimientos 3.
11. `PUT {{baseUrl}}/productos/1`: enviar los campos completos, sin stock,
    cambiando nombre o precio → 200. Con `stock` → 400.
12. `PUT {{baseUrl}}/movimientos/1` y DELETE del mismo recurso → 405.
13. `DELETE {{baseUrl}}/categorias/1` → 409 si está referenciada.
14. `GET {{baseUrl}}/productos/2147483647` → 404 si no existe.
15. Precio negativo, stock directo, cantidad fraccionaria, email inválido o
    rol Administrador en alta de usuario → 400.

Pruebas de DELETE exitoso: usar únicamente un registro descartable sin relaciones
y con autorización para borrarlo. No borrar datos usados para evidencias.
No hay pruebas de JWT ni login: pertenecen a los laboratorios siguientes.
