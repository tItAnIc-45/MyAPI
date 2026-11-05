const { test } = require('node:test');
const assert = require('node:assert/strict');
const createApp = require('../app');

test('Contrato CRUD HTTP con modelo en memoria, sin conexión MySQL', async (t) => {
  const registros = new Map();
  let siguienteId = 1;
  let escrituras = 0;
  let fallarLectura = false;
  const modelo = {
    async findAll() {
      if (fallarLectura) throw new Error('Fallo simulado');
      return [...registros.values()];
    },
    async findByPk(id) { return registros.get(Number(id)); },
    async create(datos) {
      escrituras++;
      const registro = {
        id: siguienteId++, ...datos,
        async update(cambios) { escrituras++; Object.assign(this, cambios); },
        async destroy() { escrituras++; registros.delete(this.id); },
      };
      registros.set(registro.id, registro);
      return registro;
    },
  };
  const servidor = createApp(modelo).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve);
    servidor.once('error', reject);
  });
  t.after(() => new Promise((resolve) => servidor.close(resolve)));
  const url = `http://127.0.0.1:${servidor.address().port}`;
  const pedir = (ruta, method = 'GET', datos) => fetch(url + ruta, {
    method,
    ...(datos !== undefined ? {
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos),
    } : {}),
  });
  const valido = { nombre: 'Teclado', descripcion: 'USB', precio: '25.50', stock: '3' };

  await t.test('Conserva GET / y devuelve lista vacía', async () => {
    const inicio = await pedir('/');
    assert.equal(inicio.status, 200);
    assert.match(await inicio.text(), /API Backend funcionando exitosamente/);
    assert.deepEqual(await (await pedir('/productos')).json(), []);
  });

  await t.test('Rechaza datos inválidos sin escribir', async () => {
    for (const datos of [
      {}, [], { ...valido, nombre: ' ' }, { ...valido, precio: -1 },
      { ...valido, precio: '' }, { ...valido, precio: null }, { ...valido, precio: true },
      { ...valido, precio: 'abc' }, { ...valido, precio: 100000000 },
      { ...valido, stock: -1 }, { ...valido, stock: '1.5' },
      { ...valido, stock: '' }, { ...valido, stock: null },
      { ...valido, descripcion: {} },
    ]) {
      const respuesta = await pedir('/productos', 'POST', datos);
      assert.equal(respuesta.status, 400, JSON.stringify(datos));
      assert.equal(typeof (await respuesta.json()).error, 'string');
    }
    assert.equal(escrituras, 0);
  });

  await t.test('Crea, lista, actualiza y elimina con formatos usados por Axios', async () => {
    const creada = await pedir('/productos', 'POST', { ...valido, id: 999, extra: 'ignorar' });
    assert.equal(creada.status, 201);
    const producto = await creada.json();
    assert.equal(producto.id, 1);
    assert.equal(producto.precio, 25.5);
    assert.equal(producto.stock, 3);
    assert.equal(producto.extra, undefined);
    assert.equal((await (await pedir('/productos')).json()).length, 1);
    const editada = await pedir('/productos/1', 'PUT', { ...producto, precio: '0', stock: '0' });
    assert.equal(editada.status, 200);
    assert.equal((await editada.json()).stock, 0);
    assert.equal((await pedir('/productos/1', 'PUT', { ...valido, stock: -1 })).status, 400);
    const borrada = await pedir('/productos/1', 'DELETE');
    assert.equal(borrada.status, 204);
    assert.equal(await borrada.text(), '');
    assert.deepEqual(await (await pedir('/productos')).json(), []);
    assert.equal(escrituras, 3);
  });

  await t.test('Distingue registros inexistentes e IDs inválidos', async () => {
    assert.equal((await pedir('/productos/99', 'PUT', valido)).status, 404);
    assert.equal((await pedir('/productos/99', 'DELETE')).status, 404);
    for (const id of ['0', '-1', 'abc', '1.5', '2147483648']) {
      assert.equal((await pedir(`/productos/${id}`, 'PUT', valido)).status, 400);
      assert.equal((await pedir(`/productos/${id}`, 'DELETE')).status, 400);
    }
    assert.equal(escrituras, 3);
  });

  await t.test('Devuelve errores JSON y oculta detalles internos', async () => {
    const malformada = await fetch(url + '/productos', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
    });
    assert.equal(malformada.status, 400);
    assert.equal((await pedir('/no-existe')).status, 404);
    fallarLectura = true;
    const fallo = await pedir('/productos');
    assert.equal(fallo.status, 500);
    assert.deepEqual(await fallo.json(), { error: 'Error interno del servidor.' });
  });
});
