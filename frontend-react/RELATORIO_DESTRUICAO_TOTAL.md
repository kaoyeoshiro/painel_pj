# Relatório de Stress Test — Portal PGE Frontend React

**Data**: 2026-02-12
**Cenário**: Backend real em `localhost:8000`, Frontend Vite em `127.0.0.1:5178`
**Branch**: `refactor/backend-cleanup`
**Ferramenta**: Playwright MCP (Chrome headless) + scripts de automação

---

## Resumo Executivo

| Métrica | Valor |
|---------|-------|
| **Rotas auditadas** | 32/32 únicas + 7 aliases = 39 total |
| **Interações executadas** | ~180+ (clicks, submits, navigations, toggles) |
| **Total de findings** | 15 |
| **Críticos** | 1 |
| **Altos** | 3 |
| **Médios** | 7 |
| **Baixos** | 4 |

### Testes de Resiliência (todos PASSED)

| Teste | Resultado |
|-------|-----------|
| Sidebar rapid toggle 10x | OK — sem crash |
| Rapid dialog open/close 5x | OK — sem crash |
| State leak entre rotas | Limpo — inputs resetam |
| Navigate mid-operation (dialog aberto) | OK — dialog/form limpos |
| Double-click em botão destrutivo | OK — sem duplicação |
| XSS em inputs (script/img tags) | Bloqueado — sem execução |
| CRUD lifecycle (create/edit/reset) | 5/6 passed |
| Viewport mobile → desktop transition | OK (sidebar restaura) |
| 3 rotas em viewport mobile | OK — sem crash |

---

## Findings por Categoria

### CRÍTICO

| # | Rota | Categoria | Descrição | Evidência |
|---|------|-----------|-----------|-----------|
| 1 | `/extrator-autos` | UI/Crash | **Error Boundary intermitente no primeiro load**. Falha no dynamic import de `SelectionSection.tsx`. Página mostra "Something went wrong" na primeira visita; funciona após retry (F5). | Console: `Failed to fetch dynamically imported module`, `net::ERR_CONNECTION` em SelectionSection.tsx. Na segunda visita carrega após ~3s. |

### ALTO

| # | Rota | Categoria | Descrição | Evidência |
|---|------|-----------|-----------|-----------|
| 2 | `/admin/users` | Validation | **Submit vazio do "Novo Usuario" causa HTTP 500**. O frontend NÃO valida campos obrigatórios (Username, Nome, Senha) antes de enviar. O backend retorna `ValueError is not JSON serializable` em vez de 422. | Toast: "Erro ao salvar usuario: Object of type ValueError is not JSON serializable". Dialog permanece aberto (bom). |
| 3 | `/change-password` | Validation | **Submit vazio aceito sem NENHUM feedback**. Sem toast, sem inline error, sem indicação visual. O formulário simplesmente não faz nada visível ao clicar "Salvar" com campos vazios. | `toast: false, inlineError: false` após click no submit. |
| 4 | `/admin/prompts-config` | Route | **Alias renderiza layout mas `<main>` está vazio**. A rota alias não resolve para o componente da rota canônica `/admin/prompts`. | Snapshot: `<main ref=e161>` sem filhos. Sidebar e header presentes. |

### MÉDIO

| # | Rota | Categoria | Descrição | Evidência |
|---|------|-----------|-----------|-----------|
| 5 | `/admin/feedbacks` | State | **"Carregando" permanece visível** após 5 segundos mesmo com dados parciais carregados (1388 chars de conteúdo). Spinner nunca some. | `stuckLoading: true, hasData: true, contentLength: 1388` |
| 6 | `/admin/performance` | UI | **Recharts renderiza com dimensões negativas** (`width(-1), height(-1)`). Charts podem estar invisíveis ou distorcidos. Repetido 6x no console. | Console warning: `The width(-1) and height(-1) of chart should be positive` |
| 7 | `/admin/users` | Backend | **Endpoint `/users/content-groups` retorna 422** em toda visita à página de usuários. Fallback silencioso: "Nao foi possivel carregar grupos de conteudo". | Console: `Failed to load resource: 422` + warning em UsersPage.tsx:85 |
| 8 | `/classificador` | Backend | **Endpoint `/classificador/api/execucoes-em-andamento` retorna 404**. | Console: `Failed to load resource: the server responded with a status of 404` |
| 9 | Mobile (375px) | UI | **Sidebar escondida sem hamburger menu**. Em viewport mobile a sidebar fica inacessível — o usuário não consegue navegar para outras páginas. | `sidebarHidden: true, hasHamburger: false`. Nenhum botão de menu encontrado para abrir sidebar. |
| 10 | `/extrator-autos` | A11y | **Nenhum `role="tab"` encontrado**. Os tabs (documentos, categorias, histórico, lote) não usam acessibilidade semântica padrão. | `extrator_tab_count: 0` (BERT Training e Classificador têm 4 tabs cada com role correto) |
| 11 | `/gerador-pecas` | UI | **Select "tipo peça" abre mas mostra 0 opções**. O combobox abre normalmente mas a lista de opções está vazia (possível falha na carga do backend ou timing). | `gerador_tipo_peca_options: 0` com 2 comboboxes detectados |

