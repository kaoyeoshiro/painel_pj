# Relatorio: Endpoints do Backend nao usados pelo Frontend React

> Gerado em 12/02/2026 | Branch: `refactor/backend-cleanup`
> Metodo: analise estatica (scripts `list_routes.py` + `audit_backend_vs_frontend.py`)

---

## 1. O que e isso e por que importa

O Portal PGE tem um backend FastAPI com **520 rotas** registradas e um frontend React que chama **237 delas**.
Este relatorio mostra os **64 endpoints** que existem no backend mas **nao sao chamados pelo React**.

Isso pode significar:
- **Funcionalidade escondida**: ferramentas uteis que ninguem consegue acessar pelo sistema
- **Codigo legado**: sobras da migracao Jinja2 -> React que podem ser removidas
- **Endpoints internos**: healthcheck, metricas, etc. que sao usados por infra, nao pelo usuario

**Numeros gerais:**

| Classificacao | Qtd | % |
|---------------|-----|---|
| Usado pelo frontend | 436 | 84% |
| Orfao provavel | 64 | 12% |
| Espelho legado (Jinja2) | 8 | 2% |
| Backend-only (infra) | 7 | 1% |

---

## 2. Como foi detectado

1. **Inventario backend**: `scripts/list_routes.py` importa o `app` FastAPI e lista todas as 520 rotas com path, metodo, arquivo e descricao
2. **Inventario frontend**: `scripts/audit_backend_vs_frontend.py` varre todos os `.ts/.tsx` do React buscando chamadas HTTP (apiClient, fetch, EventSource) e rotas do router
3. **Cruzamento**: cada rota backend e comparada com as chamadas do frontend. Constantes como `EXTRACTION = '/admin/api/extraction'` sao resolvidas automaticamente
4. **Verificacao manual**: endpoints suspeitos foram verificados individualmente no codigo

Dados brutos em `docs/auditoria/`: `ROTAS_BACKEND.json`, `CHAMADAS_FRONTEND.json`, `NAVEGACAO_FRONTEND.json`, `CRUZAMENTO.json`

---

## 3. Orfaos por Grupo Funcional

### GRUPO A: Paginas/Endpoints Legados (remover)

Sobras da migracao Jinja2 -> React. O React ja tem equivalentes.

| # | Endpoint | Metodo | O que faz | Arquivo | Acao |
|---|----------|--------|-----------|---------|------|
| 1 | `/admin/_frame-bridge` | GET | Bridge para iframe admin (dev) | `main.py:849` | **REMOVER** - iframe nao existe mais |
| 2 | `/admin/dashboard` | GET | Dashboard HTML legado (Jinja2) | `dashboard_router.py:93` | **REMOVER** - React tem PerformancePage |
| 3 | `/admin/importar-prompts-producao` | GET, POST | Pagina temporaria de importacao | `admin/router.py:2448` | **REMOVER** - marcado como TEMPORARIO no codigo |
| 4 | `/admin/help/glossary` | GET | Glossario em HTML | `admin/router.py:2632` | **AVALIAR** - adicionar no React ou remover |

**8 espelhos Jinja2** (rotas `/{sistema}/{filename:path}` em `main.py`) tambem sao candidatos a remocao, pois o React serve tudo via SPA catch-all.

### GRUPO B: Autenticacao — nao integrados no React (alta prioridade)

| # | Endpoint | Metodo | O que faz | Arquivo | Acao |
|---|----------|--------|-----------|---------|------|
| 5 | `/auth/logout` | POST | Invalida sessao no servidor | `auth/router.py:236` | **ALERTA** - Frontend faz logout local (limpa token) sem chamar o backend. Sessao fica valida no servidor |
| 6 | `/auth/password-requirements` | GET | Retorna regras de senha | `auth/router.py:277` | **INTEGRAR** - ChangePasswordPage deveria mostrar requisitos |
| 7 | `/auth/quota` | GET | Uso de cota de IA do usuario | `auth/router.py:288` | **INTEGRAR** - util para mostrar ao usuario quanto ja usou |

### GRUPO C: Gestao de IA — admin sem frontend (media prioridade)

