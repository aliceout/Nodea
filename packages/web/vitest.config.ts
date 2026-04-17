import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node env is fine — globalThis.crypto / crypto.subtle are available in
    // Node 20+ with full WebCrypto API. No need for jsdom for these tests.
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    testTimeout: 10_000,
  },
});