### BAIXO

| # | Rota | Categoria | Descrição | Evidência |
|---|------|-----------|-----------|-----------|
| 12 | Global (dialogs) | A11y | **Todos os dialogs Radix sem `aria-describedby`**. Warning repetido ~10x em diferentes páginas. | Console: `Warning: Missing 'Description' or 'aria-describedby'` em @radix-ui_react-dialog.js:331 |
| 13 | `/change-password` | A11y | **Inputs de senha sem `autocomplete`** attribute. Browser DOM warning. | Console: `[DOM] Input elements should have autocomplete` |
| 14 | `/admin/users` | UX | **Delete = soft-delete** (muda status para "Inativo" em vez de remover da tabela). Comportamento possivelmente intencional, mas confunde — usuário espera que "Excluir" remova. | Após confirmar exclusão, user aparece com status "Inativo" na mesma tabela. |
| 15 | `/admin/prompts-modulos` | Backend | **API `/admin/api/prompts-modulos` retorna erro** quando página carrega (dialog novo módulo funciona mas lista pode ter inconsistência). | Console: `Failed to load resource: server responded with error status` |

---

## Console.errors Únicos (não-ignorados)

| Erro | Páginas Afetadas |
|------|-----------------|
| `Failed to load resource: /users/content-groups` (422) | `/admin/users` (toda visita) |
| `Failed to load resource: /classificador/api/execucoes-em-andamento` (404) | `/classificador` |
| `Failed to fetch dynamically imported module` | `/extrator-autos` (intermitente) |
| `Failed to load resource: /admin/api/prompts-modulos` | `/admin/prompts-modulos` |
| `Failed to load resource: /users` (500) | `/admin/users` (submit vazio) |

## Console.warnings Recorrentes

| Warning | Ocorrências | Páginas |
|---------|-------------|---------|
| `Missing Description or aria-describedby` | ~10x | Todos os dialogs (users, prompts-modulos, categorias-json) |
| `width(-1) height(-1) of chart should be positive` | 6x | `/admin/feedbacks`, `/admin/performance` |
| `Nao foi possivel carregar grupos de conteudo` | Toda visita | `/admin/users` |
| `Input elements should have autocomplete` | 3x | `/change-password`, `/dev/design-system` |
| `Password field is not contained in a form` | 5x | `/admin/users` (dialog novo usuario) |

---

## Network Errors (endpoints com status >= 400)

| Endpoint | Status | Página |
|----------|--------|--------|
| `/users/content-groups` | 422 | `/admin/users` |
| `/classificador/api/execucoes-em-andamento` | 404 | `/classificador` |
| `/users` (POST vazio) | 500 | `/admin/users` (submit sem dados) |
| `/admin/api/prompts-modulos` | erro | `/admin/prompts-modulos` |

---

## Cobertura

| Item | Testado | Total (code analysis) | % |
|------|---------|----------------------|---|
| Rotas visitadas | 32 | 32 únicas | 100% |
| Aliases verificados | 7 | 7 | 100% |
| Dialogs testados (open/close/ESC/Cancel) | 6 | 18 | 33% |
| Forms testados (submit vazio/XSS) | 6 | 10 | 60% |
| Tabs testados | 3 páginas (8 tabs) | ~6 páginas | 50% |
| SSE/Streaming testado | 0 | 3 pontos | 0% |
| Botões destrutivos testados | 3 | 6 | 50% |
| CRUD lifecycle completo | 1 (users) | 2 (users, categorias) | 50% |
| Stress patterns (rapid toggle, double-click) | 4 | 4 | 100% |
| Viewport mobile | 3 rotas | 32 rotas | 9% |
| State leak tests | 2 | 2 | 100% |
| Navigate mid-operation | 1 | 1 | 100% |

---

## Rotas — Resultado Individual

