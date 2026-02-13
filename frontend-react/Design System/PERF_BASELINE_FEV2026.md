# Performance Baseline — Fevereiro 2026

> Capturado em 2026-02-11, branch `feat/tailadmin-dashboard`
> Vite 7.3.1 | React 19.2 | TanStack Router 1.158

## Build de Producao

| Metrica | Valor |
|---------|-------|
| Tempo de build | **7.26s** |
| Modulos transformados | 2.634 |
| Warnings | 1 (chunk > 500 kB) |

## Assets Gerados

| Asset | Tamanho | Gzipped |
|-------|---------|---------|
| `index-CVDruq9v.js` | **1.481,33 kB** | **406,09 kB** |
| `index-BhDOYxsO.css` | 85,75 kB | 15,54 kB |
| `index.html` | 0,48 kB | 0,31 kB |
| **Total** | **1.567,56 kB** | **421,94 kB** |

### Problema principal

**Bundle monolitico**: todo o JS esta em UM unico chunk. Nao ha code splitting.

## Rotas (50+)

Todas as rotas sao importadas de forma **sincrona** no `router.tsx`. Nenhum `React.lazy()` ou `import()` dinamico.

### Paginas por sistema (linhas de codigo)

| Pagina | Linhas | Dependencias pesadas |
|--------|--------|---------------------|
| BertTrainingPage | 2.703 | recharts |
| GeradorPecasPage | 2.091 | SSE, marked |
| PrestacaoContasPage | 1.667 | - |
| PromptsModulosPage | 1.601 | - |
| ClassificadorPage | 1.543 | SSE |
| RelatorioCumprimentoPage | 1.322 | - |
| ExtratorAutosPage | 1.320 | - |
| PedidoCalculoPage | 1.198 | - |
| MatriculasPage | 1.157 | - |
| ConfigPecasPage | 973 | - |
| FeedbacksPage | ~800 | recharts |
| PerformancePage | ~700 | recharts |

### Paginas admin (19 rotas, incluindo aliases)

Todas carregam no bundle inicial junto com as paginas de sistema.

## Dependencias Principais

| Pacote | Versao | Uso | Status |
|--------|--------|-----|--------|
| react + react-dom | 19.2.0 | Core | Necessario |
| @tanstack/react-router | 1.158.4 | Roteamento | Necessario |
| @tanstack/react-query | 5.90.21 | Estado servidor | Necessario |
| recharts | 3.7.0 | Graficos (3 paginas) | Lazy-loadable |
| cmdk | 1.1.1 | Command palette | **NAO USADO** |
| lucide-react | 0.563.0 | Icones (~50+) | Tree-shake OK |
| @radix-ui/* | varios | Componentes UI | Necessario |
| marked | 17.0.1 | Markdown render | Necessario |
| dompurify | 3.3.1 | Sanitizacao HTML | Necessario |
| zustand | 5.0.11 | Estado global (2 stores) | Necessario |
| class-variance-authority | 0.7.1 | Variantes CSS | Necessario |

### Dependencia nao utilizada

- **cmdk 1.1.1**: Componente `command.tsx` (shadcn/ui) existe mas NAO e importado por nenhuma pagina.

## Code Splitting

| Tecnica | Status |
|---------|--------|
| React.lazy() | NAO usado |
| import() dinamico | NAO usado |
| manualChunks (Vite) | NAO configurado |
| Lazy routes (TanStack) | NAO usado |

## TanStack Query Config

| Opcao | Valor | Avaliacao |
|-------|-------|-----------|
| staleTime | 5 min | OK |
| gcTime | 30 min | Alto (pode ser 10-15 min) |
| retry | 1 | OK |
| refetchOnWindowFocus | false | OK |
| refetchOnReconnect | true | OK |

## Conclusao

O principal gargalo e o **bundle monolitico de 1.481 kB**. Todas as 50+ paginas, incluindo paginas admin com graficos (recharts ~150 kB), sao carregadas no primeiro request, mesmo quando o usuario so precisa ver o login ou o dashboard.

### Oportunidades de otimizacao

1. **Lazy loading por rota** — impacto estimado: -60-70% no bundle inicial
2. **manualChunks no Vite** — separar vendors do codigo da aplicacao
3. **Remover cmdk** — ~50 kB de dead code
4. **Mover recharts para chunk lazy** — so 3 paginas usam
5. **Ajustar gcTime** — reduzir consumo de memoria em sessoes longas
