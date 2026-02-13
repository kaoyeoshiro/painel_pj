# Cruzamento: Rotas Orfas x Frontend Legado (Jinja2)

> Gerado em 12/02/2026 | Branch: `refactor/backend-cleanup`
> Complemento do `RELATORIO_BACKEND_NAO_USADO_PELO_FRONT.md`

---

## Objetivo

Para cada rota orfa (nao usada pelo React), verificar se ela **era usada no frontend legado Jinja2**.
Isso permite classificar cada orfa em:

- **REGRESSAO**: Existia no legado, nao foi migrada para o React. Precisa ser integrada.
- **NUNCA EXPOSTA**: Nunca teve UI. Endpoint foi criado mas nunca conectado ao frontend.
- **BACKEND-ONLY**: Uso interno (chamado por outro endpoint, infra, etc.)

---

## Resumo

| Classificacao | Qtd | Significado |
|---|---|---|
| REGRESSAO (tinha UI no legado) | **27** | Funcionalidade perdida na migracao |
| NUNCA EXPOSTA (sem UI em nenhum front) | **21** | Endpoint criado sem frontend |
| BACKEND-ONLY / LEGADO PURO | **10** | Paginas HTML legadas ou uso interno |
| INFRA | **6** | Health, metrics, assets |

---

## Detalhamento por Grupo

### GRUPO A: Paginas/Endpoints Legados

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 1 | `/admin/_frame-bridge` | Sim (main.py) | **LEGADO PURO** | Usado pelo iframe dev do legado. Nao migrar — remover. |
| 2 | `/admin/dashboard` | Sim (dashboard_router.py) | **LEGADO PURO** | Dashboard HTML proprio com `/admin/dashboard/api/metrics`. React tem PerformancePage. Remover. |
| 3 | `/admin/importar-prompts-producao` | Sim (admin/router.py) | **LEGADO PURO** | Marcado como TEMPORARIO no codigo. Remover. |
| 4 | `/admin/help/glossary` | **Sim** — `admin_variaveis.html:1751`, `admin_prompts_modulos.html:6413` | **REGRESSAO** | Glossario de termos. Usado em 2 paginas legadas. Migrar ou remover. |

### GRUPO B: Autenticacao

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 5 | `/auth/logout` | **Sim** — `dashboard.html:528` | **REGRESSAO** | Legado chamava `POST /auth/logout`. React faz so logout local. **Seguranca.** |
| 6 | `/auth/password-requirements` | Nao | **NUNCA EXPOSTA** | Endpoint criado mas nunca consumido por nenhum frontend. |
| 7 | `/auth/quota` | Nao | **NUNCA EXPOSTA** | Endpoint criado mas nunca consumido por nenhum frontend. |

### GRUPO C: Gestao de IA

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 8 | `/admin/api-key` (PUT) | Nao | ~~NUNCA EXPOSTA~~ **REMOVIDO** | API key e config de servidor, nao precisa de UI. Rota deletada. |
| 9 | `/admin/api-key-status` (GET) | Nao | ~~NUNCA EXPOSTA~~ **REMOVIDO** | Idem. Rota deletada. |
| 10 | `/admin/modelos-ia` (GET) | **Sim** — `admin_prompts.html:1049`, `admin_feedbacks.html:1107` | **REGRESSAO** | Listava modelos disponiveis em 2 paginas admin. |
| 11 | `/admin/modelos-ia/{sistema}` (PUT) | **Sim** — `admin_prompts.html:1081` | **REGRESSAO** | Atualizava modelo por sistema na PromptsPage legada. |