| # | Endpoint | Metodo | O que faz | Arquivo | Acao |
|---|----------|--------|-----------|---------|------|
| 8 | `/admin/api-key` | PUT | Atualiza API key Gemini | `admin/router.py:547` | **INTEGRAR** em PromptsPage ou ConfigPecas |
| 9 | `/admin/api-key-status` | GET | Verifica se API key existe | `admin/router.py:508` | **INTEGRAR** junto com o PUT |
| 10 | `/admin/modelos-ia` | GET | Lista modelos IA por sistema | `admin/router.py:411` | **AVALIAR** - PromptsPage usa `/admin/config-ia` (caminho diferente). Possivel duplicacao |
| 11 | `/admin/modelos-ia/{sistema}` | PUT | Atualiza modelo de um sistema | `admin/router.py:471` | **AVALIAR** - mesmo caso acima |

### GRUPO D: Performance/Metricas — funcionalidades ocultas (media prioridade)

PerformancePage usa `summary`, `logs`, `gemini-logs` e `route-mapping`. Os endpoints abaixo existem mas nao sao consumidos:

| # | Endpoint | Metodo | O que faz | Arquivo | Acao |
|---|----------|--------|-----------|---------|------|
| 12 | `/admin/api/performance/actions` | GET | Lista actions para filtro | `router_performance.py:255` | **INTEGRAR** em PerformancePage |
| 13 | `/admin/api/performance/systems` | GET | Lista sistemas para filtro | `router_performance.py:493` | **INTEGRAR** em PerformancePage |
| 14 | `/admin/api/performance/top-routes` | GET | Top rotas mais acessadas | `router_performance.py:451` | **INTEGRAR** em PerformancePage |
| 15 | `/admin/api/performance/cache-stats` | GET | Stats de cache | `router_performance.py:577` | **INTEGRAR** - util para debug |
| 16 | `/admin/api/performance/cache-invalidate` | POST | Limpa caches | `router_performance.py:597` | **INTEGRAR** - botao "Limpar Cache" |
| 17 | `/admin/api/performance/cleanup` | DELETE | Limpa logs antigos | `router_performance.py:270` | **INTEGRAR** - PerformancePage ja tem similar |
| 18 | `/admin/api/performance/frontend-metrics` | POST | Recebe metricas do frontend | `router_performance.py:512` | **AVALIAR** - precisa de instrumentacao no React |
| 19-22 | `/admin/api/performance/route-maps` | CRUD | Mapeia rotas para sistemas | `router_performance.py:318-432` | **INTEGRAR** em PerformancePage |
| 23-25 | `/admin/dashboard/api/*` | GET | APIs do dashboard legado | `dashboard_router.py:31-74` | **REMOVER** com o dashboard legado |

### GRUPO E: Extraction/Deps/Regras — endpoints avancados (baixa prioridade)

Endpoints da CategoriasJsonPage que nao sao chamados diretamente (possivelmente chamados internamente pelo backend ou funcionalidades futuras):

| # | Endpoint | Metodo | O que faz | Acao |
|---|----------|--------|-----------|------|
| 26 | `.../dependencias/avaliar-visibilidade` | POST | Avalia visibilidade de pergunta | **MANTER** - uso interno pelo detector |
| 27 | `.../modelos` | POST | Cria modelo de extracao manual | **AVALIAR** - CategoriasJsonPage usa IA |
| 28 | `.../operadores-dependencia` | GET | Lista operadores para deps | **INTEGRAR** se UI de deps for expandida |
| 29-31 | `.../regras-deterministicas/*` | POST | Gerar/validar/avaliar regras | **MANTER** - usado pelo TesteAtivacao interno |
| 32 | `.../tipos-variaveis` | GET | Tipos de variaveis disponiveis | **INTEGRAR** em VariaveisPage |

### GRUPO F: Teste de Categorias — funcionalidades extras (baixa prioridade)

TesteCategoriasPage usa `categorias`, `validar-processos`, `classificar` e `exportar`. Os abaixo nao:

| # | Endpoint | O que faz | Acao |
|---|----------|-----------|------|
| 33 | `.../baixar-documentos` | Baixa docs por categoria | **INTEGRAR** - funcionalidade util |
| 34 | `.../classificar-comparacao` | Compara 2 modelos de IA | **INTEGRAR** - muito util para testes |
| 35 | `.../classificar-lote` | Classifica docs em lote | **INTEGRAR** |
| 36-37 | `.../documentos*` | CRUD documentos de teste | **INTEGRAR** |
| 38-39 | `.../observacao/{cat_id}` | Notas do usuario por categoria | **INTEGRAR** |
| 40-41 | `.../pdf/*` | Cache de PDF para visualizacao | **MANTER** - suporte para outras funcoes |
| 42 | `.../categoria/{id}/formato` | Obtem formato JSON | **INTEGRAR** |

