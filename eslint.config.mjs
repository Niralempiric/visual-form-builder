import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';

export default defineConfig([
  globalIgnores(['**/node_modules/**', '**/.next/**', '**/dist/**', '**/next-env.d.ts',
    '**/coverage/**', '**/test-results/**', '**/playwright-report/**']),
  {
    files: ['**/*.{js,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: { globals: globals.node },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['infra/replica-set.js'],
    languageOptions: { globals: { Mongo: 'readonly', print: 'readonly', quit: 'readonly', sleep: 'readonly' } },
  },
]);
