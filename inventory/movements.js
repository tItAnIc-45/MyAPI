const { HttpError, object, id, number, text } = require('./validation');

async function registerMovement(models, body) {
  const b = object(body);
  const productoId = id(b.productoId, 'Producto');
  const usuarioId = id(b.usuarioId, 'Usuario');
  if (!['Entrada', 'Salida', 'Ajuste'].includes(b.tipo_movimiento)) throw new HttpError(400, 'Tipo de movimiento inválido.');
  const ajuste = b.tipo_movimiento === 'Ajuste';
  const cantidad = ajuste ? null : number(b.cantidad, 'Cantidad', { min: 1 });
  const objetivo = ajuste ? number(b.stock_objetivo, 'Stock objetivo') : null;
  const observaciones = text(b.observaciones, 'Observaciones', 2000, ajuste);
  return models.sequelize.transaction(async (transaction) => {
    // Bloqueo de fila: serializa entradas, salidas y ajustes del mismo producto.
    const producto = await models.Producto.findByPk(productoId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!producto) throw new HttpError(404, 'Producto no encontrado.');
    const usuario = await models.Usuario.findByPk(usuarioId, { transaction, lock: transaction.LOCK.SHARE });
    if (!usuario) throw new HttpError(404, 'Usuario no encontrado.');
    const anterior = producto.stock;
    const resultante = ajuste ? objetivo : anterior + (b.tipo_movimiento === 'Entrada' ? cantidad : -cantidad);
    if (resultante < 0) throw new HttpError(409, 'Stock insuficiente para la salida.');
    if (resultante > 2147483647) throw new HttpError(400, 'El stock excede el límite permitido.');
    if (resultante === anterior) throw new HttpError(400, 'El ajuste debe cambiar el stock.');
    await producto.update({ stock: resultante }, { transaction });
    return models.Movimiento.create({ productoId, usuarioId, tipo_movimiento: b.tipo_movimiento,
      cantidad: ajuste ? Math.abs(resultante - anterior) : cantidad,
      observaciones, stock_anterior: anterior, stock_resultante: resultante,
      fecha_hora: new Date() }, { transaction });
  });
}
module.exports = { registerMovement };
