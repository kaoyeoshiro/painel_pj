# State Audit — Inventario Completo

> Auditoria realizada em 2026-02-11, branch `feat/tailadmin-dashboard`
> Fonte da verdade: codigo-fonte em `src/`

---

## 1. Zustand Stores

### 1.1 auth-store (`src/stores/auth-store.ts`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `status` | `'unknown' \| 'authenticated' \| 'unauthenticated'` | Estado explicito de auth |
| `token` | `string \| null` | JWT (lido/gravado no localStorage via `getToken/setToken`) |
| `user` | `User \| null` | Dados do usuario (`id, username, full_name, role, is_admin`) |
| `error` | `string \| null` | Ultimo erro de login |
| `isAuthenticated` | `boolean` (derivado) | `status === 'authenticated'` |
| `isLoading` | `boolean` (derivado) | `status === 'unknown'` |

| Action | Efeito colateral |
|--------|-----------------|
| `login(username, password)` | POST `/auth/login` → valida schema → salva token → chama `loadUser()` |
| `logout()` | Limpa token, reseta estado, `window.location.href = '/login'` |
| `loadUser()` | GET `/auth/me` → valida schema → atualiza `user` e `status` |
| `initialize()` | Idempotente. Se tem token, chama `loadUser()`. Chamado UMA vez no boot. |

**Persistencia**: Token via `localStorage.getItem('access_token')` (helpers em `lib/api.ts`).
**Inicializacao**: `AuthGuard.tsx:17` chama `initialize()` via `useEffect` no mount.

**Consumidores (8 arquivos de producao)**:

| Arquivo | Campos acessados | Subscricao seletiva? |
|---------|-----------------|---------------------|
| `components/layout/AuthGuard.tsx:12` | `user, isLoading, initialize` | NAO — destructuring |
| `components/layout/Header.tsx:21-23` | `user, logout` | SIM — `s => s.user` |
| `components/layout/Sidebar.tsx:115` | `user` (is_admin) | SIM — `s => s.user` |
| `pages/login/LoginPage.tsx:17` | `user, login` | NAO — destructuring |
| `pages/dashboard/DashboardPageV2.tsx:177` | `user` | NAO — destructuring |
| `pages/dashboard/DashboardPage.tsx:11` | `user` | NAO — destructuring |
| `pages/dashboard/WelcomeHeader.tsx:19` | `user` | NAO — destructuring |
| `pages/cumprimento-beta/CumprimentoBetaPage.tsx:29` | `user` | SIM — `state => state.user` |

### 1.2 ui-store (`src/stores/ui-store.ts`)

| Campo | Tipo | Descricao |
|-------|------|-----------|
| `sidebarOpen` | `boolean` | Mobile sheet sidebar aberta/fechada |
| `sidebarCollapsed` | `boolean` | Desktop sidebar colapsada (icon-only), default `true` |

| Action | Efeito |
|--------|--------|
| `toggleSidebar()` | Inverte `sidebarOpen` |
| `setSidebarOpen(open)` | Seta valor direto |
| `toggleSidebarCollapsed()` | Inverte `sidebarCollapsed` |

**Persistencia**: Nenhuma (em memoria).
**Dados de servidor**: Nenhum. Store 100% UI local.

**Consumidores (2 arquivos)**:

| Arquivo | Campos acessados | Subscricao seletiva? |
|---------|-----------------|---------------------|
| `components/layout/Header.tsx:23` | `toggleSidebar` | SIM |
| `components/layout/Sidebar.tsx:163-166` | `sidebarOpen, setSidebarOpen, sidebarCollapsed, toggleSidebarCollapsed` | SIM |

---

## 2. TanStack Query — Hooks Centrais

### 2.1 Query Client (`src/lib/query-client.ts`)

| Config | Valor |
|--------|-------|
| `staleTime` | 5 min (padrao global) |
| `gcTime` | 15 min |
| `retry` | 1 |
| `retryDelay` | Exponencial (max 30s) |
| `refetchOnWindowFocus` | `false` |
| `refetchOnReconnect` | `true` |
| Mutations retry | 0 |

### 2.2 Query Keys Factory (`src/lib/query-client.ts`)

| Dominio | Keys | Usa `stableFilterKey`? |
|---------|------|----------------------|
| `auth` | `me` | Nao |
| `users` | `list(filters), detail(id)` | Sim |
| `geradorPecas` | `tiposPeca, historico(f), historicoDetail(id), grupos, subcategorias(gId), versoes(gId)` | Sim |
| `classificador` | `historico(f), prompts, projetos, execucoesEmAndamento` | Sim |
| `extrator` | `historico(f), bertHealth` | Sim |
| `pedidoCalculo` | `historico(f), historicoDetail(id)` | Sim |
| `prestacaoContas` | `historico(f)` | Sim |
| `relatorioCumprimento` | `historico(f)` | Sim |
| `cumprimentoBeta` | `historico(f), sessoes` | Sim |
| `assistencia` | `historico(f)` | Sim |
| `matriculas` | `historico(f), files, config, logs` | Sim |
| `bert` | `status, modelos` | Nao |
| `admin` | `stats, users(f), pedidoCalculoGeracoes` | Sim |

