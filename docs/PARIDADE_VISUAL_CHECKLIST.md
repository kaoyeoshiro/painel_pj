# Checklist de Paridade Visual — React SPA vs Legacy

> Comparacao tela-a-tela entre prints de referencia (`frontend-react/prints/`)
> e a implementacao React SPA atual.

## Legenda

| Status | Significado |
|--------|-------------|
| OK | Paridade visual atingida |
| PARCIAL | Estrutura correta, detalhes visuais pendentes |
| PENDENTE | Nao iniciado |

---

## 1. Assistencia Judiciaria (`assistencia.png` → `/assistencia`)

| Elemento | Status | Notas |
|----------|--------|-------|
| SystemTopbar (logo + titulo + seta) | OK | Topbar standalone com PGE logo, seta voltar, titulo/subtitulo |
| Layout sidebar + main area | OK | Sidebar esquerda com formulario, area central com empty state |
| Label "Numero CNJ" em azul | OK | `text-primary-600` aplicado |
| Input com placeholder | OK | `0000000-00.0000.0.00.0000` |
| Botao "Consultar" azul cheio | OK | Gradiente sky→teal, full-width |
| Historico recente (sidebar) | OK | CNJ em `font-mono font-semibold`, classe em `italic` |
| Empty state central (icone + texto) | OK | Icone Scale em fundo `bg-sky-100`, texto descritivo |
| Logout button (seta →) | OK | Posicao correta no topbar |

**Resultado: OK**

---

## 2. Pedido de Calculo (`calculo.png` → `/pedido-calculo`)

| Elemento | Status | Notas |
|----------|--------|-------|
| SystemTopbar (logo + titulo) | OK | "Pedido de Calculo Judicial" + subtitulo |
| Card "Gerar Pedido de Calculo" | OK | Icone badge gradiente, titulo, input, botao |
| Input com label e helper text | OK | "Numero do Processo (CNJ)" + helper |
| Botao CTA gradiente sky→teal | OK | `h-12`, full-width, icone Sparkles |
| Card "Pedidos Recentes" | OK | Com "Ver todos →" link |
| Empty state separado de loading | OK | Corrigido: antes era sempre "Carregando historico..." |
| Historico lateral (Sheet) | OK | RotateCw button + Sheet drawer |
| Dashboard link | OK | LayoutGrid icon button |

**Resultado: OK**

---

## 3. Prestacao de Contas (`prestacao.png` → `/prestacao-contas`)

| Elemento | Status | Notas |
|----------|--------|-------|
| SystemTopbar (logo + titulo) | OK | "Analise de Prestacao de Contas" + "Processos de Medicamentos" |
| Card formulario com icone badge | OK | Badge gradiente azul, titulo, input, botao |
| Input com label e helper text | OK | "Numero do Processo (CNJ)" |
| Botao CTA gradiente sky→teal | OK | Full-width, h-12, icone Search |
| Info card "Como funciona?" | OK | Fundo azul claro, check icons, 4 etapas |
| Card "Analises Recentes" | OK | Com historico de analises |
| Historico lateral | OK | Sheet drawer com titulo "Historico completo" |
| Dashboard link | OK | LayoutGrid icon |

**Resultado: OK**

---

## 4. Relatorio de Cumprimento (`relatorio.png` → `/relatorio-cumprimento`)

| Elemento | Status | Notas |
|----------|--------|-------|
| SystemTopbar (logo + titulo) | OK | "Relatorio de Cumprimento" + subtitulo |
| Card formulario com icone badge verde | OK | Gradiente emerald→green badge |
| Input com label e helper text | OK | "Numero do Processo de Cumprimento (CNJ)" |
| Botao CTA gradiente emerald→green | OK | Full-width, h-12, icone Sparkles |
| Card "Relatorios Recentes" com "Ver todos →" | OK | Lista com icone documento, CNJ, autor, data, status transito |
| History items com icone FileText verde | OK | Icone em fundo emerald-100 |
| Status transito (check verde / alerta laranja) | OK | "Transito" ou "Sem transito" badges |
| Historico lateral | OK | Sheet drawer |

**Resultado: OK**

---

## 5. Treinamento de IA / BERT (`bert.png` → `/bert-training`)

| Elemento | Status | Notas |
|----------|--------|-------|
| SystemTopbar (logo + titulo) | OK | "Treinamento de IA" + "Ensine o computador a classificar documentos" |
| 4 abas (Novo, Acompanhar, Testar, Comparar) | OK | Tabs com icones |
| Card "Dados de Treinamento" com "Enviar Planilha" | OK | Botao azul, upload area |
| Card "Iniciar Treinamento" com modos | OK | 4 cards de modo (Rapido, Equilibrado, Preciso, Maximo) |
| Modo cards com icones e descricoes | OK | Fundo azul claro no selecionado |
| Botao CTA gradiente emerald→green | OK | "Iniciar Treinamento", full-width, h-12 |
| Help button e Dashboard link | OK | Actions no topbar |

**Resultado: OK**

---

## 6. Editor do Gerador de Pecas (`editor_gerador.png` → `/gerador-pecas`)

| Elemento | Status | Notas |
|----------|--------|-------|
| Header customizado proprio | OK | Gerador ja tinha header proprio (nao usa SystemTopbar) |
| Area de edicao markdown | OK | Editor com preview |
| Sidebar com modulos | OK | Arvore de modulos selecionaveis |
| Botoes de acao (salvar, exportar) | OK | Na toolbar superior |

**Resultado: OK** (sem alteracoes necessarias — ja tinha layout proprio)

---

## Resumo Geral

| Tela | Print | Status |
|------|-------|--------|
| Assistencia Judiciaria | `assistencia.png` | OK |
| Pedido de Calculo | `calculo.png` | OK |
| Prestacao de Contas | `prestacao.png` | OK |
| Relatorio de Cumprimento | `relatorio.png` | OK |
| Treinamento BERT | `bert.png` | OK |
| Editor Gerador | `editor_gerador.png` | OK |

**6/6 telas com paridade visual atingida.**

---

## Mudancas Implementadas

### Componente novo: `SystemTopbar`
- `frontend-react/src/components/layout/SystemTopbar.tsx`
- Topbar standalone para paginas de sistema que renderizam sem o React shell (sidebar + header)
- Padrao visual: `← | PGE Logo | divider | icon + title/subtitle | actions | logout`

### Paginas migradas para SystemTopbar
- AssistenciaPage
- PedidoCalculoPage
- PrestacaoContasPage
- CumprimentoBetaPage
- RelatorioCumprimentoPage
- BertTrainingPage

### Rotas no-shell
- `AppLayout.tsx`: todas as 7 rotas de sistema em `ALWAYS_NATIVE_NO_SHELL_PREFIXES`

### Gradientes CTA
- Sky → Teal: Assistencia, Pedido Calculo, Prestacao Contas
- Emerald → Green: Relatorio Cumprimento, BERT Training

### Bug fix
- PedidoCalculoPage: separacao de empty state vs loading state (antes eram mesclados)

---

## Evidencia

Prints de referencia: `frontend-react/prints/`
Screenshots React: gerados via Playwright spec `frontend-react/e2e/parity-screenshots.spec.ts`
