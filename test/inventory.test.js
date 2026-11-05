const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerMovement } = require('../inventory/movements');
const { validate } = require('../inventory/validation');
const { createInventoryApp, hashPassword, publicUser } = require('../inventory/app');
const { scryptSync } = require('node:crypto');

function warehouse(stock = 5) {
  const state = { stock, movements: [], failInsert: false, exists: true, userExists: true };
  let tail = Promise.resolve();
  const models = {
    sequelize: { transaction(callback) {
      const pending = tail.then(async () => {
        const snapshot = { stock: state.stock, movements: [...state.movements] };
        const transaction = { LOCK: { UPDATE: 'UPDATE', SHARE: 'SHARE' } };
        try { return await callback(transaction); }
        catch (error) { state.stock = snapshot.stock; state.movements = snapshot.movements; throw error; }
      });
      tail = pending.catch(() => {});
      return pending;
    } },
    Producto: { async findByPk(id, options) {
      assert.equal(options.lock, 'UPDATE'); assert.ok(options.transaction);
      if (!state.exists) return null;
      return { get stock() { return state.stock; }, async update(data, { transaction }) {
        assert.equal(transaction, options.transaction); state.stock = data.stock;
      } };
    } },
    Usuario: { async findByPk(id, options) { assert.equal(options.lock, 'SHARE'); return state.userExists ? { id } : null; } },
    Movimiento: { async create(data, options) {
      assert.ok(options.transaction);
      if (state.failInsert) throw new Error('fallo de inserción');
      const row = { id: state.movements.length + 1, ...data };
      state.movements.push(row); return row;
    } },
  };
  return { models, state };
}
const movement = (tipo_movimiento, data = {}) => ({ productoId: '1', usuarioId: '1', tipo_movimiento, cantidad: '2', ...data });

test('Kardex: entrada, salida y ajustes mantienen los saldos', async () => {
  const { models, state } = warehouse();
  const entrada = await registerMovement(models, movement('Entrada'));
  assert.equal(entrada.stock_anterior, 5); assert.equal(entrada.stock_resultante, 7);
  await registerMovement(models, movement('Salida'));
  const ajuste = await registerMovement(models, movement('Ajuste', { stock_objetivo: 0, observaciones: 'Conteo físico' }));
  assert.equal(ajuste.cantidad, 5); assert.equal(ajuste.stock_resultante, 0);
  await registerMovement(models, movement('Ajuste', { stock_objetivo: 4, observaciones: 'Corrección documentada' }));
  assert.equal(state.stock, 4); assert.equal(state.movements.length, 4);
});

test('Kardex: no permite stock negativo, faltantes ni cantidades inválidas', async () => {
  const { models, state } = warehouse();
  await assert.rejects(registerMovement(models, movement('Salida', { cantidad: 6 })), { status: 409 });
  for (const data of [movement('Entrada', { cantidad: 0 }), movement('Entrada', { cantidad: 1.5 }),
    movement('Ajuste', { stock_objetivo: 0 }), movement('Ajuste', { stock_objetivo: 5, observaciones: 'Sin cambio' }),
    movement('Desconocido'), movement('Salida', { productoId: false })]) {
    await assert.rejects(registerMovement(models, data), { status: 400 });
  }
  state.userExists = false;
  await assert.rejects(registerMovement(models, movement('Entrada')), { status: 404 });
  state.exists = false;
  await assert.rejects(registerMovement(models, movement('Entrada')), { status: 404 });
  assert.equal(state.stock, 5); assert.equal(state.movements.length, 0);
});

test('Kardex: fallo al insertar movimiento revierte la actualización del stock', async () => {
  const { models, state } = warehouse(); state.failInsert = true;
  await assert.rejects(registerMovement(models, movement('Entrada')), /fallo de inserción/);
  assert.equal(state.stock, 5); assert.equal(state.movements.length, 0);
});

