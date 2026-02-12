# Relatorio de Bugs SonarQube - Portal PGE

**Data da analise**: 2026-02-12
**Projeto**: portal-pge (Portal PGE-MS)
**Total de bugs**: 113
**Esforco total estimado**: 966 minutos (~16h)

---

## Resumo Executivo

| Severidade | Quantidade | % |
|-----------|-----------|---|
| BLOCKER | 0 | 0% |
| CRITICAL | 3 | 2.7% |
| MAJOR | 97 | 85.8% |
| MINOR | 13 | 11.5% |
| INFO | 0 | 0% |

---

## Distribuicao por Regra

| Regra | Linguagem | Severidade | Qtd | Descricao |
|-------|-----------|-----------|-----|-----------|
| `javascript:S905` | JavaScript | MAJOR | 76 | Statements sem efeito colateral nem mudanca de fluxo de controle |
| `javascript:S3699` | JavaScript | MAJOR | 16 | Uso do retorno de funcoes que nao retornam nada |
| `Web:TableWithoutCaptionCheck` | HTML | MINOR | 12 | Tabelas sem descricao (acessibilidade WCAG2) |
| `css:S4657` | CSS | CRITICAL | 3 | Shorthand CSS sobrescrevendo longhand (propriedade anulada) |
| `python:S3923` | Python | MAJOR | 2 | Todos os branches de um if/else com mesma implementacao |
| `css:S4662` | CSS | MAJOR | 1 | At-rule CSS invalida (`@theme`) |
| `python:S1226` | Python | MINOR | 1 | Parametro de funcao reatribuido sem ser lido |
| `javascript:S1848` | JavaScript | MAJOR | 1 | Objeto criado com `new` e descartado imediatamente |
| `javascript:S5850` | JavaScript | MAJOR | 1 | Alternativas em regex devem ser agrupadas com anchors |

---

## Distribuicao por Arquivo

| Arquivo | Qtd | Severidades |
|---------|-----|-------------|
| `sistemas/bert_training/static/js/app.js` | 82 | 82 MAJOR |
| `frontend/templates/admin_feedbacks.html` | 3 | 3 MINOR |
| `frontend/templates/admin_performance.html` | 3 | 3 MINOR |
| `frontend/templates/admin_prompts_modulos.html` | 4 | 2 CRITICAL, 2 MINOR |
| `frontend/templates/admin_tjms_docs.html` | 1 | 1 MINOR |
| `frontend/templates/admin_users.html` | 1 | 1 MINOR |
| `sistemas/extrator_autos/services.py` | 1 | 1 MAJOR |
| `sistemas/extrator_autos/templates/index.html` | 2 | 2 MINOR |
| `sistemas/gerador_pecas/router.py` | 1 | 1 MAJOR |
| `sistemas/bert_training/templates/app.js` | 1 | 1 MAJOR |
| `frontend-react/src/index.css` | 1 | 1 MAJOR |
| `sistemas/assistencia_judiciaria/core/logic.py` | 1 | 1 MINOR |
| `sistemas/gerador_pecas/templates/app.js` | 1 | 1 MAJOR |
| `sistemas/assistencia_judiciaria/templates/index.html` | 1 | 1 CRITICAL |

---

## Bugs CRITICAL (3 ocorrencias)

### CRITICAL-1: CSS shorthand sobrescrevendo longhand — `admin_prompts_modulos.html:238`

- **Regra**: `css:S4657` — Shorthand properties that override related longhand properties should be avoided
- **Arquivo**: `frontend/templates/admin_prompts_modulos.html`
- **Linha**: 238
- **Mensagem**: `Unexpected shorthand "border-color" after "border-left-color"`
- **Problema**: O shorthand `border-color` esta definido DEPOIS de `border-left-color`, sobrescrevendo completamente o valor da propriedade longhand. O valor de `border-left-color` se torna inutil.
- **Correcao**: Reordenar as propriedades CSS colocando o shorthand `border-color` ANTES do longhand `border-left-color`, ou remover a propriedade longhand se nao for necessaria.

### CRITICAL-2: CSS shorthand sobrescrevendo longhand — `admin_prompts_modulos.html:244`

- **Regra**: `css:S4657` — Shorthand properties that override related longhand properties should be avoided
- **Arquivo**: `frontend/templates/admin_prompts_modulos.html`
- **Linha**: 244
- **Mensagem**: `Unexpected shorthand "border-color" after "border-left-color"`
- **Problema**: Mesmo problema do CRITICAL-1, em outra linha do mesmo arquivo.
- **Correcao**: Reordenar ou remover a propriedade longhand redundante.

### CRITICAL-3: CSS shorthand sobrescrevendo longhand — `assistencia_judiciaria/templates/index.html:77`

- **Regra**: `css:S4657` — Shorthand properties that override related longhand properties should be avoided
- **Arquivo**: `sistemas/assistencia_judiciaria/templates/index.html`
- **Linha**: 77
- **Mensagem**: `Unexpected shorthand "padding" after "padding-left"`
- **Problema**: O shorthand `padding` esta definido DEPOIS de `padding-left`, sobrescrevendo o valor de `padding-left`.
- **Correcao**: Colocar `padding` antes de `padding-left`, ou remover `padding-left` se nao for necessario.