### 2.3 Hooks Exportados (`src/hooks/useQueries.ts` — 454 linhas)

#### Queries (16 hooks)

| Hook | Endpoint | staleTime | Notas |
|------|----------|-----------|-------|
| `useCurrentUser` | GET `/auth/me` | 10 min | **NUNCA USADO** em producao |
| `useTiposPeca` | GET `/tipos-peca` | 1 hora | |
| `useHistoricoGerador` | GET `/historico` | 5 min (global) | |
| `useGeracaoDetalhe(id)` | GET `/historico/{id}` | 5 min | `enabled: !!id` |
| `useGruposDisponiveis` | GET `/grupos-disponiveis` | 30 min | |
| `useSubcategorias(gId)` | GET `/grupos/{gId}/subcategorias` | 5 min | `enabled: !!grupoId` |
| `useVersoesGeracao(gId)` | GET `/historico/{gId}/versoes` | 5 min | `enabled: !!geracaoId` |
| `useHistoricoClassificador` | GET `/historico` | 5 min | |
| `useHistoricoExtrator` | GET `/historico` | 5 min | |
| `useHistoricoPedidoCalculo` | GET `/historico` | 5 min | |
| `useHistoricoPrestacaoContas` | GET `/historico` | 5 min | |
| `useHistoricoRelatorioCumprimento` | GET `/historico` | 5 min | |
| `useHistoricoCumprimentoBeta` | GET `/historico` | 5 min | |
| `useHistoricoAssistencia` | GET `/historico` | 5 min | |
| `useHistoricoMatriculas` | GET `/historico` | 5 min | |
| `useBertStatus` | GET `/bert/status` | 5 min | `refetchInterval` opt-in |
| `useBertModelos` | GET `/bert/modelos` | 5 min | |
| `useAdminStats` | GET `/admin/stats` | 5 min | |
| `useAdminUsers(filters)` | GET `/` | 5 min | |

#### Mutations (7 hooks)

| Hook | Metodo | Invalidation |
|------|--------|-------------|
| `useExcluirGeracao` | DELETE `/historico/{id}` | `geradorPecas.historico()` |
| `useEnviarFeedback` | POST `/feedback` | Nenhuma |
| `useAtualizarMinuta` | PUT `/historico/{id}` | `geradorPecas.historicoDetail(id)` |
| `useRestaurarVersao` | POST `/historico/{gId}/versoes/{vId}/restaurar` | `historicoDetail(gId)` + `versoes(gId)` |
| `useUploadParecer` | POST `/parecer/upload` | Nenhuma |
| `useExportarDocx` | POST `/exportar-docx` | Nenhuma |
| `useInvalidateQueries` (utility) | — | `geradorHistorico`, `all`, `byKey` |

---

## 3. Uso Direto de Query nas Paginas (fora de useQueries.ts)

| Pagina | Arquivo | Tipo | Query Key | Notas |
|--------|---------|------|-----------|-------|
| Extrator Autos | `ExtratorAutosPage.tsx:30` | `useQuery` direto | `extrator.bertHealth()` | BERT health check |
| Extrator Autos | `ExtratorAutosPage.tsx:144` | `useQuery` direto | `extrator.historico()` | Condicional (modal) |
| Pedido Calculo | `PedidoCalculoPage.tsx:107-110` | `useQuery` direto | `pedidoCalculo.historico()` | |
| Relatorio Cumpr. | `RelatorioCumprimentoPage.tsx:115-118` | `useQuery` direto | `relatorioCumprimento.historico()` | |
| Assistencia | `AssistenciaPage.tsx:45-48` | `useQuery` direto | `assistencia.historico()` | |
| Matriculas | `MatriculasPage.tsx:88-99` | `useQuery` direto | `matriculas.files, config, logs` | 3 queries |
| Classificador | `ClassificadorPage.tsx:216-221` | `useQuery` direto | `classificador.*` | |

**Obs**: Todas usam `queryKeys` corretamente. A diferenca e estilo (inline vs hook centralizado), nao funcionalidade.

---

## 4. SSE/Streaming — Padroes de Estado

### 4.1 Paginas que usam fetch + getReader() (ReadableStream)

