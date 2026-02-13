# Relatorio QA: Suite Admin Destructive

> Data: 2026-02-11
> Suite: `test:admin-destructive`
> Config: `playwright.admin-destructive.config.ts`

---

## Resumo Executivo

| Metrica | Valor |
|---|---|
| Total de testes | **36** |
| Passaram | **36** (100%) |
| Falharam | **0** |
| Rotas admin cobertas | **16 de 16** (100%) |
| Testes de render (R) | 16 |
| Testes de interacao (I) | 13 |
| Testes destrutivos (D) | 7 |
| Tempo de execucao | ~1.8 min |

---

## Validacao de Build

| Etapa | Status |
|---|---|
| `tsc --noEmit` | OK (0 erros) |
| `vite build` | OK (12.93s, 2643 modulos) |
| `test:admin-destructive` | **36/36 passaram** |

---

## Cobertura por Rota

### 01. /admin/users (6 testes)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 1 | R | Titulo "Gerenciamento de Usuarios" e tabela com usuarios | PASS |
| 2 | I | Abrir/fechar dialog "Novo Usuario" pelo X | PASS |
| 3 | I | Abrir/fechar dialog "Editar" pelo Cancelar | PASS |
| 4 | I | Select "Agrupar por" troca para view agrupada | PASS |
| 5 | D | Excluir usuario (dialog confirmacao + refetch) | PASS |
| 6 | D | Resetar senha (API POST + dialog com nova senha) | PASS |

### 02. /admin/prompts (3 testes)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 7 | R | Titulo "Gerenciamento de Prompts e IA" e card de prompt | PASS |
| 8 | I | Botao "Editar" abre dialog, fecha pelo X | PASS |
| 9 | D | Restaurar prompt ao padrao (dialog confirmacao) | PASS |

### 03. /admin/prompts-modulos (2 testes)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 10 | R | Titulo "Modulos de Prompts" visivel | PASS |
| 11 | I | Abrir dialog "Gerenciar Grupos", verificar grupo, fechar X | PASS |

### 04. /admin/feedbacks (1 teste)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 12 | R | Titulo "Dashboard de Feedbacks" e cards de metricas | PASS |

### 05. /admin/performance (3 testes)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 13 | R | Titulo "Performance & Logs" e cards de gargalo | PASS |
| 14 | I | Navegar tabs (Performance Sistema → Gemini API → Avancados) | PASS |
| 15 | D | Limpar logs antigos (botao executa sem confirmacao) | PASS |

### 06. /admin/variaveis (2 testes)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 16 | R | Titulo "Painel de Variaveis", cards (total=25) e tabela (valor_causa) | PASS |
| 17 | I | Abrir/fechar dialog Glossario (heading + fechar pelo X) | PASS |

### 07. /admin/categorias-json (2 testes render + 7 testes close = 9 total)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 18 | R | Titulo "Categorias JSON" e grid de categorias | PASS |
| 19 | D | Desativar categoria (confirmacao + card desaparece) | PASS |
| 20 | I | Botao X tem aria-label="Fechar" e data-testid | PASS |
| 21 | I | Fechar editor pelo X | PASS |
| 22 | I | Fechar editor pelo "Fechar" (footer) | PASS |
| 23 | I | ESC NAO fecha o dialog (intencional) | PASS |
| 24 | I | Abrir/fechar "Nova Categoria" pelo X | PASS |
| 25 | I | Reabrir dialog apos fechar pelo X | PASS |
| 26 | I | Dialog desativacao fecha pelo X e pelo Cancelar | PASS |

### 08. /admin/historico-gerador (1 teste)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 27 | R | Titulo "Historico - Gerador de Pecas" | PASS |

### 09. /admin/historico-pedido-calculo (1 teste)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 28 | R | Titulo "Historico - Pedido de Calculo" | PASS |

### 10. /admin/historico-prestacao-contas (1 teste)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 29 | R | Titulo "Historico - Prestacao de Contas" | PASS |

### 11. /admin/modulos-tipo-peca (1 teste)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 30 | R | Titulo "Modulos por Tipo de Peca" | PASS |

### 12. /admin/config-pecas (1 teste)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 31 | R | Titulo "Configuracao de Pecas" | PASS |

### 13. /admin/teste-ativacao (1 teste)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 32 | R | Titulo "Teste de Ativacao de Modulos" | PASS |

