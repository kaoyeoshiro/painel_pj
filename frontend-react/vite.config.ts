import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// Configuracao do Vite para o Portal PGE-MS
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8000',
      '/users': 'http://localhost:8000',
      '/admin/api': 'http://localhost:8000',
      '/api': 'http://localhost:8000',
      '/assistencia/api': 'http://localhost:8000',
      '/matriculas/api': 'http://localhost:8000',
      '/gerador-pecas/api': 'http://localhost:8000',
      '/pedido-calculo/api': 'http://localhost:8000',
      '/prestacao-contas/api': 'http://localhost:8000',
      '/relatorio-cumprimento/api': 'http://localhost:8000',
      '/cumprimento-beta/api': 'http://localhost:8000',
      '/classificador/api': 'http://localhost:8000',
      '/bert-training/api': 'http://localhost:8000',
      '/extrator-autos/api': 'http://localhost:8000',
      '/gerador-pecas-admin': 'http://localhost:8000',
      '/pedido-calculo-admin': 'http://localhost:8000',
      '/logo': 'http://localhost:8000',
      '/static': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
