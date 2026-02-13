# Guia de Estilo — Frontend React (Portal PGE-MS)

## Princípios

1. **Tudo dentro do AppLayout**: Nenhuma página renderiza seu próprio header, background ou botão de voltar. O `AppLayout` fornece Header global, Sidebar, botão "Voltar ao Dashboard" e área de conteúdo com scroll.
2. **Composição via PageContainer + PageHeader + SectionCard**: Toda página segue o padrão `<PageContainer>` → `<PageHeader>` → conteúdo com `<SectionCard>`.
3. **Consistência visual**: Tokens de cor, espaçamento e tipografia são compartilhados. Não use valores hardcoded — use as classes Tailwind padronizadas.
4. **Mobile-first**: Layouts responsivos com breakpoints `sm:`, `md:`, `lg:`.

---

## Componentes de Layout

### `ContentArea` (principal para paginas com BreadcrumbBar)

Wrapper padrao de conteudo. Garante alinhamento com o BreadcrumbBar usando os mesmos tokens de largura e padding.

```tsx
import { ContentArea } from '@/components/layout/ContentArea'

// Uso padrao
<>
  <BreadcrumbBar title="..." icon={...} />
  <ContentArea className="space-y-6">
    {/* conteudo */}
  </ContentArea>
</>

// Sem padding vertical (toolbar sticky, etc.)
<ContentArea noPaddingY>...</ContentArea>

// Sem padding nenhum
<ContentArea noPadding>...</ContentArea>
```

| Prop | Tipo | Descricao |
|------|------|-----------|
| `className` | `string` | Classes adicionais (ex: `space-y-6`) |
| `noPaddingY` | `boolean` | Remove padding vertical (`py-8`) |
| `noPadding` | `boolean` | Remove todo padding |

Equivalencias: `max-w-pge` = 1350px, `lg:px-10` = 40px, `py-8` = 32px.

### `PageContainer` (para paginas com AppLayout/PageHeader)

Container alternativo com mesma largura. Usado em paginas com sistema de `PageHeader` + `SectionCard`.

```tsx
import { PageContainer } from '@/components/layout/PageContainer'

// Uso padrao
<PageContainer>
  <PageHeader ... />
  <SectionCard>...</SectionCard>
</PageContainer>

// Largura total (sem max-width)
<PageContainer fluid>...</PageContainer>

// Sem padding (para paginas com sidebar interna)
<PageContainer noPadding fluid>
  <div className="px-4 sm:px-6 lg:px-10 pt-6">
    <PageHeader ... />
  </div>
  <div className="flex flex-1 overflow-hidden">
    <aside>...</aside>
    <main>...</main>
  </div>
</PageContainer>
```

| Prop | Tipo | Descricao |
|------|------|-----------|
| `fluid` | `boolean` | Remove `max-w-pge` |
| `noPadding` | `boolean` | Remove padding interno |
| `className` | `string` | Classes adicionais |

### `PageHeader`

Header de página com título, subtítulo opcional, ícone e ações.

```tsx
import { PageHeader } from '@/components/layout/PageHeader'
import { FileText } from 'lucide-react'

<PageHeader
  title="Gerador de Peças"
  subtitle="Gere peças com inteligência artificial"
  description="Texto descritivo mais longo (text-sm)"
  icon={<FileText className="h-5 w-5" />}
  actions={
    <Button variant="outline" size="sm">
      <History className="mr-2 h-4 w-4" />
      Histórico
    </Button>
  }
/>
```

| Prop | Tipo | Descrição |
|------|------|-----------|
| `title` | `string` | Título principal (obrigatório) |
| `subtitle` | `string` | Texto `text-xs` abaixo do título |
| `description` | `string` | Texto `text-sm` descritivo |
| `icon` | `ReactNode` | Renderiza badge gradiente à esquerda |
| `actions` | `ReactNode` | Botões/ações à direita |

### `SectionCard`

Card branco com borda, sombra e padding `p-6`.

```tsx
import { SectionCard } from '@/components/layout/SectionCard'

<SectionCard>
  <h3>Seção</h3>
  <p>Conteúdo</p>
</SectionCard>
```

---

## Tokens de Design

### Cores

| Token | Valor | Uso |
|-------|-------|-----|
| `primary-500` | `#0ea5e9` | Ações principais, links |
| `primary-600` | `#0284c7` | Hover de ações, badges |
| `primary-50` | `#f0f9ff` | Backgrounds sutis |
| `gray-50` | `#f9fafb` | Background da app |
| `gray-200` | `#e5e7eb` | Bordas |
| `gray-500` | `#6b7280` | Texto secundário |
| `gray-900` | `#111827` | Texto principal |

### Tipografia

