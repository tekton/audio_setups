/**
 * Builds the local-only (no backend) site into dist/: a copy of frontend/ without dev-only files,
 * with js/config.js switched to localOnly. Usage: npm run build:local
 */

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'frontend');
const out = path.join(root, 'dist');
const SKIP = new Set(['tests', 'test-touch.html', 'Dockerfile', 'nginx.conf']);

function buildLocal() {
  fs.rmSync(out, { recursive: true, force: true });
  fs.cpSync(src, out, { recursive: true, filter: (file) => !SKIP.has(path.relative(src, file)) });

  const configPath = path.join(out, 'js', 'config.js');
  const config = fs.readFileSync(configPath, 'utf8');
  if (!config.includes('localOnly: false')) throw new Error('js/config.js no longer contains "localOnly: false"');
  fs.writeFileSync(configPath, config.replace('localOnly: false', 'localOnly: true'));
  return out;
}

if (require.main === module) console.log(`Built local-only site in ${path.relative(root, buildLocal())}/`);

module.exports = { buildLocal };
