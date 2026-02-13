# RELATORIO DE AUDITORIA FRONTEND REACT
Data da auditoria: 2026-02-12
Escopo: `frontend-react` (qualidade, arquitetura, governanca visual) e impacto da migracao sobre o legado `frontend`.

## 1. Resumo executivo (nao tecnico)
- O frontend React esta funcional e com base tecnica moderna (React 19, TanStack Router, TanStack Query, Zustand, Tailwind, Radix).
- O projeto tem bons sinais de maturidade operacional: `build` passou, `test` passou (31 arquivos / 261 testes), e ha suite E2E.
- O principal passivo atual e de engenharia: paginas muito grandes, mistura de responsabilidades (UI + regra + streaming + fetch), e baseline de lint quebrada.
- Em padrao visual, existe uma base de tokens e componentes, mas o codigo ainda usa muito `style={{}}` e hex direto, contrariando a regra oficial do Design System.
- Conclusao geral: base boa para evoluir sem "big bang", mas precisa de um ciclo de hardening arquitetural e de consistencia para reduzir custo de manutencao.

## 2. O que o Design System define (achados) e divergencias
### 2.0 Varredura obrigatoria da pasta `Design System` (passo 0)
- A pasta `frontend-react/Design System` foi varrida integralmente para esta auditoria.
- Documentos-chave por categoria:
  - Tokens e visual: `PGE-DESIGN-SYSTEM.md`, `FRONTEND_STACK.md`.
  - Padroes de componentes/layout: `PGE-DESIGN-SYSTEM.md`, `FRONTEND_STACK.md`.
  - Regras de estado e arquitetura: `STATE_ARCHITECTURE_RULES.md`, `STATE_AUDIT_REPORT.md`.
  - UX/qualidade/regressao/paridade de rotas: `QA_FULL_FRONT_REGRESSION.md`, `QA_FULL_FRONT_REGRESSION_REPORT.md`.
  - Performance: `PERF_BASELINE_FEV2026.md`, `PERF_REPORT_FEV2026.md`.
  - Seguranca: `SECURITY_AUDIT_INVENTORY.md`, `SECURITY_AUDIT_REPORT.md`.
  - Consolidacao geral: `RESUMO.md`.

### 2.1 O que esta definido
- Tokens e identidade visual: `frontend-react/Design System/PGE-DESIGN-SYSTEM.md:43`, `frontend-react/src/lib/designTokens.ts`.
- Regra de uso de classes utilitarias: preferir Tailwind e evitar `style={{}}` salvo casos dinamicos (`frontend-react/Design System/PGE-DESIGN-SYSTEM.md:324`).
- Stack oficial e arquitetura alvo atual: `frontend-react/Design System/FRONTEND_STACK.md:105`, `frontend-react/Design System/FRONTEND_STACK.md:247`.
- Regra de estado: server state em Query, client state em Zustand (`frontend-react/Design System/STATE_ARCHITECTURE_RULES.md:18`, `frontend-react/Design System/STATE_ARCHITECTURE_RULES.md:52`, `frontend-react/Design System/STATE_ARCHITECTURE_RULES.md:320`).
- Seguranca front e sanitizacao: `frontend-react/Design System/FRONTEND_STACK.md:447`.

### 2.2 Divergencias encontradas no codigo
- Alto uso de estilo inline: 1597 ocorrencias de `style={{` em `src/pages` + `src/components` (56 arquivos).
- Alto uso de hex hardcoded: 201 ocorrencias em `src/pages`, `src/components`, `src/lib`.
- Exemplo direto de inline + hex em layout global:
  - `frontend-react/src/components/layout/AppLayout.tsx:45`
  - `frontend-react/src/components/layout/AppLayout.tsx:61`
  - `frontend-react/src/components/layout/Header.tsx:36`
- Estado e acesso a token fora da camada central:
  - `frontend-react/src/pages/cumprimento-beta/CumprimentoBetaPage.tsx:179`
  - `frontend-react/src/pages/matriculas/MatriculasPage.tsx:126`
