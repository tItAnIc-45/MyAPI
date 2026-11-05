# DER — Laboratorio 9

Este diagrama corresponde a `models/index.js`. Las cinco tablas usan InnoDB,
ID entero autoincremental y `createdAt`/`updatedAt`. No hay tablas intermedias.
MariaDB de XAMPP en Windows normaliza los nombres de tablas a minúsculas:
phpMyAdmin muestra `categorias`, `proveedores`, `usuarios`, `productos` y
`movimientos`. Son las mismas tablas representadas por sus nombres Sequelize.

```mermaid
erDiagram
    Categorias ||--o{ Productos : "categoriaId RESTRICT"
    Proveedores ||--o{ Productos : "proveedorId RESTRICT"
    Productos ||--o{ Movimientos : "productoId RESTRICT"
    Usuarios ||--o{ Movimientos : "usuarioId RESTRICT"
    Categorias {
        int id PK
        varchar nombre UK
        text descripcion
        datetime createdAt
        datetime updatedAt
    }
    Proveedores {
        int id PK
        varchar razon_social
        varchar contacto
        varchar telefono
        varchar email
        datetime createdAt
        datetime updatedAt
    }
    Productos {
        int id PK
        varchar nombre
        text descripcion
        decimal precio "10,2"
        int stock "inicial 0"
        int categoriaId FK
        int proveedorId FK
        datetime createdAt
        datetime updatedAt
    }
    Usuarios {
        int id PK
        varchar nombre
        varchar email UK
        varchar password "hash scrypt"
        enum rol "Operador o Administrador"
        datetime createdAt
        datetime updatedAt
    }
    Movimientos {
        int id PK
        int productoId FK
        int usuarioId FK
        enum tipo_movimiento "Entrada Salida Ajuste"
        int cantidad "magnitud positiva"
        datetime fecha_hora
        text observaciones
        int stock_anterior
        int stock_resultante
        datetime createdAt
        datetime updatedAt
    }
```

Todas las FK son obligatorias (`NOT NULL`), con `ON DELETE RESTRICT` y
`ON UPDATE CASCADE`. Las categorías y proveedores pueden existir sin productos;
los productos y usuarios pueden existir sin movimientos.

Las restricciones FK se crean en MariaDB, no solo en JavaScript. El stock
no negativo se valida en el modelo y, para movimientos, dentro de la transacción
con bloqueo de la fila de producto. Los saldos permiten identificar si un ajuste
sumó o restó unidades; `cantidad` conserva siempre la magnitud positiva.

Vista exportable para captura: [DER.svg](./DER.svg).
