import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the built site works from any GitHub Pages sub-path.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { chunkSizeWarningLimit: 800 },
});
