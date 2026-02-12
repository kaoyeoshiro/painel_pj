# PLANO DE EXECUCAO CONSOLIDADO — Frontend React

**Data**: 2026-02-12
**Branch**: `refactor/frontend-hardening`
**Objetivo**: Resolver os 15 problemas priorizados da auditoria, elevar qualidade de codigo e preparar caminho para remocao do legado.

---

## Metricas de Partida (baseline 2026-02-12)

| Metrica | Valor |
|---------|-------|
| Lint errors | 52 |
| Lint warnings | 16 |
| Testes | 31 arquivos, 261 testes (100% pass) |
| `style={{` inline | 1.597 ocorrencias em 56 arquivos |
| Hex hardcoded | 202 ocorrencias em 29 arquivos |
| `fetch()` direto em pages | 11 calls em 7 arquivos |
| `localStorage` token direto | 5 ocorrencias em 3 pages |
| Pages > 1200 linhas | 8 arquivos |
| Maior pagina | BertTrainingPage.tsx (2.704 linhas) |
| Pages sem teste | LoginPage, ChangePasswordPage, DashboardPageV2, DesignSystemPage |
| Pages com streaming duplicado | 5 (gerador, pedido-calculo, prestacao, relatorio, extrator) |

### Breakdown de lint errors

| Qtd | Regra | Tipo |
|-----|-------|------|
| 29 | `@typescript-eslint/no-unused-vars` | error |
| 16 | `react-hooks/exhaustive-deps` | warning |
| 7 | `react-refresh/only-export-components` | error |
| 5 | `react-hooks/set-state-in-effect` | error |
| 4 | `@typescript-eslint/no-explicit-any` | error |
| 2 | `@typescript-eslint/no-empty-object-type` | error |
| 2 | `@typescript-eslint/no-require-imports` | error |
| 1 | `no-constant-binary-expression` | error |
| 1 | `react-hooks/immutability` | error |
| 1 | `no-case-declarations` | error |

---

## Estrutura de Execucao (7 Waves)

### Wave 1 — Lint Zero + Regras Anti-Regressao
**Prioridade**: CRITICA (desbloqueia tudo)
**Estimativa de arquivos**: ~25
**Agente**: `lint-fixer`

#### Tarefas
- [ ] Corrigir 29 `no-unused-vars` (remover imports/vars nao usados)
- [ ] Corrigir 7 `only-export-components` (mover exports ou ajustar)
- [ ] Corrigir 5 `set-state-in-effect` (refatorar para pattern correto)
- [ ] Corrigir 4 `no-explicit-any` (tipar corretamente)
- [ ] Corrigir 2 `no-empty-object-type` (usar `Record<string, never>` ou tipo correto)
- [ ] Corrigir 2 `no-require-imports` (converter para ESM import)
- [ ] Corrigir 1 `no-constant-binary-expression`
- [ ] Corrigir 1 `react-hooks/immutability`
- [ ] Corrigir 1 `no-case-declarations`
- [ ] Tratar 16 `exhaustive-deps` warnings (avaliar caso a caso)
- [ ] Adicionar regra no eslint.config.js: `no-restricted-syntax` para bloquear novo `fetch(` em `src/pages`
- [ ] Adicionar regra no eslint.config.js: `no-restricted-globals` ou custom para bloquear `localStorage.getItem('access_token')` fora de `lib/api.ts`

#### Validacao
- `npx eslint src` = 0 errors, 0 warnings
- `npm run test` = 261 testes passando
- `npm run build` = sucesso

#### Commit
`fix(frontend): corrige 52 erros e 16 warnings de lint, adiciona regras anti-regressao`

---

### Wave 2 — Streaming Compartilhado
**Prioridade**: ALTA (reduz duplicacao, desbloqueia Wave 4)
**Estimativa de arquivos**: 6-8
**Agente**: `streaming-extractor`

#### Contexto
5 paginas duplicam logica de streaming/SSE: `getReader()`, `TextDecoder`, parsing de `data:` lines.

#### Tarefas
- [ ] Criar `src/services/api/streaming.ts` com:
  - `useStreamingRequest(url, options)` — hook que abstrai fetch+reader+decoder
  - `parseSSELine(line)` — parser de eventos SSE
  - `StreamingState<T>` — tipo padrao de estado de streaming
