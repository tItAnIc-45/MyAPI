const { test } = require('node:test');
const assert = require('node:assert/strict');
const { inspectDatabase, initializeEmptyDatabase } = require('../scripts/db-safety');

function fakeDatabase({ name = 'APIDB', objects = [[], [], []], failConnect = false } = {}) {
  const calls = { queries: [], sync: [] };
  const db = {
    getDatabaseName: () => name,
    async authenticate() { if (failConnect) throw new Error('Sin conexión'); },
    async query(sql, options) {
      calls.queries.push({ sql, options });
      return objects[calls.queries.length - 1];
    },
    async sync(options) { calls.sync.push(options); },
  };
  return { db, calls };
}

test('Inspección usa solamente SELECT y parámetros para APIDB', async () => {
  const { db, calls } = fakeDatabase();
  assert.deepEqual(await inspectDatabase(db), { tables: [], routines: [], events: [] });
  assert.equal(calls.queries.length, 3);
  for (const { sql, options } of calls.queries) {
    assert.match(sql, /^SELECT /);
    assert.deepEqual(options.replacements, { database: 'APIDB' });
  }
  assert.equal(calls.sync.length, 0);
});

test('Inicialización rechaza una base diferente y la falta de confirmación', async () => {
  const { db, calls } = fakeDatabase({ name: 'otra_base' });
  await assert.rejects(initializeEmptyDatabase(db, true), /limitada a APIDB/);
  await assert.rejects(initializeEmptyDatabase(db, false), /confirm-empty/);
  assert.equal(calls.queries.length, 0);
  assert.equal(calls.sync.length, 0);
});

test('Bloquea tablas, vistas, rutinas o eventos existentes antes de sync', async () => {
  for (const objects of [
    [[{ nombre: 'Productos' }], [], []],
    [[{ nombre: 'vista', tipo: 'VIEW' }], [], []],
    [[], [{ nombre: 'rutina' }], []],
    [[], [], [{ nombre: 'evento' }]],
  ]) {
    const { db, calls } = fakeDatabase({ objects });
    await assert.rejects(initializeEmptyDatabase(db, true), /no está vacía/);
    assert.equal(calls.sync.length, 0);
  }
});

test('Sin conexión no intenta sincronizar', async () => {
  const { db, calls } = fakeDatabase({ failConnect: true });
  await assert.rejects(initializeEmptyDatabase(db, true), /Sin conexión/);
  assert.equal(calls.sync.length, 0);
});

test('Solo una base vacía confirmada permite sincronización no destructiva', async () => {
  const { db, calls } = fakeDatabase();
  await initializeEmptyDatabase(db, true);
  assert.deepEqual(calls.sync, [undefined]);
});
