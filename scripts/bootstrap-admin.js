const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const { Transaction } = require('sequelize');
const models = require('../models');
const { validate } = require('../inventory/validation');
const { hashPassword } = require('../security/passwords');
async function main() {
  let rl;
  try {
    if (!process.stdin.isTTY) throw new Error('Ejecutar en una terminal interactiva. No pasar contraseñas como argumentos.');
    if (models.sequelize.getDatabaseName() !== 'APIDB') throw new Error('Se requiere APIDB.');
    if (await models.Usuario.count({ where: { rol: 'Administrador' } })) throw new Error('Ya existe un administrador. Utiliza la gestión autenticada de usuarios.');
    let hidden = false;
    const output = new Writable({ write(chunk, encoding, callback) { if (!hidden) process.stdout.write(chunk); callback(); } });
    rl = readline.createInterface({ input: process.stdin, output, terminal: true });
    const nombre = await rl.question('Nombre del primer administrador: ');
    const email = await rl.question('Email: ');
    process.stdout.write('Contraseña (entrada oculta): '); hidden = true;
    const password = await rl.question(''); hidden = false; process.stdout.write('\n');
    process.stdout.write('Confirmar contraseña (entrada oculta): '); hidden = true;
    const confirm = await rl.question(''); hidden = false; process.stdout.write('\n');
    if (password !== confirm) throw new Error('Las contraseñas no coinciden.');
    const data = validate('usuarios', { nombre, email, password, rol: 'Administrador' }, false, true);
    data.password = await hashPassword(data.password);
    await models.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE }, async transaction => {
      if (await models.Usuario.count({ where: { rol: 'Administrador' }, transaction })) throw new Error('Ya se creó un administrador.');
      if (await models.Usuario.findOne({ where: { email: data.email }, transaction })) throw new Error('Ese email ya existe. No se modifica su cuenta; elige otro email.');
      await models.Usuario.create(data, { transaction });
    });
    console.log('Primera cuenta administradora creada. No se modificaron cuentas anteriores.');
  } catch (error) {
    console.error('No se creó el administrador:', error.original?.code || error.message);
    process.exitCode = 1;
  } finally { rl?.close(); await models.sequelize.close(); }
}
main();
