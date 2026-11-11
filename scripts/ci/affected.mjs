import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const everything = () => ({
  web: true, api: true, worker: true, contracts: true, tooling: true, audit: true,
});

export function affected(files) {
  const result = Object.fromEntries(Object.keys(everything()).map((key) => [key, false]));
  const globalFiles = new Set([
    'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.npmrc',
    '.nvmrc', 'tsconfig.base.json', 'eslint.config.mjs',
  ]);
  for (const file of files) {
    if (globalFiles.has(file) || file.startsWith('.github/workflows/') || file.startsWith('scripts/ci/')) {
      return everything();
    }
    if (file.startsWith('apps/web/')) result.web = true;
    if (file.startsWith('packages/contracts/')) {
      result.contracts = result.web = result.api = result.worker = true;
    }
    if (file.startsWith('apps/api/')) {
      const apiOnly = file.startsWith('apps/api/src/health/')
        || file.startsWith('apps/api/src/shared/auth/')
        || file.startsWith('apps/api/src/modules/auth/')
        || file.startsWith('apps/api/src/modules/identity/')
        || file.startsWith('apps/api/src/modules/businesses/')
        || file === 'apps/api/test/security.e2e-spec.ts'
        || ['apps/api/src/main.ts', 'apps/api/src/configure-http.ts', 'apps/api/src/app.module.ts', 'apps/api/test/health.e2e-spec.ts'].includes(file);
      const workerOnly = [
        'apps/api/src/worker.ts', 'apps/api/src/worker.module.ts',
        'apps/api/src/system-worker.service.ts', 'apps/api/test/worker.e2e-spec.ts',
      ].includes(file);
      if (!workerOnly) result.api = true;
      if (!apiOnly) result.worker = true;
    }
    if (file === 'compose.yaml' || file === '.env.example') {
      result.api = result.worker = true;
    }
  }
  result.audit = result.web || result.api || result.worker || result.contracts;
  return result;
}

function detect() {
  const { DIFF_BASE: base, DIFF_HEAD: head, GITHUB_EVENT_NAME: event } = process.env;
  if (event === 'workflow_dispatch' || !/^[a-f0-9]{40}$/.test(base ?? '')
    || /^0+$/.test(base) || !/^[a-f0-9]{40}$/.test(head ?? '')) return everything();
  try {
    const comparisonBase = event === 'pull_request'
      ? execFileSync('git', ['merge-base', base, head], { encoding: 'utf8' }).trim()
      : base;
    const files = execFileSync('git', ['diff', '--no-renames', '--name-only', '-z', comparisonBase, head], {
      encoding: 'utf8',
    }).split('\0').filter(Boolean);
    return affected(files);
  } catch {
    console.warn('Could not determine affected services; all services will be checked.');
    return everything();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = detect();
  const output = Object.entries(result).map(([key, value]) => key + '=' + value).join('\n') + '\n';
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  console.log(output);
}
