import { fileURLToPath } from 'node:url';
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import globals from 'globals';

const typedFiles = ['apps/**/*.{ts,tsx}', 'packages/contracts/**/*.ts'];

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', '.delivery/**', 'apps/web/next-env.d.ts']),
  ...tseslint.configs.recommended.map((config) => ({ ...config, files: typedFiles })),
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    languageOptions: { globals: globals.browser },
    settings: { next: { rootDir: fileURLToPath(new URL('./apps/web/', import.meta.url)) } },
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      ...reactHooks.configs.flat.recommended.rules,
    },
  },
  { files: ['apps/api/**/*.ts'], languageOptions: { globals: globals.node } },
  {
    ...js.configs.recommended,
    files: ['scripts/**/*.mjs', 'eslint.config.mjs', 'apps/web/next.config.mjs'],
    languageOptions: { globals: globals.node },
  },
]);
