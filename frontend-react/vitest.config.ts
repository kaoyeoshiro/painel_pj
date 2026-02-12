import { defineConfig } from 'vitest/config'
import path from 'path'

// Configuracao do Vitest para testes unitarios
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    exclude: [
      '**/e2e/**',
      '**/e2e-real/**',
      '**/node_modules/**',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
