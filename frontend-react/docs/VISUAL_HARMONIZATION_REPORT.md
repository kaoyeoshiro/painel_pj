# Relatorio de Harmonizacao Visual — Frontend React (Portal PGE-MS)

**Data**: 2026-02-11
**Escopo**: Eliminacao de inline styles repetidos, criacao de componente de layout unico, aplicacao de fonte global.

---

## Resumo

- **27 paginas** migradas para usar `ContentArea` ou tokens `max-w-pge`
- **Inline styles eliminados**: `fontFamily`, `maxWidth: 1350`, `margin: '0 auto'`, `padding: '32px 40px'`
- **Componente central**: `ContentArea` — wrapper com `max-w-pge px-4 sm:px-6 lg:px-10 py-8`
- **BreadcrumbBar**: container migrado de inline styles para Tailwind com mesmos tokens
- **Fonte global**: aplicada no `body` via CSS, nao mais por pagina
- **Token Tailwind v4**: `--max-width-pge: 1350px` → classe `max-w-pge`
- **Build**: OK (sem erros TS, sem erros Vite)
- **data-testid**: Nenhum alterado

---

## Fases Executadas

### Fase 0: Tokens CSS e Fonte Global

| Arquivo | Mudanca |
|---------|---------|
| `src/index.css` | Adicionado `--max-width-pge: 1350px` no bloco `@theme inline` |
| `src/index.css` | Body font-family mudado para `var(--font-ui, 'Plus Jakarta Sans', system-ui, sans-serif)` |

### Fase 1: Componente ContentArea

| Arquivo | Mudanca |
|---------|---------|
| `src/components/layout/ContentArea.tsx` | NOVO — componente central de layout |
| `src/components/layout/index.ts` | Adicionado export de `ContentArea` |

### Fase 2: BreadcrumbBar

| Arquivo | Mudanca |
|---------|---------|
| `src/components/layout/BreadcrumbBar.tsx` | Container migrado de `style={{ maxWidth: 1350, padding: '0 40px' }}` para `max-w-pge px-4 sm:px-6 lg:px-10` |

### Fase 3: PageContainer

| Arquivo | Mudanca |
|---------|---------|
| `src/components/layout/PageContainer.tsx` | `max-w-7xl` → `max-w-pge`, `lg:px-8` → `lg:px-10`, removidos `wide` prop e `isAdminRoute` |

### Fase 4: Migracao de Paginas

#### Onda 1 — Admin simples (10 paginas)

| Pagina | Arquivo | Tipo de Migracao |
|--------|---------|------------------|
| Restaurar Slugs | `admin/restaurar-slugs/RestaurarSlugsPage.tsx` | ContentArea |
| TJMS Docs | `admin/tjms-docs/TjmsDocsPage.tsx` | ContentArea |
| Historico Prest. Contas | `admin/historico-prestacao-contas/HistoricoPrestacaoContasPage.tsx` | ContentArea |
| Historico Gerador | `admin/historico-gerador/HistoricoGeradorPage.tsx` | ContentArea |
| Historico Pedido Calculo | `admin/historico-pedido-calculo/HistoricoPedidoCalculoPage.tsx` | ContentArea |
| Modulos Tipo Peca | `admin/modulos-tipo-peca/ModulosTipoPecaPage.tsx` | ContentArea |
| Config Pecas | `admin/config-pecas/ConfigPecasPage.tsx` | ContentArea |
| Variaveis | `admin/variaveis/VariaveisPage.tsx` | ContentArea |
| Prompts | `admin/prompts/PromptsPage.tsx` | ContentArea |
| Prompts Modulos | `admin/prompts-modulos/PromptsModulosPage.tsx` | ContentArea |

#### Onda 2 — Admin complexas (6 paginas)

| Pagina | Arquivo | Tipo de Migracao |
|--------|---------|------------------|
| Users | `admin/users/UsersPage.tsx` | ContentArea |
| Feedbacks | `admin/feedbacks/FeedbacksPage.tsx` | ContentArea |
| Performance | `admin/performance/PerformancePage.tsx` | ContentArea |
| Categorias JSON | `admin/categorias-json/CategoriasJsonPage.tsx` | ContentArea |
| Teste Ativacao | `admin/teste-ativacao/TesteAtivacaoPage.tsx` | ContentArea |
| Teste Categorias | `admin/teste-categorias/TesteCategoriasPage.tsx` | ContentArea |

