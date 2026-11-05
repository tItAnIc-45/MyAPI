const sequelize = require('../config/db');
require('../models');
const { initializeEmptyDatabase } = require('./db-safety');

async function main() {
  try {
    await initializeEmptyDatabase(sequelize, process.argv.includes('--confirm-empty'));
    console.log('Tablas de los modelos actuales inicializadas en APIDB previamente vacía.');
  } catch (error) {
    const code = error.original?.code;
    console.error(code ? `No se pudo inicializar APIDB (${code}). Revisa la configuración local.` : error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
