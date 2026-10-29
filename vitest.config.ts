import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/fast/**/*.test.ts'],
    globals: false,
    allowOnly: false,
    passWithNoTests: false,
    retry: 0,
    maxWorkers: 2,
    testTimeout: 5000,
    hookTimeout: 10000,
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
  },
});
