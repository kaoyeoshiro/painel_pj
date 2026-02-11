# State Architecture Audit — Relatorio Final

> Auditoria realizada em 2026-02-11, branch `feat/tailadmin-dashboard`

---

## Resumo Executivo

A arquitetura de estado do frontend esta **madura e bem separada**. Os dois stores Zustand (auth + UI) nao guardam dados de API alem do justificado (auth bootstrap). TanStack Query e a fonte unica para server state. Os problemas encontrados sao de **inconsistencia e codigo morto**, nao anti-patterns graves.

| Metrica | Valor |
|---------|-------|
| Zustand stores | 2 (auth-store, ui-store) |
| Query hooks centrais | 16 queries + 7 mutations |
| Paginas com SSE/streaming | 7 |
| Duplicacoes reais Zustand↔Query | 0 (zero) |
| Codigo morto encontrado | 3 itens |
| Subscricoes nao-seletivas corrigidas | 5 arquivos |

---

## Problemas Encontrados

### 1. Hook morto `useCurrentUser()` (REMOVIDO)

**Arquivo**: `hooks/useQueries.ts:34-41`
**Problema**: Hook Query que buscava GET `/auth/me` — mesmo endpoint que `auth-store.loadUser()`. Criava **fonte dupla de verdade potencial**. Nunca chamado em nenhuma pagina de producao.
**Acao**: Removido. Adicionado comentario explicando que auth vive exclusivamente no Zustand.

### 2. Hook deprecado `useApiQuery` (REMOVIDO)

**Arquivo**: `hooks/useApiQuery.ts` (90 linhas)
**Problema**: Hook legado com useState para data/loading/error. Marcado `@deprecated` mas o arquivo ainda existia.
**Acao**: Arquivo deletado. Mock removido de `test/setup.ts`. Referencia em `assistencia/README.md` atualizada.

### 3. Metodo `invalidateAll()` — bazuca de cache (REMOVIDO)

**Arquivo**: `hooks/useQueries.ts:434-435`
**Problema**: `useInvalidateQueries()` expunha `invalidateAll()` que chamava `queryClient.invalidateQueries()` sem filtro. Nunca usado em producao mas disponivel.
**Acao**: Removido. Mocks atualizados em `test/setup.ts` e `GeradorPecasPage.test.tsx`.

### 4. Subscricoes Zustand nao-seletivas (CORRIGIDO)

5 arquivos usavam `const { user } = useAuthStore()` (re-render em qualquer mudanca do store) em vez de `useAuthStore(s => s.user)` (re-render somente quando `user` muda).

| Arquivo | Antes | Depois |
|---------|-------|--------|
| `AuthGuard.tsx:12` | `const { user, isLoading, initialize } = useAuthStore()` | 3 subscricoes seletivas |
| `LoginPage.tsx:17` | `const { user, login } = useAuthStore()` | 2 subscricoes seletivas |
| `DashboardPageV2.tsx:177` | `const { user } = useAuthStore()` | `useAuthStore(s => s.user)` |
| `DashboardPage.tsx:11` | `const { user } = useAuthStore()` | `useAuthStore(s => s.user)` |
| `WelcomeHeader.tsx:19` | `const { user } = useAuthStore()` | `useAuthStore(s => s.user)` |

### 5. Import nao utilizado `apiRequest` (REMOVIDO)

**Arquivo**: `hooks/useQueries.ts:19`
**Problema**: `apiRequest` era importado para `useCurrentUser()`. Apos remocao do hook, ficou sem uso.
**Acao**: Import removido.

---

## O Que NAO Precisou Mudar

A auditoria confirmou que varios padroes ja estao corretos:

| Padrao | Status | Evidencia |
|--------|--------|-----------|
| Nenhum store Zustand guarda dados de API | OK | auth-store.user e excecao justificada (bootstrap) |
| TanStack Query e fonte unica de server state | OK | 16 hooks centrais + 7 queries diretas nas paginas |
| Query keys factory com filtros estaveis | OK | `stableFilterKey()` em `query-client.ts` |
| Invalidation especifica nas mutations | OK | Todas 5 mutations com `onSuccess` invalidam keys especificas |
| SSE com invalidation ao completar | OK | GeradorPecas invalida `geradorHistorico` apos stream |
| ui-store sem dados de servidor | OK | Apenas sidebarOpen + sidebarCollapsed |
| Hook `useSSE` disponivel | OK | Exportado via `hooks/index.ts` |

