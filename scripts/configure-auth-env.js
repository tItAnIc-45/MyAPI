const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
const file = path.join(__dirname, '..', '.env');
let contents = fs.readFileSync(file, 'utf8');
const values = dotenv.parse(contents);
const additions = [];
if (!values.JWT_SECRET) additions.push(`JWT_SECRET=${randomBytes(64).toString('hex')}`);
else if (Buffer.byteLength(values.JWT_SECRET) < 32) throw new Error('JWT_SECRET existente demasiado corto. Revisa la configuración local.');
if (!values.JWT_EXPIRES_IN) additions.push('JWT_EXPIRES_IN=1h');
if (additions.length) {
  // Reemplazar únicamente asignaciones vacías; conservar el resto del entorno.
  for (const assignment of additions) {
    const key = assignment.split('=')[0];
    const pattern = new RegExp(`^${key}=.*$`, 'm');
    if (pattern.test(contents)) contents = contents.replace(pattern, assignment);
    else contents += `\n${assignment}\n`;
  }
  fs.writeFileSync(file, contents, { mode: 0o600 });
}
console.log('Variables JWT locales configuradas; valores omitidos.');
