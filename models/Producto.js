const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');

const Producto = sequelize.define(
  'Producto',
  {
    nombre: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
    descripcion: { type: DataTypes.TEXT },
    precio: { type: DataTypes.DECIMAL(10, 2), allowNull: false, validate: { min: 0 } },
    stock: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, validate: { min: 0, max: 2147483647, isInt: true } },
  },
  { timestamps: true, tableName: 'Productos', engine: 'InnoDB' }
);

module.exports = Producto;