### Públicas (2)

| Rota | Status | Obs |
|------|--------|-----|
| `/` | OK | Redirect para `/dashboard` |
| `/login` | OK | Form funcional, login real testado |

### Portal (13)

| Rota | Status | Texto | Buttons | Inputs | Obs |
|------|--------|-------|---------|--------|-----|
| `/dashboard` | OK | 1368 | 5 | 0 | Cards + admin section |
| `/gerador-pecas` | OK | 664 | 16 | 2 | Botão Gerar desabilitado quando vazio |
| `/extrator-autos` | **CRASH** | 146→OK | 2→6+ | 0→1+ | Error Boundary intermitente (1o load) |
| `/classificador` | OK | 514 | 13 | 8 | 4 tabs funcionais |
| `/pedido-calculo` | OK | 306 | 6 | 1 | |
| `/prestacao-contas` | OK | 535 | 7 | 1 | |
| `/relatorio-cumprimento` | OK | 686 | 6 | 1 | |
| `/cumprimento-beta` | OK | 178 | 6 | 1 | |
| `/assistencia` | OK | 313 | 6 | 1 | |
| `/matriculas` | OK | 561 | 14 | 2 | |
| `/bert-training` | OK | 873 | 18 | 4 | 4 tabs funcionais |
| `/change-password` | OK | 321 | 6 | 3 | Submit vazio sem feedback |
| `/dev/design-system` | OK | 1084 | 25 | 3 | Showcase componentes |

### Admin Únicas (17)

| Rota | Status | Texto | Buttons | Inputs | Obs |
|------|--------|-------|---------|--------|-----|
| `/admin/users` | OK | 338 | 12 | 0 | 422 em content-groups |
| `/admin/prompts` | OK | 880 | 24 | 4 | |
| `/admin/prompts-modulos` | OK | 7337 | 434 | 8 | Página mais complexa |
| `/admin/feedbacks` | **LOADING** | 1457 | 15 | 0 | "Carregando" preso |
| `/admin/performance` | OK | 2157 | 27 | 1 | Charts width/height negativo |
| `/admin/variaveis` | OK | 26273 | 12 | 1 | Página mais pesada (26KB texto) |
| `/admin/categorias-json` | OK | 1424 | 33 | 0 | Dialog Nova Categoria funcional |
| `/admin/historico-gerador` | OK | 1956 | 6 | 0 | Tabela com dados reais |
| `/admin/historico-pedido-calculo` | OK | 1838 | 6 | 1 | |
| `/admin/historico-prestacao-contas` | OK | 1620 | 6 | 0 | |
| `/admin/modulos-tipo-peca` | OK | 1083 | 6 | 0 | |
| `/admin/config-pecas` | OK | 1419 | 44 | 0 | |
| `/admin/teste-ativacao` | OK | 580 | 23 | 2 | Select tipo peça funcional |
| `/admin/teste-categorias` | OK | 487 | 16 | 2 | |
| `/admin/tjms-docs` | OK | 1629 | 4 | 0 | |
| `/admin/tjms-docs/plano` | OK | 1629 | 4 | 0 | |
| `/admin/restaurar-slugs` | OK | 240 | 5 | 1 | Double-click seguro |

### Aliases (7)

| Alias | Canônica | Status |
|-------|----------|--------|
| `/admin/prompts-config` | `/admin/prompts` | **VAZIO** — `<main>` sem conteúdo |
| `/admin/categorias-resumo-json` | `/admin/categorias-json` | OK |
| `/admin/gerador-pecas/historico` | `/admin/historico-gerador` | OK |
| `/admin/pedido-calculo/debug` | `/admin/historico-pedido-calculo` | OK |
| `/admin/prestacao-contas/debug` | `/admin/historico-prestacao-contas` | OK |
| `/admin/prompts-modulos/teste` | `/admin/teste-ativacao` | OK |
| `/admin/categorias-resumo-json/teste` | `/admin/teste-categorias` | OK |

---

## Correções Priorizadas

### P0 — Crítico (corrigir imediatamente)

