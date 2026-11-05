const express = require('express');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');
const { HttpError, object, email, validate } = require('../inventory/validation');
const { hashPassword, verifyPassword, publicUser } = require('./passwords');
const ISSUER = 'senati-inventario';
const AUDIENCE = 'senati-admin';
function securityConfig(input = {}) {
  const config = { jwtSecret: process.env.JWT_SECRET, jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h', ...input };
  if (typeof config.jwtSecret !== 'string' || Buffer.byteLength(config.jwtSecret) < 32) throw new Error('Configura JWT_SECRET local con al menos 32 bytes.');
  if (!/^\d+(s|m|h|d)$/.test(config.jwtExpiresIn) || /^0+[smhd]$/.test(config.jwtExpiresIn)) throw new Error('JWT_EXPIRES_IN debe ser una duración positiva, por ejemplo 1h.');
  return config;
}
function signToken(user, config) {
  return jwt.sign({}, config.jwtSecret, { algorithm: 'HS256', subject: String(user.id), issuer: ISSUER, audience: AUDIENCE, expiresIn: config.jwtExpiresIn });
}
function authenticate(models, config) {
  return async (req, res, next) => {
    const match = /^Bearer ([^\s]+)$/i.exec(req.get('Authorization') || '');
    if (!match) return res.status(401).json({ error: 'Se requiere un token de acceso.' });
    let claims;
    try {
      claims = jwt.verify(match[1], config.jwtSecret, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
      if (!Number.isSafeInteger(Number(claims.sub)) || Number(claims.sub) <= 0 || !Number.isInteger(claims.exp)) throw new Error('Identidad inválida');
    } catch { return res.status(401).json({ error: 'Sesión inválida o expirada. Inicia sesión nuevamente.' }); }
    try {
      const user = await models.Usuario.findByPk(claims.sub);
      if (!user || !['Administrador', 'Operador'].includes(user.rol)) return res.status(401).json({ error: 'La cuenta ya no está disponible.' });
      req.user = publicUser(user); next();
    } catch (error) { next(error); }
  };
}
const roles = (...allowed) => (req, res, next) => allowed.includes(req.user?.rol) ? next() : res.status(403).json({ error: 'No tienes permisos para esta operación.' });
function authRouter(models, config) {
  const router = express.Router();
  const throttle = rateLimit({ windowMs: 15 * 60 * 1000, limit: config.authLimit || 30, standardHeaders: 'draft-7', legacyHeaders: false,
    message: { error: 'Demasiados intentos. Espera antes de volver a intentarlo.' } });
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/register', throttle, async (req, res) => {
    const data = validate('usuarios', req.body);
    data.rol = 'Operador';
    data.password = await hashPassword(data.password);
    const user = await models.Usuario.create(data);
    res.status(201).json({ user: publicUser(user), message: 'Cuenta creada. Ya puedes iniciar sesión.' });
  });
  router.post('/login', throttle, async (req, res) => {
    const body = object(req.body);
    const address = email(body.email);
    if (typeof body.password !== 'string' || !body.password || body.password.length > 1024) throw new HttpError(400, 'Contraseña requerida.');
    const user = await models.Usuario.unscoped().findOne({ where: { email: address } });
    if (!user || !(await verifyPassword(body.password, user.password))) throw new HttpError(401, 'Email o contraseña incorrectos.');
    // Actualización compatible: solo tras verificar la contraseña y sin truncar
    // contraseñas scrypt antiguas que excedan el límite de bcrypt.
    if (user.password.startsWith('scrypt$') && body.password.length >= 8 && Buffer.byteLength(body.password) <= 72) {
      const oldHash = user.password;
      const upgraded = await hashPassword(body.password);
      await models.Usuario.update({ password: upgraded }, { where: { id: user.id, password: oldHash }, silent: true });
    }
    res.json({ token: signToken(user, config), user: publicUser(user) });
  });
  router.get('/me', authenticate(models, config), (req, res) => res.json({ user: req.user }));
  return router;
}
module.exports = { securityConfig, signToken, authenticate, roles, authRouter };
