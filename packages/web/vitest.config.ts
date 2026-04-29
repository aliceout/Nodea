import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // Mirror `vite.config.js` aliases so source files importing
    // `@/core/...` etc. resolve under vitest. Vitest doesn't pick
    // up `vite.config.js`'s `resolve.alias` block automatically
    // when a dedicated `vitest.config.ts` is present.
    alias: {
      '@': path.resolve(here, 'src'),
      '@app': path.resolve(here, 'src/app'),
      '@core': path.resolve(here, 'src/core'),
      '@i18n': path.resolve(here, 'src/i18n'),
      '@ui': path.resolve(here, 'src/ui'),
    },
  },
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
