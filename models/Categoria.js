const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('Categoria', {
  nombre: { type: DataTypes.STRING(120), allowNull: false, unique: true, validate: { notEmpty: true } },
  descripcion: DataTypes.TEXT,
}, { tableName: 'Categorias', engine: 'InnoDB' });
