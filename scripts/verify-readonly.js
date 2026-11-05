const assert = require('node:assert/strict');
const { QueryTypes } = require('sequelize');
const models = require('../models');
const { createInventoryApp } = require('../inventory/app');
const { securityConfig, signToken } = require('../security/auth');

async function main() {
  let server;
  try {
    assert.equal(models.sequelize.getDatabaseName(), 'APIDB');
    await models.sequelize.authenticate();
    const tables = await models.sequelize.query(
      'SELECT TABLE_NAME AS nombre, ENGINE AS motor FROM information_schema.TABLES WHERE TABLE_SCHEMA = :database ORDER BY TABLE_NAME',
      { replacements: { database: 'APIDB' }, type: QueryTypes.SELECT },
    );
    assert.deepEqual(tables.map(t => t.nombre.toLowerCase()).sort(), ['categorias', 'movimientos', 'productos', 'proveedores', 'usuarios']);
    assert.ok(tables.every(t => t.motor === 'InnoDB'));
    const keys = await models.sequelize.query(
      'SELECT TABLE_NAME AS tabla, COLUMN_NAME AS campo, REFERENCED_TABLE_NAME AS padre FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = :database AND REFERENCED_TABLE_NAME IS NOT NULL ORDER BY TABLE_NAME, COLUMN_NAME',
      { replacements: { database: 'APIDB' }, type: QueryTypes.SELECT },
    );
    assert.deepEqual(keys.map(k => `${k.tabla}.${k.campo}->${k.padre}`.toLowerCase()).sort(), [
      'movimientos.productoid->productos', 'movimientos.usuarioid->usuarios',
      'productos.categoriaid->categorias', 'productos.proveedorid->proveedores',
    ]);
    const rules = await models.sequelize.query(
      'SELECT DELETE_RULE AS borrar, UPDATE_RULE AS actualizar FROM information_schema.REFERENTIAL_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = :database',
      { replacements: { database: 'APIDB' }, type: QueryTypes.SELECT },
    );
    assert.ok(rules.every(r => r.borrar === 'RESTRICT' && r.actualizar === 'CASCADE'));
    console.log('Esquema: cinco tablas InnoDB y cuatro FK RESTRICT/CASCADE verificadas.');
    console.table(tables);
    const counts = Object.fromEntries(await Promise.all(['Categoria', 'Proveedor', 'Usuario', 'Producto', 'Movimiento'].map(async name => [name, await models[name].count()])));
    console.log('Conteos reales:', JSON.stringify(counts));
    server = createInventoryApp(models).listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const base = `http://127.0.0.1:${server.address().port}`;
    const user = await models.Usuario.findOne({ where: { rol: 'Administrador' } }) || await models.Usuario.findOne();
    const token = user ? signToken(user, securityConfig()) : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    for (const resource of ['productos', 'categorias', 'proveedores', 'usuarios', 'movimientos', 'dashboard']) {
      assert.equal((await fetch(`${base}/api/${resource}`)).status, 401);
      if (!user) continue;
      const response = await fetch(`${base}/api/${resource}`, { headers });
      const expected = resource === 'usuarios' && user.rol !== 'Administrador' ? 403 : 200;
      assert.equal(response.status, expected, resource);
      if (expected === 403) { console.log('GET /api/usuarios: 403 para operador, correcto.'); continue; }
      const json = await response.json();
      if (resource === 'dashboard') {
        assert.equal(json.productos, counts.Producto);
        assert.equal(json.categorias, counts.Categoria);
        assert.equal(json.proveedores, counts.Proveedor);
        assert.equal(json.usuarios, counts.Usuario);
        assert.equal(json.movimientos, counts.Movimiento);
        console.log('Dashboard real: conteos coherentes con MariaDB.');
      } else assert.ok(Array.isArray(json));
      console.log(`GET /api/${resource}: 200`);
    }
    assert.equal((await fetch(`${base}/`)).status, 200);
    assert.equal((await fetch(`${base}/productos`)).status, 401);
    if (user) assert.equal((await fetch(`${base}/productos`, { headers })).status, 200);
    console.log('Lecturas HTTP correctas. No se insertaron, actualizaron ni borraron filas.');
  } catch (error) {
    console.error('Verificación fallida:', error.original?.code || error.name, error.original ? '' : error.message);
    process.exitCode = 1;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await models.sequelize.close();
  }
}
main();
