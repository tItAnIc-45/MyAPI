const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('Usuario', {
  nombre: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING(255), allowNull: false, validate: { is: /^scrypt\$/ } },
  rol: { type: DataTypes.ENUM('Administrador', 'Operador'), allowNull: false, defaultValue: 'Operador' },
}, {
  tableName: 'Usuarios', engine: 'InnoDB',
  defaultScope: { attributes: { exclude: ['password'] } },
});
