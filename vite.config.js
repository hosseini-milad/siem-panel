import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1': { target: process.env.SIEM_API_TARGET ?? 'http://127.0.0.1:8000', changeOrigin: false },
    },
  },
});
