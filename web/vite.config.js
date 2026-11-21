import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5178,
    host: '127.0.0.1',
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:4177',
      '/ws': {
        target: 'ws://127.0.0.1:4177',
        ws: true,
      },
    },
  },
});