| Elemento | Classes |
|----------|---------|
| Título de página | `text-2xl font-bold text-gray-900` |
| Subtítulo de página | `text-xs text-gray-500` |
| Descrição | `text-sm text-gray-500` |
| Label de campo | `text-sm font-medium` |
| Texto de ajuda | `text-xs text-gray-400` |
| Card title | `text-lg font-semibold` |

### Espaçamento

| Contexto | Valor |
|----------|-------|
| Padding de página | `px-4 sm:px-6 lg:px-10 py-8` |
| Padding de card | `p-6` |
| Gap entre seções | `space-y-6` |
| Gap entre campos | `space-y-4` |
| Margem do header | `mb-6` |

### Sombras e Bordas

| Elemento | Classes |
|----------|---------|
| Card padrão | `shadow-sm border border-gray-200 rounded-xl` |
| Header badge (ícone) | `shadow-sm rounded-xl` |
| Separador | `border-gray-200` ou `Separator` do Radix |

### Botões

| Variante | Uso |
|----------|-----|
| `default` | Ação principal (Gerar, Consultar) |
| `outline` | Ação secundária (Histórico, Exportar) |
| `ghost` | Ação terciária (Voltar, Dashboard) |
| `destructive` | Ação destrutiva (Excluir) |

### Badges (ícone do sistema)

O ícone de cada sistema usa um badge gradiente:

```tsx
<div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center text-white shadow-sm">
  <IconeDoSistema className="h-5 w-5" />
</div>
```

---

## Ícones por Sistema

| Sistema | Ícone | Import |
|---------|-------|--------|
| Gerador de Peças | `FileText` | `lucide-react` |
| Extrator de Autos | `FolderSearch` | `lucide-react` |
| Treinamento BERT | `Brain` | `lucide-react` |
| Relatório Cumprimento | `FileText` | `lucide-react` |
| Cumprimento Beta | `FlaskConical` | `lucide-react` |
| Assistência Judiciária | `Scale` | `lucide-react` |
| Matrículas | `FileText` | `lucide-react` |
| Pedido de Cálculo | `Calculator` | `lucide-react` |
| Classificador | `Tags` | `lucide-react` |
| Prestação de Contas | `Receipt` | `lucide-react` |

---

## Animações

| Classe | Duração | Uso |
|--------|---------|-----|
| `animate-fade-in` | 0.2s | Aparição suave de elementos |
| `animate-slide-in` | 0.3s | Entrada com deslocamento vertical |
| `animate-spin` | contínuo | Loaders e spinners |

---

## Padrões para Páginas com Sidebar

Páginas como **Assistência** e **Matrículas** que têm sidebar interna devem usar:

```tsx
<PageContainer noPadding fluid className="flex flex-col h-full">
  <div className="px-4 sm:px-6 lg:px-10 pt-6">
    <PageHeader title="..." icon={...} />
  </div>
  <div className="flex flex-1 overflow-hidden">
    <aside className="w-80 flex-shrink-0 border-r bg-white">
      {/* Sidebar */}
    </aside>
    <div className="flex-1 overflow-auto p-6">
      {/* Conteúdo */}
    </div>
  </div>
</PageContainer>
```

---

## Padrão para Sheet de Histórico nas Actions

Muitas páginas de sistema têm um Sheet (drawer lateral) de histórico. Ele deve ficar na prop `actions` do PageHeader:

```tsx
<PageHeader
  title="..."
  actions={
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-2 h-4 w-4" />
          Histórico
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Histórico</SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          {/* Lista de itens do histórico */}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  }
/>
```

---

## Anti-patterns (o que NÃO fazer)

### Layout

- **NÃO** use `min-h-screen` em páginas — o AppLayout já gerencia a altura
- **NÃO** crie `<header>` próprio — use `PageHeader`
- **NÃO** adicione `bg-gradient-*` no wrapper da página — o fundo é `bg-gray-50` via AppLayout
- **NÃO** use `sticky top-0 z-40/z-50` em headers de página — conflita com o Header global
- **NÃO** renderize botão "Voltar ao Dashboard" dentro da página — vem do AppLayout

### Estilo

- **NAO** use `style={{ fontFamily: FONT_UI }}` — a fonte e global via `body` no CSS
- **NAO** use `style={{ maxWidth: 1350, padding: '32px 40px' }}` — use `ContentArea` ou `max-w-pge`
- **NAO** redeclare `const C = {...}` localmente — importe de `@/lib/designTokens`
- **NAO** use cores hardcoded — use os tokens (`primary-500`, `gray-200`, etc.)
- **NAO** misture `p-4` e `p-6` em cards do mesmo nivel — use `SectionCard` (que ja tem `p-6`)
- **NAO** defina scrollbar customizada inline — use a classe `.custom-scrollbar`

### Componentes

- **NÃO** importe `useNavigate` apenas para o botão voltar — o AppLayout cuida disso
- **NÃO** duplique o botão "Dashboard" no header da página
- **NÃO** use `<main>` dentro do componente da página — já existe no AppLayout
