import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Capacitor Android 需要相对路径，否则 webview 找不到静态资源
// 开发模式通过 server.proxy 代理 API；生产模式通过 VITE_API_BASE_URL 直连后端
// https://capacitorjs.com/docs/reference/config/vite

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  server: {
    port: 5173,
    host: '127.0.0.1',
    strictPort: false,
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Capacitor Android webview 兼容：避免 chunk 哈希导致的缓存问题
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
})