### GRUPO G: Teste de Ativacao — funcionalidades extras (baixa prioridade)

| # | Endpoint | O que faz | Acao |
|---|----------|-----------|------|
| 43 | `.../cenarios-predefinidos` | Cenarios de exemplo | **INTEGRAR** em TesteAtivacaoPage |
| 44 | `.../debug/modulo/{id}` | Debug de modulo especifico | **MANTER** - endpoint de debug |
| 45 | `.../gerar-variaveis` | Gera vars sem IA | **AVALIAR** - TesteAtivacaoPage usa `gerar-variaveis-ia` |
| 46 | `.../relatorio-ativacao` | Relatorio via LLM | **INTEGRAR** - funcionalidade valiosa |

### GRUPO H: Prestacao de Contas Admin — parcialmente integrado

| # | Endpoint | O que faz | Acao |
|---|----------|-----------|------|
| 47 | `.../estatisticas` | Stats do sistema | **INTEGRAR** em HistoricoPrestacao |
| 48 | `.../logs/{id}` | Logs de IA por geracao | **INTEGRAR** em HistoricoPrestacao |
| 49 | `.../upload-documentos-faltantes` | Upload manual de docs | **ALERTA** - funcionalidade critica nao exposta |

### GRUPO I: Pedido de Calculo Admin — parcialmente integrado

| # | Endpoint | O que faz | Acao |
|---|----------|-----------|------|
| 50 | `.../logs-recentes` | Logs recentes | **INTEGRAR** em HistoricoPedidoCalculo |
| 51 | `.../logs/{log_id}` | Detalhe de um log | **INTEGRAR** em HistoricoPedidoCalculo |

### GRUPO J: Config Pecas/Gerador — endpoints avulsos

| # | Endpoint | O que faz | Acao |
|---|----------|-----------|------|
| 52-53 | `/api/gerador-pecas/config/admin` | Config de parecer NATJus | **INTEGRAR** em ConfigPecasPage |
| 54 | `.../config/categorias-json` | Lista categorias do JSON | **AVALIAR** - possivel duplicata |
| 55 | `.../config/seed` | Popula dados iniciais | **MANTER** - operacao one-time |
| 56 | `.../config/tipos-peca-prompts` | Tipos de peca (fonte: prompts) | **AVALIAR** - possivel duplicata |

### GRUPO K: Normalizacao de Texto — sistema isolado

| # | Endpoint | O que faz | Acao |
|---|----------|-----------|------|
| 57 | `/api/text/normalize` | Normaliza texto de PDF | **AVALIAR** - utilitario potencialmente util |
| 58 | `/api/text/normalize/modes` | Lista modos | **AVALIAR** - mesma decisao |
| 59 | `/api/text/normalize/preview` | Preview de normalizacao | **AVALIAR** - mesma decisao |

### GRUPO L: Cumprimento Beta — verificacao de acesso

| # | Endpoint | O que faz | Acao |
|---|----------|-----------|------|
| 60 | `/api/cumprimento-beta/acesso` | Verifica acesso ao beta | **INTEGRAR** - CumprimentoBetaPage deveria verificar |

---

## 4. Uso interno provavel (Backend-Only)

| Endpoint | Metodo | O que faz | Motivo |
|----------|--------|-----------|--------|
| `/health` | GET | Health check basico | Load balancer / Railway |
| `/health/detailed` | GET | Health check detalhado | Admin (requer auth) |
| `/health/live` | GET | Liveness probe | Kubernetes |
| `/health/ready` | GET | Readiness probe | Kubernetes |
| `/metrics` | GET | Metricas Prometheus | Scraping Prometheus |
| `/metrics/json` | GET | Metricas JSON | Dashboard interno |
| `/vite.svg` | GET | Asset estatico | React build |

---

## 5. Espelhos Legado (Jinja2) — candidatos a remocao

Com o React servindo tudo via SPA catch-all (`/{full_path:path}`), estas rotas sao redundantes:

| Endpoint | Arquivo |
|----------|---------|
| `/assistencia/{filename:path}` | `main.py:902` |
| `/matriculas/{filename:path}` | `main.py:909` |
| `/gerador-pecas/{filename:path}` | `main.py:916` |
| `/pedido-calculo/{filename:path}` | `main.py:923` |
| `/prestacao-contas/{filename:path}` | `main.py:930` |
| `/relatorio-cumprimento/{filename:path}` | `main.py:937` |
| `/classificador/{filename:path}` | `main.py:944` |
| `/bert-training/templates/{filename:path}` | `main.py:951` |

**Atencao**: Remover so apos confirmar que nenhum template Jinja2 e carregado em producao.

---

## 6. Acoes recomendadas

### Prioridade ALTA (seguranca + UX critica)

- [ ] **ALERTA `/auth/logout`**: Frontend faz logout local sem invalidar sessao no servidor. Integrar chamada ao backend no `auth-store.ts:logout()`
- [ ] **ALERTA `/admin/api/prestacao-admin/upload-documentos-faltantes`**: Funcionalidade critica (upload manual quando TJ-MS falha) sem acesso pelo React. Adicionar botao em HistoricoPrestacaoContasPage
- [ ] **`/auth/quota`**: Mostrar ao usuario seu uso de cota de IA (ex: badge no header ou no dashboard)
- [ ] **`/auth/password-requirements`**: ChangePasswordPage deveria mostrar requisitos de senha

### Prioridade MEDIA (funcionalidades uteis ocultas)

- [ ] **API key Gemini** (`/admin/api-key*`): Adicionar secao em PromptsPage para gerenciar API key
- [ ] **Performance extras** (6 endpoints): Expandir PerformancePage com filtros, top routes e cache
- [ ] **Teste Categorias extras** (10 endpoints): Expandir TesteCategoriasPage com comparacao de modelos, docs de teste, lote
- [ ] **Teste Ativacao extras** (4 endpoints): Adicionar cenarios predefinidos e relatorio de ativacao
- [ ] **Prestacao/Pedido admin logs**: Mostrar logs de IA nas paginas de historico admin

### Prioridade BAIXA (limpeza)

- [ ] **Remover** `_frame-bridge`, `/admin/dashboard` (HTML), `/admin/importar-prompts-producao`
- [ ] **Remover** espelhos Jinja2 (8 rotas) apos confirmar que nao ha acesso direto em producao
- [ ] **Avaliar** `/admin/modelos-ia` vs `/admin/config-ia` — possivel duplicacao
- [ ] **Avaliar** normalizacao de texto (`/api/text/normalize*`) — decidir se expor ou documentar
- [ ] **Documentar** endpoints backend-only (health, metrics) no guia de operacoes

---

## 7. Checklist de Follow-up (por sprint)

### Sprint 1 — Seguranca e quick wins
- [ ] Integrar `/auth/logout` no auth-store do React
- [ ] Integrar `/auth/password-requirements` em ChangePasswordPage
- [ ] Integrar `/auth/quota` como badge ou widget
- [ ] Integrar `/api/cumprimento-beta/acesso` em CumprimentoBetaPage

### Sprint 2 — Admin enriquecido
- [ ] Adicionar gestao de API key Gemini no admin
- [ ] Expandir PerformancePage (filtros, top routes, cache)
- [ ] Integrar logs de IA em HistoricoPrestacao e HistoricoPedido
- [ ] Expor upload de documentos faltantes na Prestacao de Contas

### Sprint 3 — Ferramentas de teste
- [ ] Expandir TesteCategoriasPage (comparacao, lote, docs)
- [ ] Expandir TesteAtivacaoPage (cenarios predefinidos, relatorio)
- [ ] Avaliar e decidir sobre normalizacao de texto

### Sprint 4 — Limpeza
- [ ] Remover paginas legadas (frame-bridge, dashboard HTML, importar-prompts)
- [ ] Remover espelhos Jinja2 (apos telemetria confirmar zero acessos)
- [ ] Remover/consolidar endpoints duplicados (modelos-ia vs config-ia)

---

## 8. Observacao sobre telemetria

Este relatorio e baseado em **analise estatica do codigo-fonte**.
Nao ha telemetria de producao para confirmar se os endpoints sao chamados em runtime
(ex: por scripts externos, integracoes ou usuarios com bookmarks diretos).

**Recomendacao**: Antes de remover qualquer endpoint, adicionar logging de acesso
por 30 dias para confirmar que ninguem o usa diretamente.
