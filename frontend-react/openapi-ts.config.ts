import { defineConfig } from '@hey-api/openapi-ts'

/**
 * Configuracao de geracao de tipos a partir do OpenAPI schema.
 *
 * Em dev local, o schema e lido de http://localhost:8000/openapi.json (backend rodando).
 * Em CI ou modo offline, definir a env var OPENAPI_INPUT apontando para o arquivo local:
 *   OPENAPI_INPUT=./openapi.json npx openapi-ts
 */
const input = process.env.OPENAPI_INPUT ?? 'http://localhost:8000/openapi.json'

export default defineConfig({
  client: '@hey-api/client-fetch',
  input,
  output: {
    path: 'src/types/generated',
    format: 'prettier',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/schemas',
  ],
})
