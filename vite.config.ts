import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build can be served from any domain / sub-path (white-label hosting).
export default defineConfig({
  base: './',
  plugins: [react()],
})
