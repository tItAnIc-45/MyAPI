const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('Movimiento', {
  tipo_movimiento: { type: DataTypes.ENUM('Entrada', 'Salida', 'Ajuste'), allowNull: false },
  cantidad: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 1, isInt: true } },
  fecha_hora: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  observaciones: DataTypes.TEXT,
  stock_anterior: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
  stock_resultante: { type: DataTypes.INTEGER, allowNull: false, validate: { min: 0 } },
}, { tableName: 'Movimientos', engine: 'InnoDB' });
