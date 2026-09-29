/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Little Atlas is served from a GitHub Pages *project* page
// (https://<user>.github.io/little-atlas/), so the base path must match
// the repo name. Override with VITE_BASE_PATH if you fork/rename it.
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH ?? '/little-atlas/',
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '**/.{idea,git,cache,output,temp}/**'],
    css: true
  }
})
