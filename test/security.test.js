const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes, scryptSync } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { createInventoryApp } = require('../inventory/app');
const { signToken, securityConfig } = require('../security/auth');
const { hashPassword, verifyPassword } = require('../security/passwords');
const config = { jwtSecret: randomBytes(48).toString('hex'), jwtExpiresIn: '1h', authLimit: 100 };
function memoryModels() {
  let nextId = 10;
  const users = new Map(); const categories = new Map();
  const wrap = (data, collection) => {
    const row = { ...data, async update(changes) { Object.assign(this, changes); }, async destroy() { collection.delete(this.id); } };
    collection.set(row.id, row); return row;
  };
  const Usuario = {
    unscoped() { return this; },
    async findByPk(id) { return users.get(Number(id)) || null; },
    async findOne({ where }) { return [...users.values()].find(u => u.email === where.email) || null; },
    async findAll() { return [...users.values()]; },
    async create(data) {
      if ([...users.values()].some(u => u.email === data.email)) { const error = new Error(); error.name = 'SequelizeUniqueConstraintError'; throw error; }
      return wrap({ id: nextId++, ...data }, users);
    },
    async update(data, { where }) {
      const user = users.get(where.id);
      if (user?.password === where.password) { Object.assign(user, data); return [1]; }
      return [0];
    },
  };
  const Categoria = {
    async findAll() { return [...categories.values()]; },
    async findByPk(id) { return categories.get(Number(id)) || null; },
    async create(data) { return wrap({ id: nextId++, ...data }, categories); },
  };
  const empty = { async findAll() { return []; }, async findByPk() { return null; } };
  return { Usuario, Categoria, Producto: empty, Proveedor: empty, Movimiento: empty, users, categories };
}
async function fixture(t, options = {}) {
  const models = memoryModels();
  const admin = await models.Usuario.create({ nombre: 'Admin prueba', email: 'admin@example.com', password: await hashPassword('Password de prueba'), rol: 'Administrador' });
  const server = createInventoryApp(models, { ...config, ...options }).listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = (route, { method = 'GET', body, token, origin } = {}) => fetch(`http://127.0.0.1:${server.address().port}${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(origin ? { Origin: origin } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { models, request, admin, token: signToken(admin, config) };
}

test('Registro público bcrypt, login y CRUD autenticado sin tocar MySQL', async t => {
  const { request, models, token } = await fixture(t);
  const registration = { nombre: 'Operador prueba', email: 'operator@example.com', password: 'Password de prueba' };
  assert.equal((await request('/api/auth/register', { method: 'POST', body: { ...registration, rol: 'Administrador' } })).status, 400);
  const created = await request('/api/auth/register', { method: 'POST', body: registration });
  assert.equal(created.status, 201);
  const { user } = await created.json();
  assert.equal(user.rol, 'Operador'); assert.equal(user.password, undefined);
  assert.match(models.users.get(user.id).password, /^\$2b\$/);
  assert.equal((await request('/api/auth/register', { method: 'POST', body: registration })).status, 409);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: registration.email, password: 'incorrecta' } })).status, 401);
  const login = await request('/api/auth/login', { method: 'POST', body: registration });
  assert.equal(login.status, 200);
  const session = await login.json();
  assert.equal(typeof session.token, 'string'); assert.equal(session.user.password, undefined);
  for (const route of ['productos', 'categorias', 'proveedores', 'usuarios', 'movimientos', 'dashboard']) {
    assert.equal((await request(`/api/${route}`)).status, 401);
    assert.equal((await request(`/${route}`)).status, 401);
  }
  assert.equal((await request('/api/productos', { token: session.token })).status, 200);
  assert.equal((await request('/api/usuarios', { token: session.token })).status, 403);
  assert.equal((await request('/api/categorias', { method: 'POST', body: { nombre: 'No permitido' }, token: session.token })).status, 403);
  const category = await request('/api/categorias', { method: 'POST', body: { nombre: 'Autenticada' }, token });
  assert.equal(category.status, 201); const row = await category.json();
  const edited = await request(`/api/categorias/${row.id}`, { method: 'PUT', body: { nombre: 'Editada' }, token });
  assert.equal(edited.status, 200); assert.equal((await edited.json()).nombre, 'Editada');
  assert.equal((await request(`/api/categorias/${row.id}`, { method: 'DELETE', token })).status, 204);
  // Logout del cliente: la siguiente petición omite Authorization.
  assert.equal((await request('/api/categorias')).status, 401);
  assert.equal((await request('/api/movimientos', { method: 'POST', token: session.token, body: { usuarioId: 999, productoId: 1 } })).status, 403);
});

test('Scrypt existente: contraseña conservada y transición a bcrypt solo con login válido', async t => {
  const { models, request } = await fixture(t);
  const password = 'Password anterior'; const salt = randomBytes(16).toString('hex');
  const hash = `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
  const user = await models.Usuario.create({ nombre: 'Anterior', email: 'legacy@example.com', password: hash, rol: 'Operador' });
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: user.email, password: 'incorrecta' } })).status, 401);
  assert.equal(user.password, hash);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: user.email, password } })).status, 200);
  assert.match(user.password, /^\$2b\$/); assert.equal(await verifyPassword(password, user.password), true);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: user.email, password } })).status, 200);
  const longPassword = 'á'.repeat(50); const longSalt = randomBytes(16).toString('hex');
  const longHash = `scrypt$${longSalt}$${scryptSync(longPassword, longSalt, 64).toString('hex')}`;
  const legacy = await models.Usuario.create({ nombre: 'Anterior largo', email: 'long@example.com', password: longHash, rol: 'Operador' });
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: legacy.email, password: longPassword } })).status, 200);
  assert.equal(legacy.password, longHash);
});

test('JWT inválido, expirado, algoritmo equivocado, cuenta eliminada y rol actualizado', async t => {
  const { models, request, admin, token } = await fixture(t);
  const expired = jwt.sign({}, config.jwtSecret, { algorithm: 'HS256', subject: String(admin.id), issuer: 'senati-inventario', audience: 'senati-admin', expiresIn: -1 });
  const wrong = jwt.sign({}, config.jwtSecret, { algorithm: 'HS384', subject: String(admin.id), issuer: 'senati-inventario', audience: 'senati-admin', expiresIn: '1h' });
  for (const value of ['incorrecto', expired, wrong, signToken(admin, { ...config, jwtSecret: randomBytes(48).toString('hex') })]) {
    assert.equal((await request('/api/productos', { token: value })).status, 401);
  }
  assert.equal((await request('/api/auth/me', { token })).status, 200);
  admin.rol = 'Operador';
  assert.equal((await request('/api/usuarios', { token })).status, 403);
  models.users.delete(admin.id);
  assert.equal((await request('/api/productos', { token })).status, 401);
});

test('Helmet, CORS limitado y bloqueo de intentos excesivos', async t => {
  const { request } = await fixture(t, { authLimit: 2 });
  for (const origin of ['http://localhost:5173', 'http://127.0.0.1:5173']) {
    const response = await request('/', { origin });
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('x-powered-by'), null);
  }
  assert.equal((await request('/', { origin: 'http://malicioso.example' })).status, 403);
  const options = { method: 'POST', body: { email: 'unknown@example.com', password: 'incorrecta' } };
  assert.equal((await request('/api/auth/login', options)).status, 401);
  assert.equal((await request('/api/auth/login', options)).status, 401);
  assert.equal((await request('/api/auth/login', options)).status, 429);
  assert.throws(() => securityConfig({ jwtSecret: 'corto' }), /JWT_SECRET/);
});
