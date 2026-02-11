#!/usr/bin/env node

/**
 * Script cross-platform para gerar tipos da API.
 *
 * Uso:
 *   node scripts/generate-api.mjs                    # usa backend local (localhost:8000)
 *   node scripts/generate-api.mjs ./openapi.json     # usa arquivo local (CI)
 *
 * Em CI, o backend gera openapi.json como artifact e este script le o arquivo.
 */

import { execSync } from 'node:child_process'

const inputArg = process.argv[2]

if (inputArg) {
  process.env.OPENAPI_INPUT = inputArg
  console.log(`[generate-api] Usando input: ${inputArg}`)
} else {
  console.log('[generate-api] Usando input padrao: http://localhost:8000/openapi.json')
}

try {
  execSync('npx openapi-ts', { stdio: 'inherit', env: process.env })
  console.log('[generate-api] Tipos gerados com sucesso em src/types/generated/')
} catch {
  console.error('[generate-api] Falha ao gerar tipos. Verifique se o backend esta rodando ou se o arquivo existe.')
  process.exit(1)
}
