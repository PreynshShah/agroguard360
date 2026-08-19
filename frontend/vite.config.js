import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Vite configuration for the AGROGUARD 360 frontend.
// Run `npm run dev -- --open` if you want the browser launched automatically.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: false,
    host: true, // exposes the dev server on your LAN, useful for testing on a tablet
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
