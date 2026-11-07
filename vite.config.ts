import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base keeps the same build usable from the Tauri asset protocol,
// the Capacitor https://localhost origin and a normal web server.
const allowedHost = process.env.VITE_ALLOWED_HOST

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: allowedHost ? [allowedHost] : undefined,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    chunkSizeWarningLimit: 900,
  },
})
