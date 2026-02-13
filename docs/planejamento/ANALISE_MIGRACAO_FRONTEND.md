# Analise de Migracao do Frontend — Portal PGE-MS

> Documento gerado em: Fevereiro/2026
> Objetivo: Avaliar o estado atual do frontend, mapear opcoes de modernizacao, riscos e recomendacoes.
> Contexto: Equipe tecnica sugeriu refatoracao total do front-end devido a templates HTML monoliticos.

---

## Sumario

1. [Diagnostico do Estado Atual](#1-diagnostico-do-estado-atual)
2. [Problemas Identificados](#2-problemas-identificados)
3. [Opcoes de Stack](#3-opcoes-de-stack)
4. [Comparativo Geral](#4-comparativo-geral)
5. [Riscos e Dificuldades da Migracao](#5-riscos-e-dificuldades-da-migracao)
6. [Recomendacao Final](#6-recomendacao-final)

---

## 1. Diagnostico do Estado Atual

### 1.1 Arquitetura Geral

O Portal PGE usa **FastAPI** como backend com **Jinja2Templates** para renderizacao server-side.
Cada sistema (gerador de pecas, extrator de autos, BERT training, etc.) possui sua propria
pasta com templates HTML, que sao servidos diretamente pelo backend.

```
Fluxo atual:
  Browser → FastAPI (rota) → Jinja2 renderiza HTML → Resposta com pagina completa
  Browser → fetch/SSE → FastAPI (API REST) → JSON
```

**Nao ha SPA (Single Page Application)**. Cada sistema e uma pagina HTML independente,
com navegacao via links tradicionais.

### 1.2 Inventario Quantitativo

| Metrica | Valor |
|---------|-------|
| Total de templates HTML | **30 arquivos** |
| Total de linhas HTML | **~68.000 linhas** |
| Total de arquivos JS separados | **13 arquivos** |
| Total de linhas JS | **~17.000 linhas** |
| Total estimado de frontend | **~85.000 linhas** |
| Arquivos TypeScript (src/) | **22 arquivos** |
| Templates com `<script>` inline | **100% (30/30)** |

### 1.3 Templates por Tamanho (Top 10)

| Arquivo | Linhas | Tipo |
|---------|--------|------|
| `frontend/templates/admin_prompts_modulos.html` | 7.654 | Admin |
| `frontend/templates/admin_categorias_json.html` | 4.188 | Admin |
| `sistemas/classificador_documentos/templates/index.html` | 3.953 | Sistema |
| `sistemas/extrator_autos/templates/index.html` | 2.683 | Sistema |
| `frontend/templates/admin_teste_categorias_json.html` | 2.509 | Admin |
| `sistemas/prestacao_contas/templates/index.html` | 2.178 | Sistema |
| `frontend/templates/admin_feedbacks.html` | 1.979 | Admin |
| `frontend/templates/admin_variaveis.html` | 1.900 | Admin |
| `frontend/templates/admin_prompts.html` | 1.858 | Admin |
| `frontend/templates/admin_performance.html` | 1.663 | Admin |

**Observacao critica:** Um unico template (admin_prompts_modulos) tem quase **8.000 linhas**.
Isso inclui HTML, CSS inline e JavaScript inline misturados no mesmo arquivo.

### 1.4 JavaScript Separado (Top 5)

| Arquivo | Linhas | Sistema |
|---------|--------|---------|
| `sistemas/cumprimento_beta/templates/app.js` | 3.474 | Cumprimento Beta |
| `sistemas/cumprimento_beta/templates/index.js` | 3.474 | Cumprimento Beta |
| `sistemas/gerador_pecas/templates/app.js` | 2.585 | Gerador de Pecas |
| `sistemas/bert_training/templates/app.js` | 1.576 | BERT Training |
| `sistemas/matriculas_confrontantes/templates/app.js` | 1.430 | Matriculas |

### 1.5 Stack Tecnologica Atual

| Camada | Tecnologia | Observacao |
|--------|-----------|------------|
| Renderizacao | Jinja2 (server-side) | Templates servidos pelo FastAPI |
| CSS | Tailwind CSS **via CDN** | Nao instalado localmente, sem purge/otimizacao |
| Icones | FontAwesome 6.4.2 (CDN) | |
| JavaScript | Vanilla JS + TypeScript (parcial) | Migracao TS iniciada mas incompleta |
| Bundler | esbuild | So para os arquivos .ts em `frontend/src/` |
| Markdown | Marked.js (CDN) | Gerador de pecas, prestacao de contas |
| PDF | PDF.js v3.11.174 (CDN) | Classificador de documentos |
| Graficos | Chart.js (CDN) | BERT Training |
| Drag & Drop | SortableJS v1.15.0 (CDN) | Admin prompts |

### 1.6 Infraestrutura TypeScript Existente

Ja existe uma infraestrutura parcial de TypeScript:

```
frontend/
├── package.json          # esbuild + typescript
├── tsconfig.json         # strict mode, ES2020 target
├── scripts/build.mjs     # Build script customizado
└── src/
    ├── shared/           # api.ts, ui.ts, security.ts, timezone.ts
    ├── types/            # api.ts (tipos compartilhados)
    └── sistemas/
        ├── assistencia_judiciaria/app.ts
        ├── bert_training/app.ts
        ├── cumprimento_beta/       # Mais modularizado (api, types, components)
        ├── gerador_pecas/app.ts
        ├── matriculas_confrontantes/app.ts + components.ts
        ├── pedido_calculo/app.ts
        └── relatorio_cumprimento/app.ts
```

**Processo de build:** `esbuild` compila TS → JS (IIFE) e deposita na pasta `templates/`
de cada sistema. Os HTMLs referenciam esses `.js` via `<script src="app.js">`.

**Ponto-chave:** A migracao para TypeScript ja comecou, mas so cobre ~7 dos 11+ sistemas.
Os templates admin (que sao os MAIORES) continuam 100% JavaScript inline.

---

## 2. Problemas Identificados

### 2.1 Problemas Criticos

#### P1. Templates Monoliticos (Severidade: Alta)
- Templates de 4.000-8.000 linhas misturam HTML, CSS e JS no mesmo arquivo
- Impossivel fazer code review efetivo
- Dificil encontrar bugs (ex: bug do `projetoAtual = null` no classificador — exigiu debug manual)
- Sem separacao de responsabilidades

#### P2. Zero Reuso de Componentes (Severidade: Alta)
- Cada template reimplementa: modais, tabelas, toasts, formularios, barras de loading
- Mudanca de design exige alterar 30 arquivos individualmente
- Sem design system — cada sistema tem visual ligeiramente diferente
- Ao escalar para mais servicos, a duplicacao cresce linearmente

#### P3. Tailwind via CDN (Severidade: Media)
- O CDN do Tailwind inclui **todos** os estilos (~300KB+ sem gzip)
- Sem purge de classes nao usadas (build otimizado reduziria para ~10-20KB)
- Sem customizacao de tema via `tailwind.config.js`
- Play CDN nao e recomendado para producao (aviso oficial do Tailwind)

#### P4. JavaScript Inline Nao-Testavel (Severidade: Media)
- JS inline dentro de `<script>` nao pode ser importado em testes
- Sem cobertura de testes no frontend (0%)
- Funcoes globais expostas via `window.` — risco de colisao de nomes

### 2.2 Problemas Operacionais

#### P5. Sem Gerenciamento de Estado
- Estado via variaveis globais (`let projetoAtual`, `let processoAtual`, etc.)
- Bugs de sincronizacao de estado sao comuns (ex: modal fecha antes de ler variavel)
- Cada template reinventa sua propria maquina de estado

#### P6. Duplicacao de Padroes
Padroes repetidos em praticamente todos os templates:
- **Autenticacao**: `localStorage.getItem('access_token')` + redirect + Bearer header
- **Chamadas API**: fetch + token + error handling + 401 redirect
- **Modais**: criacao/abertura/fechamento
- **Tabelas**: renderizacao, paginacao, ordenacao
- **SSE (Server-Sent Events)**: streaming de respostas IA
- **Toasts**: notificacoes de sucesso/erro

#### P7. Sem Build Pipeline Completo
- esbuild so processa TypeScript em `frontend/src/`
- Templates admin nao passam por nenhum build
- Sem linting no JS inline
- Sem minificacao dos templates

#### P8. Dependencias via CDN Nao-Gerenciadas
- Versoes das libs controladas manualmente em cada `<head>`
- Risco de uma lib ser atualizada no CDN e quebrar algo
- Sem lockfile de versoes frontend
- Performance: multiplos requests a CDNs externos

---

## 3. Opcoes de Stack

### 3.1 Opcao A: Evolucao Incremental (TypeScript + Web Components + Tailwind Local)

**Descricao:** Nao adotar framework SPA. Completar a migracao TypeScript ja iniciada,
instalar Tailwind localmente, criar biblioteca de Web Components reutilizaveis.

**Como funcionaria:**
```
frontend/
├── src/
│   ├── shared/            # Utils existentes (api.ts, ui.ts)
│   ├── components/        # NOVO: Web Components (<pge-modal>, <pge-table>, etc.)
│   ├── types/
│   └── sistemas/          # Um app.ts por sistema (ja existe parcialmente)
├── styles/
│   └── tailwind.css       # NOVO: Tailwind instalado localmente
├── tailwind.config.js     # NOVO: Tema customizado
└── package.json           # + tailwindcss, postcss
```

**Pros:**
- Menor risco — evolucao do que ja existe, nao revolucao
- Nao requer reescrever templates existentes de uma vez
- Web Components sao padrao do browser — sem dependencia de framework
- Curva de aprendizado baixa (equipe ja conhece TS e o projeto)
- Backend FastAPI permanece 100% inalterado
- Build simples (esbuild ja configurado)
- Migracao pode ser feita sistema por sistema, no ritmo da equipe

**Contras:**
- Web Components tem API verbosa (mais boilerplate que React/Vue)
- Sem reatividade automatica — gerenciamento de estado manual
- Ecossistema de componentes prontos e menor que React/Vue
- Nao resolve a falta de routing SPA (se isso for desejado)
- Sem SSR (server-side rendering) — mas hoje ja e SSR via Jinja2
- Pode ser visto como "meia-medida" pela equipe tecnica
- Escalar para muitos servicos ainda exige disciplina manual

**Esforco estimado:** 2-4 semanas para infra + 1-2 dias por sistema migrado

---

### 3.2 Opcao B: React + Vite (SPA Completo)

**Descricao:** Criar uma SPA React que substitui todos os templates.
O FastAPI vira API pura, servindo so JSON. O React e servido como SPA estatica.

**Como funcionaria:**
```
portal-pge-frontend/    # Repositorio/pasta separada
├── src/
│   ├── components/     # Componentes reutilizaveis
│   ├── pages/          # Uma page por sistema
│   ├── hooks/          # Custom hooks (useAuth, useFetch, useSSE)
│   ├── services/       # Clientes API tipados
│   ├── store/          # Zustand/Redux para estado global
│   └── layouts/        # Shell, sidebar, header
├── vite.config.ts
├── tailwind.config.ts
└── package.json
```

**Pros:**
- Maior ecossistema do mercado (~20M+ downloads/semana no npm)
- Abundancia de componentes prontos (shadcn/ui, Radix, MUI, Ant Design)
- Reatividade automatica — estado muda, UI atualiza
- Component-based — maximo reuso de codigo
- DevTools excelentes (React DevTools, Vite HMR)
- Facil contratar/encontrar devs React
- Testing robusto (React Testing Library, Vitest)
- Tipagem forte com TypeScript (o padrao)
- shadcn/ui + Tailwind = design system pronto em horas
- Escalabilidade excelente — 50+ paginas nao sao problema

**Contras:**
- **Reescrita total** — nenhum template atual e reaproveitavel
- Complexidade de setup: Vite, React Router, gerenciamento de estado, etc.
- React tem curva de aprendizado (hooks, ciclo de vida, re-renders)
- Bundle size base ~150KB (React + ReactDOM + Router)
- Risco de over-engineering (muitas libs para escolher)
- Dois repositorios/processos de build (backend + frontend)
- SEO nao se aplica aqui (app interno), mas perde SSR do Jinja2
- **Risco alto**: durante a migracao, manter dois frontends em paralelo
- Precisa reescrever toda a logica de SSE, modais, formularios
- Se a equipe e pequena (1-2 devs), a migracao pode levar **meses**

**Esforco estimado:** 3-6 meses para migracao completa (equipe pequena)

---

### 3.3 Opcao C: Vue.js 3 + Vite

**Descricao:** Similar ao React, mas usando Vue.js. Tambem SPA completo.

**Como funcionaria:** Estrutura similar a opcao B, mas com Single File Components (.vue).

**Pros:**
- Curva de aprendizado mais suave que React (template syntax mais familiar)
- Single File Components (.vue) — HTML, JS e CSS no mesmo arquivo, mas ORGANIZADOS
- Reatividade magica via Composition API (menos boilerplate que React hooks)
- Ecossistema oficial coeso: Vue Router, Pinia (estado), VueUse (utilidades)
- Menos decisoes a tomar (ecossistema mais "opinionated" que React)
- Excelente suporte a TypeScript (Vue 3 foi reescrito em TS)
- Componentes prontos: PrimeVue, Vuetify, Naive UI
- Otimo para adocao gradual — pode montar componentes Vue dentro de HTML existente
- DevTools boas (Vue DevTools)

**Contras:**
- Ecossistema menor que React (~4M downloads/semana vs ~20M)
- Menos devs disponiveis no mercado que React
- Se precisar de libs especializadas, React tem mais opcoes
- **Ainda e uma reescrita** (mas pode ser gradual — ver ponto sobre adocao)
- Comunidade brasileira menor que React
- Dois processos de build

**Diferencial do Vue — adocao gradual:**
Vue pode ser montado em elementos especificos de HTML existente:
```html
<!-- Dentro de um template Jinja2 existente -->
<div id="app-modulos"></div>
<script type="module">
  import { createApp } from 'vue'
  import ModulosEditor from './ModulosEditor.vue'
  createApp(ModulosEditor).mount('#app-modulos')
</script>
```
Isso permite migrar **um componente por vez** dentro dos templates existentes,
sem precisar reescrever a pagina inteira. React tambem permite, mas Vue
historicamente e melhor nisso.

**Esforco estimado:** 3-5 meses para migracao completa; 1-2 meses se gradual

---

### 3.4 Opcao D: Svelte 5 + SvelteKit

**Descricao:** Framework moderno que compila componentes em JavaScript vanilla.
Sem Virtual DOM, menos runtime.

**Como funcionaria:**
```
portal-pge-frontend/
├── src/
│   ├── lib/
│   │   ├── components/   # Componentes Svelte
│   │   └── services/     # API clients
│   ├── routes/           # File-based routing
│   └── app.html
├── svelte.config.js
└── package.json
```

**Pros:**
- Sintaxe mais simples e intuitiva de todos os frameworks
- Menor bundle size (compila para JS vanilla — sem runtime de framework)
- Reatividade nativa com `$state` (Svelte 5 runes)
- Menos boilerplate que React/Vue
- Performance excelente (sem Virtual DOM overhead)
- SvelteKit inclui routing, SSR, code splitting out of the box
- Curva de aprendizado a mais rapida entre os frameworks SPA
- TypeScript suportado nativamente

**Contras:**
- **Ecossistema MUITO menor** que React/Vue (~700K downloads/semana)
- Poucos componentes prontos (nada comparavel a shadcn/ui ou PrimeVue)
- Dificil encontrar devs Svelte no mercado brasileiro
- Menos recursos de aprendizado em portugues
- Breaking changes frequentes (Svelte 4 → 5 mudou bastante)
- Menos battle-tested em aplicacoes enterprise
- Comunidade menor = menos respostas no StackOverflow
- **Ainda e uma reescrita total**
- Se a equipe mudar, pode ser dificil encontrar substitutos

**Esforco estimado:** 3-5 meses para migracao completa

---

### 3.5 Opcao E: HTMX + Alpine.js (Server-Centric)

**Descricao:** Manter a renderizacao server-side (Jinja2), mas usar HTMX para
interatividade e Alpine.js para estado local. Minimo de JavaScript.

**Como funcionaria:**
```html
<!-- Exemplo: carregar modulos via HTMX -->
<button hx-get="/api/modulos" hx-target="#lista-modulos" hx-swap="innerHTML">
  Carregar Modulos
</button>
<div id="lista-modulos"></div>

<!-- Estado local com Alpine.js -->
<div x-data="{ aberto: false }">
  <button @click="aberto = !aberto">Toggle</button>
  <div x-show="aberto">Conteudo do modal</div>
</div>
```

**Pros:**
- **Menor ruptura** — mantem a arquitetura server-side que ja existe
- Backend FastAPI continua renderizando HTML (Jinja2)
- Quase zero JavaScript para escrever
- HTMX e tiny (~14KB), Alpine.js e tiny (~15KB)
- Curva de aprendizado minima
- Nao precisa de build pipeline complexo
- FastAPI + HTMX e uma combinacao bem documentada
- Ideal para equipes com mais experiencia em backend
- Performance percebida boa (HTML parcial via AJAX)

**Contras:**
- **Nao resolve o problema de templates monoliticos** diretamente
- Componentes Jinja2 (macros/includes) sao limitados vs React/Vue components
- SSE com HTMX exige adaptacoes (htmx-ext-sse existe, mas e limitado)
- Sem tipagem forte no frontend (sem TypeScript pratico)
- Perde o investimento ja feito em TypeScript (`frontend/src/`)
- Para UIs complexas (drag & drop, editor de prompts, BERT dashboard), HTMX fica limitado
- Testes de frontend continuam dificeis
- Escalabilidade questionavel para UIs muito interativas
- Comunidade menor que React/Vue (mas crescendo)
- **O portal PGE tem muita interatividade** (SSE streaming, curadoria, BERT training)
  — pode nao ser o melhor fit

**Esforco estimado:** 2-4 semanas para setup + 2-3 dias por template migrado

---

### 3.6 Opcao F: Next.js (React Full-Stack)

**Descricao:** Usar Next.js como frontend completo, com SSR, routing, e API routes.
Potencialmente substituir ate partes do FastAPI.

**Pros:**
- Tudo do React (opcao B) + SSR + routing + code splitting automatico
- App Router com Server Components reduz JS enviado ao client
- Vercel como deploy trivial (ou self-hosted com Docker)
- Excelente para SEO (nao relevante aqui, mas futuro-proof)
- Ecossistema Next.js e o maior de todos (Vercel, shadcn/ui, etc.)

**Contras:**
- **Over-engineering para este caso** — o backend ja e FastAPI e funciona bem
- Introduz Node.js como runtime obrigatorio no servidor
- Duplicacao de responsabilidades: FastAPI ja faz routing e auth
- Complexidade de deploy aumenta (Python + Node.js)
- Curva de aprendizado alta (React + Next.js + Server Components)
- Dois backends para manter (FastAPI para logica + Next.js para frontend)
- **Nao faz sentido** quando o backend e Python e nao vai mudar

**Esforco estimado:** 4-8 meses (mais complexo que React puro por causa do SSR)

**Veredito:** Nao recomendado para este projeto.

---

## 4. Comparativo Geral

### 4.1 Tabela de Comparacao

| Criterio | A: Incremental | B: React | C: Vue | D: Svelte | E: HTMX | F: Next.js |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|
| **Risco de migracao** | Baixo | Alto | Medio | Alto | Baixo | Muito Alto |
| **Reuso de codigo atual** | Alto | Nenhum | Baixo-Medio | Nenhum | Medio | Nenhum |
| **Curva de aprendizado** | Baixa | Media-Alta | Media | Media | Baixa | Alta |
| **Escalabilidade (50+ paginas)** | Media | Alta | Alta | Alta | Media | Alta |
| **Ecossistema de componentes** | Baixo | Muito Alto | Alto | Baixo | Muito Baixo | Muito Alto |
| **Facilidade de contratacao** | Alta (JS/TS) | Muito Alta | Media | Baixa | Media | Alta |
| **Performance runtime** | Alta | Media | Media-Alta | Muito Alta | Alta | Media |
| **Testabilidade** | Media | Muito Alta | Alta | Alta | Baixa | Muito Alta |
| **Tempo para 1o resultado** | 1 semana | 4-6 semanas | 3-4 semanas | 3-4 semanas | 1 semana | 6-8 semanas |
| **Tempo total migracao** | 2-3 meses | 3-6 meses | 3-5 meses | 3-5 meses | 1-2 meses | 4-8 meses |
| **Manutencao a longo prazo** | Media | Alta | Alta | Media | Media-Baixa | Alta |
| **Investimento TS preservado** | Total | Parcial | Parcial | Parcial | Perdido | Parcial |

### 4.2 Melhor Opcao por Cenario

| Cenario | Opcao Recomendada |
|---------|-------------------|
| Equipe de 1-2 devs, priorizando estabilidade | **A (Incremental)** |
| Equipe de 3+ devs, com tempo para refatoracao | **C (Vue)** ou **B (React)** |
| Precisa escalar para 20+ sistemas rapidamente | **B (React)** com shadcn/ui |
| Backend-first, frontend e secundario | **E (HTMX)** |
| Performance e tamanho de bundle sao criticos | **D (Svelte)** |
| Precisa de resultado rapido sem risco | **A (Incremental)** |

---

## 5. Riscos e Dificuldades da Migracao

### 5.1 Riscos Tecnicos

#### R1. Periodo de Coexistencia (Risco Alto)
Durante qualquer migracao que nao seja a opcao A, havera um periodo onde **dois frontends
coexistem**: o legado (Jinja2) e o novo (SPA). Isso significa:
- Manter dois stacks
- Bugs em dois lugares diferentes
- Autenticacao precisa funcionar nos dois
- Possivel confusao do usuario (paginas com visual diferente)

**Mitigacao:** Migrar por sistema completo (nao por funcionalidade parcial).
Manter uma "porta de entrada" unica (dashboard) que direciona para sistema
legado ou novo.

#### R2. SSE/Streaming (Risco Alto)
O portal usa **Server-Sent Events** extensivamente (gerador de pecas, classificador, etc.).
Em SPA, o tratamento de SSE precisa ser reimplementado:
- React/Vue: custom hooks (`useSSE`, `useEventSource`)
- Estado do streaming precisa atualizar a UI reativa
- Reconexao, timeout, cleanup de conexoes

Isso e trabalhoso e propenso a bugs. O codigo de SSE atual nos templates e complexo
(ver `gerador_pecas/templates/app.js` — 2.585 linhas, boa parte e SSE).

#### R3. Jinja2 Templating (Risco Medio)
Alguns templates usam features do Jinja2 no HTML:
- Variaveis injetadas pelo backend (ex: `{{ usuario.nome }}`, `{{ csrf_token }}`)
- Loops e condicionais Jinja2 no HTML

Em uma SPA, tudo isso precisa virar chamadas API. Cada variavel Jinja2
usada no template precisa ter um endpoint correspondente.

#### R4. Autenticacao/CORS (Risco Medio)
Se o frontend virar SPA separada:
- CORS precisa ser configurado no FastAPI
- Token flow muda (SPA geralmente usa refresh tokens)
- Cookies vs localStorage para tokens
- CSP headers precisam ser revisados

### 5.2 Riscos Operacionais

#### R5. Produtividade Zero Durante Setup (Risco Medio)
Qualquer migracao para SPA exige 2-4 semanas de setup antes de produzir
valor visivel:
- Setup do projeto (Vite, Router, estado, auth, layout)
- Criar design system basico
- Configurar CI/CD para dois builds
- Definir convencoes

Nesse periodo, nenhuma feature nova e entregue.

#### R6. Feature Freeze Parcial (Risco Alto)
Durante a migracao, cada feature nova precisa ser feita nos DOIS frontends
(legado + novo), ou aceitar que features novas so vao para o novo
(e o legado fica congelado).

Nenhuma das opcoes e ideal.

#### R7. Regressoes Visuais (Risco Medio)
Recriar 30 templates manualmente quase garante regressoes visuais.
Cada template tem detalhes de UX (modais, validacoes, estados de loading)
que podem ser esquecidos na reescrita.

**Mitigacao:** Testes E2E com Playwright (ja existe infra parcial).

### 5.3 Riscos de Equipe

#### R8. Dependencia de Framework (Risco Longo Prazo)
Escolher React/Vue/Svelte cria uma dependencia de longo prazo:
- Framework pode perder popularidade (ex: AngularJS → Angular 2)
- Migracoes futuras serao igualmente caras
- Lock-in no ecossistema do framework

#### R9. Custo de Aprendizado (Risco Medio)
Se a equipe atual nao tem experiencia com o framework escolhido:
- 2-4 semanas de aprendizado antes de ser produtivo
- Primeiros meses: codigo de qualidade inferior (anti-patterns do framework)
- Risco de decisoes arquiteturais erradas no inicio

### 5.4 Mapa de Riscos por Opcao

| Risco | A: Incremental | B: React | C: Vue | D: Svelte | E: HTMX |
|-------|:-:|:-:|:-:|:-:|:-:|
| R1 Coexistencia | Nenhum | Alto | Medio | Alto | Baixo |
| R2 SSE/Streaming | Nenhum | Alto | Alto | Alto | Medio |
| R3 Jinja2 Templating | Nenhum | Alto | Medio | Alto | Nenhum |
| R4 Auth/CORS | Nenhum | Medio | Medio | Medio | Nenhum |
| R5 Produtividade zero | 1 sem | 3-4 sem | 2-3 sem | 2-3 sem | 1 sem |
| R6 Feature freeze | Nenhum | Alto | Medio | Alto | Baixo |
| R7 Regressoes visuais | Baixo | Alto | Medio | Alto | Baixo |
| R8 Lock-in framework | Nenhum | Medio | Medio | Alto | Baixo |
| R9 Custo aprendizado | Baixo | Medio | Medio | Medio | Baixo |

---

## 6. Recomendacao Final

### 6.1 Analise de Contexto

Fatores especificos do Portal PGE que influenciam a decisao:

1. **Equipe pequena** (1-2 devs) — nao tem capacidade para reescrita de meses
2. **Aplicacao interna** — nao precisa de SEO, PWA, ou otimizacao mobile extrema
3. **Alta interatividade** — SSE, drag & drop, editores complexos descartam HTMX puro
4. **Investimento TS existente** — ja tem infra de build, tipos, e shared utils
5. **Crescimento planejado** — vai escalar para mais servicos
6. **Backend estavel** — FastAPI funciona bem, nao precisa mudar

### 6.2 Estrategia Recomendada: Abordagem em Fases

**Fase 1 — Consolidacao (1-2 meses): Opcao A**
Resolver os problemas mais criticos SEM mudar de stack:

- Instalar Tailwind localmente (purge, tema, plugins)
- Completar migracao TypeScript de TODOS os templates
- Extrair JS inline → arquivos `.ts` separados (um por template)
- Criar biblioteca de componentes Lit/Web Components para reuso
  (modais, tabelas, toasts, formularios, loading states)
- Configurar linting (ESLint) e formatting (Prettier) no frontend
- Adicionar testes basicos com Playwright

**Resultado esperado:** Mesma arquitetura, mas com codigo organizado, tipado e testavel.
Templates caem de 8.000 linhas para ~500 (HTML puro + referencia ao .ts).

**Fase 2 — Avaliacao (1-2 semanas)**
Com o codigo limpo, avaliar se precisa de framework SPA:
- Se a interatividade crescer muito → migrar para Vue.js (gradual) ou React
- Se estiver suficiente → continuar com TypeScript + Web Components

**Fase 3 — SPA Gradual (se necessario, 3-6 meses)**
Se decidir por SPA, recomendo **Vue.js** pelas seguintes razoes:
- Pode ser adotado gradualmente (montar em divs dentro de Jinja2)
- Composition API e muito similar ao TypeScript que voces ja escrevem
- Ecossistema coeso (Router, Pinia, VueUse — sem paralysis by analysis)
- Menos boilerplate que React
- PrimeVue ou Naive UI = componentes admin prontos

**Alternativa:** Se a equipe tiver mais afinidade com React,
usar React + Vite + shadcn/ui + Tanstack Router. O ecossistema e maior
e a contratacao e mais facil.

### 6.3 O que NAO Fazer

1. **NAO fazer Big Bang rewrite** — reescrever tudo de uma vez e a
   causa #1 de fracasso em migracoes de frontend
2. **NAO escolher Svelte** — ecossistema muito pequeno para equipe
   que precisa escalar rapido
3. **NAO escolher Next.js** — over-engineering quando o backend ja
   e FastAPI
4. **NAO ignorar os problemas** — templates de 8.000 linhas vao
   piorar com cada sistema novo
5. **NAO descartar o TypeScript ja feito** — e a base mais valiosa
   do frontend atual

### 6.4 Resumo Executivo

| Pergunta | Resposta |
|----------|---------|
| Precisa migrar o frontend? | **Sim**, mas nao necessariamente para SPA |
| Qual o maior problema hoje? | Templates monoliticos sem reuso de componentes |
| Qual o maior risco de uma migracao? | Meses de reescrita sem entregar features |
| Melhor abordagem? | **Fase 1: limpar o que tem. Fase 2: avaliar. Fase 3: SPA se necessario** |
| Se for SPA, qual framework? | **Vue.js** (gradual) ou **React** (ecossistema) |
| Quanto tempo total? | 2-3 meses (Fase 1) + 3-6 meses (Fase 3 opcional) |

---

## Apendice A — Referencias

| Recurso | URL |
|---------|-----|
| Tailwind CSS Production Build | https://tailwindcss.com/docs/installation |
| esbuild Documentation | https://esbuild.github.io/ |
| Lit (Web Components) | https://lit.dev/ |
| Vue.js Migration Guide | https://vuejs.org/guide/introduction.html |
| React + Vite Setup | https://vitejs.dev/guide/ |
| shadcn/ui (React) | https://ui.shadcn.com/ |
| PrimeVue (Vue) | https://primevue.org/ |
| HTMX | https://htmx.org/ |
| Strangler Fig Pattern | https://martinfowler.com/bliki/StranglerFigApplication.html |

## Apendice B — Metricas Detalhadas do Frontend Atual

### Distribuicao por tipo de conteudo (estimativa)

| Tipo | Linhas | % do Total |
|------|--------|-----------|
| HTML (markup) | ~25.000 | 29% |
| CSS inline (Tailwind classes) | ~8.000 | 9% |
| JavaScript inline (`<script>`) | ~18.000 | 21% |
| JavaScript separado (.js) | ~17.000 | 20% |
| TypeScript fonte (.ts) | ~5.000 | 6% |
| Comentarios e whitespace | ~12.000 | 14% |
| **Total** | **~85.000** | **100%** |

### Bibliotecas Frontend (CDN)

| Biblioteca | Versao | Usado em | Tamanho (gzip) |
|-----------|--------|----------|----------------|
| Tailwind CSS (CDN) | latest | Todos (30) | ~300KB |
| FontAwesome | 6.4.2 | Todos (30) | ~50KB |
| Marked.js | latest | 3 templates | ~12KB |
| Chart.js | latest | 1 template | ~65KB |
| SortableJS | 1.15.0 | 1 template | ~15KB |
| PDF.js | 3.11.174 | 1 template | ~400KB |
