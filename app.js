const express = require('express');
const cors = require('cors');

function validarProducto(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'El cuerpo debe ser un objeto JSON.' };
  }
  const { nombre, descripcion, precio, stock = 0 } = body;
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.trim().length > 255) {
    return { error: 'El nombre es obligatorio y debe tener hasta 255 caracteres.' };
  }
  if (descripcion != null && typeof descripcion !== 'string') {
    return { error: 'La descripción debe ser texto.' };
  }
  // Los inputs de React envían cadenas; se aceptan números y cadenas numéricas.
  const esNumero = (valor) =>
    (typeof valor === 'number' || (typeof valor === 'string' && valor.trim() !== '')) &&
    Number.isFinite(Number(valor));
  if (!esNumero(precio) || Number(precio) < 0 || Number(precio) > 99999999.99) {
    return { error: 'El precio debe ser un número entre 0 y 99999999.99.' };
  }
  if (!esNumero(stock) || !Number.isInteger(Number(stock)) || Number(stock) < 0 || Number(stock) > 2147483647) {
    return { error: 'El stock debe ser un entero entre 0 y 2147483647.' };
  }
  return {
    datos: { nombre: nombre.trim(), descripcion: descripcion ?? null, precio: Number(precio), stock: Number(stock) },
  };
}

// Recibir el modelo permite probar las rutas sin abrir conexiones a MySQL.
function createApp(Producto) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.send('¡API Backend funcionando exitosamente!');
  });

  app.get('/productos', async (req, res) => {
    res.json(await Producto.findAll({ order: [['id', 'ASC']] }));
  });

  app.post('/productos', async (req, res) => {
    const resultado = validarProducto(req.body);
    if (resultado.error) return res.status(400).json({ error: resultado.error });
    const producto = await Producto.create(resultado.datos);
    res.status(201).json(producto);
  });

  app.param('id', (req, res, next, id) => {
    if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)) || Number(id) > 2147483647) {
      return res.status(400).json({ error: 'El ID debe ser un entero positivo válido.' });
    }
    next();
  });

  app.put('/productos/:id', async (req, res) => {
    const resultado = validarProducto(req.body);
    if (resultado.error) return res.status(400).json({ error: resultado.error });
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' });
    await producto.update(resultado.datos);
    res.json(producto);
  });

  app.delete('/productos/:id', async (req, res) => {
    const producto = await Producto.findByPk(req.params.id);
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado.' });
    await producto.destroy();
    res.status(204).end();
  });

  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'JSON inválido.' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande.' });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: 'Datos de producto inválidos.' });
    }
    if (error.name === 'SequelizeUniqueConstraintError' || error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(409).json({ error: 'La operación entra en conflicto con registros existentes.' });
    }
    console.error('Error al procesar la petición:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });
  return app;
}

module.exports = createApp;
