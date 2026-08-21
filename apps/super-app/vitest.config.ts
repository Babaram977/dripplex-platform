import path from 'node:path';
import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The same shape the other six apps in this monorepo already use
 * (operations-console, customer-web, merchant-portal, rider-portal,
 * admin-portal, driver-portal). super-app was the only one with no test runner
 * at all — which is why a Back button that trapped every customer inside their
 * profile could ship, be deployed, and only be found by a person using the app.
 *
 * Deliberately NOT loading vite.config.ts: that pulls in Tailwind and the Figma
 * asset resolver, neither of which a test needs, and both of which slow every
 * run. The `@` alias is the only part of it tests actually depend on.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, './src'),
    },
  },
});