### GRUPO D: Performance/Metricas

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 12 | `.../performance/actions` | **Sim** — `admin_performance.html:916` | ~~REGRESSAO~~ **MIGRADO** | Alimentava filtro de actions. Integrado em PerformancePage (dropdown dinamico). |
| 13 | `.../performance/systems` | **Sim** — `admin_performance.html:1147` | ~~REGRESSAO~~ **MIGRADO** | Alimentava filtro de sistemas. Integrado em PerformancePage (dropdown dinamico). |
| 14 | `.../performance/top-routes` | **Sim** — `admin_performance.html:1008` | ~~REGRESSAO~~ **MIGRADO** | Tabela de top rotas sem mapeamento. Integrado em PerformancePage. |
| 15 | `.../performance/cache-stats` | Nao | ~~NUNCA EXPOSTA~~ **INTEGRADO** | Invalidacao de cache via botao no header da PerformancePage. |
| 16 | `.../performance/cache-invalidate` | Nao | ~~NUNCA EXPOSTA~~ **INTEGRADO** | Botao "Limpar Cache" no header da PerformancePage. |
| 17 | `.../performance/cleanup` | **Sim** — `admin_performance.html:1162` | ~~REGRESSAO~~ **MIGRADO** | Botao "Limpar" com seletor de dias. Integrado em PerformancePage. |
| 18 | `.../performance/frontend-metrics` | **Sim** — `admin_categorias_json.html:948` | **REGRESSAO** | Enviava metricas de frontend automaticamente. (Instrumentacao global, nao UI) |
| 19-22 | `.../performance/route-maps` (CRUD) | **Sim** — `admin_performance.html:962,1058,1098,1125` | ~~REGRESSAO~~ **MIGRADO** | CRUD completo com Dialog. Integrado em PerformancePage. |
| 23-25 | `/admin/dashboard/api/*` | **Sim** — `dashboard_router.py:290` (consumo interno) | **LEGADO PURO** | APIs do dashboard HTML legado. Remover junto com `/admin/dashboard`. |

### GRUPO E: Extraction/Deps/Regras

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 26 | `.../dependencias/avaliar-visibilidade` | Nao | **BACKEND-ONLY** | Usado internamente pelo detector de modulos. |
| 27 | `.../modelos` (POST) | Nao | **NUNCA EXPOSTA** | Criacao manual de modelo. Nunca teve UI. |
| 28 | `.../operadores-dependencia` | Nao | **NUNCA EXPOSTA** | Nunca consumido por nenhum frontend. |
| 29-31 | `.../regras-deterministicas/*` | **Sim** — `admin_prompts_modulos.html:4392,4666,7474` | **REGRESSAO** | Geracao automatica de regras via IA na pagina de modulos. |
| 32 | `.../tipos-variaveis` | Nao | **NUNCA EXPOSTA** | Endpoint existe mas sem UI. |

### GRUPO F: Teste de Categorias

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 33 | `.../baixar-documentos` | **Sim** — `admin_teste_categorias_json.html:720,784,1945,2019` | ~~REGRESSAO~~ **MIGRADO** | Download de documentos por categoria. Integrado em TesteCategoriasPage. |
| 34 | `.../classificar-comparacao` | **Sim** — `admin_teste_categorias_json.html:1055,1260` | ~~REGRESSAO~~ **MIGRADO** | Comparacao lado-a-lado de 2 modelos. Integrado em TesteCategoriasPage. |
| 35 | `.../classificar-lote` | **Sim** — `admin_teste_categorias_json.html:932,2068` | ~~REGRESSAO~~ **MIGRADO** | Classificacao em lote. Integrado em TesteCategoriasPage. |
| 36-37 | `.../documentos*` | **Sim** — `admin_teste_categorias_json.html:551,622,670,...` (14 refs) | ~~REGRESSAO~~ **MIGRADO** | CRUD de documentos de teste. Integrado em TesteCategoriasPage. |
| 38-39 | `.../observacao/{cat_id}` | **Sim** — `admin_teste_categorias_json.html:2453,2469` | ~~REGRESSAO~~ **MIGRADO** | Observacoes persistentes por categoria. Integrado em TesteCategoriasPage. |
| 40-41 | `.../pdf/*` | Nao | **BACKEND-ONLY** | Cache de PDF usado internamente por outros endpoints. |
| 42 | `.../categoria/{id}/formato` | **Sim** — `admin_teste_categorias_json.html:561` | ~~REGRESSAO~~ **MIGRADO** | Formato JSON por categoria. Integrado em TesteCategoriasPage. |