- Fetch direto em pagina (em vez de padrao unico via client/hooks):
  - `frontend-react/src/pages/prestacao-contas/PrestacaoContasPage.tsx:278`
  - `frontend-react/src/pages/gerador-pecas/GeradorPecasPage.tsx:264`
  - `frontend-react/src/pages/relatorio-cumprimento/RelatorioCumprimentoPage.tsx:283`

## 3. Mapa do frontend (arquitetura atual)
### 3.1 Estrutura de pastas
- Raiz de codigo: `frontend-react/src`
- Organizacao principal:
  - `assets`, `components`, `hooks`, `lib`, `pages`, `stores`, `types`, `test`
- Paginas por dominio em `frontend-react/src/pages` (portal + admin).

### 3.2 Rotas
- Rotas definidas manualmente em `frontend-react/src/router.tsx`.
- 39 declaracoes de `path` no router.
- 29 imports `lazy()` (code splitting por rota).
- Guard de autenticacao e layout compartilhado:
  - `frontend-react/src/router.tsx:69`
  - `frontend-react/src/router.tsx:70`

### 3.3 Estado
- Estado de servidor: TanStack Query (`frontend-react/src/lib/query-client.ts`).
- Estado de cliente: Zustand:
  - `frontend-react/src/stores/auth-store.ts`
  - `frontend-react/src/stores/ui-store.ts`
- Bootstrap de auth com 3 estados explicitos:
  - `frontend-react/src/stores/auth-store.ts:56`
  - `frontend-react/src/stores/auth-store.ts:139`

### 3.4 API / data access
- Client central com tratamento de auth/erro: `frontend-react/src/lib/api.ts`.
- Hooks de Query/Mutation centralizados: `frontend-react/src/hooks/useQueries.ts`.
- Divergencia: ainda ha 11 chamadas `fetch(` em 7 paginas de `src/pages`.

### 3.5 UI e Design System
- Stack real: Tailwind + Radix + componentes shadcn (`frontend-react/package.json`, `frontend-react/src/components/ui/*`).
- Exemplo positivo de composicao e variacao (cva): `frontend-react/src/components/ui/button.tsx`.
- Exemplo positivo de componente reutilizavel orientado a configuracao: `frontend-react/src/components/shared/DataTable.tsx`.
- Divergencia principal: volume alto de estilo inline e cores hardcoded fora de token.

## 4. Avaliacao SOLID (com exemplos)
### SRP (Single Responsibility)
- Problema:
  - `frontend-react/src/pages/bert-training/BertTrainingPage.tsx` (2563 linhas)
  - `frontend-react/src/pages/gerador-pecas/GeradorPecasPage.tsx` (1900 linhas)
  - `frontend-react/src/pages/admin/prompts-modulos/PromptsModulosPage.tsx` (1667 linhas)
- Porque e problema: mesma unidade mistura UI, estado local extenso, fluxo de streaming, validacao, regras de negocio e acesso a API.
- Correcao incremental:
  - Extrair `hooks` de orquestracao por pagina.
  - Extrair subcomponentes de apresentacao sem efeito colateral.
  - Mover fetch/stream parser para `services` por dominio.

### OCP (Open/Closed)
- Ponto positivo:
  - Tabela configuravel por coluna: `frontend-react/src/components/shared/DataTable.tsx`.
  - Variants de botao com `cva`: `frontend-react/src/components/ui/button.tsx`.
- Gap:
  - Extensao de rota/menu exige alteracao em multiplos pontos (router + sidebar + algumas paginas de navegacao), aumentando risco de regressao.
- Correcao incremental:
  - Introduzir registro unico de navegacao/rotas de modulo e derivar sidebar a partir desse registry.