#### Onda 3 — Paginas de sistema com BreadcrumbBar (6 paginas)

| Pagina | Arquivo | Tipo de Migracao |
|--------|---------|------------------|
| Assistencia | `assistencia/AssistenciaPage.tsx` | Fragment (sidebar layout) |
| Classificador | `classificador/ClassificadorPage.tsx` | ContentArea |
| Cumprimento Beta | `cumprimento-beta/CumprimentoBetaPage.tsx` | ContentArea |
| Relatorio Cumprimento | `relatorio-cumprimento/RelatorioCumprimentoPage.tsx` | ContentArea |
| Prestacao Contas | `prestacao-contas/PrestacaoContasPage.tsx` | ContentArea |
| BERT Training | `bert-training/BertTrainingPage.tsx` | ContentArea |

#### Onda 4 — Layout customizado (3 paginas)

| Pagina | Arquivo | Tipo de Migracao |
|--------|---------|------------------|
| Extrator Autos | `extrator-autos/ExtratorAutosPage.tsx` | ContentArea |
| Pedido Calculo | `pedido-calculo/PedidoCalculoPage.tsx` | ContentArea + breadcrumb customizado |
| Gerador Pecas | `gerador-pecas/GeradorPecasPage.tsx` | max-w-pge direto (flex layout) |

#### Onda 5 — Layouts especiais (2 paginas)

| Pagina | Arquivo | Tipo de Migracao |
|--------|---------|------------------|
| Matriculas | `matriculas/MatriculasPage.tsx` | Fragment (sidebar layout) |
| Dashboard | `dashboard/DashboardPageV2.tsx` | max-w-pge direto (sem BreadcrumbBar) |

### Fase 5: Limpeza de copias locais de C

| Arquivo | Mudanca |
|---------|---------|
| `dashboard/DashboardPageV2.tsx` | Removido `const C = {...}` local, adicionado `import { C } from '@/lib/designTokens'` |
| `pedido-calculo/PedidoCalculoPage.tsx` | Idem |
| `gerador-pecas/GeradorPecasPage.tsx` | Idem |

---

## Padrao de Migracao Aplicado

### Antes (padrao antigo)

```tsx
return (
  <div style={{ fontFamily: FONT_UI }}>
    <BreadcrumbBar title="..." icon={...} actions={...} />
    <div style={{ maxWidth: 1350, margin: '0 auto', padding: '32px 40px' }}>
      <div className="space-y-6">
        ...conteudo...
      </div>
    </div>
  </div>
)
```

### Depois (padrao novo)

```tsx
return (
  <>
    <BreadcrumbBar title="..." icon={...} actions={...} />
    <ContentArea className="space-y-6">
      ...conteudo...
    </ContentArea>
  </>
)
```

---

## Verificacao

| Check | Resultado |
|-------|-----------|
| `npx tsc --noEmit` | OK (sem erros) |
| `npm run build` | OK (Vite 7, build em ~12s) |
| `npx eslint src/` | Sem erros novos (erros pre-existentes nao relacionados) |
| `data-testid` preservados | Sim (nenhum alterado) |

---

## Melhorias Obtidas

1. **Alinhamento perfeito**: BreadcrumbBar e conteudo agora usam os mesmos tokens (`max-w-pge`, `lg:px-10`)
2. **Responsividade**: Padding responsivo (`16px → 24px → 40px`) em vez de fixo 40px em todas as telas
3. **DRY**: Eliminados ~27 blocos de `style={{ maxWidth: 1350, margin: '0 auto', padding: '32px 40px' }}`
4. **Fonte global**: Eliminados ~27 wrappers `<div style={{ fontFamily: FONT_UI }}>`
5. **Tokens centralizados**: Copias locais de `C` removidas de 3 arquivos
6. **Manutenibilidade**: Para mudar a largura maxima, basta alterar `--max-width-pge` no CSS
