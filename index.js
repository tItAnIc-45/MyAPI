const express = require('express');
const cors = require('cors');
const sequelize = require('./config/db');
require('dotenv').config();

const Producto = require('./models/Producto');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('¡API Backend funcionando exitosamente!');
});

const PORT = process.env.PORT || 3006;

sequelize
  .sync({ force: false })
  .then(() => {
    console.log('Base de datos conectada y sincronizada.');
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('Error al conectar con la base de datos:', error);
  });