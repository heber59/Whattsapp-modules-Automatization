import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { affected } from './affected.mjs';

test('documentación no ejecuta servicios; frontend no ejecuta backend', () => {
  assert(Object.values(affected(['README.md', 'docs/backend.md', '.ai'])).every((value) => !value));
  const result = affected(['apps/web/src/app/page.tsx']);
  assert(result.web && result.audit);
  assert(!result.api && !result.worker && !result.contracts);
});

test('separación de API y worker, incluyendo eliminación y cambios compartidos', () => {
  const api = affected(['apps/api/src/health/health.service.ts']);
  assert(api.api && !api.worker && !api.web);
  const auth = affected(['apps/api/src/shared/auth/access.guard.ts', 'apps/api/test/security.e2e-spec.ts', 'apps/api/src/modules/auth/auth.service.ts']);
  assert(auth.api && !auth.worker && !auth.web);
  const worker = affected(['apps/api/src/worker.ts']);
  assert(worker.worker && !worker.api && !worker.web);
  const shared = affected(['apps/api/src/shared/config/config.ts']);
  assert(shared.api && shared.worker && !shared.web);
});

test('contratos y configuración global incluyen sus consumidores', () => {
  for (const file of ['packages/contracts/src/index.ts', 'pnpm-lock.yaml']) {
    const result = affected([file]);
    assert(result.web && result.api && result.worker && result.contracts);
  }
  assert(Object.values(affected(['.github/workflows/ci.yml'])).every(Boolean));
});

test('infraestructura local afecta backend; varios cambios acumulan servicios', () => {
  const infra = affected(['compose.yaml']);
  assert(infra.api && infra.worker && !infra.web);
  const mixed = affected(['apps/api/src/main.ts', 'apps/web/next.config.mjs']);
  assert(mixed.api && mixed.web && !mixed.worker);
});

test('el detector CLI usa el historial y escribe salidas de GitHub Actions', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'wa-affected-'));
  const git = (...args) => execFileSync('git', args, { cwd: directory, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = () => {
    git('add', '.');
    git('-c', 'user.name=CI', '-c', 'user.email=ci@example.invalid',
      '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'test');
    return git('rev-parse', 'HEAD');
  };
  try {
    git('init');
    writeFileSync(path.join(directory, 'README.md'), 'inicio');
    const base = commit();
    mkdirSync(path.join(directory, 'apps/web/src'), { recursive: true });
    writeFileSync(path.join(directory, 'apps/web/src/page.tsx'), 'frontend');
    const head = commit();
    const outputPath = path.join(directory, 'outputs');
    const script = fileURLToPath(new URL('./affected.mjs', import.meta.url));
    const output = execFileSync(process.execPath, [script], {
      cwd: directory, encoding: 'utf8',
      env: { ...process.env, GITHUB_EVENT_NAME: 'pull_request', DIFF_BASE: base, DIFF_HEAD: head, GITHUB_OUTPUT: outputPath },
    });
    assert(output.includes('web=true\n'));
    assert(output.includes('api=false\n'));
    assert.equal(readFileSync(outputPath, 'utf8'), output.trimEnd() + '\n');
  } finally {
    assert(directory.startsWith(path.join(tmpdir(), 'wa-affected-')));
    rmSync(directory, { recursive: true, force: true });
  }
});
