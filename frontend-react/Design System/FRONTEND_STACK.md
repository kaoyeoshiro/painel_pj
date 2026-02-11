# Frontend Stack - Portal PGE-MS

> Documentacao completa da arquitetura e ferramentas do frontend React do Portal PGE-MS.

**Ultima atualizacao:** Fevereiro 2026

---

## Sumario

1. [Visao Geral](#visao-geral)
2. [Stack de Tecnologias](#stack-de-tecnologias)
3. [Arquitetura do Projeto](#arquitetura-do-projeto)
4. [Build & Development](#build--development)
5. [Tipagem de Ponta a Ponta](#tipagem-de-ponta-a-ponta)
6. [Validacao Runtime com Schemas](#validacao-runtime-com-schemas)
7. [Gerenciamento de Estado](#gerenciamento-de-estado)
8. [Data Fetching com TanStack Query](#data-fetching-com-tanstack-query)
9. [Server-Sent Events (SSE)](#server-sent-events-sse)
10. [Roteamento com TanStack Router](#roteamento-com-tanstack-router)
11. [Estilizacao](#estilizacao)
12. [Componentes UI](#componentes-ui)
13. [Seguranca no Frontend](#seguranca-no-frontend)
14. [Testes](#testes)
15. [Governanca do Design System](#governanca-do-design-system)
16. [Scripts Disponiveis](#scripts-disponiveis)
17. [Decisoes e Rationale](#decisoes-e-rationale)

---

## Visao Geral

O frontend do Portal PGE-MS e uma **Single Page Application (SPA)** moderna construida com React 19, que se comunica com um backend FastAPI via REST API. A aplicacao foi projetada para:

- **Type Safety**: Tipagem end-to-end do Python ate o TypeScript (OpenAPI + gerados)
- **Validacao Runtime**: Schemas gerados validam respostas criticas (auth, permissoes)
- **Performance**: Cache inteligente via TanStack Query e otimizacoes de rede
- **Seguranca**: Sanitizacao estrita de Markdown, ApiError tipado, auth com estados explicitos
- **DX**: Hot reload, DevTools, e ferramentas de debug

---

## Stack de Tecnologias

### Core

| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| **React** | 19.2.0 | UI Library |
| **TypeScript** | 5.9.3 | Tipagem estatica |
| **Vite** | 7.2.4 | Build tool & Dev server |

### State Management & Data Fetching

| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| **TanStack Query** | 5.90.21 | Server state, cache, mutations |
| **Zustand** | 5.0.11 | Client state (auth, UI) |

### Routing

| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| **TanStack Router** | 1.158.4 | Roteamento type-safe (manual routes) |

### Styling

| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| **Tailwind CSS** | 4.1.18 | Utility-first CSS |
| **class-variance-authority** | 0.7.1 | Component variants |
| **tailwind-merge** | 3.4.0 | Class deduplication |

### UI Components

| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| **Radix UI** | latest | Primitivos acessiveis |
| **Lucide React** | 0.563.0 | Icones |
| **Recharts** | 3.7.0 | Graficos |
| **cmdk** | 1.1.1 | Command palette |

### Code Generation

| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| **@hey-api/openapi-ts** | 0.92.3 | Geracao de tipos + schemas a partir do OpenAPI |

### Testing

| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| **Vitest** | 4.0.18 | Unit tests |
| **Playwright** | 1.58.2 | E2E tests |
| **Testing Library** | 16.3.2 | Component tests |

### Seguranca

| Tecnologia | Versao | Proposito |
|------------|--------|-----------|
| **DOMPurify** | 3.3.1 | Sanitizacao de HTML (Markdown) com allowlist |

---

## Arquitetura do Projeto

```
frontend-react/
├── src/
│   ├── assets/            # Imagens, SVGs
│   ├── components/
│   │   ├── layout/        # AppLayout, Sidebar, Header, AuthGuard
│   │   ├── shared/        # Componentes reutilizaveis (MarkdownRenderer, DataTable)
│   │   └── ui/            # Primitivos UI (Button, Dialog, Input, etc.)
│   ├── hooks/             # Custom hooks
│   │   ├── useQueries.ts  # Hooks TanStack Query por dominio (padrao unico)
│   │   ├── useSSE.ts      # Server-Sent Events com integracao TanStack Query
│   │   ├── useMarkdown.ts # Markdown com sanitizacao DOMPurify (allowlist)
│   │   ├── usePagination  # Paginacao
│   │   └── useApiQuery.ts # @deprecated — substituido por TanStack Query
│   ├── lib/
│   │   ├── api.ts         # Cliente HTTP tipado + ApiError
│   │   ├── query-client.ts # TanStack Query config + query keys factory
│   │   ├── schema-validator.ts # Validacao runtime com JSON Schemas gerados
│   │   ├── designTokens.ts # Tokens de cor e tipografia PGE
│   │   ├── utils.ts       # Utilitarios (cn, formatters)
│   │   └── constants.ts   # Constantes globais
│   ├── pages/             # Paginas por rota
│   │   ├── login/
│   │   ├── dashboard/
│   │   ├── gerador-pecas/
│   │   ├── admin/
│   │   └── ...
│   ├── stores/            # Zustand stores
│   │   ├── auth-store.ts  # Auth com estados explicitos (unknown/auth/unauth)
│   │   └── ui-store.ts    # Estado de UI (sidebar, theme)
│   ├── types/
│   │   ├── generated/     # Tipos + schemas gerados automaticamente (OpenAPI)
│   │   ├── index.ts       # Barrel export de todos os tipos por dominio
│   │   └── *.ts           # Tipos manuais por dominio
│   ├── index.css          # Estilos globais + Tailwind
│   ├── main.tsx           # Entry point
│   └── router.tsx         # Configuracao do TanStack Router (manual routes)
├── e2e/                   # Testes E2E Playwright
├── scripts/               # Scripts de geracao e utilitarios
│   └── generate-api.mjs   # Script cross-platform para gerar tipos (dev + CI)
├── Design System/         # Documentacao de design
├── openapi-ts.config.ts   # Configuracao do gerador de tipos
├── tailwind.config.ts     # Configuracao do Tailwind
├── vite.config.ts         # Configuracao do Vite
└── package.json
```

---

## Build & Development

### Alias `@/`

O alias `@/` aponta para `src/`, permitindo imports absolutos:

```typescript
// Evite caminhos relativos longos
import { Button } from '@/components/ui/button'
```

### Proxy de API

O Vite proxia todas as rotas `/api`, `/auth`, `/users`, etc. para `http://localhost:8000`.

---

## Tipagem de Ponta a Ponta

### Fluxo de Geracao de Tipos

```
Backend (FastAPI/Pydantic) → OpenAPI schema → @hey-api/openapi-ts → TypeScript types + JSON schemas
```

### Configuracao (`openapi-ts.config.ts`)

```typescript
const input = process.env.OPENAPI_INPUT ?? 'http://localhost:8000/openapi.json'

export default defineConfig({
  client: '@hey-api/client-fetch',
  input,
  output: { path: 'src/types/generated', format: 'prettier' },
  plugins: ['@hey-api/typescript', '@hey-api/schemas'],
})
```

### Dev Local vs CI

| Cenario | Comando | Input |
|---------|---------|-------|
| **Dev local** | `npm run generate:api` | `http://localhost:8000/openapi.json` |
| **CI / offline** | `npm run generate:api:file` | `./openapi.json` (arquivo local) |
| **Custom** | `node scripts/generate-api.mjs <path>` | Qualquer URL ou arquivo |

Em CI, o pipeline deve:
1. Rodar o backend e exportar `openapi.json` como artifact
2. No job do frontend, rodar `npm run generate:api:file`

### Arquivos Gerados

```
src/types/generated/
├── types.gen.ts     # Interfaces TypeScript (22K+ linhas)
├── schemas.gen.ts   # JSON Schemas para validacao runtime
└── index.ts         # Re-exports
```

### Tipos Manuais por Dominio

Tipos manuais vivem em `src/types/<dominio>.ts`. O barrel `src/types/index.ts` re-exporta tudo com aliases para evitar colisoes de nomes entre dominios.

---

## Validacao Runtime com Schemas

Respostas de endpoints criticos (auth, permissoes) sao validadas em runtime usando os JSON Schemas gerados:

```typescript
import { assertSchema } from '@/lib/schema-validator'
import { TokenSchema, UserMeSchema } from '@/types/generated/schemas.gen'

// No login
const response = await apiRequest('/auth/login', { ... })
assertSchema(response, TokenSchema, 'POST /auth/login')

// No loadUser
const user = await apiRequest('/auth/me', { ... })
assertSchema(user, UserMeSchema, 'GET /auth/me')
```

O validador checa:
- Campos `required` presentes
- Tipos basicos (string, number, boolean, integer, array, object, null)
- Union types (`anyOf`)

Nao valida profundidade > 1 por design (manter leve).

---

## Gerenciamento de Estado

### State Architecture — Regras (Resumo)

> Documentacao completa: `Design System/STATE_ARCHITECTURE_RULES.md`
> Inventario: `Design System/STATE_AUDIT_INVENTORY.md`

**Principio**: Cada dado vive em exatamente UM lugar.

| Tipo de dado | Onde vive | Exemplo |
|-------------|-----------|---------|
| Dados do servidor (listas, detalhes, status) | **TanStack Query** | `useHistoricoGerador()`, `useTiposPeca()` |
| Identidade do usuario e token JWT | **Zustand (auth-store)** | `useAuthStore(s => s.user)` |
| Preferencias de UI | **Zustand (ui-store)** | `useUiStore(s => s.sidebarCollapsed)` |
| Estado efemero de pagina | **useState/useReducer local** | Formularios, modais, streaming chunks |
| Conteudo de streaming SSE | **useState local** + invalidation ao completar | Chunks incrementais durante SSE |

**Anti-patterns proibidos**:
- Guardar resposta de API no Zustand
- `queryClient.invalidateQueries()` sem filtro (bazuca)
- Criar novo store Zustand para dados do servidor
- Usar `useApiQuery` (REMOVIDO — era `@deprecated`)

**Subscricoes Zustand**: SEMPRE seletivas (`useAuthStore(s => s.user)`), nunca destructuring.

### Client HTTP (`lib/api.ts`)

**ApiError tipado** com campos estruturados:

```typescript
class ApiError extends Error {
  readonly status: number        // HTTP status code
  readonly detail: string        // Mensagem amigavel
  readonly validationErrors: ValidationError[]  // Erros 422 do FastAPI

  get isUnauthorized(): boolean  // 401
  get isValidation(): boolean    // 422
  get isServerError(): boolean   // >= 500
}
```

Tratamento consistente:
- **401**: Limpa token, redireciona para `/login`
- **422**: Extrai `validationErrors` do FastAPI (loc, msg, type)
- **500+**: Mensagem generica do servidor

### Auth Store (`stores/auth-store.ts`)

**3 estados explicitos** (sem ambiguidade):

```typescript
type AuthStatus = 'unknown' | 'authenticated' | 'unauthenticated'
```

| Estado | Significado | UI |
|--------|------------|-----|
| `unknown` | Verificando token (boot) | Skeleton |
| `authenticated` | Usuario logado | App normal |
| `unauthenticated` | Sem token / token invalido | Redirect para /login |

Boot sequence:
1. App monta → `AuthGuard` chama `initialize()`
2. `initialize()` e idempotente (`_initialized` flag)
3. Se tem token → chama `/auth/me` → valida com `UserMeSchema` → `authenticated`
4. Se nao tem token → `unauthenticated` → redirect

Compatibilidade: `isAuthenticated` e `isLoading` continuam como propriedades derivadas.

---

## Data Fetching com TanStack Query

### Padrao Unico

**Todo data fetching usa TanStack Query.** O hook legado `useApiQuery` esta `@deprecated`.

### Query Keys Factory (`lib/query-client.ts`)

```typescript
export const queryKeys = {
  geradorPecas: {
    all: ['gerador-pecas'] as const,
    historico: (filters?) => [...all, 'historico', stableFilterKey(filters)] as const,
    historicoDetail: (id: number) => [...all, 'historico', id] as const,
  },
  // ... outros dominios
}
```

**Filtros estaveis**: `stableFilterKey(filters)` serializa o objeto em string deterministica para evitar instabilidade de cache quando o objeto e recriado a cada render.

### Hooks por Dominio (`hooks/useQueries.ts`)

```typescript
export function useTiposPeca(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.geradorPecas.tiposPeca(),
    queryFn: () => geradorApi.get<TipoPecaResponse>('/tipos-peca'),
    staleTime: 1000 * 60 * 60, // 1 hora
    ...options,
  })
}
```

### Invalidacao pos-Mutation

```typescript
export function useExcluirGeracao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => geradorApi.delete(`/historico/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.geradorPecas.historico() })
    },
  })
}
```

---

## Server-Sent Events (SSE)

### Hook `useSSE`

O hook suporta integracao opcional com TanStack Query:

```typescript
useSSE({
  url: '/gerador-pecas/api/processar-stream',
  onMessage: (event) => handleChunk(event),
  onComplete: () => setPageState('resultado'),

  // Integracao TanStack Query: invalida cache ao completar
  queryClient,
  invalidateOnComplete: [queryKeys.geradorPecas.historico()],
})
```

**Politica SSE + Query Cache:**

| Fase | Estrategia | Motivo |
|------|-----------|--------|
| **Durante streaming** | Estado local (`onMessage`) | Chunks incrementais, sem cache |
| **Ao completar** | `invalidateQueries` | Sincroniza cache com dado final no servidor |

---

## Roteamento com TanStack Router

### Abordagem: Manual Routes + Lazy Loading

Usamos **roteamento manual** (`createRoute`) — nao file-based. Decisao motivada por:
- Controle explicito de rotas alias (ex: `/admin/prompts` e `/admin/prompts-config` apontam para mesma page)
- Integracoes com `AuthGuard` e layout compartilhado

### Lazy Loading

Todas as paginas sao carregadas via `React.lazy()`. O `Suspense` boundary fica no `AppLayout` (ao redor do `Outlet`), exibindo skeleton de carregamento.

```typescript
const GeradorPecasPage = lazy(() =>
  import('@/pages/gerador-pecas/GeradorPecasPage')
    .then(m => ({ default: m.GeradorPecasPage }))
)
```

Apenas `LoginPage` e carregada eagerly (primeira pagina visivel).

---

## Estilizacao

### Design Tokens (`lib/designTokens.ts`)

Tokens de cor e tipografia centralizados:

```typescript
import { C, FONT_UI, FONT_DOC } from '@/lib/designTokens'

// Cores: C.navy900, C.orange500, C.gray200, etc.
// Fontes: FONT_UI (Plus Jakarta Sans), FONT_DOC (Lora)
```

### Utility: `cn()`

```typescript
import { cn } from '@/lib/utils'
<div className={cn('flex items-center', isActive && 'bg-primary')} />
```

---

## Componentes UI

Baseados em **Radix UI + shadcn/ui** com variants via **class-variance-authority (cva)**.

Componentes em `components/ui/` sao atomicos. Composicao em `components/shared/`.

---

## Seguranca no Frontend

### Sanitizacao de HTML (DOMPurify)

**Sanitizacao e OBRIGATORIA e sem bypass.** O hook `useMarkdown` nao aceita opcao para desabilitar sanitizacao.

**Allowlist estrita** (tudo fora da lista e removido):

```
Tags permitidas: p, h1-h6, ul, ol, li, strong, em, b, i, a, code, pre,
  blockquote, br, hr, table, thead, tbody, tr, th, td, span, img,
  sup, sub, del, dd, dt, dl, details, summary

Atributos permitidos: href, target, rel, src, alt, class, id, title,
  colspan, rowspan, open

Protocolos permitidos: https, http, mailto, tel (ALLOW_UNKNOWN_PROTOCOLS: false)

PROIBIDOS: style (attr), on* (onclick/onerror/onload/onmouseover),
  javascript: URIs, data: URIs, vbscript: URIs,
  script/iframe/object/embed/form/svg/math/style tags
```

Links: todo `<a>` recebe `target="_blank"` + `rel="noopener noreferrer"` via hook DOMPurify.

**Componentes para renderizar HTML**:
- `useMarkdown(text)` — converte Markdown para HTML sanitizado (hook)
- `<MarkdownRenderer content={text} />` — wrapper do hook com estilos prose
- `<SafeHtml html={rawHtml} />` — sanitiza e renderiza HTML cru (sem Markdown)
- `sanitizeHtml(raw)` — funcao pura exportada para uso fora de componentes

**Regras para o time**:
1. NUNCA use `dangerouslySetInnerHTML` diretamente. Use `useMarkdown`, `MarkdownRenderer` ou `SafeHtml`.
2. NUNCA crie opcao de desabilitar sanitizacao.
3. Todo HTML vindo do backend ou de input de usuario DEVE ser sanitizado.
4. Testes de XSS em `src/hooks/__tests__/useMarkdown.security.test.ts` (26 testes).

### Politica de Links Externos

- Todo link externo DEVE ter `rel="noopener noreferrer"`.
- O DOMPurify hook ja forca isso automaticamente em links dentro de Markdown.
- Para links em JSX, usar explicitamente: `<a href="..." target="_blank" rel="noopener noreferrer">`.

### Politica de Redirects

- Nao existem redirects por query param (`?next=`, `?redirect=`).
- Redirects sao hardcoded: `window.location.href = '/login'` (unico destino).
- Se no futuro for necessario redirect por param, implementar allowlist de paths internos (inicio com `/`, sem `//`).

### Auth e Token

- Token JWT armazenado em `localStorage` (chave `access_token`).
- **Risco aceito**: `localStorage` e acessivel por scripts na mesma origem. Se houver XSS, token pode ser exfiltrado. Mitigacao primaria: sanitizacao forte + CSP.
- **Futuro**: Migrar para cookie httpOnly (requer mudanca no backend).
- Fluxo de 401: `api.ts` limpa token e redireciona uma unica vez (guard contra duplo redirect).
- `AuthGuard` nao renderiza conteudo enquanto status e `unknown`.

### Politica de Logs e Erros

- `console.log` NAO deve ser usado em producao. Apenas `console.warn` / `console.error` para erros reais.
- Toasts de fallback (fora do provider) logam apenas `variant`, sem conteudo.
- Mensagens de erro da API: usar `getUserFriendlyError(error)` de `lib/utils.ts` para evitar exposicao de detalhes internos em erros de servidor (5xx).
- NUNCA logar tokens, senhas ou dados pessoais (CPF, nomes de partes).

### Meta Tags de Seguranca

`index.html` inclui:
- `<meta name="referrer" content="strict-origin-when-cross-origin" />`

### Recomendacoes de CSP / Headers (infra)

O frontend nao controla headers HTTP diretamente. Recomendacoes para o gateway/nginx:

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  connect-src 'self' <api-domain>;
  font-src 'self';
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';

X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

---

## Testes

### Suites

| Suite | Comando | Contexto | Requer Backend? |
|-------|---------|----------|-----------------|
| **Unit** | `npm run test` | Vitest | Nao |
| **Smoke (local)** | `npm run test:portal-smoke` | Playwright + mocks | Sim |
| **Smoke (CI)** | `npm run test:ci-smoke` | Playwright + mocks | Nao |
| **Visual admin** | `npm run test:admin-visual` | Playwright + screenshots | Sim |
| **Visual portal** | `npm run test:portal-visual` | Playwright + screenshots | Sim |

### Smoke Suite para CI

A suite `test:ci-smoke` roda sem backend — todos os endpoints sao mockados via `page.route()`:

```bash
npm run test:ci-smoke   # Inicia so Vite, mocka todas as APIs
```

### Estrutura de Testes

```
src/
├── components/ui/__tests__/
├── hooks/__tests__/
├── pages/*/__tests__/
└── test/setup.ts

e2e/
├── portal.smoke.spec.ts    # Smoke tests (roda sem backend em CI)
├── admin.visual.spec.ts    # Visual regression admin
├── portal.visual.spec.ts   # Visual regression portal
└── fixtures/               # Dados de teste
```

---

## Governanca do Design System

### Regras de cva (class-variance-authority)

1. **Quando usar**: Componentes com 2+ variantes visuais (ex: Button, Badge, Alert)
2. **Nomenclatura**: `const fooVariants = cva(base, { variants: { variant, size } })`
3. **defaultVariants** obrigatorio
4. **Exports**: `buttonVariants` exportado para uso com `cn()` fora do componente

### Regras de Tokens

1. **Nunca** usar cor hex direto em componentes — usar `C.navy900` ou CSS variable
2. **Fontes**: usar `FONT_UI` ou `FONT_DOC` de `designTokens.ts`
3. **Cores de status**: `C.statusSuccess`, `C.statusWarning`, `C.statusError`, `C.statusInfo`

### Regras de Organizacao

1. `components/ui/` — atomicos (Button, Dialog, Input). Nao importam logica de negocio
2. `components/shared/` — composicao de atomicos (MarkdownRenderer, DataTable)
3. `components/layout/` — estrutura de pagina (AppLayout, Sidebar, Header, AuthGuard)
4. Paginas em `pages/<sistema>/` — conectam dados + UI

---

## Scripts Disponiveis

| Script | Comando | Descricao |
|--------|---------|-----------|
| `dev` | `vite` | Dev server (port 5173) |
| `build` | `vite build` | Build de producao |
| `preview` | `vite preview` | Preview do build |
| `lint` | `eslint .` | Linting |
| `test` | `vitest run` | Testes unitarios |
| `test:watch` | `vitest` | Testes em watch mode |
| `test:coverage` | `vitest run --coverage` | Testes com cobertura |
| `test:ci-smoke` | `playwright test -c playwright.ci-smoke.config.ts` | **Smoke CI (sem backend)** |
| `test:portal-smoke` | `playwright test -c playwright.portal-smoke.config.ts` | Smoke com backend |
| `test:admin-visual` | `playwright test -c playwright.admin-visual.config.ts` | Visual admin |
| `test:portal-visual` | `playwright test -c playwright.portal-visual.config.ts` | Visual portal |
| **`generate:api`** | `node scripts/generate-api.mjs` | **Gera tipos (dev local)** |
| **`generate:api:file`** | `node scripts/generate-api.mjs ./openapi.json` | **Gera tipos (CI/arquivo)** |

---

## Decisoes e Rationale

| Decisao | Rationale |
|---------|-----------|
| TanStack Query como padrao unico | Elimina bifurcacao useApiQuery vs useQuery. Cache, retry, devtools gratis |
| Query keys com `stableFilterKey` | Evita cache miss quando filtros sao objeto recriado a cada render |
| Auth com 3 estados explicitos | `unknown/authenticated/unauthenticated` elimina flicker e UI zombie |
| ApiError como classe | `instanceof ApiError` + `.status` + `.validationErrors` para tratamento tipado |
| DOMPurify com allowlist | Padrao seguro: tudo bloqueado exceto tags/atributos explicitamente permitidos |
| Schema validation em auth | Detecta inconsistencias backend→frontend cedo (login, /me) |
| Roteamento manual | Feature flags (native vs legacy) e rotas alias exigem controle explicito |
| Geracao OpenAPI via script Node | Cross-platform (Windows + Linux/CI) sem depender de cross-env |
| SSE invalida queries ao completar | Streaming atualiza estado local; ao finalizar, sincroniza cache global |

---

## Referencias

- [TanStack Query Docs](https://tanstack.com/query/latest)
- [TanStack Router Docs](https://tanstack.com/router/latest)
- [Zustand Docs](https://zustand-demo.pmnd.rs/)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Radix UI Docs](https://www.radix-ui.com/docs/primitives)
- [shadcn/ui Docs](https://ui.shadcn.com/)
- [hey-api/openapi-ts Docs](https://heyapi.dev/openapi-ts)
- [DOMPurify Docs](https://github.com/cure53/DOMPurify)
- [Vite Docs](https://vitejs.dev/)
