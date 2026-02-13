# PLANO DE MELHORIAS FRONTEND REACT
Data base: 2026-02-12
Objetivo: elevar qualidade arquitetural e consistencia sem refactor big bang.

## Principios (padroes a adotar)
- Um unico padrao de acesso a dados: pagina nao chama `fetch` direto.
- Separacao clara: `container/hook` para regra e IO, componente para apresentacao.
- Feature-first: organizar por dominio para reduzir acoplamento transversal.
- Design System como fonte unica: tokens e classes utilitarias, evitando hardcoded.
- PR pequeno e reversivel: cada entrega deve ter rollout e rollback simples.
- Teste minimo por mudanca: unitario de comportamento + smoke de rota impactada.

## Target architecture proposta
```text
src/
  app/                 # bootstrap, providers, guards
  routes/              # declaracao de rotas + route registry
  pages/               # wrappers de pagina (finos)
  features/
    <dominio>/
      components/      # UI do dominio
      hooks/           # regra de negocio / orquestracao
      services/        # chamadas API e mapeamento DTO
      types/           # tipos do dominio
  components/
    ui/                # primitives (shadcn/radix)
    shared/            # blocos reutilizaveis transversais
    layout/            # shell app (header/sidebar/content)
  services/
    api/               # client base + interceptors + helpers comuns
  hooks/               # hooks transversais
  state/               # stores Zustand
  styles/              # tema, tokens css, utilitarios
  utils/               # helpers puros
```

## Gap entre estado atual e alvo
- Ja existe:
  - `lib/api.ts`, `lib/query-client.ts`, `stores/*`, `components/ui/*`, `hooks/useQueries.ts`.
- Divergente:
  - Paginas concentram muita regra e IO.
  - `features/` ainda nao e padrao dominante.
  - Estilo inline/hardcoded muito acima do aceitavel.

## Plano em fases (PRs pequenos)
## Fase 1: quick wins (lint, estrutura minima, duplicacao)
### Tarefas
- Corrigir lint em `src` primeiro (deixar `src` com zero erro), mantendo `e2e` para lote seguinte.
- Criar regra de arquitetura:
  - bloquear novo `fetch(` em `src/pages`.
  - bloquear novo `localStorage.getItem('access_token')` fora de `lib/api.ts`.
- Criar estrutura inicial por dominio para 2 features piloto:
  - `features/gerador-pecas`
  - `features/prestacao-contas`
- Extrair parser de streaming comum para `services/api/streaming.ts`.

### Arquivos impactados (estimativa)
- `frontend-react/eslint.config.js`
- `frontend-react/src/pages/**/*`
- `frontend-react/src/lib/api.ts`
- `frontend-react/src/services/api/streaming.ts` (novo)
- `frontend-react/src/features/*` (novos modulos piloto)

### Risco
- Medio (pode quebrar fluxo de pagina se extracao for apressada).

### Como validar
- `npm run lint`
- `npm run test`
- Smoke manual de rotas piloto (`/gerador-pecas`, `/prestacao-contas`).

## Fase 2: feature slices (migrar por dominio)
### Tarefas
- Migrar por ondas:
  - Onda A: `gerador-pecas`, `pedido-calculo`, `prestacao-contas`.
  - Onda B: `relatorio-cumprimento`, `extrator-autos`, `matriculas`.
  - Onda C: dominios admin com maior complexidade.
- Reduzir tamanho de pagina:
  - meta inicial: nenhuma pagina > 1200 linhas.
  - meta intermediaria: nenhuma pagina > 800 linhas.
- Centralizar API por dominio em `features/<dominio>/services`.

### Arquivos impactados (estimativa)
- `frontend-react/src/pages/*`
- `frontend-react/src/hooks/useQueries.ts` (quebrando em hooks por dominio)
- `frontend-react/src/features/<dominio>/**`

### Risco
- Medio-alto (muitas movimentacoes de arquivo e import).

### Como validar
- Testes por dominio antes/depois da migracao.
- Comparacao visual de rotas criticas (snapshot ou checklist manual).
- Revisao de bundle para garantir que chunking nao piorou.

## Fase 3: testes minimos e CI
### Tarefas
- Cobrir lacunas:
  - `LoginPage`, `DashboardPageV2`, `ChangePasswordPage`.
- Tratar warnings `act(...)` e `DialogContent` sem descricao.
- Endurecer CI:
  - gate de `npm run lint`.
  - gate de `npm run test`.
  - smoke E2E sem flakey aberto (ou com limite formal e ticket associado).

### Arquivos impactados (estimativa)
- `frontend-react/src/pages/login/*`
- `frontend-react/src/pages/dashboard/*`
- `frontend-react/src/pages/change-password/*`
- `frontend-react/src/test/*`
- `.github/workflows/*` (se gate novo for aplicado)

### Risco
- Baixo-medio.

### Como validar
- CI verde sem suppressions novas.
- Relatorio de testes atualizado em `Design System`.

## Fase 4: performance e refino visual
### Tarefas
- Reduzir inline style/hardcoded com backlog orientado por contagem.
- Extrair componentes de visualizacao pesada para lazy interno.
- Revisar uso de Recharts (vendor chunk alto) e carregar sob demanda quando possivel.
- Definir budget simples de bundle por rota critica.

### Arquivos impactados (estimativa)
- `frontend-react/src/components/layout/*`
- `frontend-react/src/pages/admin/performance/PerformancePage.tsx`
- `frontend-react/src/pages/dashboard/*`
- `frontend-react/vite.config.ts`
- `frontend-react/src/index.css`

### Risco
- Medio.

### Como validar
- `npm run build` com comparativo de chunk.
- Smoke de navegacao entre rotas lazy.
- Checklist visual de tokens/cores em layout global.

## Sequencia sugerida de PRs
1. PR-01: baseline lint `src` + regras anti-regressao (`fetch`, token direto).
2. PR-02: parser streaming compartilhado + migracao piloto 1 dominio.
3. PR-03: migracao piloto 2 dominio + reducao de pagina gigante.
4. PR-04: testes faltantes (login/dashboard/change-password) + estabilizacao warnings.
5. PR-05: refino visual (tokens, inline styles, hardcoded colors).

## Critero de concluido
- Lint sem erro em `src`.
- Nenhuma pagina critica com IO direto em componente.
- Rotas principais cobertas por teste minimo automatizado.
- Queda mensuravel de inline style/hardcoded.