1. **[#1] `/extrator-autos` Error Boundary intermitente**
   - **Causa provável**: Code-splitting com `React.lazy()` falha no primeiro load. O chunk de `SelectionSection.tsx` não é encontrado.
   - **Correção sugerida**: Verificar se o Vite está gerando chunks corretos. Adicionar `retry` no lazy import ou usar `Suspense` com fallback que tenta recarregar. Verificar se há race condition com o Vite HMR.
   - **Arquivo**: `src/pages/extrator-autos/` (lazy import)

### P1 — Alto (corrigir antes do próximo release)

2. **[#2] Submit vazio "Novo Usuario" → 500**
   - **Correção**: Adicionar validação client-side com Zod/required nos campos Username, Nome Completo e Senha antes de chamar API. No backend, retornar 422 com mensagem específica em vez de 500.
   - **Arquivo**: `src/pages/admin/users/UsersPage.tsx`

3. **[#3] `/change-password` sem feedback em submit vazio**
   - **Correção**: Validar campos required antes de submit. Mostrar toast de erro ou inline validation.
   - **Arquivo**: `src/pages/change-password/`

4. **[#4] Alias `/admin/prompts-config` vazio**
   - **Correção**: Verificar configuração do router — o alias pode não estar mapeado para o componente correto.
   - **Arquivo**: `src/router.tsx` ou equivalente

### P2 — Médio (planejar para sprint)

5. **[#5] Feedbacks "Carregando" preso** — Verificar se a query React Query está em estado `isLoading` permanente (possível endpoint lento ou erro silencioso).

6. **[#6] Recharts dimensões negativas** — Envolver charts em container com min-width/min-height ou usar `ResponsiveContainer` corretamente.

7. **[#7] `/users/content-groups` 422** — Backend não tem esse endpoint ou espera parâmetros. Criar endpoint ou remover chamada.

8. **[#8] `/classificador/api/execucoes-em-andamento` 404** — Endpoint inexistente. Criar ou remover referência.

9. **[#9] Mobile sem hamburger** — Adicionar botão hamburger que abre sidebar em drawer no mobile.

10. **[#10] Extrator tabs sem role="tab"** — Adicionar atributos ARIA aos tabs para acessibilidade.

11. **[#11] Gerador "tipo peça" sem opções** — Verificar se o endpoint que popula o select está sendo chamado e retornando dados.

### P3 — Baixo (backlog)

12. **[#12] Dialogs sem aria-describedby** — Adicionar `<DialogDescription>` ou `aria-describedby` em todos os dialogs Radix.

13. **[#13] Inputs sem autocomplete** — Adicionar `autoComplete` nos inputs de senha.

14. **[#14] Soft-delete UX** — Considerar filtro para ocultar usuários inativos ou indicar claramente o comportamento.

15. **[#15] API prompts-modulos erro no load** — Verificar endpoint `/admin/api/prompts-modulos`.

---

## Sugestões de Refatoração

### Padrão repetido: Dialogs sem validação client-side

Múltiplos dialogs (Novo Usuario, Nova Categoria, Novo Módulo) enviam dados ao backend sem validar campos obrigatórios. Recomendação:

1. Criar um hook `useFormValidation` que valida campos required antes do submit
2. Ou integrar com `react-hook-form` + `zod` para validação declarativa
3. Aplicar consistentemente em TODOS os dialogs de criação/edição

### Padrão repetido: Endpoints 4xx/5xx não tratados

Vários endpoints retornam erro mas o frontend faz fallback silencioso (apenas console.warn). Recomendação:

1. Criar error boundary por seção (não global) para capturar erros de fetch
2. Mostrar banner de erro inline quando uma API retorna 4xx/5xx
3. Implementar retry automático para erros transitórios (503, timeout)

### Mobile: Implementação incompleta

O layout responsivo oculta a sidebar mas não oferece alternativa de navegação. Prioridade alta se houver usuários mobile.

---

## Inventário Completo de Elementos Interativos (Code Analysis)

Mapeamento realizado por análise estática do código-fonte (`src/pages/`).

### Dialogs Encontrados (18 total)

| # | Dialog | Página | Testado? |
|---|--------|--------|----------|
| 1 | User Create/Edit Dialog | `/admin/users` | Sim (open/close/ESC/submit vazio) |
| 2 | Delete Confirmation Dialog | `/admin/users` | Sim (CRUD lifecycle) |
| 3 | Password Reset Dialog | `/admin/users` | Sim (open/cancel) |
| 4 | PromptEditDialog | `/admin/prompts` | Não (botão "editar" não encontrado por regex) |
| 5 | ModuloFormDialog (Create/Edit) | `/admin/prompts-modulos` | Sim (open/submit vazio/ESC) |
| 6 | DeleteDialog | `/admin/prompts-modulos` | Não |
| 7 | HistoricoDialog | `/admin/prompts-modulos` | Não |
| 8 | ImportDialog | `/admin/prompts-modulos` | Não |
| 9 | GruposDialog | `/admin/prompts-modulos` | Não |
| 10 | CodigosSelectorDialog | `/admin/categorias-json` | Não |
| 11 | CategoriaEditorDialog | `/admin/categorias-json` | Sim (open/submit vazio/ESC) |
| 12 | PerguntaEditorDialog | `/admin/categorias-json` | Não |
| 13 | PerguntasLoteDialog | `/admin/categorias-json` | Não |
| 14 | CommentModal | `/admin/feedbacks` | Não |
| 15 | CurationAuditModal | `/admin/feedbacks` | Não |
| 16 | ProgressModal (non-dismissible) | `/gerador-pecas` | Não (requer execução real) |
| 17 | ParecerDialog | `/gerador-pecas` | Não (condicional) |
| 18 | FeedbackDialog | `/gerador-pecas` | Não (requer geração completa) |

**Cobertura real**: 6/18 dialogs testados (33%)

### Pontos SSE/Streaming Encontrados (3)

| Componente | Arquivo | Testado? |
|------------|---------|----------|
| Gerador de Peças (agent status) | `GeradorModals.tsx` | Não (requer processo real) |
| Classificador (execução lote) | `NovoLoteTab.tsx` | Não (requer arquivos) |
| Cumprimento Beta | `CumprimentoBetaPage.tsx` | Não (requer processo real) |

### Botões Destrutivos (regex DANGEROUS_BUTTON_PATTERNS)

Pattern: `/(excluir|remover|deletar|apagar|desativar|revogar|resetar|restaurar.*slug|limpar.*log|carregar.*dados.*iniciais|sincronizar.*prompt)/i`

| Botão | Página | Testado? |
|-------|--------|----------|
| Excluir (user) | `/admin/users` | Sim (soft-delete confirmado) |
| Excluir (módulo) | `/admin/prompts-modulos` | Não |
| Resetar Senha | `/admin/users` | Sim (open/cancel) |
| Restaurar Slugs | `/admin/restaurar-slugs` | Sim (double-click seguro) |
| Excluir (categoria) | `/admin/categorias-json` | Não |
| Excluir (lote) | `/classificador` | Não |

### Forms por Página

| Página | Campos | Submit Vazio Testado? |
|--------|--------|-----------------------|
| `/login` | username, password | Não (testado login real) |
| `/change-password` | senha atual, nova, confirmar | Sim — **sem feedback** |
| `/gerador-pecas` | processo, tipo peça | Sim — botão desabilitado (OK) |
| `/admin/users` (dialog) | username, nome, email, setor, senha, perfil, 10 checkboxes | Sim — **HTTP 500** |
| `/admin/categorias-json` (dialog) | nome, descrição, códigos | Sim — dialog fica aberto (OK) |
| `/admin/prompts-modulos` (dialog) | título, nome, conteúdo, tipo, categoria, grupo, tags, ordem, ativo | Sim — dialog fica aberto (OK) |
| `/admin/teste-ativacao` | tipo peça, variáveis, cenário | Não |
| `/admin/teste-categorias` | categoria, JSON input | Não |
| `/extrator-autos` | processo, modo lote, categorias | Não (Error Boundary) |
| `/classificador` | nome lote, prompt, modelo, modo, chunk, upload | Não |

---

## Metodologia

### Ferramentas
- **Playwright MCP** (Chrome headless) via `browser_run_code` para batches
- **Snapshots de acessibilidade** para detecção de elementos interativos
- **Console error collector** com filtro de IGNORED_PATTERNS
- **Network response listener** para captura de erros HTTP

### Cobertura de testes por tipo
- **Baseline**: Navegar + render + console check (todas as 39 rotas)
- **Dialog cycles**: Open/ESC/X/Cancel/empty submit (6 dialogs)
- **Tab navigation**: Click + aria-selected + rapid switch (3 páginas, 8 tabs)
- **Form interaction**: Empty submit, XSS payload, huge text (4 forms)
- **CRUD lifecycle**: Create → Edit → Reset → Delete (1 entity)
- **Stress patterns**: Rapid toggles, double-click, navigate mid-op, state leak
- **Viewport**: Mobile 375px, desktop restore

### Limitações
- Não testou fluxos que disparam processamento real de IA (geração de peças, classificação)
- SSE/streaming não testado (requer processo ativo)
- Upload de arquivos não testado (requer fixtures)
- Apenas 1 CRUD lifecycle completo (users); categorias-json não testado com dados reais
