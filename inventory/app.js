const express = require('express');
const cors = require('cors');
const { randomBytes, scrypt } = require('node:crypto');
const { promisify } = require('node:util');
const { Op, Transaction } = require('sequelize');
const { HttpError, id, validate } = require('./validation');
const { registerMovement } = require('./movements');
const derive = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}
function publicUser(value) {
  const plain = value.toJSON ? value.toJSON() : { ...value };
  delete plain.password;
  return plain;
}
function createInventoryApp(m) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.get('/', (req, res) => res.send('¡API Backend funcionando exitosamente!'));
  const router = express.Router();
  router.param('id', (req, res, next, value) => { try { id(value); next(); } catch (error) { next(error); } });
  const productInclude = [{ model: m.Categoria, as: 'categoria' }, { model: m.Proveedor, as: 'proveedor' }];
  const movementInclude = [{ model: m.Producto, as: 'producto' }, { model: m.Usuario, as: 'usuario', attributes: ['id', 'nombre', 'email', 'rol'] }];
  const resources = { productos: m.Producto, categorias: m.Categoria, proveedores: m.Proveedor, usuarios: m.Usuario };
  for (const [resource, Model] of Object.entries(resources)) {
    const options = resource === 'productos' ? { include: productInclude } : {};
    const output = resource === 'usuarios' ? publicUser : (value) => value;
    router.get(`/${resource}`, async (req, res) => {
      const rows = await Model.findAll({ ...options, order: [['id', 'ASC']] });
      res.json(rows.map(output));
    });
    router.get(`/${resource}/:id`, async (req, res) => {
      const row = await Model.findByPk(req.params.id, options);
      if (!row) throw new HttpError(404, 'Registro no encontrado.');
      res.json(output(row));
    });
    router.post(`/${resource}`, async (req, res) => {
      const data = validate(resource, req.body);
      if (data.password) data.password = await hashPassword(data.password);
      const row = await Model.create(data);
      res.status(201).json(output(row));
    });
    router.put(`/${resource}/:id`, async (req, res) => {
      const data = validate(resource, req.body, true);
      if (data.password) data.password = await hashPassword(data.password);
      const row = await Model.findByPk(req.params.id);
      if (!row) throw new HttpError(404, 'Registro no encontrado.');
      await row.update(data);
      res.json(output(row));
    });
    router.delete(`/${resource}/:id`, async (req, res) => {
      const row = await Model.findByPk(req.params.id);
      if (!row) throw new HttpError(404, 'Registro no encontrado.');
      // Evita descartar inventario; las FK protegen cualquier historial existente.
      if (resource === 'productos' && row.stock !== 0) throw new HttpError(409, 'No se puede eliminar un producto con stock.');
      await row.destroy();
      res.status(204).end();
    });
  }
  router.get('/movimientos', async (req, res) => {
    const where = {};
    if (req.query.productoId !== undefined) where.productoId = id(req.query.productoId, 'Producto');
    res.json(await m.Movimiento.findAll({ where, include: movementInclude, order: [['id', 'DESC']] }));
  });
  router.post('/movimientos', async (req, res) => res.status(201).json(await registerMovement(m, req.body)));
  router.get('/movimientos/:id', async (req, res) => {
    const row = await m.Movimiento.findByPk(req.params.id, { include: movementInclude });
    if (!row) throw new HttpError(404, 'Movimiento no encontrado.');
    res.json(row);
  });
  router.all('/movimientos/:id', (req, res) => res.status(405).set('Allow', 'GET').json({ error: 'El historial es inmutable. Registra un movimiento compensatorio.' }));
  router.get('/dashboard', async (req, res) => {
    // Todas las lecturas del dashboard comparten una instantánea consistente.
    const result = await m.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async (transaction) => {
      const opts = { transaction };
      const productos = await m.Producto.findAll({ ...opts, attributes: ['id', 'precio', 'stock'] });
      let valorCentimos = 0n;
      for (const p of productos) {
        const [entero, decimal = ''] = String(p.precio).split('.');
        valorCentimos += (BigInt(entero) * 100n + BigInt(decimal.padEnd(2, '0').slice(0, 2))) * BigInt(p.stock);
      }
      const totalStock = productos.reduce((sum, p) => sum + p.stock, 0);
      const recientes = await m.Movimiento.findAll({ ...opts, include: movementInclude, order: [['id', 'DESC']], limit: 5 });
      return { productos: productos.length, categorias: await m.Categoria.count(opts), proveedores: await m.Proveedor.count(opts),
        usuarios: await m.Usuario.count(opts), movimientos: await m.Movimiento.count(opts), unidades: totalStock,
        valorInventario: `${valorCentimos / 100n}.${String(valorCentimos % 100n).padStart(2, '0')}`,
        stockBajo: await m.Producto.count({ ...opts, where: { stock: { [Op.lte]: 5 } } }), recientes };
    });
    res.json(result);
  });
  app.use('/api', router);
  app.use('/', router); // Alias del CRUD del Laboratorio 8.
  app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error, req, res, next) => {
    if (error.status && error.status >= 400 && error.status < 500) return res.status(error.status).json({ error: error.type === 'entity.parse.failed' ? 'JSON inválido.' : error.message });
    if (error.name === 'SequelizeValidationError') return res.status(400).json({ error: 'Datos inválidos. Revisa los campos del formulario.' });
    if (['SequelizeUniqueConstraintError', 'SequelizeForeignKeyConstraintError'].includes(error.name)) return res.status(409).json({ error: 'Registro duplicado, relación inexistente o registro utilizado por otro módulo.' });
    console.error('Fallo de inventario:', error.original?.code || error.name);
    res.status(500).json({ error: 'No se pudo completar la operación. Revisa la conexión y el esquema.' });
  });
  return app;
}
module.exports = { createInventoryApp, hashPassword, publicUser };
