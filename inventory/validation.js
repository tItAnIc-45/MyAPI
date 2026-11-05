class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (message) => { throw new HttpError(400, message); };
function object(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Se requiere un objeto JSON.');
  return value;
}
function text(value, name, max = 255, required = true) {
  if (!required && (value == null || value === '')) return '';
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(`${name}: texto requerido, máximo ${max} caracteres.`);
  return value.trim();
}
function number(value, name, { min = 0, max = 2147483647, integer = true } = {}) {
  if (!['string', 'number'].includes(typeof value) || String(value).trim() === '' ||
    !Number.isFinite(Number(value)) || Number(value) < min || Number(value) > max ||
    (integer && !Number.isInteger(Number(value)))) fail(`${name}: número ${integer ? 'entero ' : ''}entre ${min} y ${max}.`);
  return Number(value);
}
const id = (value, name = 'ID') => number(value, name, { min: 1 });
function email(value) {
  const result = text(value, 'Email').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) fail('Email inválido.');
  return result;
}
function validate(resource, body, updating = false, allowAdmin = false) {
  const b = object(body);
  if (resource === 'productos') {
    const precio = number(b.precio, 'Precio', { max: 99999999.99, integer: false });
    if (Math.abs(precio * 100 - Math.round(precio * 100)) > 0.00001) fail('Precio: máximo dos decimales.');
    if ('stock' in b && (updating || Number(b.stock) !== 0)) fail('El stock se modifica únicamente desde Kardex. Omite el campo stock.');
    return { nombre: text(b.nombre, 'Nombre'), descripcion: text(b.descripcion, 'Descripción', 2000, false), precio,
      categoriaId: id(b.categoriaId, 'Categoría'), proveedorId: id(b.proveedorId, 'Proveedor') };
  }
  if (resource === 'categorias') return { nombre: text(b.nombre, 'Nombre', 120), descripcion: text(b.descripcion, 'Descripción', 2000, false) };
  if (resource === 'proveedores') return { razon_social: text(b.razon_social, 'Razón social'), contacto: text(b.contacto, 'Contacto', 255, false),
    telefono: text(b.telefono, 'Teléfono', 40, false), email: email(b.email) };
  if (resource === 'usuarios') {
    const datos = { nombre: text(b.nombre, 'Nombre'), email: email(b.email), rol: b.rol || 'Operador' };
    if (!['Operador', 'Administrador'].includes(datos.rol) || (!allowAdmin && datos.rol !== 'Operador')) fail('Rol no permitido.');
    if (!updating || b.password) {
      if (typeof b.password !== 'string' || b.password.length < 8 || Buffer.byteLength(b.password, 'utf8') > 72) fail('La contraseña requiere al menos 8 caracteres y máximo 72 bytes UTF-8.');
      datos.password = b.password;
    }
    return datos;
  }
  fail('Recurso inválido.');
}
module.exports = { HttpError, fail, object, text, number, id, email, validate };
