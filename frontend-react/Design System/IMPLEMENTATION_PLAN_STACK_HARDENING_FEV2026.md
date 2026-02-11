# Plano de Implementacao - Stack Hardening (Fev 2026)

> Plano detalhado para endurecimento da stack frontend React do Portal PGE-MS.
> Cobre tipagem, auth, data fetching, seguranca, testes e governanca.

**Data:** 2026-02-11
**Branch:** `feat/tailadmin-dashboard`

---

## Objetivo Geral

Endurecer a stack frontend eliminando inconsistencias, fortalecendo tipagem e seguranca,
unificando padroes de data fetching e documentando decisoes para o time.

---

## Diagnostico do Estado Atual

| Area | Estado | Problema |
|------|--------|----------|
| Tipos gerados | 22K linhas em `types/generated/`, **0 imports** | Ninguem usa os tipos gerados |
| useApiQuery | 11 paginas usando hook legado | Bifurcacao de padroes |
| Query keys | `Record<string, unknown>` como key | Instabilidade de cache |
| Client HTTP | `throw new Error(message)` | Sem tipo estruturado de erro |
| Auth store | `isLoading + isAuthenticated` | Sem estado "unknown" explicito |
| Markdown | `DOMPurify.sanitize()` sem allowlist | Risco de XSS por tags esquecidas |
| OpenAPI | Hardcoded `localhost:8000` | Nao funciona em CI |
| SSE | Desconectado do TanStack Query | Sem integracao com cache |
| Router | Doc diz "file-based", codigo e manual | Inconsistencia |

---

## Etapas (ordenadas por dependencia)

### Etapa 1 - Client HTTP + ApiError tipado

**Dependencia:** Nenhuma (base para tudo)

**Arquivos:**
- [x] `src/lib/api.ts` — Criar classe `ApiError`, melhorar tratamento de erros

**Mudancas:**
1. Criar `class ApiError extends Error` com campos `status`, `code`, `detail`, `validationErrors`
2. Tratar 401 (redirect), 422 (validation errors), 500 (server error) com tipos distintos
3. Manter compatibilidade com todos os consumidores atuais

**Criterio de aceite:**
- `ApiError` exportada e usada no `apiRequest`
- Propriedades `status` e `detail` acessiveis em catch blocks
- Zero breaking changes para consumidores atuais

**Validacao:** `npx tsc --noEmit`

---

### Etapa 2 - Auth Store com estados explicitos

**Dependencia:** Etapa 1 (ApiError para tratamento no login)

**Arquivos:**
- [x] `src/stores/auth-store.ts` — Adicionar `AuthStatus` enum
- [x] `src/components/layout/AuthGuard.tsx` — Usar novo status

**Mudancas:**
1. Criar tipo `AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'`
2. Substituir `isAuthenticated: boolean` + `isLoading: boolean` por `status: AuthStatus`
3. Manter `isAuthenticated` e `isLoading` como getters derivados (compat)
4. `initialize()` usa `_initialized` flag para evitar chamadas duplicadas
5. AuthGuard usa `status` para decidir rendering

**Criterio de aceite:**
- Boot sequence: unknown → (check token) → authenticated/unauthenticated
- Sem flicker de UI (skeleton ate resolucao)
- `isAuthenticated` e `isLoading` continuam funcionando (compat)

**Validacao:** `npx tsc --noEmit`

---

### Etapa 3 - Query Keys estaveis

**Dependencia:** Nenhuma

**Arquivos:**
- [x] `src/lib/query-client.ts` — Serializar filtros em query keys

**Mudancas:**
1. Criar helper `stableFilterKey(filters)` que serializa deterministicamente
2. Trocar `filters` cru por `stableFilterKey(filters)` em todas as keys com filtros
3. Filtros `undefined` geram key sem o segmento (em vez de `[..., undefined]`)

**Criterio de aceite:**
- Mesmos filtros = mesma key (identidade referencial nao importa)
- `undefined` nao gera segmento extra na key

**Validacao:** `npx tsc --noEmit`

---

### Etapa 4 - Migrar useApiQuery para TanStack Query

**Dependencia:** Etapa 3 (query keys estaveis)

**Arquivos (11 paginas):**
- [x] `src/pages/extrator-autos/ExtratorAutosPage.tsx`
- [x] `src/pages/matriculas/MatriculasPage.tsx`
- [x] `src/pages/prestacao-contas/PrestacaoContasPage.tsx`
- [x] `src/pages/classificador/ClassificadorPage.tsx`
- [x] `src/pages/cumprimento-beta/CumprimentoBetaPage.tsx`
- [x] `src/pages/pedido-calculo/PedidoCalculoPage.tsx`
- [x] `src/pages/relatorio-cumprimento/RelatorioCumprimentoPage.tsx`
- [x] `src/pages/admin/historico-pedido-calculo/HistoricoPedidoCalculoPage.tsx`
- [x] `src/pages/assistencia/AssistenciaPage.tsx`
- [x] `src/hooks/useApiQuery.ts` — Marcar como `@deprecated`
- [x] `src/hooks/index.ts` — Remover re-export de useApiQuery

**Mudancas:**
1. Em cada pagina, substituir `useApiQuery(() => api.get(...))` por `useQuery({ queryKey, queryFn })`
2. Adicionar query keys correspondentes se nao existirem
3. Marcar `useApiQuery` como `@deprecated` com instrucao de usar TanStack Query
4. Remover re-export do index

**Criterio de aceite:**
- 0 imports de `useApiQuery` em paginas (so o arquivo de definicao e test)
- Todos os dados carregam corretamente
- Cache funciona para chamadas repetidas

**Validacao:** `npx tsc --noEmit && npm run build`

