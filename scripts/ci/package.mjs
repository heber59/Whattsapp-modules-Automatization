import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const service = process.argv[2];
if (!['web', 'api', 'worker'].includes(service)) throw new Error('Servicio inválido');
const delivery = path.join(root, '.delivery');
const destination = path.join(delivery, service);
mkdirSync(delivery, { recursive: true });
rmSync(destination, { recursive: true, force: true });

if (service === 'web') {
  const standalone = path.join(root, 'apps/web/.next/standalone');
  if (!existsSync(standalone)) throw new Error('Ejecuta el build del frontend antes de empaquetar');
  cpSync(standalone, destination, { recursive: true, dereference: true });
  cpSync(path.join(root, 'apps/web/.next/static'), path.join(destination, 'apps/web/.next/static'), { recursive: true });
  const assets = path.join(root, 'apps/web/public');
  if (existsSync(assets)) cpSync(assets, path.join(destination, 'apps/web/public'), { recursive: true });
} else {
  if (!existsSync(path.join(root, 'apps/api/dist/main.js'))) throw new Error('Ejecuta el build del backend antes de empaquetar');
  execFileSync('pnpm', ['--filter', '@wa/api', 'deploy', '--legacy', '--prod', destination], { cwd: root, stdio: 'inherit' });
}

function rejectSecrets(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === '.env' || entry.name.startsWith('.env.')) throw new Error('El artefacto contiene un archivo de entorno');
    if (entry.isDirectory() && entry.name !== 'node_modules') rejectSecrets(path.join(directory, entry.name));
  }
}
rejectSecrets(destination);
const release = {
  service,
  revision: process.env.GITHUB_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  entrypoint: service === 'web' ? 'apps/web/server.js' : service === 'api' ? 'dist/main.js' : 'dist/worker.js',
};
writeFileSync(path.join(destination, 'release.json'), JSON.stringify(release, null, 2) + '\n');
execFileSync('tar', ['-czf', path.join(delivery, service + '.tar.gz'), '-C', destination, '.'], { stdio: 'inherit' });
rmSync(destination, { recursive: true, force: true });
console.log('Artefacto generado: .delivery/' + service + '.tar.gz');
