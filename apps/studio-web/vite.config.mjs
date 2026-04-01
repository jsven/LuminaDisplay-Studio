import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const port = Number(process.env.PORT || 4173);

export default defineConfig({
  build: {
    emptyOutDir: true,
    outDir: 'dist',
  },
  plugins: [react()],
  preview: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    host: '127.0.0.1',
    port,
    strictPort: true,
  },
});