---

### Etapa 5 - Hardening Markdown (DOMPurify allowlist)

**Dependencia:** Nenhuma

**Arquivos:**
- [x] `src/hooks/useMarkdown.ts` — Adicionar allowlist estrita
- [x] `src/pages/assistencia/AssistenciaPage.tsx` — Verificar uso direto de DOMPurify

**Mudancas:**
1. Configurar DOMPurify com `ALLOWED_TAGS` e `ALLOWED_ATTR` explicitos
2. Tags permitidas: p, h1-h6, ul, ol, li, strong, em, a, code, pre, blockquote, br, hr, table, thead, tbody, tr, th, td, span, img, sup, sub
3. Atributos permitidos: href, target, rel, src, alt, class
4. Links forcam `target="_blank"` e `rel="noopener noreferrer"`
5. Documentar recomendacoes de CSP como requisito de infra

**Criterio de aceite:**
- Tags perigosas (script, iframe, object, embed, form) removidas
- Links externos seguros (noopener)
- Nenhum atributo on* permitido

**Validacao:** `npx tsc --noEmit`

---

### Etapa 6 - Geracao OpenAPI (dev + CI)

**Dependencia:** Nenhuma

**Arquivos:**
- [x] `openapi-ts.config.ts` — Aceitar env var `OPENAPI_INPUT`
- [x] `package.json` — Adicionar script `generate:api:file`

**Mudancas:**
1. Config le `process.env.OPENAPI_INPUT` com fallback para `http://localhost:8000/openapi.json`
2. Novo script `generate:api:file` que recebe arquivo como argumento
3. Documentar fluxo CI: backend gera openapi.json como artifact → frontend le do arquivo

**Criterio de aceite:**
- `npm run generate:api` continua funcionando com backend local
- `OPENAPI_INPUT=./openapi.json npm run generate:api` funciona com arquivo

**Validacao:** Rodar com backend local

---

### Etapa 7 - SSE + TanStack Query

**Dependencia:** Etapa 1 (ApiError), Etapa 3 (query keys)

**Arquivos:**
- [x] `src/hooks/useSSE.ts` — Adicionar callback `onQueryUpdate`

**Mudancas:**
1. Adicionar opcao `queryClient` e `invalidateKeys` ao hook
2. Quando SSE recebe evento de sucesso, invalida queries relacionadas
3. Documentar politica: "streaming usa setQueryData para chunks, invalidateQueries no fim"

**Criterio de aceite:**
- SSE pode opcionalmente invalidar queries ao completar
- Sem breaking change para usos atuais (opcoes sao opcionais)

**Validacao:** `npx tsc --noEmit`

---

### Etapa 8 - Router: alinhar doc com implementacao

**Dependencia:** Nenhuma (so doc)

**Mudancas:**
- Corrigir FRONTEND_STACK.md: diz "file-based" mas e manual `createRoute`
- Documentar que usamos roteamento manual por escolha (compatibilidade com legacy routing)
- Remover mencao a "file-based routing" do doc

**Criterio de aceite:**
- Doc reflete realidade do codigo

---

### Etapa 9 - Organizacao por dominio

**Dependencia:** Etapa 4 (migracao useApiQuery concluida)

**Mudancas:**
- Mover tipos manuais de `src/types/` para re-export central por dominio
- Criar barrel exports em `src/types/index.ts` para facilitar imports
- NAO mover paginas (incremental demais, risco de quebrar rotas)

**Criterio de aceite:**
- Tipos importaveis via `@/types/gerador-pecas`, `@/types/api`, etc.
- Criar `@/types/index.ts` que re-exporta tudo

**Validacao:** `npx tsc --noEmit`

---

### Etapa 10 - Testes: smoke suite para CI

**Dependencia:** Nenhuma

**Arquivos:**
- [x] `playwright.portal-smoke.config.ts` — Verificar estabilidade
- [x] `e2e/portal.smoke.spec.ts` — Ja existe, estavel

**Mudancas:**
1. Garantir que smoke tests rodam sem backend (mocks ja implementados)
2. Documentar estrategia de testes no FRONTEND_STACK.md

**Criterio de aceite:**
- Smoke tests passam com `npm run test:portal-smoke` (sem backend)

---

### Etapa 11 - Governanca Design System

**Dependencia:** Nenhuma (so doc + tokens)

**Arquivos:**
- [x] `src/lib/designTokens.ts` — Verificar/criar se necessario

**Mudancas:**
1. Documentar regras de uso de cva (quando usar, como nomear variants)
2. Documentar tokens de cor, espacamento, tipografia
3. Regra: "Nunca usar cor hex direto, sempre token ou CSS variable"
4. Regra: "Componentes UI sao atômicos, composicao em components/shared"

**Criterio de aceite:**
- Secao de governanca no FRONTEND_STACK.md

---

### Etapa 12 - Atualizar FRONTEND_STACK.md

**Dependencia:** Todas as etapas anteriores

**Mudancas:**
- Refletir todas as decisoes tomadas
- Novo fluxo de geracao de tipos
- Padroes definitivos
- Seguranca
- Testes

---

### Etapa 13 - Validacao final e relatorio

**Dependencia:** Etapa 12

**Comandos:**
```bash
npx tsc --noEmit
npm run lint
npm run build
npm run test
```

---

## Estrategia Incremental

- Cada etapa e um commit logico
- Etapas 1-3 sao fundacao (podem ser paralelas)
- Etapa 4 depende de 3
- Etapa 5-6 sao independentes
- Etapa 7 depende de 1 e 3
- Etapas 8-11 sao independentes
- Etapa 12 consolida tudo
- Nenhuma etapa quebra funcionalidade existente (backward-compat)
