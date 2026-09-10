/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';

// Runs tests through the app's SWC transform (same plugin as vite.config.ts).
// We declare the plugin here rather than importing vite.config.ts: Vitest's
// config loader bundles the config with esbuild's require path, which cannot
// load the ESM-only vite.config.ts / plugin chain.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.tsx', 'src/**/*.test.ts'],
  },
});
