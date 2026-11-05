const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const Producto = require('./Producto');
const Categoria = require('./Categoria');
const Proveedor = require('./Proveedor');
const Usuario = require('./Usuario');
const Movimiento = require('./Movimiento');

function relation(parent, child, foreignKey, as, inverse) {
  const key = { name: foreignKey, allowNull: false, type: DataTypes.INTEGER };
  parent.hasMany(child, { foreignKey: key, as: inverse, onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
  child.belongsTo(parent, { foreignKey: key, as, onDelete: 'RESTRICT', onUpdate: 'CASCADE' });
}
relation(Categoria, Producto, 'categoriaId', 'categoria', 'productos');
relation(Proveedor, Producto, 'proveedorId', 'proveedor', 'productos');
relation(Producto, Movimiento, 'productoId', 'producto', 'movimientos');
relation(Usuario, Movimiento, 'usuarioId', 'usuario', 'movimientos');

module.exports = { sequelize, Producto, Categoria, Proveedor, Usuario, Movimiento };
