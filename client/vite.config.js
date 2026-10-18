import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // The static live demo is published at https://jad-obeidd.github.io/smartcart/
  base: process.env.VITE_DEMO === 'true' ? '/smartcart/' : '/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
});
