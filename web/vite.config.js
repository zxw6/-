import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5178,
    host: '127.0.0.1',
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': 'http://127.0.0.1:4177',
      '/ws': {
        target: 'ws://127.0.0.1:4177',
        ws: true,
      },
    },
  },
  /** NATAPP 免费隧道有「每分钟连接数」上限；dev 会拆成大量模块请求，易触发限流 */
  preview: {
    port: 5178,
    host: '127.0.0.1',
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': 'http://127.0.0.1:4177',
      '/ws': {
        target: 'ws://127.0.0.1:4177',
        ws: true,
      },
    },
  },
});