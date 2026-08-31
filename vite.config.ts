import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { knollDevApi } from './vite/dev-api.ts'

export default defineConfig({
  plugins: [react(), knollDevApi()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
})