test('Kardex: dos salidas concurrentes no consumen las mismas existencias', async () => {
  const { models, state } = warehouse(3);
  const results = await Promise.allSettled([registerMovement(models, movement('Salida')), registerMovement(models, movement('Salida'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.status, 409);
  assert.equal(state.stock, 1); assert.equal(state.movements.length, 1);
});

test('Validaciones: relaciones obligatorias, dinero y stock solo desde Kardex', () => {
  const valid = { nombre: 'Producto', precio: '25.50', categoriaId: 1, proveedorId: 1 };
  assert.equal(validate('productos', valid).precio, 25.5);
  for (const patch of [{ precio: -1 }, { precio: '1.234' }, { categoriaId: '' }, { proveedorId: null }, { stock: 4 }]) {
    assert.throws(() => validate('productos', { ...valid, ...patch }), { status: 400 });
  }
  assert.throws(() => validate('productos', { ...valid, stock: 0 }, true), { status: 400 });
  assert.throws(() => validate('usuarios', { nombre: 'Nombre', email: 'a@example.com', password: '12345678', rol: 'Administrador' }), { status: 400 });
  assert.throws(() => validate('usuarios', { nombre: 'Nombre', email: 'incorrecto', password: '12345678' }), { status: 400 });
});

test('Usuarios: hash con sal única, verificable y omitido en DTO', async () => {
  const password = 'contraseña solo de prueba';
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second); assert.ok(!first.includes(password));
  const [, salt, hash] = first.split('$');
  assert.equal(scryptSync(password, salt, 64).toString('hex'), hash);
  assert.deepEqual(publicUser({ id: 1, nombre: 'Prueba', password: first }), { id: 1, nombre: 'Prueba' });
});

test('API real: CRUD, alias, errores y usuario sin hash en HTTP', async (t) => {
  let savedPassword;
  const rows = new Map();
  const Model = {
    async findAll() { return [...rows.values()]; },
    async findByPk(id) { return rows.get(Number(id)); },
    async create(data) {
      savedPassword = data.password;
      const row = { id: rows.size + 1, ...data, async update(changes) { Object.assign(this, changes); }, async destroy() { rows.delete(this.id); } };
      rows.set(row.id, row); return row;
    },
  };
  const models = { Producto: Model, Categoria: Model, Proveedor: Model, Usuario: Model, Movimiento: Model };
  const server = createInventoryApp(models).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (path, method = 'GET', body) => fetch(`http://127.0.0.1:${server.address().port}${path}`, {
    method, headers: { 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  assert.equal((await request('/')).status, 200);
  for (const resource of ['productos', 'categorias', 'proveedores', 'usuarios']) {
    assert.equal((await request(`/api/${resource}`)).status, 200);
    assert.equal((await request(`/${resource}`)).status, 200);
    assert.equal((await request(`/api/${resource}/99`)).status, 404);
    assert.equal((await request(`/api/${resource}/abc`)).status, 400);
  }
  const created = await request('/api/categorias', 'POST', { nombre: 'Nombre' });
  assert.equal(created.status, 201);
  const updated = await request('/api/categorias/1', 'PUT', { nombre: 'Actualizado' });
  assert.equal((await updated.json()).nombre, 'Actualizado');
  assert.equal((await request('/api/categorias/1', 'DELETE')).status, 204);
  const user = await request('/api/usuarios', 'POST', { nombre: 'Operador', email: 'operator@example.com', password: 'solo-prueba-segura' });
  assert.equal(user.status, 201); assert.equal((await user.json()).password, undefined);
  assert.match(savedPassword, /^scrypt\$/);
  assert.equal((await (await request('/api/usuarios')).json())[0].password, undefined);
  assert.equal((await request('/api/movimientos/1', 'PUT', {})).status, 405);
  assert.equal((await request('/api/movimientos/1', 'DELETE')).status, 405);
  assert.equal((await request('/api/no-existe')).status, 404);
});
