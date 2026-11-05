const sequelize = require('./config/db');
require('dotenv').config();

const models = require('./models');
const { createInventoryApp } = require('./inventory/app');
const app = createInventoryApp(models);

const PORT = process.env.PORT || 3006;

sequelize
  .authenticate()
  .then(() => {
    console.log('Base de datos conectada. No se modifica el esquema.');
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('No se pudo conectar a APIDB. Revisa XAMPP y las variables locales.', error.original?.code || error.name);
    process.exitCode = 1;
  });