### GRUPO G: Teste de Ativacao

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 43 | `.../cenarios-predefinidos` | **Sim** — `admin_teste_ativacao_modulos.html:1121` | ~~REGRESSAO~~ **MIGRADO** | Cenarios predefinidos. Integrado em TesteAtivacaoPage. |
| 44 | `.../debug/modulo/{id}` | Nao | **BACKEND-ONLY** | Endpoint de debug sem UI. |
| 45 | `.../gerar-variaveis` (sem IA) | **Sim** — `admin_teste_ativacao_modulos.html:755` | **REGRESSAO** | Geracao de variaveis SEM chamar IA (mais rapido). |
| 46 | `.../relatorio-ativacao` | **Sim** — `admin_teste_ativacao_modulos.html:1201` | ~~REGRESSAO~~ **MIGRADO** | Relatorio IA sobre ativacao. Integrado em TesteAtivacaoPage. |

### GRUPO H: Prestacao de Contas Admin

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 47 | `.../estatisticas` | Nao | **NUNCA EXPOSTA** | Sem referencia no legado. |
| 48 | `.../logs/{id}` | Nao | **NUNCA EXPOSTA** | Sem referencia no legado. |
| 49 | `.../upload-documentos-faltantes` | **Sim** — `admin_prestacao_contas_historico.html:832` + `prestacao_contas/templates/index.html:1827,1963` | ~~REGRESSAO~~ **MIGRADO** | Upload de documentos faltantes. Integrado em HistoricoPrestacaoContasPage. |

### GRUPO I: Pedido de Calculo Admin

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 50 | `.../logs-recentes` | Nao | **NUNCA EXPOSTA** | Sem referencia no legado. |
| 51 | `.../logs/{log_id}` | Nao | **NUNCA EXPOSTA** | Sem referencia no legado. |

### GRUPO J: Config Pecas/Gerador

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 52-53 | `/api/gerador-pecas/config/admin` | **Sim** — `dashboard.html:427` (link direto) | **REGRESSAO** | Link no dashboard legado para config NATJus. |
| 54 | `.../config/categorias-json` | **Sim** — `admin_config_pecas.html:330` | **REGRESSAO** | Lista de categorias JSON na ConfigPecas legada. |
| 55 | `.../config/seed` | Nao | **BACKEND-ONLY** | Operacao one-time de seed. Nunca exposto em UI. |
| 56 | `.../config/tipos-peca-prompts` | **Sim** — `admin_config_pecas.html:360` | **REGRESSAO** | Tipos de peca (fonte: prompts) na ConfigPecas legada. |

### GRUPO K: Normalizacao de Texto

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 57 | `/api/text/normalize` | Nao | **NUNCA EXPOSTA** | Nunca teve UI em nenhum frontend. |
| 58 | `/api/text/normalize/modes` | Nao | **NUNCA EXPOSTA** | Idem. |
| 59 | `/api/text/normalize/preview` | Nao | **NUNCA EXPOSTA** | Idem. |

### GRUPO L: Cumprimento Beta

| # | Rota | Legado? | Classificacao | Detalhe |
|---|------|---------|---------------|---------|
| 60 | `/api/cumprimento-beta/acesso` | Nao | **NUNCA EXPOSTA** | Nunca teve UI. |

---

## Resumo por Acao Recomendada

### REGRESSOES (27 endpoints) — Funcionalidade perdida na migracao

Estes endpoints **tinham UI no legado** e precisam ser avaliados para integracao no React:

