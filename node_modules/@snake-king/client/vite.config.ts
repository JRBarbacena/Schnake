import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      '@snake-king/shared': path.resolve(__dirname, '../shared/src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
