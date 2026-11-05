const sequelize = require('../config/db');
const { inspectDatabase } = require('./db-safety');

async function main() {
  try {
    const state = await inspectDatabase(sequelize);
    console.log('Conexión a APIDB verificada mediante consultas de lectura.');
    console.log(`Tablas/vistas: ${state.tables.length}. Rutinas: ${state.routines.length}. Eventos: ${state.events.length}.`);
    if (state.tables.length) console.table(state.tables);
    console.log(state.tables.length || state.routines.length || state.events.length
      ? 'APIDB contiene objetos: no ejecutar inicialización para una base vacía.'
      : 'APIDB está vacía. No se han creado tablas.');
  } catch (error) {
    // No imprimir objetos de conexión, consultas con datos o credenciales.
    const code = error.original?.code;
    console.error(code ? `No se pudo comprobar APIDB (${code}). Revisa la configuración local y XAMPP.` : error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
