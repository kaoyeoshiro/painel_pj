# Performance Report — Fevereiro 2026

> Otimizacao realizada em 2026-02-11, branch `feat/tailadmin-dashboard`
> Vite 7.3.1 | React 19.2 | TanStack Router 1.158

## Resumo Executivo

| Metrica | ANTES | DEPOIS | Reducao |
|---------|-------|--------|---------|
| JS total (1 request) | 1.481 kB (406 kB gz) | N/A (split em chunks) | — |
| JS inicial (first load) | 1.481 kB (406 kB gz) | ~497 kB (~158 kB gz) | **-66%** |
| Maior chunk JS | 1.481 kB | 365 kB (recharts, lazy) | **-75%** |
| CSS | 85,75 kB (15,54 kB gz) | 85,98 kB (15,57 kB gz) | ~0% |
| Chunks JS gerados | **1** | **85+** (por rota) | code-split |
| Build time | 7,26s | 11,43s | +57% (esperado) |
| Warning > 500 kB | SIM | NAO | Resolvido |

## O Que O Usuario Baixa (First Load)

### ANTES: /login ou /dashboard

O usuario baixava **tudo** de uma vez:

| Asset | Tamanho | Gzip |
|-------|---------|------|
| index.js (monolitico) | 1.481,33 kB | 406,09 kB |
| index.css | 85,75 kB | 15,54 kB |
| **Total** | **1.567 kB** | **421 kB** |

### DEPOIS: /login

Apenas o essencial:

| Asset | Tamanho | Gzip |
|-------|---------|------|
| index.js (shell + login) | 259,28 kB | 81,78 kB |
| vendor-tanstack.js | 126,44 kB | 39,81 kB |
| index.css | 85,98 kB | 15,57 kB |
| **Total** | **~472 kB** | **~137 kB** |

### DEPOIS: /dashboard (autenticado)

Carrega o shell + dashboard page sob demanda:

| Asset | Tamanho | Gzip |
|-------|---------|------|
| index.js (shell) | 259,28 kB | 81,78 kB |
| vendor-tanstack.js | 126,44 kB | 39,81 kB |
| vendor-radix.js | 111,93 kB | 36,24 kB |
| DashboardPageV2.js | 9,43 kB | 3,50 kB |
| index.css | 85,98 kB | 15,57 kB |
| **Total** | **~593 kB** | **~177 kB** |

### DEPOIS: /bert-training (pagina mais pesada)

Recharts so carrega aqui:

| Asset adicional | Tamanho | Gzip |
|-----------------|---------|------|
| BertTrainingPage.js | 63,92 kB | 13,75 kB |
| vendor-recharts.js | 365,15 kB | 107,79 kB |

## Otimizacoes Aplicadas

### 1. Code Splitting por Rota (ALTO IMPACTO)

**Arquivo**: `src/router.tsx`

- Todas as 30 paginas convertidas para `React.lazy()` com `import()` dinamico
- Cada pagina gera um chunk separado no build
- LoginPage permanece eager (primeira pagina visivel)
- Suspense boundary adicionado no `AppLayout` com fallback de loading skeleton

**Impacto**: Bundle inicial reduzido de 1.481 kB para ~260 kB (reducao de 82% no JS da app)

### 2. Vendor Chunks (manualChunks no Vite)

**Arquivo**: `vite.config.ts`

Vendors separados em chunks independentes para melhor caching:

| Chunk | Tamanho | Quando carrega |
|-------|---------|----------------|
| vendor-tanstack | 126 kB | Sempre (router + query) |
| vendor-radix | 112 kB | Com o layout (UI primitives) |
| vendor-recharts | 365 kB | **Sob demanda** (3 paginas) |
| vendor-markdown | 62 kB | **Sob demanda** (paginas com markdown) |

**Impacto**: Recharts (365 kB) deixou de carregar no bundle inicial.

### 3. Suspense Fallback (UX)

**Arquivo**: `src/components/layout/AppLayout.tsx`

- Adicionado `<Suspense>` ao redor do `<Outlet />` no AppLayout
- Fallback com skeleton pulsante que imita a estrutura de uma pagina (titulo + paragrafo + linhas)
- Evita "flash" em branco durante carregamento de rota lazy