---

## Bugs MAJOR — Python (3 ocorrencias)

### MAJOR-PY-1: If/else com branches identicos — `gerador_pecas/router.py:2250`

- **Regra**: `python:S3923` — All branches in a conditional structure should not have exactly the same implementation
- **Arquivo**: `sistemas/gerador_pecas/router.py`
- **Linha**: 2250
- **Mensagem**: `Remove this if statement or edit its code blocks so that they're not all the same.`
- **Problema**: Um `if/else` na linha 2250 tem todos os branches executando exatamente o mesmo codigo. Isso indica provavel erro de copy-paste ou condicao desnecessaria.
- **Impacto**: Possivel bug logico — o programa pode nao estar diferenciando entre dois cenarios que deveriam ter comportamentos distintos.
- **Correcao**: Verificar se a condicao deveria produzir resultados diferentes ou remover o `if` e manter apenas o corpo.

### MAJOR-PY-2: Expressao condicional ternaria retorna mesmo valor — `extrator_autos/services.py:317`

- **Regra**: `python:S3923` — Conditional expression returns the same value
- **Arquivo**: `sistemas/extrator_autos/services.py`
- **Linha**: 317
- **Mensagem**: `This conditional expression returns the same value whether the condition is "true" or "false".`
- **Problema**: Uma expressao ternaria `x if cond else x` retorna o mesmo valor independente da condicao. O ternario e inutil.
- **Impacto**: Codigo morto/confuso. Pode indicar bug logico.
- **Correcao**: Simplificar removendo a expressao ternaria e usando o valor diretamente.

### MAJOR-PY-3 (MINOR): Parametro reatribuido sem leitura — `assistencia_judiciaria/core/logic.py:447`

- **Regra**: `python:S1226` — Function parameters initial values should not be ignored
- **Arquivo**: `sistemas/assistencia_judiciaria/core/logic.py`
- **Linha**: 447
- **Mensagem**: `Introduce a new variable or use its initial value before reassigning 'model'.`
- **Problema**: O parametro `model` e reatribuido na linha 447 sem que seu valor original seja utilizado.
- **Impacto**: O valor passado pelo chamador e ignorado — possivel bug onde o modelo deveria ser configuravel mas a implementacao ignora o parametro.
- **Correcao**: Usar o valor do parametro antes de reatribuir, ou renomear a variavel local para evitar confusao.

---

## Bugs MAJOR — JavaScript/CSS (94 ocorrencias)

### Arquivo concentrador: `sistemas/bert_training/static/js/app.js` (82 bugs)

> **NOTA IMPORTANTE**: Este arquivo e um **bundle JavaScript minificado/compilado**. Os 82 bugs reportados sao falsos positivos causados pela natureza do codigo minificado (expressoes sem efeito aparente, retorno de funcoes void sendo usado como expressao, etc.). Este arquivo **nao deveria ser analisado pelo SonarQube** e deve ser excluido da analise.

**Regras violadas neste arquivo:**
| Regra | Qtd | Descricao |
|-------|-----|-----------|
| `javascript:S905` | 69 | Statements sem side-effect (artefato de minificacao) |
| `javascript:S3699` | 13 | Uso de retorno de funcoes void (artefato de minificacao) |

**Recomendacao**: Adicionar `sistemas/bert_training/static/js/app.js` nas exclusoes do SonarQube (`sonar.exclusions`).

### Outros bugs JavaScript/CSS

| # | Arquivo | Linha | Regra | Mensagem |
|---|---------|-------|-------|----------|
| 1 | `sistemas/bert_training/templates/app.js` | 477 | `javascript:S1848` | `new Chart()` criado sem ser atribuido a variavel |
| 2 | `sistemas/gerador_pecas/templates/app.js` | 362 | `javascript:S5850` | Regex com alternativas e anchors sem agrupamento |
| 3 | `frontend-react/src/index.css` | 6 | `css:S4662` | At-rule `@theme` desconhecida (Tailwind CSS v4) |

#### Detalhes:

**JS-1**: `bert_training/templates/app.js:477` — `new Chart()` sem atribuicao
- Severidade: MAJOR
- O Chart.js e instanciado com `new Chart()` mas o objeto nao e atribuido. No contexto do Chart.js, isso e **intencionalmente valido** — o Chart.js se auto-registra no canvas via side-effect do construtor. Nao e um bug real, mas SonarQube nao reconhece esse pattern.
- **Recomendacao**: Atribuir a uma variavel (`const chart = new Chart(...)`) para silenciar o aviso e permitir destruicao futura do chart.

**JS-2**: `gerador_pecas/templates/app.js:362` — Regex com anchors e alternativas
- Severidade: MAJOR
- A regex na linha 362 tem alternativas com `|` e anchors `^`/`$` sem agrupamento, o que pode causar matching inesperado (anchor so se aplica a primeira/ultima alternativa).
- **Recomendacao**: Agrupar alternativas com `(?:...)` ou aplicar anchors individualmente.