### LSP / ISP (interfaces e contratos)
- Problemas:
  - Contratos frouxos e `any` ainda presentes (vide erros de lint em `src/pages/admin/historico-gerador/HistoricoGeradorPage.tsx:173` e testes correlatos).
  - Componentes de pagina com muitos estados e callbacks tornam contrato de composicao dificil de substituir/testar.
- Correcao incremental:
  - Tipar DTOs de dominio por feature e reduzir `any`.
  - Definir contratos menores por componente (`presentational`) e mover logica para hook/container.

### DIP (Dependency Inversion)
- Ponto positivo:
  - Existe camada de abstracao (`frontend-react/src/lib/api.ts`, `frontend-react/src/hooks/useQueries.ts`).
- Problema:
  - Paginas com dependencia direta de `fetch` + token em `localStorage`:
    - `frontend-react/src/pages/cumprimento-beta/CumprimentoBetaPage.tsx:179`
    - `frontend-react/src/pages/matriculas/MatriculasPage.tsx:126`
- Correcao incremental:
  - Criar servicos por feature (ex.: `features/cumprimento-beta/api.ts`) e consumir via hooks.
  - Banir novo `fetch` em pagina via regra lint/arquitetura.

## 5. Clean Code: problemas e padroes inconsistentes
### Evidencias objetivas
- `npm run lint` (2026-02-12): 89 problemas (69 erros, 20 warnings).
- Erros em `src` e `e2e` (nao restrito a teste).
- Tipos de problema recorrente:
  - `no-unused-vars`
  - `react-hooks/exhaustive-deps`
  - `react-hooks/set-state-in-effect`
  - `@typescript-eslint/no-explicit-any`
  - `react-refresh/only-export-components`

### Inconsistencias de organizacao
- Boundary UI x dados inconsistente: parte usa Query/client, parte usa fetch local.
- Duplicacao de fluxo de streaming e parser SSE em varias paginas:
  - `frontend-react/src/pages/gerador-pecas/GeradorPecasPage.tsx`
  - `frontend-react/src/pages/pedido-calculo/PedidoCalculoPage.tsx`
  - `frontend-react/src/pages/prestacao-contas/PrestacaoContasPage.tsx`
  - `frontend-react/src/pages/relatorio-cumprimento/RelatorioCumprimentoPage.tsx`
- Grande volume de inline style dificulta manutencao visual centralizada.

## 6. Performance: achados e quick wins
### Achados
- Build de producao passa com chunks separados por rota (lazy + vendor chunks).
- Maiores chunks observados no build:
  - `vendor-recharts`: 381.97 kB
  - `index`: 259.93 kB
  - `vendor-tanstack`: 126.45 kB
- Arquivos de pagina muito grandes elevam custo de parse/manutencao e risco de re-render nao intencional.
- `npm run test:ci-smoke` passou, mas com 3 cenarios flakey (passou no retry).

### Quick wins
- Extrair areas de graficos pesados para carregamento sob demanda.
- Padronizar memoizacao seletiva em blocos caros (ja aplicado em parte do layout).
- Consolidar parser de streaming em util/hook compartilhado por dominio.

## 7. Seguranca no front: achados e recomendacoes
### Pontos fortes
- Pipeline de sanitizacao consistente para markdown/HTML:
  - `frontend-react/src/hooks/useMarkdown.ts`
  - `frontend-react/src/components/shared/MarkdownRenderer.tsx`
  - `frontend-react/src/components/shared/SafeHtml.tsx`
- 21 usos de `dangerouslySetInnerHTML` em 15 arquivos, com padrao de sanitizacao detectado (uso de `useMarkdown` ou `sanitizeHtml`).
- Links externos com `rel="noopener noreferrer"` nos pontos encontrados:
  - `frontend-react/src/pages/cumprimento-beta/CumprimentoBetaPage.tsx:645`
  - `frontend-react/src/pages/admin/legacy/LegacyAdminFramePage.tsx:104`