- [ ] Migrar `GeradorPecasPage.tsx` para usar hook compartilhado
- [ ] Migrar `PedidoCalculoPage.tsx` para usar hook compartilhado
- [ ] Migrar `PrestacaoContasPage.tsx` para usar hook compartilhado
- [ ] Migrar `RelatorioCumprimentoPage.tsx` para usar hook compartilhado
- [ ] Migrar `ExtratorAutosPage.tsx` para usar hook compartilhado (se aplicavel)
- [ ] Garantir que cada pagina mantem comportamento identico pos-migracao

#### Validacao
- Testes das 5 paginas passam
- Smoke manual de cada rota com streaming
- Lint = 0

#### Commit
`refactor(frontend): extrai streaming compartilhado e migra 5 paginas`

---

### Wave 3 — Eliminar fetch() Direto e Token Leak
**Prioridade**: ALTA (seguranca + padrao arquitetural)
**Estimativa de arquivos**: 10-12
**Agente**: `api-centralizer`

#### Contexto
7 pages com `fetch()` direto. 3 pages acessando `localStorage.getItem('access_token')` diretamente.

#### Tarefas

**3A — Criar servicos de API por dominio**
- [ ] `src/features/gerador-pecas/services/api.ts` — 3 fetch calls
- [ ] `src/features/matriculas/services/api.ts` — 2 fetch calls
- [ ] `src/features/cumprimento-beta/services/api.ts` — 2 fetch calls
- [ ] `src/features/relatorio-cumprimento/services/api.ts` — 1 fetch call
- [ ] `src/features/prestacao-contas/services/api.ts` — 1 fetch call
- [ ] `src/features/pedido-calculo/services/api.ts` — 1 fetch call
- [ ] `src/features/extrator-autos/services/api.ts` — 1 fetch call

**3B — Eliminar acesso direto a token**
- [ ] `CumprimentoBetaPage.tsx` (linhas 179, 259) — usar `apiClient` centralizado
- [ ] `MatriculasPage.tsx` (linhas 126, 390) — usar `apiClient` centralizado
- [ ] `LegacyAdminFramePage.tsx` (linha 51) — avaliar se necessario ou remover

**3C — Hooks Query/Mutation por dominio**
- [ ] Criar hooks em cada `features/<dominio>/hooks/` consumindo os servicos acima
- [ ] Migrar pages para usar hooks em vez de fetch direto

#### Validacao
- 0 ocorrencias de `fetch(` em `src/pages` (exceto em services importados)
- 0 ocorrencias de `localStorage.getItem('access_token')` em `src/pages`
- Testes passam
- Lint = 0

#### Commit(s)
- `refactor(frontend): cria servicos API por dominio e elimina fetch direto em pages`
- `fix(frontend): remove acesso direto a localStorage token em pages`

---

### Wave 4 — Reducao de Paginas Gigantes (SRP)
**Prioridade**: ALTA (mantenibilidade)
**Estimativa de arquivos**: 30-40 (novos componentes + hooks extraidos)
**Agentes**: `page-splitter-1`, `page-splitter-2` (paralelo)

#### Meta
- Nenhuma page > 1.200 linhas (meta inicial)
- Longo prazo: nenhuma page > 800 linhas

#### Pages alvo (> 1.200 linhas)

| Page | Linhas | Agente |
|------|--------|--------|
| BertTrainingPage.tsx | 2.704 | page-splitter-1 |
| GeradorPecasPage.tsx | 2.053 | page-splitter-1 |
| PromptsModulosPage.tsx | 1.819 | page-splitter-2 |
| PrestacaoContasPage.tsx | 1.675 | page-splitter-2 |
| ClassificadorPage.tsx | 1.544 | page-splitter-1 |
| RelatorioCumprimentoPage.tsx | 1.324 | page-splitter-2 |
| ExtratorAutosPage.tsx | 1.319 | page-splitter-1 |
| PerformancePage.tsx | 1.257 | page-splitter-2 |

#### Estrategia por pagina
1. Extrair hook de orquestracao: `use<Page>Logic()` com estado + handlers
2. Extrair subcomponentes de apresentacao: `<PageHeader>`, `<FilterBar>`, `<ResultPanel>`, etc.
3. Mover regra de negocio para `features/<dominio>/hooks/`
4. Page final: composicao fina (< 200 linhas ideal, max 800)

#### Validacao por page
- Testes existentes continuam passando
- Lint = 0
- Comportamento visual identico (smoke manual)

