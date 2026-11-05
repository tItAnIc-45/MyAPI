// Comprobación explícita: no inicializa esquemas, no borra filas y revierte sus datos.
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const { QueryTypes } = require('sequelize');
const models = require('../models');
const { hashPassword, createInventoryApp } = require('../inventory/app');
const { registerMovement } = require('../inventory/movements');
async function main() {
  let outer;
  let server;
  try {
    if (!process.argv.includes('--confirm-rollback')) throw new Error('Requiere --confirm-rollback. Puede consumir IDs autoincrementales aunque las filas se reviertan.');
    assert.equal(models.sequelize.getDatabaseName(), 'APIDB');
    await models.sequelize.authenticate();
    const fks = await models.sequelize.query(
      'SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = :database AND REFERENCED_TABLE_NAME IS NOT NULL',
      { replacements: { database: 'APIDB' }, type: QueryTypes.SELECT },
    );
    assert.equal(fks.length, 4, 'Se requieren las cuatro claves foráneas reales.');
    const names = ['Categoria', 'Proveedor', 'Usuario', 'Producto', 'Movimiento'];
    const before = await Promise.all(names.map(name => models[name].count()));
    outer = await models.sequelize.transaction();
    const options = { transaction: outer };
    const suffix = randomBytes(6).toString('hex');
    const categoria = await models.Categoria.create({ nombre: `Prueba temporal ${suffix}` }, options);
    const proveedor = await models.Proveedor.create({ razon_social: `Prueba temporal ${suffix}`, email: `${suffix}@example.com` }, options);
    const usuario = await models.Usuario.create({ nombre: 'Prueba temporal', email: `${suffix}@example.com`, password: await hashPassword(randomBytes(24).toString('hex')), rol: 'Operador' }, options);
    const producto = await models.Producto.create({ nombre: 'Prueba temporal', precio: '25.50', categoriaId: categoria.id, proveedorId: proveedor.id }, options);
    await producto.update({ nombre: 'Prueba temporal editada' }, options);
    const related = await models.Producto.findByPk(producto.id, { ...options, include: ['categoria', 'proveedor'] });
    assert.equal(related.categoria.id, categoria.id); assert.equal(related.proveedor.id, proveedor.id);
    const listedUser = await models.Usuario.findByPk(usuario.id, options);
    assert.equal(listedUser.toJSON().password, undefined);
    const protectedUser = await models.Usuario.unscoped().findByPk(usuario.id, options);
    assert.match(protectedUser.password, /^scrypt\$/);
    // Los movimientos usan savepoints dentro de la transacción exterior.
    const scoped = { ...models, sequelize: { transaction: cb => models.sequelize.transaction({ transaction: outer }, cb) } };
    const payload = { productoId: producto.id, usuarioId: usuario.id, tipo_movimiento: 'Entrada', cantidad: 10 };
    await registerMovement(scoped, payload);
    await registerMovement(scoped, { ...payload, tipo_movimiento: 'Salida', cantidad: 3 });
    await registerMovement(scoped, { ...payload, tipo_movimiento: 'Ajuste', stock_objetivo: 5, observaciones: 'Prueba reversible de conteo' });
    await assert.rejects(registerMovement(scoped, { ...payload, tipo_movimiento: 'Salida', cantidad: 6 }), { status: 409 });
    assert.equal((await models.Producto.findByPk(producto.id, options)).stock, 5);
    assert.equal(await models.Movimiento.count({ ...options, where: { productoId: producto.id } }), 3);
    const failing = { ...scoped, Movimiento: { async create() { throw new Error('Fallo deliberado de inserción'); } } };
    await assert.rejects(registerMovement(failing, payload), /Fallo deliberado/);
    assert.equal((await models.Producto.findByPk(producto.id, options)).stock, 5);
    await outer.rollback(); outer = null;
    const after = await Promise.all(names.map(name => models[name].count()));
    assert.deepEqual(after, before, 'No deben quedar filas de prueba. Ejecutar sin usuarios modificando datos en paralelo.');
    console.log('MariaDB: cuatro FK, relaciones, actualización, hash, movimientos y rollback comprobados; sin filas de prueba persistentes.');
    server = createInventoryApp(models).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    for (const route of ['productos', 'categorias', 'proveedores', 'usuarios', 'movimientos', 'dashboard']) {
      const response = await fetch(`${base}/${route}`);
      assert.equal(response.status, 200, route);
      const json = await response.json();
      if (route === 'dashboard') assert.equal(json.productos, after[3]);
    }
    console.log('HTTP con MariaDB: seis endpoints de lectura y Dashboard respondieron 200.');
  } catch (error) {
    console.error('Prueba MariaDB fallida:', error.original?.code || error.name, error.original ? '' : error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    if (outer) await outer.rollback();
    await models.sequelize.close();
  }
}
main();