**CSS-1**: `frontend-react/src/index.css:6` — `@theme` desconhecido
- Severidade: MAJOR
- **Falso positivo**: `@theme` e uma diretiva valida do Tailwind CSS v4. SonarQube nao reconhece esta at-rule.
- **Recomendacao**: Adicionar `theme` a lista de at-rules ignoradas no profile do SonarQube (`css:S4662` parameter `ignoreAtRules`).

---

## Bugs MINOR — HTML/Acessibilidade (12 ocorrencias)

Todos sao da regra `Web:TableWithoutCaptionCheck` — tabelas sem `<caption>`, `aria-label`, `aria-labelledby` ou `aria-describedby`.

| # | Arquivo | Linha |
|---|---------|-------|
| 1 | `frontend/templates/admin_feedbacks.html` | 268 |
| 2 | `frontend/templates/admin_feedbacks.html` | 292 |
| 3 | `frontend/templates/admin_feedbacks.html` | 324 |
| 4 | `frontend/templates/admin_performance.html` | 293 |
| 5 | `frontend/templates/admin_performance.html` | 484 |
| 6 | `frontend/templates/admin_performance.html` | 672 |
| 7 | `frontend/templates/admin_prompts_modulos.html` | 1205 |
| 8 | `frontend/templates/admin_prompts_modulos.html` | 1367 |
| 9 | `frontend/templates/admin_tjms_docs.html` | 795 |
| 10 | `frontend/templates/admin_users.html` | 95 |
| 11 | `sistemas/extrator_autos/templates/index.html` | 343 |
| 12 | `sistemas/extrator_autos/templates/index.html` | 535 |

**Recomendacao**: Adicionar `aria-label` descritivo em cada `<table>` para conformidade com WCAG 2.0 nivel A. Exemplo:
```html
<table aria-label="Tabela de feedbacks do sistema">
```

---

## Classificacao por Prioridade de Correcao

### Prioridade ALTA (corrigir imediatamente)

| Bug | Motivo | Esforco |
|-----|--------|---------|
| MAJOR-PY-1: `router.py:2250` if/else identicos | Possivel bug logico no gerador de pecas | 15min |
| MAJOR-PY-2: `services.py:317` ternario identico | Possivel bug logico no extrator de autos | 15min |
| JS-2: `app.js:362` regex sem agrupamento | Pode causar matching incorreto | 10min |

### Prioridade MEDIA (corrigir no proximo sprint)

| Bug | Motivo | Esforco |
|-----|--------|---------|
| CRITICAL-1/2: CSS `admin_prompts_modulos.html` | CSS incorreto, estilo visual pode estar errado | 10min |
| CRITICAL-3: CSS `assistencia_judiciaria` | CSS incorreto, padding pode estar errado | 5min |
| MAJOR-PY-3: `logic.py:447` parametro ignorado | Parametro `model` ignorado | 5min |
| JS-1: `app.js:477` Chart sem variavel | Boa pratica, facilita cleanup | 5min |

### Prioridade BAIXA (backlog)

| Bug | Motivo | Esforco |
|-----|--------|---------|
| 12x tabelas sem caption (MINOR) | Acessibilidade, nao bloqueia funcionalidade | 60min |
| CSS-1: `@theme` falso positivo | Configurar exclusao no SonarQube | 1min |

### Excluir da analise (falsos positivos)

| Bugs | Motivo | Acao |
|------|--------|------|
| 82 bugs em `bert_training/static/js/app.js` | Bundle minificado, falsos positivos | Adicionar a `sonar.exclusions` |

---

## Recomendacoes de Configuracao do SonarQube

### 1. Excluir arquivos minificados/compilados

Adicionar ao `sonar-project.properties`:
```properties
sonar.exclusions=**/static/js/app.js,**/node_modules/**,**/*.min.js,**/*.bundle.js
```

Isso eliminaria **82 dos 113 bugs** (72.5%), deixando 31 bugs reais para tratar.

### 2. Configurar at-rules CSS validas

Adicionar `theme` ao parametro `ignoreAtRules` da regra `css:S4662` no Quality Profile para reconhecer diretivas do Tailwind CSS v4.

### 3. Resultado apos exclusoes

Com as exclusoes configuradas, o cenario real seria:

| Severidade | Quantidade |
|-----------|-----------|
| CRITICAL | 3 |
| MAJOR | 5 |
| MINOR | 13 |
| **Total real** | **21 bugs** |

---

## Resumo Final

- **113 bugs reportados** pelo SonarQube
- **82 sao falsos positivos** de bundle JS minificado (`bert_training/static/js/app.js`)
- **1 falso positivo** de `@theme` do Tailwind CSS v4
- **21 bugs reais** a serem tratados:
  - **3 CRITICAL** (CSS shorthand ordering) — correcao trivial
  - **5 MAJOR** (2 Python + 2 JS + 1 CSS) — alguns podem ser bugs logicos reais
  - **13 MINOR** (12 tabelas sem caption + 1 parametro Python) — acessibilidade e boas praticas
- **0 BLOCKER**
- Os 2 bugs Python (`router.py:2250` e `services.py:317`) sao os mais relevantes por potencialmente indicar bugs logicos no codigo de producao
