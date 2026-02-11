# ADR-0013: Convencoes do React SPA (frontend-react)

**Data**: 2026-02-07
**Status**: Aceito
**Autores**: LAB/PGE-MS

## Contexto

Durante a revisao commit-a-commit da branch `feat/react-spa` (48 commits), foram identificados 19 bugs e padroes incorretos. Este ADR registra as convencoes estabelecidas para evitar recorrencia.

## Decisoes

### 1. Markdown deve usar o hook `useMarkdown`

**Problema**: 4 paginas usavam `marked()` ou `marked.parse()` diretamente com `dangerouslySetInnerHTML`, sem sanitizacao (XSS).

**Convencao**: Sempre usar o hook `useMarkdown` de `@/hooks/useMarkdown`, que aplica DOMPurify internamente.

```tsx
// ERRADO - XSS vulneravel
import { marked } from 'marked'
<div dangerouslySetInnerHTML={{ __html: marked(text) }} />

// CORRETO - sanitizado
import { useMarkdown } from '@/hooks/useMarkdown'
const { html } = useMarkdown(text)
<div dangerouslySetInnerHTML={{ __html: html }} />
```

**Importante**: `useMarkdown` retorna `{ html }` (objeto), nao string. Sempre desestruturar.

### 2. Dialog deve usar `DialogContent` do Radix

**Problema**: `PromptsModulosPage` usava `<Dialog>` com `<div className="fixed inset-0">` custom. O `DialogPrimitive.Root` nao controla renderizacao dos filhos — o overlay ficava permanentemente visivel.

**Convencao**: Sempre usar `<DialogContent>` dentro de `<Dialog>`.

```tsx
// ERRADO - overlay permanente, sem focus trap
<Dialog open={open} onOpenChange={setOpen}>
  <div className="fixed inset-0 bg-black/50">
    <div className="bg-white">...</div>
  </div>
</Dialog>

// CORRETO - portal, overlay, focus trap, escape key
<Dialog open={open} onOpenChange={setOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader><DialogTitle>Titulo</DialogTitle></DialogHeader>
    {/* conteudo */}
    <DialogFooter>{/* botoes */}</DialogFooter>
  </DialogContent>
</Dialog>
```

### 3. Select do Radix vs `<select>` nativo

**Problema**: 2 paginas usavam `<Select>` do Radix com filhos `<option>` nativos. O Radix Select requer `<SelectTrigger>`, `<SelectContent>`, `<SelectItem>`.

**Convencao**:
- Para dropdowns simples com `<option>`: usar `<select>` nativo com classes Tailwind
- Para dropdowns estilizados: usar componentes completos do Radix (`SelectTrigger` + `SelectContent` + `SelectItem`)

### 4. `createApiClient` prepende o base URL

**Problema**: `authApi = createApiClient('/auth')` + `authApi.post('/auth/change-password')` resultava em `/auth/auth/change-password`.

**Convencao**: Ao usar `createApiClient(baseUrl)`, os paths das chamadas NAO devem incluir o prefixo base.

```tsx
const authApi = createApiClient('/auth')
authApi.post('/change-password', data)  // -> /auth/change-password
```

### 5. Zustand store — destruturar apenas propriedades existentes

**Problema**: `Sidebar` destruturava `closeSidebar` do `useUiStore()`, mas essa propriedade nao existia. O valor era `undefined`, impedindo o fechamento do Sheet no mobile.

**Convencao**: Verificar a interface do store antes de destruturar. TypeScript deveria detectar isso, mas Zustand v5 pode ser permissivo em alguns casos.

### 6. Cleanup de efeitos

**Problema**: `MatriculasPage` tinha um unico `useEffect` com `[pdfViewerUrl]` que limpava intervals E revogava URLs. Quando `pdfViewerUrl` mudava, os intervals eram limpos prematuramente.

**Convencao**:
- Separar concerns em effects distintos
- Intervals/timeouts: cleanup com `[]` (apenas unmount)
- Recursos visuais (blob URLs): cleanup com `[url]` (a cada mudanca)
- Sempre armazenar timeout IDs em refs para cleanup

### 7. Sem `console.log` em producao

**Problema**: `PedidoCalculoPage` e `PrestacaoContasPage` tinham `console.log('Evento SSE:', ...)`.

**Convencao**: Remover `console.log` de debug antes de merge. `console.warn` para erros de parse e `console.error` para erros inesperados sao aceitaveis.

## Consequencias

- 19 bugs corrigidos em 2 commits de ajuste (`21c6899`, `202509b`)
- Convencoes documentadas para prevenir recorrencia
- 216 testes unitarios passando, TSC limpo, build de producao OK