### Riscos abertos
- Token ainda em `localStorage` (risco residual em caso de XSS): `frontend-react/src/lib/api.ts`.
- Leitura direta de token em paginas (bypass do client central):
  - `frontend-react/src/pages/cumprimento-beta/CumprimentoBetaPage.tsx:179`
  - `frontend-react/src/pages/matriculas/MatriculasPage.tsx:126`

### Recomendacoes
- Eliminar acesso direto a token fora de `lib/api.ts` / camada de auth.
- Planejar migracao para cookie httpOnly quando backend suportar.
- Adicionar regra de lint para bloquear `dangerouslySetInnerHTML` fora de wrappers permitidos.

## 8. Testes e testabilidade: estado atual e gaps
### Estado atual
- `npm run test` passou: 31 arquivos, 261 testes.
- `npm run test:ci-smoke` passou com retries (3 flakies).
- Cobertura funcional relevante em paginas de negocio e admin.

### Gaps principais
- Paginas sem teste direto identificado:
  - `frontend-react/src/pages/login/LoginPage.tsx`
  - `frontend-react/src/pages/change-password/ChangePasswordPage.tsx`
  - `frontend-react/src/pages/dashboard/DashboardPageV2.tsx`
  - `frontend-react/src/pages/dev/DesignSystemPage.tsx`
- Warnings recorrentes de `act(...)` e `DialogContent` sem descricao nos testes, indicando fragilidade de teste de UI.

### Estrategia incremental de adocao
- Fase 1: smoke unitario de login/dashboard/change-password.
- Fase 2: testes de contrato de hooks de streaming.
- Fase 3: estabilizacao de flakies E2E com utilitarios de espera e instrumentacao.

## 9. Pontuacao (0 a 10)
- Arquitetura: 7.2
- Organizacao do repo: 7.0
- Qualidade do codigo: 5.8
- Consistencia com Design System: 5.6
- Testabilidade: 7.4
- Performance: 7.5
- Seguranca: 7.3

## 10. Top 15 problemas mais importantes (priorizados)
1. Baseline de lint quebrada (69 erros) reduz confiabilidade de PR.
2. Paginas gigantes com baixa separacao de responsabilidades (SRP).
3. Fetch direto em 7 paginas, quebrando padrao arquitetural de dados.
4. Leitura direta de token em paginas (risco de seguranca e acoplamento).
5. Excesso de inline style (1597 ocorrencias), dificultando governanca visual.
6. Cores hardcoded fora de token (201 ocorrencias), risco de inconsistencia visual.
7. Duplicacao de fluxo de streaming/parsing em varias paginas.
8. Flakiness em smoke E2E (passa com retry, mas sinaliza instabilidade).
9. Warnings recorrentes de `act(...)` nos testes unitarios.
10. Warnings de acessibilidade em dialogs (`aria-describedby`).
11. Contratos tipados com `any` ainda presentes em areas criticas.
12. Regras de hooks com dependencias incompletas em varios arquivos.
13. Fronteira layout/design token nao aplicada de forma uniforme.
14. Ausencia de testes diretos em login/dashboard/change-password.
15. Presenca de componente legado de iframe no frontend (`admin/legacy`) sem uso no router atual, aumentando custo de manutencao.

## 11. Recomendacoes (curto e medio prazo)
### Curto prazo (1-2 semanas)
- Congelar padrao: sem novo `fetch` em pagina, sem novo `style={{}}` fora excecao documentada.
- Reduzir lint errors para zero por blocos (primeiro `src`, depois `e2e`).
- Cobrir login/dashboard/change-password com testes basicos.
- Extrair 1 fluxo de streaming para hook compartilhado piloto.

### Medio prazo (3-6 semanas)
- Migrar para feature slices por dominio (`src/features/<dominio>`).
- Mover servicos de API por dominio e padronizar Query/Mutation.
- Refatorar 3 maiores paginas em PRs pequenos (SRP + testabilidade).
- Consolidar tema/tokens em classes utilitarias e remover hardcoded gradualmente.