| Prioridade | Grupo | Endpoints | Template legado | Pagina React alvo |
|---|---|---|---|---|
| **ALTA** | B | `/auth/logout` | `dashboard.html` | `auth-store.ts` |
| **ALTA** | H | `upload-documentos-faltantes` | `admin_prestacao_contas_historico.html` + `prestacao_contas/index.html` | `HistoricoPrestacaoContasPage` |
| MEDIA | C | `modelos-ia` (GET/PUT) | `admin_prompts.html`, `admin_feedbacks.html` | `PromptsPage` |
| MEDIA | D | 8 endpoints performance | `admin_performance.html` | `PerformancePage` |
| MEDIA | D | `frontend-metrics` | `admin_categorias_json.html` | Instrumentacao global |
| MEDIA | E | `regras-deterministicas/gerar` | `admin_prompts_modulos.html` | `PromptsModulosPage` |
| MEDIA | F | 10 endpoints teste-categorias | `admin_teste_categorias_json.html` | `TesteCategoriasPage` |
| MEDIA | G | 3 endpoints teste-ativacao | `admin_teste_ativacao_modulos.html` | `TesteAtivacaoPage` |
| MEDIA | J | 3 endpoints config | `admin_config_pecas.html`, `dashboard.html` | `ConfigPecasPage` |
| BAIXA | A | `help/glossary` | `admin_variaveis.html`, `admin_prompts_modulos.html` | Componente compartilhado ou remover |

### NUNCA EXPOSTAS (21 endpoints) — Decidir: integrar ou remover

Endpoints que **nunca tiveram UI em nenhum frontend**:

| Grupo | Endpoints | Decisao sugerida |
|---|---|---|
| B | `password-requirements`, `quota` | **INTEGRAR** — uteis para UX |
| C | `api-key`, `api-key-status` | **INTEGRAR** — gestao de API key |
| D | `cache-stats`, `cache-invalidate` | **INTEGRAR** — util para admin |
| E | `modelos` (POST), `operadores-dependencia`, `tipos-variaveis` | **AVALIAR** — baixa prioridade |
| H | `estatisticas`, `logs/{id}` | **AVALIAR** — podem enriquecer o historico |
| I | `logs-recentes`, `logs/{log_id}` | **AVALIAR** — idem |
| K | 3 endpoints normalize | **AVALIAR** — sistema isolado sem demanda clara |
| L | `cumprimento-beta/acesso` | **INTEGRAR** — verificacao de acesso no beta |

### BACKEND-ONLY / LEGADO PURO (16 endpoints) — Nao migrar

| Tipo | Endpoints | Acao |
|---|---|---|
| LEGADO PURO | `_frame-bridge`, `/admin/dashboard`, `importar-prompts-producao`, `dashboard/api/*` (3) | **REMOVER** apos confirmar zero uso |
| BACKEND-ONLY | `avaliar-visibilidade`, `pdf/*` (2), `debug/modulo/{id}`, `config/seed` | **MANTER** — uso interno |
| INFRA | `health` (4), `metrics` (2), `vite.svg` | **MANTER** — infraestrutura |

---

## Proximos Passos

1. **Sprint 1 (Seguranca)**: Migrar `/auth/logout` e `upload-documentos-faltantes` — sao regressoes criticas
2. **Sprint 2 (Performance + IA)**: Migrar os 8 endpoints de performance e `modelos-ia` — o legado ja tinha UI completa para referenciar
3. **Sprint 3 (Ferramentas de teste)**: Migrar endpoints de TesteCategoriasPage (10 endpoints) e TesteAtivacaoPage (3 endpoints) — consultar templates legados como referencia de UX
4. **Sprint 4 (Limpeza)**: Remover endpoints legado-puro e avaliar os "nunca expostos"

**Dica**: Para cada regressao, consultar o template legado indicado na coluna "Template legado" para entender a UX original antes de recriar no React.
