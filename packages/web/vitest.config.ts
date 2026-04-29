import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Node env is fine — globalThis.crypto / crypto.subtle are available in
    // Node 20+ with full WebCrypto API. No need for jsdom for these tests.
    environment: 'node',
    // Pick up shared-package tests too so the workspace's pure helpers
    // (`@nodea/shared/threads`, etc.) get exercised without a separate
    // test runner. Shared has no React deps so the same node env works.
    include: [
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
      '../shared/src/**/*.test.ts',
    ],
    testTimeout: 10_000,
  },
});
