const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
module.exports = sequelize.define('Usuario', {
  nombre: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: true } },
  email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
  password: { type: DataTypes.STRING(255), allowNull: false, validate: { is: /^(?:scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}|\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53})$/ } },
  rol: { type: DataTypes.ENUM('Administrador', 'Operador'), allowNull: false, defaultValue: 'Operador' },
}, {
  tableName: 'Usuarios', engine: 'InnoDB',
  defaultScope: { attributes: { exclude: ['password'] } },
});
