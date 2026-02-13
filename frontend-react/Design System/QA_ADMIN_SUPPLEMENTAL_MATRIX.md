# QA Admin Supplemental — Matriz de Rotas

> Inventario de todas as rotas `/admin/*` do frontend-react.
> Fonte da verdade: `src/router.tsx` (branch `feat/tailadmin-dashboard`).

## Legenda

| Coluna | Descricao |
|--------|-----------|
| Rota | Path no router |
| Componente | Componente React renderizado |
| Auth | Requer autenticacao (todas sim — `AuthGuard`) |
| Alias | Rotas alternativas que renderizam o mesmo componente |
| Elementos esperados | Componentes criticos que devem estar visiveis |
| Acoes principais | Botoes/interacoes disponiveis na pagina |

## Rotas Admin (17 unicas + 7 alias)

| # | Rota | Componente | Auth | Alias | Elementos esperados | Acoes principais |
|---|------|-----------|------|-------|---------------------|------------------|
| 1 | `/admin/users` | UsersPage | Sim | — | heading, tabela, filtro agrupar-por | Criar usuario, editar, excluir, filtrar por sistema/setor |
| 2 | `/admin/prompts` | PromptsPage | Sim | `/admin/prompts-config` | heading, lista/cards de prompts | Criar padrao, editar prompt, restaurar padrao |
| 3 | `/admin/prompts-modulos` | PromptsModulosPage | Sim | — | heading, lista de modulos | Criar modulo, editar, excluir |
| 4 | `/admin/feedbacks` | FeedbacksPage | Sim | — | heading, graficos, filtros (sistema/mes/ano/avaliacao), secoes | Exportar, auditoria, limpar filtros, paginacao |
| 5 | `/admin/performance` | PerformancePage | Sim | — | heading, tabs (performance/gemini/logs), cards gargalo, filtros | Refresh, limpar filtros, trocar tab, limpar logs antigos |
| 6 | `/admin/variaveis` | VariaveisPage | Sim | — | heading, toggle modo visualizacao, checkbox inativos | Glossario, ajuda, expandir/colapsar, trocar modo |
| 7 | `/admin/categorias-json` | CategoriasJsonPage | Sim | `/admin/categorias-resumo-json` | heading, botao ajuda | Criar categoria, editar, ajuda |
| 8 | `/admin/historico-gerador` | HistoricoGeradorPage | Sim | `/admin/gerador-pecas/historico` | heading, tabela | Filtrar, paginacao, ver detalhes |
| 9 | `/admin/historico-pedido-calculo` | HistoricoPedidoCalculoPage | Sim | `/admin/pedido-calculo/debug` | heading, tabela | Filtrar, paginacao, ver detalhes |
| 10 | `/admin/historico-prestacao-contas` | HistoricoPrestacaoContasPage | Sim | `/admin/prestacao-contas/debug` | heading, tabela | Filtrar, paginacao, ver detalhes |
| 11 | `/admin/modulos-tipo-peca` | ModulosTipoPecaPage | Sim | — | heading | Configurar modulos por tipo de peca |
| 12 | `/admin/config-pecas` | ConfigPecasPage | Sim | — | heading, acoes admin | Nova categoria, carregar dados iniciais, sincronizar prompts |
| 13 | `/admin/teste-ativacao` | TesteAtivacaoPage | Sim | `/admin/prompts-modulos/teste` | heading, select tipo-peca, textarea, tabs | Simular, gerar variaveis IA, exportar JSON, salvar cenario |
| 14 | `/admin/teste-categorias` | TesteCategoriasPage | Sim | `/admin/categorias-resumo-json/teste` | heading, select categoria, textarea, tabs | Classificar, baixar todos, limpar, comparar modelos |
| 15 | `/admin/tjms-docs` | TjmsDocsPage | Sim | — | heading, link ver plano | Navegar documentacao |
| 16 | `/admin/tjms-docs/plano` | TjmsDocsPage | Sim | — | heading | Visualizar plano completo |
| 17 | `/admin/restaurar-slugs` | RestaurarSlugsPage | Sim | — | heading, botao restaurar | Restaurar slugs |

## Botoes potencialmente destrutivos (heuristica)

Os seguintes botoes/acoes SAO considerados destrutivos e NAO devem ser clicados nos testes
(exceto para abrir confirmacao e cancelar):

| Rota | Botao/Acao | Motivo |
|------|-----------|--------|
| `/admin/users` | Excluir usuario | Mutacao destrutiva |
| `/admin/users` | Desativar usuario | Mutacao de estado |
| `/admin/prompts` | Restaurar padrao | Sobrescreve prompts |
| `/admin/config-pecas` | Carregar dados iniciais | Mutacao em massa |
| `/admin/config-pecas` | Sincronizar prompts | Mutacao em massa |
| `/admin/restaurar-slugs` | Restaurar | Mutacao em massa |
| `/admin/performance` | Limpar logs antigos | Deleta dados |

## Botoes seguros para clicar

| Tipo | Exemplos | Efeito esperado |
|------|----------|----------------|
| Tab | tab-performance, tab-gemini, tab-advanced-logs | Troca conteudo da tab |
| Filtro | filtro-sistema, filtro-mes, select-time-period | Altera visualizacao |
| Toggle | toggle-comparar-modelos, view-mode-toggle | Altera modo de exibicao |
| Dialog opener | Nova Categoria, Ajuda, Glossario | Abre dialog (fechar depois) |
| Expand/Collapse | btn-expand-all, btn-collapse-all | Expande/recolhe secoes |
| Exportar | btn-exportar | Dispara download (mock intercepta) |
| Limpar filtros | btn-limpar-filtros, btn-clear-filters | Reseta filtros |
