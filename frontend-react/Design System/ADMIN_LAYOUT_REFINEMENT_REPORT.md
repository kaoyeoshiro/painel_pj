# Relatorio de Refinamento de Layout Admin

**Data**: 2026-02-11
**Branch**: feat/tailadmin-dashboard
**Escopo**: /admin/categorias-json e /admin/config-pecas

## Problemas Identificados

### 1. /admin/categorias-json: Grid fixa em 1 coluna

**Antes**: `grid-cols-1` forcava todos os cards a ocupar 100% da largura, desperdicando espaco horizontal em telas desktop. Apenas 1 card por linha em qualquer resolucao.

**Causa raiz**: Heranca do layout legado Jinja2 que era single-column.

### 2. /admin/config-pecas: Codigos de documentos expostos diretamente

**Antes**: Todos os codigos de documento (`codigos_documento[]`) eram renderizados como badges diretamente no card, sem limite. Cards com muitos codigos ficavam visualmente poluidos e com scroll vertical excessivo.

### 3. Inconsistencia visual entre as paginas

Cards nao tinham altura uniforme nem alinhamento de botoes. Titulos e subtitulos usavam tamanhos diferentes entre as paginas.

## Solucoes Aplicadas

### 1. Grid Responsivo em categorias-json

- **Arquivo**: `CategoriasJsonPage.tsx`
- **Mudanca**: `grid-cols-1` → `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`
- **Resultado**: 2 cards por linha em telas md (768px+), 3 cards em xl (1280px+)

### 2. Codigos Colapsaveis em config-pecas

- **Arquivo**: `ConfigPecasPage.tsx`
- **Componente novo**: `CodigosColapsavel` (componente interno)
- **Comportamento**:
  - Estado fechado (padrao): mostra badge com contagem (ex: "12 codigos")
  - Estado aberto: lista de badges com scroll interno (max-h-32)
  - Zero codigos: texto italico "Nenhum codigo vinculado"
- **Decisao UX**: Optou-se por accordion inline (botao chevron + contagem) por ser mais leve que modal/drawer e manter o contexto do card

### 3. Padronizacao Visual

Ambas as paginas agora seguem:

| Propriedade | Valor |
|-------------|-------|
| Card container | `rounded-2xl flex flex-col h-full` |
| Borda | `borderColor: C.gray200` |
| Titulo | `text-base font-semibold` + `C.text900` |
| Subtitulo/nome tecnico | `font-mono text-xs` + `C.text400` |
| Botoes de acao | `mt-auto pt-2` (fixos no fundo do card) |
| Grid | responsivo com `gap-4` |

## Arquivos Alterados

| Arquivo | Tipo de Mudanca |
|---------|-----------------|
| `src/pages/admin/categorias-json/CategoriasJsonPage.tsx` | Grid CSS: 1 col → responsivo |
| `src/pages/admin/categorias-json/CategoriaCard.tsx` | Flex layout para h-full + mt-auto nos botoes |
| `src/pages/admin/config-pecas/ConfigPecasPage.tsx` | Componente CodigosColapsavel + cards uniformizados |

## Validacao

| Verificacao | Resultado |
|-------------|-----------|
| `npx tsc --noEmit` | Sem erros |
| `npm run lint` | Sem erros novos (erros pre-existentes em outros arquivos) |
| `npm run build` | Build com sucesso (10.60s) |
| Testes CategoriasJsonPage | 12/12 passando |
| Testes ConfigPecasPage | 1 falha pre-existente (texto hardcoded no teste que nunca existiu no componente) |
| Testes E2E admin-supplemental | 65/66 passando; 1 falha pre-existente (erro de API no E2E, nao relacionada a layout) |

## Descritivo Antes/Depois

### /admin/categorias-json

**Antes**: Cards empilhados em coluna unica, ocupando toda a largura disponivel. Em desktop largo (1920px), cada card esticava ate ~1350px de largura, desperdicando espaco e dificultando escaneamento visual.

**Depois**: Grid responsivo com 2 colunas em tablet/desktop medio e 3 colunas em telas largas. Cards com altura uniforme e botoes alinhados no fundo. Melhor aproveitamento do espaco horizontal e escaneamento mais rapido.

### /admin/config-pecas

**Antes**: Cards de categoria exibiam todos os codigos diretamente (ex: 15+ badges de codigo por card), tornando a UI densa e dificil de escanear. O foco visual era nos codigos numericos em vez do conteudo relevante (nome, status, descricao).

**Depois**: Codigos colapsados por padrao com indicador de contagem. Um clique expande a lista com scroll interno limitado. Cards focam no que importa: nome da categoria, descricao, status. Cards com flex column e botoes no fundo para alinhamento uniforme.
