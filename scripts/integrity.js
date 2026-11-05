// Solo SELECT. Guarda cantidades y huellas, nunca filas ni contraseñas.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { createHash } = require('node:crypto');
const { Transaction } = require('sequelize');
const models = require('../models');
const target = path.join(os.tmpdir(), 'senati-lab10-integrity.json');
async function main() {
  try {
    if (models.sequelize.getDatabaseName() !== 'APIDB') throw new Error('Se requiere APIDB.');
    const snapshot = await models.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
      const result = {};
      for (const name of ['Categoria', 'Proveedor', 'Usuario', 'Producto', 'Movimiento']) {
        const rows = await models[name].unscoped().findAll({ transaction, raw: true, order: [['id', 'ASC']] });
        result[name] = { count: rows.length, digest: createHash('sha256').update(JSON.stringify(rows)).digest('hex') };
      }
      return result;
    });
    if (process.argv[2] === 'snapshot') {
      await fs.writeFile(target, JSON.stringify(snapshot), { flag: 'wx' });
      console.log('Huella de integridad inicial guardada fuera de los repositorios.');
    } else if (process.argv[2] === 'compare') {
      const previous = JSON.parse(await fs.readFile(target, 'utf8'));
      if (JSON.stringify(previous) !== JSON.stringify(snapshot)) throw new Error('Los registros difieren de la captura inicial. Revisar cambios externos antes de continuar.');
      console.log('Integridad confirmada: los registros completos de las cinco tablas coinciden con la captura inicial.');
    } else throw new Error('Usar snapshot o compare.');
    console.log('Cantidades:', JSON.stringify(Object.fromEntries(Object.entries(snapshot).map(([key, value]) => [key, value.count]))));
  } catch (error) {
    console.error('Comprobación de integridad:', error.original?.code || error.message);
    process.exitCode = 1;
  } finally { await models.sequelize.close(); }
}
main();
