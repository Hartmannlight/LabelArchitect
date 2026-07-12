import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/v1': {
        target: process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