### 14. /admin/teste-categorias (1 teste)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 33 | R | Titulo "Ambiente de Teste de Categorias" | PASS |

### 15. /admin/tjms-docs (1 teste)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 34 | R | Titulo "Documentacao Integracao TJ-MS" | PASS |

### 16. /admin/restaurar-slugs (2 testes)

| # | Tipo | Teste | Status |
|---|---|---|---|
| 35 | R | Titulo "Restaurar Slugs" visivel | PASS |
| 36 | D | Executar restauracao (POST + resultado JSON) | PASS |

---

## Bug Corrigido nesta Suite

### CategoriaEditorDialog: botao X nao fechava o dialog

- **Arquivo**: `src/pages/admin/categorias-json/components/CategoriaEditorDialog.tsx`
- **Causa**: `Dialog` com `onOpenChange` customizado para bloquear ESC/click-fora
  estava tambem bloqueando o `DialogPrimitive.Close` (botao X).
- **Fix**: Adicionado `data-testid="dialog-close-btn"` + `aria-label="Fechar"`
  ao `DialogPrimitive.Close` no componente `DialogContent` (Shadcn).
  A logica de `onOpenChange` foi ajustada para respeitar o X button.
- **Cobertura**: 7 testes especificos em `categorias-json-close.spec.ts`

---

## Padroes Aprendidos (Playwright + React + Radix)

### 1. BreadcrumbBar renderiza titulo como `<span>`, nao `<h1>`/`<h2>`
- Usar `getByText('titulo exato')` em vez de `getByRole('heading')`
- Dialogs (DialogTitle) SIM renderizam como `<h2>` — ok usar `getByRole('heading')`

### 2. Dialogs Radix tem 2 botoes "Fechar" (strict mode!)
- Footer button `<Button>Fechar</Button>`
- X button `<button aria-label="Fechar" data-testid="dialog-close-btn">`
- **Solucao**: usar `getByTestId('dialog-close-btn')` para fechar via X

### 3. Performance tabs sao `<button>`, nao Radix `<Tabs>`
- Usar `getByRole('button', { name: /Logs Gemini API/i })`, nao `getByRole('tab')`

### 4. PromptGroup tem interfaces diferentes por pagina
- `PromptsModulosPage`: `{ nome: string }` (em portugues)
- `ModulosTipoPecaPage`: `{ name: string }` (em ingles)
- Mock data deve respeitar a interface de cada pagina

### 5. Scope de locators em dialogs
- Quando texto aparece tanto no dialog quanto na pagina (ex: nome do grupo
  no combobox + dialog), scoped ao dialog: `dialog.getByText('...')`

### 6. Regex para rotas com query params
- Usar regex `/\/api\/path\?/` em vez de glob `**/path?**` para clareza
- Playwright glob `?` match ANY single char exceto `/` — funciona mas e confuso

---

## Arquivos Criados/Modificados

| Arquivo | Tipo | Descricao |
|---|---|---|
| `playwright.admin-destructive.config.ts` | Criado | Config com trace, screenshot, video, reporter HTML |
| `e2e/admin-destructive/fixtures.ts` | Criado | Fixture de auth + mocks base para suite |
| `e2e/admin-destructive/admin-render-interactions.spec.ts` | Criado | 29 testes (16 render, 6 interacao, 7 destrutivos) |
| `e2e/admin-destructive/categorias-json-close.spec.ts` | Criado | 7 testes de fechar dialog (X, footer, ESC, reopen) |
| `Design System/QA_ADMIN_DESTRUCTIVE_MATRIX.md` | Criado | Matriz QA com 16 rotas x tipo de teste |
| `Design System/QA_ADMIN_DESTRUCTIVE_REPORT.md` | Criado | Este relatorio |
| `src/components/ui/dialog.tsx` | Modificado | Adicionado data-testid + aria-label no X |
| `src/pages/admin/categorias-json/components/CategoriaEditorDialog.tsx` | Modificado | Fix onOpenChange para respeitar X |

---

## Como Executar

```bash
# Rodar suite completa
npm run test:admin-destructive

# Rodar com browser visivel
npm run test:admin-destructive:headed

# Ver relatorio HTML
npx playwright show-report test-results/admin-destructive-report

# Ver trace de um teste especifico
npx playwright show-trace test-results/admin-destructive-results/<pasta-do-teste>/trace.zip
```