| Pagina | Arquivo (linhas) | Estado intermediario | Finalizacao |
|--------|-----------------|---------------------|-------------|
| Gerador Pecas | `GeradorPecasPage.tsx:280, 336, 742` | `useState` (streamingContent, agentStatuses, progressMessage) | `invalidateGeradorHistorico()` |
| Pedido Calculo | `PedidoCalculoPage.tsx:259` | `useState` (streamingContent, agentStatuses) | Manual setState |
| Prestacao Contas | `PrestacaoContasPage.tsx:293` | `useState` (mensagensLog, relatorio) | Manual setState |
| Relatorio Cumpr. | `RelatorioCumprimentoPage.tsx:301` | `useState` (mensagensLog, relatorio, streaming) | Manual setState |
| Cumprimento Beta | `CumprimentoBetaPage.tsx:185, 266` | `useState` (mensagensLog, relatorio) | Manual setState |
| Extrator Autos | `ExtratorAutosPage.tsx:366` | `useState` (downloadLogs, percentual) | Manual setState |

### 4.2 Paginas que usam EventSource

| Pagina | Arquivo (linhas) | Instancias | Cleanup |
|--------|-----------------|------------|---------|
| Classificador | `ClassificadorPage.tsx:298, 745` | 2 (upload lote + exec classificacao) | `useRef` + close on unmount |

### 4.3 Hook `useSSE` (`src/hooks/useSSE.ts`)

- Existe, bem projetado (reconnect, invalidateOnComplete, cleanup)
- **Importado em**: `hooks/index.ts` (barrel export)
- **Usado em paginas**: NENHUMA — as paginas implementam SSE manualmente

---

## 5. Codigo Morto e Deprecado

| Item | Arquivo | Situacao |
|------|---------|---------|
| `useCurrentUser()` | `hooks/useQueries.ts:34-41` | Definido, exportado, **NUNCA chamado** em producao |
| `useApiQuery` (hook inteiro) | `hooks/useApiQuery.ts` (90 linhas) | Marcado `@deprecated`. Nao usado em nenhuma pagina |
| Mock de `useApiQuery` | `test/setup.ts:141` | Referencia mock para hook deprecado |

---

## 6. Tabela de Duplicacoes Suspeitas

| Suspeita | Evidencia | Severidade | Veredicto |
|----------|-----------|-----------|-----------|
| **Auth user em Zustand + Query** | `auth-store.loadUser()` faz GET `/auth/me` e armazena em `store.user`. `useCurrentUser()` faria o mesmo via Query. | BAIXA | `useCurrentUser()` nunca e chamado. **Duplicacao potencial, nao real.** Remover `useCurrentUser()`. |
| **Historico em useQueries.ts + paginas** | `useHistoricoPedidoCalculo()` existe em useQueries.ts, mas PedidoCalculoPage usa `useQuery` direto com mesma key. | BAIXA | Ambos usam `queryKeys.pedidoCalculo.historico()` — TanStack Query deduplicada. **Sem duplicacao de cache.** Hook centralizado fica sem uso. |
| **Dados de API em useState** | GeradorPecas tem `minutaMarkdown`, `geracaoId` etc. em useState apos SSE | NENHUMA | Correto — e resultado de streaming, nao cache. Dado final esta no Query cache via invalidation. |
| **Polling manual vs Query refetchInterval** | MatriculasPage usa `useRef` + `setInterval` para polling | BAIXA | Funcional mas inconsistente com padrao Query. Candidato a migracao para `refetchInterval`. |
| **useSSE hook nao usado** | `hooks/useSSE.ts` exportado mas nenhuma pagina consome | INFO | Infraestrutura pronta mas nao adotada. Paginas implementam SSE ad-hoc. |

---

## 7. Resumo por Pagina

| Pagina | Zustand | Query (central) | Query (direto) | API direta | SSE | useState (server data) |
|--------|---------|-----------------|----------------|-----------|-----|----------------------|
| Login | `login, user` | — | — | — | — | form state |
| Dashboard | `user` | — | — | — | — | — |
| Gerador Pecas | — | 5 queries, 6 mutations | — | fetch SSE | getReader x3 | ~70 |
| Classificador | — | — | 1 query | post + SSE | EventSource x2 | ~30 |
| Extrator Autos | — | — | 2 queries | post/get | getReader x1 | ~25 |
| Pedido Calculo | — | — | 1 query | post | getReader x1 | ~20 |
| Prestacao Contas | — | — | — | post | getReader x1 | ~15 |
| Relatorio Cumpr. | — | — | 1 query | post | getReader x1 | ~25 |
| Cumprimento Beta | `user` | — | — | post | getReader x2 | ~15 |
| Assistencia | — | — | 1 query | post/get | — | ~10 |
| Matriculas | — | — | 3 queries | — | — | ~15 |
| BERT Training | — | — | — | bertApi.* | — | ~20 |
| Admin Users | — | — | — | usersApi.* | — | ~15 |
| Admin Feedbacks | — | — | — | adminApi.* | — | ~10 |
| Admin Performance | — | — | — | adminApi.* | — | ~15 |
