# Checklist Visual Baseline — Frontend React (Portal PGE-MS)

Regras visuais do design system. Toda nova pagina ou componente deve respeitar estes padroes.

---

## Largura e Alinhamento

| Item | Valor | Implementacao |
|------|-------|---------------|
| Largura maxima de conteudo | **1350px** | Token `max-w-pge` (Tailwind v4 `--max-width-pge`) |
| BreadcrumbBar alinhamento | Mesmo container | `max-w-pge px-4 sm:px-6 lg:px-10` |
| ContentArea alinhamento | Mesmo container | `max-w-pge px-4 sm:px-6 lg:px-10 py-8` |
| Dashboard (sem BreadcrumbBar) | Mesmo container | `max-w-pge px-4 py-8 sm:px-6 lg:px-10` |

> **Regra de ouro**: BreadcrumbBar e conteudo DEVEM usar os mesmos tokens de largura e padding horizontal para garantir alinhamento perfeito em todos os breakpoints.

---

## Padding

| Contexto | Mobile (`< 640px`) | Tablet (`640-1023px`) | Desktop (`>= 1024px`) |
|----------|--------------------|-----------------------|----------------------|
| Horizontal (pagina) | `px-4` (16px) | `sm:px-6` (24px) | `lg:px-10` (40px) |
| Vertical (pagina) | `py-8` (32px) | `py-8` (32px) | `py-8` (32px) |
| BreadcrumbBar horizontal | `px-4` (16px) | `sm:px-6` (24px) | `lg:px-10` (40px) |
| Card interno | `p-6` (24px) | `p-6` (24px) | `p-6` (24px) |

---

## Sub-header (BreadcrumbBar)

| Propriedade | Valor |
|-------------|-------|
| Altura | `h-12` (48px) |
| Borda inferior | `border-b border-gray-200` |
| Container | `mx-auto flex max-w-pge items-center justify-between` |
| Padding | `px-4 sm:px-6 lg:px-10` |

---

## Fonte Global

| Propriedade | Valor |
|-------------|-------|
| Font-family | `var(--font-ui, 'Plus Jakarta Sans', system-ui, sans-serif)` |
| Aplicacao | `body` via `index.css` (nao por pagina) |

> **Anti-pattern**: Nao usar `style={{ fontFamily: FONT_UI }}` em nenhum componente. A fonte e global.

---

## Componentes de Layout

### `ContentArea` (principal)

Wrapper padrao para conteudo de pagina com BreadcrumbBar.

```tsx
import { ContentArea } from '@/components/layout/ContentArea'

// Padrao
<ContentArea>...</ContentArea>

// Com classes adicionais
<ContentArea className="space-y-6">...</ContentArea>

// Sem padding vertical (toolbar sticky, etc.)
<ContentArea noPaddingY>...</ContentArea>

// Sem padding nenhum
<ContentArea noPadding>...</ContentArea>
```

### `PageContainer` (legado, alinhado)

Mesma largura e padding que ContentArea. Usado em paginas com AppLayout (PageHeader + SectionCard).

### `BreadcrumbBar`

Sub-header de navegacao. Container alinhado com ContentArea.

---

## Estrutura Padrao de Pagina

### Pagina com BreadcrumbBar (maioria)

```tsx
return (
  <>
    <BreadcrumbBar title="..." icon={...} actions={...} />
    <ContentArea className="space-y-6">
      {/* conteudo */}
    </ContentArea>
  </>
)
```

### Pagina com sidebar (Assistencia, Matriculas)

```tsx
return (
  <>
    <BreadcrumbBar title="..." icon={...} />
    <div className="flex flex-1 overflow-hidden">
      <aside className="w-80">...</aside>
      <main className="flex-1 overflow-auto p-6">...</main>
    </div>
  </>
)
```

### Dashboard (sem BreadcrumbBar)

```tsx
return (
  <div className="mx-auto max-w-pge px-4 py-8 sm:px-6 lg:px-10">
    {/* conteudo */}
  </div>
)
```

---

## Design Tokens Centralizados

| Arquivo | Export | Uso |
|---------|--------|-----|
| `@/lib/designTokens` | `C` (objeto de cores) | Inline styles para cores PGE |
| `@/lib/designTokens` | `FONT_UI` | Apenas para referencia; fonte e global |
| `src/index.css` | `--max-width-pge` | Token Tailwind `max-w-pge` |

> **Regra**: Nao redeclarar `const C = {...}` localmente. Sempre importar de `@/lib/designTokens`.

---

## Espacamentos entre Secoes

| Contexto | Classe |
|----------|--------|
| Entre cards/secoes de pagina | `space-y-6` |
| Entre campos de formulario | `space-y-4` |
| Header de secao ate conteudo | `mb-4` ou `mb-6` |
| Secao admin (Dashboard) | `mt-14` (56px) |

---

## Toolbar / Actions (BreadcrumbBar)

| Elemento | Padrao |
|----------|--------|
| Botao primario | Cor `C.navy950`, texto branco, `rounded-xl` |
| Botao secundario | `variant="outline"`, borda `C.gray200` |
| Grupo de botoes | `flex items-center gap-2` |
| Sheet de historico | `<Sheet>` no slot `actions` do BreadcrumbBar |