### 4. Header Memoizado

**Arquivo**: `src/components/layout/Header.tsx`

- `Header` envolto em `React.memo()` para evitar re-render quando AppLayout re-renderiza por mudanca de rota
- Zustand subscriptions seletivas (`useAuthStore(s => s.user)` em vez de `useAuthStore()`)

### 5. Sidebar Subscriptions Seletivas

**Arquivo**: `src/components/layout/Sidebar.tsx`

- Zustand subscriptions seletivas em `SidebarContent` e `Sidebar`
- Evita re-render quando propriedades nao relacionadas mudam no store

### 6. BERT Polling Condicional

**Arquivo**: `src/hooks/useQueries.ts`

- `useBertStatus` nao faz polling por padrao (era 5s incondicional)
- Polling agora e opt-in via `refetchInterval` parameter
- Evita requests desnecessarias quando nenhum treinamento esta ativo

### 7. gcTime Reduzido

**Arquivo**: `src/lib/query-client.ts`

- `gcTime` reduzido de 30 para 15 minutos
- Menor consumo de memoria em sessoes longas
- staleTime permanece em 5 min (adequado para a maioria dos dados)

### 8. Bundle Analyzer

**Arquivo**: `vite.config.ts`

- Adicionado `rollup-plugin-visualizer` (devDependency)
- Gera relatorio visual em `reports/bundle-analysis.html` a cada build
- Facilita identificacao de regressoes futuras

## Analise de Bundle (reports/bundle-analysis.html)

Relatorio HTML interativo gerado automaticamente a cada build.
Abrir `reports/bundle-analysis.html` no navegador para visualizar:

- Treemap de todos os modulos e seus tamanhos
- Tamanhos raw, gzip e brotli
- Identificacao de dependencias grandes

## Trade-offs

| Decisao | Beneficio | Custo |
|---------|-----------|-------|
| Lazy loading por rota | -66% JS inicial | +57% tempo de build (12s vs 7s) |
| manualChunks | Melhor caching | Mais requests HTTP (mitigado por HTTP/2) |
| Muitos chunks pequenos (icones) | Tree-shaking fino | ~35 micro-chunks (0.1-0.5 kB cada) |
| Suspense fallback generico | Evita flash branco | Nao e skeleton especifico de cada pagina |

## Dependencia Nao Utilizada

- **cmdk 1.1.1** (command palette): O componente `components/ui/command.tsx` existe mas NAO e importado por nenhuma pagina. Tree-shaking ja remove do bundle, mas a dependencia pode ser removida do `package.json` para limpeza.

## Proximos Passos (Backlog)

### Curto prazo (quick wins)

1. **Remover `cmdk` do package.json** — nao e usado por nenhuma pagina
2. **Prefetch de rota no hover** — carregar chunk da pagina quando usuario passa o mouse no link da sidebar
3. **Skeletons especificos** — criar fallbacks de loading para paginas admin vs portal

### Medio prazo

4. **Service Worker (caching)** — cachear vendor chunks que raramente mudam
5. **Font optimization** — self-host Google Fonts (Lora + Plus Jakarta Sans) para evitar FOUT/FOIT
6. **Comprimir imagens** — otimizar logo e assets estaticos

### Longo prazo

7. **Virtualizacao de listas** — se alguma tabela admin tiver 500+ linhas, considerar @tanstack/react-virtual
8. **Module preloading** — usar `<link rel="modulepreload">` para chunks criticos
9. **Bundle budget CI** — adicionar check no CI que falha se bundle inicial ultrapassar 300 kB gzip

## Arquivos Modificados

| Arquivo | Tipo de mudanca |
|---------|----------------|
| `src/router.tsx` | Lazy imports para todas as rotas |
| `src/components/layout/AppLayout.tsx` | Suspense boundary com fallback |
| `src/components/layout/Header.tsx` | React.memo + selective subscriptions |
| `src/components/layout/Sidebar.tsx` | Selective Zustand subscriptions |
| `src/hooks/useQueries.ts` | BERT polling condicional |
| `src/lib/query-client.ts` | gcTime reduzido para 15 min |
| `vite.config.ts` | manualChunks + visualizer plugin |
| `package.json` | +rollup-plugin-visualizer (devDep) |