#### Commits (1 por page ou grupo)
- `refactor(frontend): divide BertTrainingPage em componentes e hooks`
- `refactor(frontend): divide GeradorPecasPage em componentes e hooks`
- `refactor(frontend): divide PromptsModulosPage em componentes e hooks`
- (etc.)

---

### Wave 5 — Testes Faltantes
**Prioridade**: MEDIA
**Estimativa de arquivos**: 4-6 novos
**Agente**: `test-writer`

#### Tarefas
- [ ] Criar `src/pages/login/__tests__/LoginPage.test.tsx`
  - Teste de renderizacao
  - Teste de submit com credenciais validas (mock)
  - Teste de submit com erro
  - Teste de redirect se ja autenticado
- [ ] Criar `src/pages/change-password/__tests__/ChangePasswordPage.test.tsx`
  - Teste de renderizacao
  - Teste de validacao de campos
  - Teste de submit com sucesso
- [ ] Criar `src/pages/dashboard/__tests__/DashboardPageV2.test.tsx`
  - Teste de renderizacao para user normal
  - Teste de renderizacao para admin (cards admin visiveis)
  - Teste de loading state
- [ ] Corrigir warnings `act(...)` nos testes existentes
- [ ] Corrigir warnings `aria-describedby` em `DialogContent`

#### Validacao
- `npm run test` = todos passam sem warnings criticos
- Cobertura de pages criticas >= smoke basico

#### Commit
`test(frontend): adiciona testes para LoginPage, ChangePasswordPage e DashboardPageV2`

---

### Wave 6 — Inline Styles e Hex Hardcoded
**Prioridade**: MEDIA (governanca visual)
**Estimativa de arquivos**: 56 (incremental por lote)
**Agentes**: `style-migrator-1`, `style-migrator-2` (paralelo)

#### Estrategia
NAO fazer big bang. Migrar por camadas:

**Lote 1 — Layout/Shell (alto impacto visual)**
- [ ] `components/layout/AppLayout.tsx`
- [ ] `components/layout/Header.tsx`
- [ ] `components/layout/Sidebar.tsx`
- [ ] `components/layout/ContentArea.tsx`
- [ ] `components/layout/BreadcrumbBar.tsx`

**Lote 2 — Componentes shared**
- [ ] `components/shared/DataTable.tsx`
- [ ] `components/shared/MarkdownRenderer.tsx`
- [ ] `components/shared/SafeHtml.tsx`
- [ ] Demais em `components/shared/`

**Lote 3 — Pages de dominio (top 8 por volume)**
- [ ] GeradorPecasPage e componentes filhos
- [ ] BertTrainingPage e componentes filhos
- [ ] PrestacaoContasPage e componentes filhos
- [ ] ClassificadorPage
- [ ] PedidoCalculoPage
- [ ] RelatorioCumprimentoPage
- [ ] ExtratorAutosPage
- [ ] MatriculasPage

**Lote 4 — Pages admin**
- [ ] PerformancePage
- [ ] PromptsModulosPage
- [ ] UsersPage
- [ ] Demais admin pages

**Lote 5 — Dashboard e demais**
- [ ] DashboardPageV2
- [ ] AssistenciaPage
- [ ] CumprimentoBetaPage
- [ ] LoginPage, ChangePasswordPage

#### Regras de migracao
- `style={{ color: '#xxx' }}` → classe Tailwind ou token `C.xxx` do Design System
- `style={{ padding: '16px' }}` → `className="p-4"`
- `style={{ display: 'flex', ... }}` → classes Tailwind (`flex`, `items-center`, etc.)
- Valores dinamicos legítimos (calculados em runtime) permanecem inline

#### Validacao por lote
- Visual identico (screenshot comparison ou smoke manual)
- Lint = 0
- Testes passam

#### Commits (1 por lote)
- `style(frontend): migra layout shell de inline para Tailwind/tokens`
- `style(frontend): migra componentes shared de inline para Tailwind/tokens`
- (etc.)

---

### Wave 7 — Preparacao para Delete do Legado
**Prioridade**: BAIXA (depende de decisao de produto)
**Estimativa de arquivos**: 5-10 no backend
**Agente**: `legacy-migration`

#### Pre-requisitos (do CHECKLIST_DELETE_LEGADO.md)
- [ ] Verificar que todas as rotas admin React substituem as Jinja2 equivalentes
- [ ] Mapear rotas legadas ainda ativas em `main.py:835-910`
- [ ] Identificar quais templates ainda NAO tem equivalente React

