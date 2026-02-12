# Matriz de Cobertura — Full Regression Frontend React

> Gerado em: 2026-02-11
> Suite: `e2e/full-regression-*.spec.ts`
> Config: `playwright.full-regression.config.ts`
> Comando: `npm run test:full-regression`

## Resumo

| Metrica | Valor |
|---------|-------|
| Total de rotas | 45 |
| Rotas cobertas | 45 |
| Rotas alias | 7 |
| Testes auth | 8 |
| Testes portal | 45 |
| Testes admin | 53 |
| Testes erros | 12 |
| **Total** | **118** |
| **Taxa sucesso** | **100%** |
| **Tempo execução** | **2.7 min** |

## Cobertura por Rota

### Rotas Públicas (2)

| # | Path | Status | Spec | Testes |
|---|------|--------|------|--------|
| 1 | `/` | Coberta | auth | Redirect → /dashboard |
| 2 | `/login` | Coberta | auth | Render, login válido, login inválido |

### Rotas Portal (13)

| # | Path | Status | Spec | Testes |
|---|------|--------|------|--------|
| 3 | `/dashboard` | Coberta | portal | Render, cards sistemas, navegação |
| 4 | `/gerador-pecas` | Coberta | portal | Render, input processo, preencher |
| 5 | `/extrator-autos` | Coberta | portal | Render, inputs/tabs, troca tab |
| 6 | `/classificador` | Coberta | portal | Render, elementos interativos |
| 7 | `/pedido-calculo` | Coberta | portal | Render, input processo, preencher |
| 8 | `/prestacao-contas` | Coberta | portal | Render, input processo |
| 9 | `/relatorio-cumprimento` | Coberta | portal | Render, input processo |
| 10 | `/cumprimento-beta` | Coberta | portal | Render, interativos |
| 11 | `/assistencia` | Coberta | portal | Render, input processo |
| 12 | `/matriculas` | Coberta | portal | Render, interativos |
| 13 | `/bert-training` | Coberta | portal | Render, botões |
| 14 | `/change-password` | Coberta | portal | Render, 3 inputs senha, botão salvar |
| 15 | `/dev/design-system` | Coberta | portal | Render, showcase |

### Rotas Admin Únicas (17)

| # | Path | Status | Spec | Testes |
|---|------|--------|------|--------|
| 16 | `/admin/users` | Coberta | admin | Render, tabela, botão novo |
| 17 | `/admin/prompts` | Coberta | admin | Render, conteúdo |
| 18 | `/admin/prompts-modulos` | Coberta | admin | Render, conteúdo |
| 19 | `/admin/feedbacks` | Coberta | admin | Render, KPIs, exportar |
| 20 | `/admin/performance` | Coberta | admin | Render, tabs, troca tab |
| 21 | `/admin/variaveis` | Coberta | admin | Render, KPIs |
| 22 | `/admin/categorias-json` | Coberta | admin | Render, conteúdo |
| 23 | `/admin/historico-gerador` | Coberta | admin | Render, conteúdo |
| 24 | `/admin/historico-pedido-calculo` | Coberta | admin | Render, conteúdo |
| 25 | `/admin/historico-prestacao-contas` | Coberta | admin | Render, conteúdo |
| 26 | `/admin/modulos-tipo-peca` | Coberta | admin | Render, conteúdo |
| 27 | `/admin/config-pecas` | Coberta | admin | Render, conteúdo |
| 28 | `/admin/teste-ativacao` | Coberta | admin | Render, conteúdo |
| 29 | `/admin/teste-categorias` | Coberta | admin | Render, conteúdo |
| 30 | `/admin/tjms-docs` | Coberta | admin | Render, documentação |
| 31 | `/admin/tjms-docs/plano` | Coberta | admin | Render |
| 32 | `/admin/restaurar-slugs` | Coberta | admin | Render, botão |

### Rotas Admin Alias (7)

| # | Path | Alias de | Status | Spec |
|---|------|----------|--------|------|
| 33 | `/admin/prompts-config` | `/admin/prompts` | Coberta | admin aliases |
| 34 | `/admin/categorias-resumo-json` | `/admin/categorias-json` | Coberta | admin aliases |
| 35 | `/admin/gerador-pecas/historico` | `/admin/historico-gerador` | Coberta | admin aliases |
| 36 | `/admin/pedido-calculo/debug` | `/admin/historico-pedido-calculo` | Coberta | admin aliases |
| 37 | `/admin/prestacao-contas/debug` | `/admin/historico-prestacao-contas` | Coberta | admin aliases |
| 38 | `/admin/prompts-modulos/teste` | `/admin/teste-ativacao` | Coberta | admin aliases |
| 39 | `/admin/categorias-resumo-json/teste` | `/admin/teste-categorias` | Coberta | admin aliases |

### Testes Transversais

| Categoria | Testes | Spec |
|-----------|--------|------|
| Auth: login, logout, guards | 8 | auth |
| Sidebar portal: navegação | 10 | portal |
| Sidebar admin: navegação | 10 | admin |
| Console.error audit (portal) | 4 | portal |
| Console.error audit (admin) | 5 | errors |
| Erro 401: redirect | 2 | errors |
| Erro 422: validação | 1 | errors |
| Erro 500: crash prevention | 2 | errors |
| Rota inexistente (404) | 2 | errors |

## Dependências

- **Backend**: Nenhuma (100% mocked)
- **Browser**: Chromium (via Playwright)
- **Feature flags**: Removidos (tudo React nativo)

## Limitações Conhecidas

1. **SSE/Streaming**: Não testado (requer backend real)
2. **Uploads reais**: Mocked (não envia arquivo real ao backend)
3. **Dados dinâmicos**: Mocks retornam dados estáticos
4. **Mobile**: Não coberto nesta suite (usar visual parity para mobile)
5. **Ações destrutivas**: Dialogs abertos e cancelados, nunca confirmados

## Como Executar

```bash
cd frontend-react

# Rodar suite completa
npm run test:full-regression

# Rodar spec específica
npx playwright test -c playwright.full-regression.config.ts e2e/full-regression-auth.spec.ts

# Rodar com UI
npx playwright test -c playwright.full-regression.config.ts --ui

# Ver relatório HTML
npx playwright show-report e2e-artifacts/full-regression-report
```