## Core Web Vitals — Budget e Baseline

> Metricas de referencia para monitoramento continuo.
> Valores baseline coletados em ambiente local (Vite dev server, sem throttling).
> Em producao (build otimizado + HTTP/2 + CDN), valores tendem a ser melhores.

### Budget (metas recomendadas pelo Google)

| Metrica | Descricao | Budget | Classificacao |
|---------|-----------|--------|---------------|
| **LCP** (Largest Contentful Paint) | Tempo ate o maior elemento visivel carregar | < 2.5s | Bom |
| **INP** (Interaction to Next Paint) | Latencia de interacao (substitui FID desde mar/2024) | < 200ms | Bom |
| **CLS** (Cumulative Layout Shift) | Deslocamento visual acumulado | < 0.1 | Bom |
| **FCP** (First Contentful Paint) | Tempo ate o primeiro conteudo pintado | < 1.8s | Bom |
| **TTFB** (Time to First Byte) | Tempo ate primeiro byte do servidor | < 800ms | Bom |
| **TBT** (Total Blocking Time) | Tempo total bloqueando main thread | < 200ms | Bom |

### Baseline Estimado (pos-otimizacao)

| Metrica | Rota /login | Rota /dashboard | Rota /bert-training |
|---------|-------------|-----------------|---------------------|
| **JS inicial (gzip)** | ~137 kB | ~177 kB | ~299 kB |
| **LCP esperado** | < 1.5s | < 2.0s | < 2.5s |
| **INP esperado** | < 100ms | < 150ms | < 200ms |
| **CLS esperado** | ~0 | < 0.05 | < 0.1 |
| **FCP esperado** | < 1.0s | < 1.5s | < 1.8s |

**Notas:**
- `/login` e a rota mais leve (JS ~137 kB gzip, sem vendor-radix/recharts)
- `/bert-training` e a rota mais pesada (carrega recharts sob demanda, 365 kB)
- CLS tende a zero porque usamos Suspense fallback com skeleton que ocupa o mesmo espaco
- INP depende da complexidade da pagina; paginas com DataTable grandes podem ter INP maior

### Como Coletar Metricas

#### Opcao 1: Lighthouse CLI (recomendado para CI)

```bash
# Instalar Lighthouse globalmente
npm install -g lighthouse

# Coletar metricas da rota /login (requer servidor rodando)
lighthouse http://localhost:5173/login \
  --output=json \
  --output-path=reports/lighthouse-login.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance

# Coletar metricas da rota /dashboard
lighthouse http://localhost:5173/dashboard \
  --output=json \
  --output-path=reports/lighthouse-dashboard.json \
  --chrome-flags="--headless --no-sandbox" \
  --only-categories=performance
```

#### Opcao 2: Chrome DevTools (manual)

1. Abrir Chrome DevTools (F12)
2. Aba "Lighthouse" > Selecionar "Performance"
3. Clicar "Analyze page load"
4. Anotar LCP, TBT, CLS, FCP, Speed Index

#### Opcao 3: web-vitals (runtime, futuro)

```typescript
// Adicionar ao main.tsx para coleta em producao
import { onLCP, onINP, onCLS } from 'web-vitals'
onLCP(console.log)
onINP(console.log)
onCLS(console.log)
```

### Budget CI (futuro)

Para adicionar verificacao automatica no CI:

```bash
# Instalar lighthouse-ci
npm install -g @lhci/cli

# Criar .lighthouserc.json na raiz
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "largest-contentful-paint": ["warn", { "maxNumericValue": 2500 }],
        "cumulative-layout-shift": ["error", { "maxNumericValue": 0.1 }],
        "interactive": ["warn", { "maxNumericValue": 3000 }]
      }
    }
  }
}
```

## Validacao

- [x] `npx tsc --noEmit` — sem erros
- [x] `npx eslint` nos arquivos modificados — sem erros
- [x] `npm run build` — sem warnings de chunk > 500 kB
- [x] Navegacao entre rotas funciona (Suspense + lazy load)
- [x] Nenhuma regra de negocio alterada
- [x] Nenhum contrato de API alterado