#### Tarefas
- [ ] Redirecionar rotas admin legadas para React SPA (uma por uma)
- [ ] Remover mount de `frontend/static` quando nao houver mais consumers
- [ ] Remover `Jinja2Templates(directory="frontend/templates")` de `main.py`
- [ ] Refatorar `render_admin_restaurar_slugs_response` para API + React
- [ ] Executar apagao controlado (renomear `frontend` → `frontend__DISABLED`)
- [ ] Validar rotas React sem fallback legado
- [ ] Ajustar sonar config, README, scripts

#### Validacao
- Checklist completo do `CHECKLIST_DELETE_LEGADO.md`:
  - [ ] Nenhuma rota retorna `TemplateResponse` legado
  - [ ] Nenhum mount aponta para `frontend/static`
  - [ ] Smoke tests React passam sem fallback legado
  - [ ] Apagao controlado validado
  - [ ] Monitoramento 24h sem erro 5xx

#### Commit
`feat(frontend): migra ultimas rotas legadas e remove dependencia de frontend/`

---

## Plano de Agentes (Team)

### Organizacao do Team

```
team-lead (eu)
├── lint-fixer          — Wave 1
├── streaming-extractor — Wave 2
├── api-centralizer     — Wave 3
├── page-splitter-1     — Wave 4 (BertTraining, GeradorPecas, Classificador, Extrator)
├── page-splitter-2     — Wave 4 (PromptsModulos, PrestacaoContas, Relatorio, Performance)
├── test-writer         — Wave 5
├── style-migrator-1    — Wave 6 lotes 1-2
├── style-migrator-2    — Wave 6 lotes 3-5
└── legacy-migration    — Wave 7
```

### Dependencias entre Waves

```
Wave 1 (lint)
  └── Wave 2 (streaming) ─┐
  └── Wave 3 (fetch/token) ├── Wave 4 (split pages)
                           │     └── Wave 6 (styles) — pode comecar layout em paralelo
                           └── Wave 5 (testes)
                                 └── Wave 7 (legado)
```

- Wave 1 DEVE ser concluida antes de qualquer outra
- Waves 2 e 3 podem rodar em paralelo apos Wave 1
- Wave 4 depende de Waves 2 e 3 (para nao refatorar codigo que sera movido)
- Wave 5 pode iniciar apos Wave 3
- Wave 6 pode iniciar layout (lote 1) apos Wave 1; demais lotes apos Wave 4
- Wave 7 e independente mas deve esperar Wave 5

### Execucao Paralela Maxima

| Slot | Agente 1 | Agente 2 | Agente 3 |
|------|----------|----------|----------|
| T1 | lint-fixer (W1) | — | — |
| T2 | streaming-extractor (W2) | api-centralizer (W3) | style-migrator-1 (W6-L1) |
| T3 | page-splitter-1 (W4) | page-splitter-2 (W4) | test-writer (W5) |
| T4 | style-migrator-1 (W6-L3) | style-migrator-2 (W6-L4,5) | — |
| T5 | legacy-migration (W7) | — | — |

---

## Progresso

### Wave 1 — Lint Zero + Regras Anti-Regressao
- **Status**: CONCLUIDA
- **Inicio**: 2026-02-12
- **Conclusao**: 2026-02-12
- **Commit**: `72c3240`
- **Metricas pos**: errors=0, warnings=0 (35 arquivos, 105+/102-)
- **Notas**: Regras anti-regressao (fetch ban, token ban) pendentes para eslint.config.js — sera adicionado na Wave 3

### Wave 2 — Streaming Compartilhado
- **Status**: CONCLUIDA
- **Inicio**: 2026-02-12
- **Conclusao**: 2026-02-12
- **Commit**: `a96c9f5`
- **Metricas pos**: streaming pages migradas=5/5, ~400 linhas duplicadas removidas
- **Novo modulo**: `src/services/api/streaming.ts` (parseSSELine, readSSEStream, fetchSSEStream, useStreamingFetch)
- **Nota**: CumprimentoBetaPage ainda tem streaming inline (fora do escopo — pagina beta)

