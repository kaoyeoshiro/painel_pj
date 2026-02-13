import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Desabilitado: regra nova do react-hooks que gera falsos positivos
      // quando hooks retornam objetos que misturam estado e refs (padrao vm = useHook()).
      // A regra interpreta qualquer acesso a vm.prop como acesso a ref durante render.
      'react-hooks/refs': 'off',
    },
  },
  // ------------------------------------------------------------------
  // Regras de regressao: proibe fetch() direto e acesso a token em pages
  // ------------------------------------------------------------------
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message:
            'Use o cliente centralizado de src/lib/api.ts (apiRequest / createApiClient). ' +
            'Se for streaming (SSE), use getToken() para o header Authorization.',
        },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/api.ts', 'src/**/__tests__/**', 'src/**/*.test.{ts,tsx}', 'src/**/*.spec.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='localStorage'][callee.property.name='getItem'][arguments.0.value='access_token']",
          message:
            'Use getToken() de src/lib/api.ts em vez de localStorage.getItem("access_token").',
        },
      ],
    },
  },
])
