/// <reference types="vitest" />
/**
 * PHASE 2 §P2.B — Frontend Vitest configuration.
 *
 * Activates the frontend unit-test infrastructure (was installed but never
 * configured). Two environments:
 *   • "happy-dom" (default, fast) for pure-logic tests (helpers, engines,
 *     recommendation scoring, realisable-value math)
 *   • "jsdom" (opt-in via `// @vitest-environment jsdom`) for React
 *     component tests that need a DOM
 *
 * Module alias `@/* → src/*` is inherited from tsconfig.json paths but is
 * also declared here so vitest doesn't depend on TS path resolution.
 */
import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    environmentMatchGlobs: [
      ['src/features/**/components/__tests__/**', 'jsdom'],
      ['src/components/**/__tests__/**', 'jsdom'],
    ],
    setupFiles: ['./src/test/setup.ts'],
    include: [
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
    exclude: ['node_modules', 'dist', '.tanstack', 'src/openapi-ts/**'],
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['src/features/farmerDashboard/market-intelligence/**'],
      exclude: [
        '**/__tests__/**',
        '**/*.test.{ts,tsx}',
        '**/index.ts',
        '**/types.ts',
      ],
    },
  },
});