### Wave 3 — Eliminar fetch() Direto e Token Leak
- **Status**: CONCLUIDA
- **Inicio**: 2026-02-12
- **Conclusao**: 2026-02-12
- **Commits**: `de05929` (parte 1) + `a96c9f5` (parte 2 junto com Wave 2)
- **Metricas pos**: fetch direto nao-streaming em pages=0, token direto em pages=0
- **Regras lint**: `no-restricted-globals` (fetch) e `no-restricted-syntax` (token) adicionadas
- **Nota**: 7 fetch() de streaming permanecem (agora via useStreamingFetch, nao mais diretos)

### Wave 4 — Reducao de Paginas Gigantes
- **Status**: CONCLUIDA
- **Inicio**: 2026-02-12
- **Conclusao**: 2026-02-12
- **Commits**: `21e4931` (Wave 4B) + `fc36ce8` (Wave 4A)
- **Metricas pos**: pages > 1200 linhas=0 (era 8), pages > 800=3 (eram 12)
- **Reducoes**:
  - BertTrainingPage: 2704 → 180 (-93%)
  - GeradorPecasPage: 1877 → 150 (-92%)
  - PromptsModulosPage: 1810 → 329 (-82%)
  - PrestacaoContasPage: 1612 → 162 (-90%)
  - ClassificadorPage: 1544 → 104 (-93%)
  - ExtratorAutosPage: 1292 → 72 (-94%)
  - RelatorioCumprimentoPage: 1266 → 124 (-90%)
  - PerformancePage: 1257 → 65 (-95%)
- **Padrao**: Page (composicao fina) + Hook (estado/logica) + Components (visual) + types.ts
- **Pendente**: 3 paginas entre 800-1200 (Matriculas, PedidoCalculo, ConfigPecas) — alvo futuro

### Wave 5 — Testes Faltantes
- **Status**: CONCLUIDA
- **Inicio**: 2026-02-12
- **Conclusao**: 2026-02-12
- **Commit**: `4ec45bd`
- **Metricas pos**: 36 testes novos (10+14+12), total 297 (era 261)
- **Cobertura**: LoginPage (10), ChangePasswordPage (14), DashboardPageV2 (12)

### Wave 6 — Inline Styles e Hex Hardcoded
- **Status**: PENDENTE
- **Inicio**: —
- **Conclusao**: —
- **Metricas pos**: inline=1597, hex=202

### Wave 7 — Preparacao para Delete do Legado
- **Status**: PENDENTE
- **Inicio**: —
- **Conclusao**: —

---

## Metricas Alvo (pos-execucao completa)

| Metrica | Antes | Alvo |
|---------|-------|------|
| Lint errors | 52 | 0 |
| Lint warnings | 16 | 0 |
| Testes | 261 | ~280+ |
| `style={{` inline | 1.597 | < 200 (apenas dinamicos) |
| Hex hardcoded | 202 | < 20 |
| `fetch()` direto em pages | 11 | 0 |
| Token direto em pages | 5 | 0 |
| Pages > 1200 linhas | 8 | 0 |
| Pages > 800 linhas | 13 | 0 |
| Nota Qualidade (auditoria) | 5.8 | >= 7.5 |
| Nota Design System (auditoria) | 5.6 | >= 7.5 |

---

## Riscos e Mitigacoes

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|---------------|---------|-----------|
| Regressao visual ao migrar styles | Alta | Medio | Smoke manual + screenshot antes/depois |
| Testes quebrando ao mover codigo | Media | Alto | Rodar testes apos cada move, nunca acumular |
| Conflitos de merge entre agentes | Media | Medio | Cada agente trabalha em arquivos distintos; merge sequencial |
| Streaming quebra ao extrair hook | Media | Alto | Testar cada pagina individualmente; manter fallback |
| Lint rules novas quebrando build | Baixa | Alto | Adicionar como warning primeiro, promover a error depois |

---

## Convencoes para os Agentes

1. **Nunca** alterar comportamento funcional — apenas estrutura e organizacao
2. **Sempre** rodar `npx eslint src` + `npx vitest run` apos cada mudanca
3. **Sempre** manter imports organizados (stdlib → third-party → local)
4. **Nunca** introduzir `any` novo — tipar corretamente
5. **Nunca** adicionar `style={{}}` novo — usar Tailwind ou tokens
6. Nomes de componentes extraidos: `PascalCase`, prefixo do dominio se necessario
7. Hooks extraidos: `use<Dominio><Funcao>` (ex: `useGeradorPecasStreaming`)
8. Services extraidos: em `features/<dominio>/services/` com tipos em `features/<dominio>/types/`