---

## Mudancas Aplicadas

| Arquivo | Tipo | Descricao |
|---------|------|-----------|
| `hooks/useQueries.ts` | Remocao | `useCurrentUser()` removido, `invalidateAll()` removido, import `apiRequest` removido |
| `hooks/useApiQuery.ts` | Deletado | Arquivo inteiro (deprecated, nao usado) |
| `test/setup.ts` | Limpeza | Mock de `useApiQuery` removido, mock de `useCurrentUser` removido, `invalidateAll` removido de mock |
| `pages/gerador-pecas/__tests__/GeradorPecasPage.test.tsx` | Limpeza | `invalidateAll` removido de mock |
| `components/layout/AuthGuard.tsx` | Refactor | Subscricoes seletivas Zustand |
| `pages/login/LoginPage.tsx` | Refactor | Subscricoes seletivas Zustand |
| `pages/dashboard/DashboardPageV2.tsx` | Refactor | Subscricao seletiva Zustand |
| `pages/dashboard/DashboardPage.tsx` | Refactor | Subscricao seletiva Zustand |
| `pages/dashboard/WelcomeHeader.tsx` | Refactor | Subscricao seletiva Zustand |
| `pages/assistencia/README.md` | Doc | Referencia a useApiQuery → useQuery |

### Documentos criados

| Documento | Conteudo |
|-----------|----------|
| `Design System/STATE_AUDIT_INVENTORY.md` | Inventario completo: stores, queries, SSE, duplicacoes |
| `Design System/STATE_ARCHITECTURE_RULES.md` | Regras objetivas para gestao de estado |
| `Design System/STATE_AUDIT_REPORT.md` | Este relatorio |

---

## Validacao

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | OK — sem erros |
| `npx eslint` (arquivos modificados) | OK — 1 erro pre-existente em setup.ts (require) |
| `npm run build` | OK — 10.61s, sem warnings |
| Testes GeradorPecas (9) | OK — 9/9 passam |
| Testes globais (245) | 161 passam, 84 falham (pre-existente: harmonizacao visual) |

---

## Decisoes de Arquitetura

### 1. Auth fica no Zustand (excecao justificada)

O `auth-store.loadUser()` faz fetch direto (sem TanStack Query). Motivo:
- Auth precisa resolver ANTES de qualquer Query hook
- Boot sequence e atomico (token → loadUser → status)
- Validacao com JSON Schema em runtime
- Nao precisa de cache/staleTime

**Regra**: NAO criar hooks Query para `/auth/me`.

### 2. SSE permanece com estado local

Streaming usa useState + useRef no componente. Motivo:
- Chunks incrementais de alta frequencia
- Dado final vai para o Query cache via invalidation
- Hook `useSSE` disponivel para novas implementacoes

### 3. Paginas podem usar useQuery direto

Paginas como ExtratorAutos e Matriculas usam `useQuery` direto (nao via useQueries.ts). Motivo:
- Queries especificas de uma pagina
- Usam `queryKeys` do factory (cache correto)
- Centralizar tudo em um arquivo de 450+ linhas nao escala

---

## Trade-offs

| Decisao | Beneficio | Custo |
|---------|-----------|-------|
| Nao migrar SSE para useSSE | Zero risco de regressao | Paginas mantêm implementacao ad-hoc |
| Nao criar `features/<dominio>/` | Menos indireção | useQueries.ts cresce com novos dominios |
| Nao adicionar optimistic updates | Simplicidade | Mutations esperam resposta do servidor |
| Remover `invalidateAll` | Previne uso errado | Se necessario no futuro, recria-se |

---

## Backlog

### Curto prazo

1. **Corrigir 84 testes pre-existentes** — falham por mudanca de heading→span no BreadcrumbBar
2. **Migrar Matriculas para refetchInterval** — hoje usa setInterval manual via useRef

### Medio prazo

3. **Migrar GeradorPecas para useReducer** — ~70 useState podem ser consolidados em state machine
4. **Adotar useSSE nas paginas existentes** — gradual, comecando por paginas simples (Assistencia)
5. **Criar domain hooks** se algum dominio passar de 10 hooks — `features/<dominio>/queries.ts`

### Longo prazo

6. **Optimistic updates** em mutations de alta frequencia (feedback, exclusao)
7. **Filtros na URL** — persistir filtros de tabelas em search params para compartilhamento
