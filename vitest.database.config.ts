import { defineConfig } from 'vitest/config';
import base from './vitest.config.js';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['tests/integration/**/*.test.ts'],
    maxWorkers: 1,
    fileParallelism: false,
    testTimeout: 180000,
    hookTimeout: 180000,
  },
});
