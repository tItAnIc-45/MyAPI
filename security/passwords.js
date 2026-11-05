const bcrypt = require('bcryptjs');
const { scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const { HttpError } = require('../inventory/validation');
const derive = promisify(scrypt);
function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value, 'utf8') > 72) {
    throw new HttpError(400, 'La contraseña requiere al menos 8 caracteres y máximo 72 bytes UTF-8.');
  }
  return value;
}
async function hashPassword(value) { return bcrypt.hash(validatePassword(value), 12); }
async function verifyPassword(value, stored) {
  if (typeof value !== 'string' || typeof stored !== 'string' || value.length > 1024) return false;
  if (/^\$2[aby]\$\d{2}\$/.test(stored)) return Buffer.byteLength(value, 'utf8') <= 72 && bcrypt.compare(value, stored);
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/i.exec(stored);
  if (!match) return false;
  const actual = await derive(value, match[1], 64);
  return timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
}
function publicUser(value) {
  const plain = value.toJSON ? value.toJSON() : { ...value };
  delete plain.password;
  return plain;
}
module.exports = { hashPassword, verifyPassword, validatePassword, publicUser };
