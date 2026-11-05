const { QueryTypes } = require('sequelize');

async function inspectDatabase(sequelize) {
  const database = sequelize.getDatabaseName();
  if (database !== 'APIDB') {
    throw new Error('Operación limitada a APIDB. Revisa DB_NAME.');
  }
  await sequelize.authenticate();
  const tables = await sequelize.query(
    'SELECT TABLE_NAME AS nombre, TABLE_TYPE AS tipo FROM information_schema.TABLES WHERE TABLE_SCHEMA = :database ORDER BY TABLE_NAME',
    { replacements: { database }, type: QueryTypes.SELECT },
  );
  const routines = await sequelize.query(
    'SELECT ROUTINE_NAME AS nombre FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = :database',
    { replacements: { database }, type: QueryTypes.SELECT },
  );
  const events = await sequelize.query(
    'SELECT EVENT_NAME AS nombre FROM information_schema.EVENTS WHERE EVENT_SCHEMA = :database',
    { replacements: { database }, type: QueryTypes.SELECT },
  );
  return { tables, routines, events };
}

async function initializeEmptyDatabase(sequelize, confirmed) {
  if (!confirmed) {
    throw new Error('Inicialización no ejecutada. Requiere --confirm-empty tras revisar db:check.');
  }
  const state = await inspectDatabase(sequelize);
  if (state.tables.length || state.routines.length || state.events.length) {
    throw new Error('APIDB no está vacía. Se bloqueó la inicialización; revisar y solicitar confirmación antes de cambiar el esquema.');
  }
  // Nunca invocar este inicializador en paralelo con otro creador de esquema.
  // No se modifican tablas existentes, no se eliminan datos ni se usan migraciones.
  await sequelize.sync();
}

module.exports = { inspectDatabase, initializeEmptyDatabase };
