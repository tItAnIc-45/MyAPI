const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('Proveedor', {
  razon_social: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  contacto: DataTypes.STRING,
  telefono: DataTypes.STRING(40),
  email: { type: DataTypes.STRING, allowNull: false, validate: { isEmail: true } },
}, { tableName: 'Proveedores', engine: 'InnoDB' });
