# Árvore de Decisão — Spec de Design

**Data:** 2026-03-12
**Status:** Aprovado
**Objetivo:** Visualização read-only estilo BPMN do relacionamento entre variáveis (e suas perguntas de extração) e prompts modulares do Gerador de Peças. Para auditoria e documentação.

---

## 1. Visão Geral

Nova página `/admin/arvore-decisao` que renderiza um grafo interativo mostrando como cada variável e sua pergunta vinculada se relacionam com os prompts modulares, incluindo variáveis órfãs (sem vínculo) com toggle de visibilidade.

### Volumes de dados (produção)

| Elemento | Quantidade |
|----------|-----------|
| Módulos de conteúdo | 162 |
| Variáveis de extração | 265 |
| Perguntas de extração | 264 |
| Módulos determinísticos | 153 |
| Módulos LLM | 28 |
| Variáveis usadas em regras | 77 |
| Variáveis órfãs | 195 |
| Vínculos variável→módulo | 144 |
| Tipos de peça | 6 |
| Grupos | 3 (PS, PP, DETRAN) |
| Categorias | Mérito (90), Preliminar (47), Eventualidade (17), honorários (4), Tutela de Urgência (3) |

### Fora do escopo (YAGNI)

- Edição de regras pelo diagrama (usa páginas existentes)
- Simulação de ativação (já existe em `/admin/teste-ativacao`)
- Histórico/versionamento visual

---

## 2. Arquitetura da Página

### Layout

```
┌──────────────────────────────────────────────────────────┐
│  Toolbar (filtros + controles)                           │
│  [Grupo: PS ▼]  [Tipo Peça: contestação ▼]  [Buscar...] │
│  [□ Mostrar órfãs] [Expandir tudo] [Colapsar] [📷 PNG]  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Canvas React Flow (zoom/pan)                            │
│  ┌─── Mérito (90 módulos) ───────────────────────────┐   │
│  │ [Módulo 1] [Módulo 2] [Módulo 3] ...              │   │
│  └───────────────────────────────────────────────────┘   │
│  ┌─── Preliminar (47 módulos) ───────────────────────┐   │
│  │ [Módulo A] [Módulo B] ...                         │   │
│  └───────────────────────────────────────────────────┘   │
│  ┌─── Eventualidade (17 módulos) ────────────────────┐   │
│  │ ...                                               │   │
│  └───────────────────────────────────────────────────┘   │
│                                          ┌─────────┐     │
│                                          │ Minimap │     │
│                                          └─────────┘     │
├──────────────────────────────────────────────────────────┤
│  Detail Panel (slide-in lateral direito, ao clicar nó)   │
│  Título │ Pergunta │ Regra JSON │ Variáveis              │
└──────────────────────────────────────────────────────────┘
```

- Página fullscreen (sem sidebar do admin)
- Canvas ocupa toda a área disponível
- Minimap no canto inferior direito (mostra swimlanes como barras compactas)
- Detail panel desliza pela direita ao clicar num nó

---

## 3. Tipos de Nós (Custom Nodes)

### 3.1 Swimlane Node (raia)

- Fundo com cor suave por categoria (azul Mérito, laranja Preliminar, verde Eventualidade)
- Header com nome da categoria + contador de módulos
- Colapsável manualmente (click no header) quando zoom >= 0.4
- No zoom < 0.4 (macro): colapsa automaticamente para bloco agregado (click-collapse desabilitado)
- **Prioridade:** zoom sempre tem precedência sobre colapso manual

### 3.2 Module Node (retângulo arredondado)

- Título do módulo (truncado se necessário)
- Badge visual: `determinístico` (verde) ou `LLM` (roxo)
- Contador de variáveis vinculadas
- **Click:** expande a sub-árvore de decisão abaixo do módulo
- **Duplo-click:** abre detail panel lateral

### 3.3 Condition Node (losango)

- Losango clássico BPMN
- Mostra operador (`equals`, `in_list`, `greater_than`, AND, OR, NOT)
- Cor amarela
- Edges saindo: verde (sim) / vermelho (não)
- Gerados dinamicamente pelo frontend a partir da regra AST (via `ruleToNodes.ts`)

### 3.4 Variable Node (oval)

- Oval com slug da variável + tipo (boolean, text, number, etc.)
- Cor azul se vinculada a módulos
- **Click:** abre detail panel com a pergunta de extração vinculada

### 3.5 Orphan Variable Node (oval tracejado)

- Borda tracejada + cor alaranjada
- Badge "sem vínculo"
- Agrupadas na raia "Variáveis Sem Uso" (posicionada abaixo de todas as categorias)
- Visíveis apenas com toggle ativo

### 3.6 Dependency Variable Edge

- Variáveis condicionais (`depends_on_variable`) exibem edge tracejado cinza para a variável pai
- Tooltip no edge mostra a condição: "quando `var_pai` equals true"
- Permite visualizar cadeias de dependência entre variáveis

### 3.7 Edges (conexões)

| Tipo | Visual | Significado |
|------|--------|-------------|
| Módulo → Condição | Linha sólida cinza | Módulo tem esta regra |
| Condição → Variável | Linha sólida com seta | Regra usa esta variável |
| Sim | Linha verde saindo do losango | Condição verdadeira |
| Não | Linha vermelha saindo do losango | Condição falsa |
| AND/OR | Nó conector pequeno (círculo com "&" ou "∥") | Operador lógico |
| Compartilhada | Linha pontilhada entre raias | Mesma variável usada em categorias diferentes |
| Dependência | Linha tracejada cinza com tooltip | Variável condicional depende de outra |

---

## 4. Zoom Semântico — 3 Níveis

### Nível 1 — Macro (zoom < 0.35)

- Apenas swimlanes como blocos compactos
- Contadores agregados: módulos, variáveis, % determinístico
- Barra de proporção determinístico/LLM
- Sem módulos individuais visíveis
- Click-collapse de swimlanes desabilitado

### Nível 2 — Médio (zoom 0.35 ~ 0.75)

- Módulos aparecem como cards compactos dentro das raias
- Título truncado + badge (determinístico/LLM) + contador de variáveis
- Sem árvore de decisão
- Click num módulo = expande para nível 3
- Click-collapse de swimlanes habilitado

### Nível 3 — Detalhe (zoom > 0.75 ou click para expandir)

- Árvore de decisão completa do módulo expandido
- Losangos com operadores AND/OR/NOT
- Variáveis como nós folha com valor esperado
- Se tem regra secundária (fallback): sub-árvore separada com label "Fallback"
- Edges de dependência entre variáveis visíveis

Transição entre níveis é suave (fade in/out conforme zoom).

### Debounce de transição

Para evitar flickering nos limites de zoom, a mudança de nível usa debounce de 150ms:

```typescript
const getZoomLevel = (zoom: number): 'macro' | 'medium' | 'detail' => {
  if (zoom < 0.35) return 'macro';
  if (zoom < 0.75) return 'medium';
  return 'detail';
};
```

---

## 5. Detail Panel (Painel Lateral)

Slide-in pela direita. Conteúdo muda conforme o tipo de nó clicado:

### Ao clicar num Módulo

- Título, ID, categoria
- Modo de ativação (determinístico/LLM)
- Fallback habilitado sim/não
- **Regra Primária** em formato visual (notação de árvore AST):
  ```
  (AND
    (EQUALS decisoes_audiencia_inicial true)
    (EQUALS valor_causa_inferior_60sm true)
  )
  ```
- **Regra Primária** em formato JSON (colapsável, fechado por padrão)
- **Regra Secundária (Fallback)** — exibida somente se `fallback_habilitado = true`, mesmo formato visual + JSON
- **Regras por Tipo de Peça** — se existem `RegraDeterministicaTipoPeca` para este módulo, exibidas em seção colapsável por tipo
- Lista de variáveis usadas (clicáveis — navega no grafo)
- Tipos de peça vinculados
- Link "Abrir no Editor de Prompts" → `/admin/prompts-modulos`

### Ao clicar numa Variável

- Slug, tipo, fonte (extração/processo)
- Pergunta de extração vinculada (texto completo)
- **Dependência:** se condicional, mostra variável pai + operador + valor esperado. Se encadeada, mostra cadeia: `var → var_pai → var_avó`
- **Dependency config:** se possui `dependency_config` complexo (JSON), exibido em seção colapsável
- Lista de módulos que usam (clicáveis — navega no grafo)
- Link "Abrir no Editor de Variáveis" → `/admin/variaveis`

### Ao clicar numa Variável Órfã

- Mesmas informações da variável normal
- Seção "Sugestão": indicação de que a variável existe mas não é usada em nenhuma regra determinística
- Link para editor de variáveis

---

## 6. Toolbar e Filtros

### Filtros

| Filtro | Tipo | Comportamento |
|--------|------|---------------|
| Grupo | Select obrigatório | PS / PP / DETRAN — filtra módulos e variáveis do grupo |
| Tipo de Peça | Select opcional | Mostra só módulos vinculados ao tipo + regras por tipo |
| Busca | Text input | Case-insensitive substring match |

### Comportamento da busca

**Campos pesquisados:**
- Módulo: `titulo`, `nome`
- Variável: `slug`, `label`
- Pergunta: `pergunta` (texto da question vinculada)

**Highlight:**
```css
.node.match { border: 2px solid #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); }
.node.no-match { opacity: 0.2; }
.edge.match { stroke: #22c55e; stroke-width: 2; }
.edge.no-match { opacity: 0.1; }
```

**Auto-fit por volume de resultados:**
- < 10 matches: fit nos nós encontrados + adjacentes
- 10-50 matches: fit nas swimlanes que contêm matches
- \> 50 matches: fit no canvas inteiro, badge com contador de resultados

### Controles

| Botão | Ação |
|-------|------|
| Mostrar órfãs [195] | Toggle com badge vermelho no botão. Mostra/esconde raia "Variáveis Sem Uso" abaixo das categorias |
| Expandir tudo | Expande todos os módulos para nível 3 (com aviso se > 50 módulos) |
| Colapsar | Volta todos os módulos para nível 2 |
| Exportar PNG | Exporta a view atual (zoom/pan corrente). Esconde toolbar, detail panel e minimap na imagem. `pixelRatio: 1` |

### Legenda

Sempre visível na toolbar: formas (retângulo, losango, oval, oval tracejado) e cores (verde/vermelho/pontilhado/cinza tracejado).

---

## 7. Backend — API

### Endpoint

```
GET /admin/api/arvore-decisao?grupo_id={id}&tipo_peca_id={id}&include_orphans=true
```

- `grupo_id`: obrigatório
- `tipo_peca_id`: opcional
- `include_orphans`: opcional, default `true`

### Controle de acesso

```python
@router.get("/api/arvore-decisao")
async def get_arvore_decisao(
    grupo_id: int,
    tipo_peca_id: int | None = None,
    include_orphans: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Admin: acesso total
    # Non-admin: apenas grupos permitidos (allowed_groups)
    if not current_user.is_admin:
        allowed_ids = [g.id for g in current_user.allowed_groups]
        if grupo_id not in allowed_ids:
            raise HTTPException(status_code=403, detail="Sem acesso a este grupo")
```

### Response

```json
{
  "swimlanes": [
    {
      "id": "merito",
      "label": "Mérito",
      "modulos_count": 90,
      "variaveis_count": 52,
      "pct_deterministico": 85.0
    }
  ],
  "modulos": [
    {
      "id": 27,
      "titulo": "Não Comparecimento à Audiência",
      "categoria": "Mérito",
      "modo_ativacao": "deterministic",
      "regra": { "type": "condition", "variable": "decisoes_audiencia_inicial", "operator": "equals", "value": true },
      "regra_secundaria": null,
      "fallback_habilitado": false,
      "variaveis_usadas": ["decisoes_audiencia_inicial"],
      "tipos_peca": ["contestacao", "contrarrazoes"],
      "regras_tipo_peca": {}
    }
  ],
  "variaveis": [
    {
      "slug": "decisoes_audiencia_inicial",
      "label": "Decisões - Audiência Inicial",
      "tipo": "boolean",
      "fonte": "extraction",
      "pergunta": "Houve audiência inicial no processo e o réu não compareceu?",
      "is_orfa": false,
      "modulos_ids": [27, 45, 68],
      "depends_on": null,
      "dependency_operator": null,
      "dependency_value": null
    }
  ],
  "stats": {
    "total_modulos": 162,
    "total_variaveis": 265,
    "total_orfas": 195,
    "total_vinculos": 144
  }
}
```

### Decisões de design

| Decisão | Justificativa |
|---------|--------------|
| Sem array `edges` na API | Frontend gera nós de condição e edges a partir da regra AST JSON via `ruleToNodes.ts`. Evita duplicar lógica e mantém payload menor. |
| Sem array `conditions` na API | Nós de condição (losangos AND/OR/NOT) são gerados pelo frontend a partir de `regra` e `regra_secundaria`. O backend entrega o AST puro. |
| Um endpoint só | Payload estimado: ~162 módulos × ~200B + ~265 variáveis × ~150B ≈ 72KB. Aceitável para request único. |
| `include_orphans` como parâmetro | Permite frontend carregar sem órfãs (toggle desligado) e buscar depois se ativado |
| Filtro grupo obrigatório | Evita misturar PS + DETRAN no mesmo grafo |
| Variáveis de processo incluídas | Aparecem com `fonte: "process"`. Derivadas de `ProcessVariableResolver.DEFINITIONS` no backend. |
| `regras_tipo_peca` no módulo | Dict `{tipo_slug: regra_json}` para regras específicas por tipo de peça (`RegraDeterministicaTipoPeca`) |
| Campos de dependência na variável | `depends_on`, `dependency_operator`, `dependency_value` permitem ao frontend renderizar edges de dependência entre variáveis |

### Schemas Pydantic

```python
# sistemas/gerador_pecas/schemas_arvore.py

class SwimlaneDTO(BaseModel):
    id: str
    label: str
    modulos_count: int
    variaveis_count: int
    pct_deterministico: float

class ModuloDTO(BaseModel):
    id: int
    titulo: str
    categoria: str
    modo_ativacao: Literal["deterministic", "llm"]
    regra: dict | None
    regra_secundaria: dict | None = None
    fallback_habilitado: bool
    variaveis_usadas: list[str]
    tipos_peca: list[str]
    regras_tipo_peca: dict[str, dict] = {}

class VariavelDTO(BaseModel):
    slug: str
    label: str
    tipo: str
    fonte: Literal["extraction", "process"]
    pergunta: str | None
    is_orfa: bool
    modulos_ids: list[int]
    depends_on: str | None = None
    dependency_operator: str | None = None
    dependency_value: str | None = None

class StatsDTO(BaseModel):
    total_modulos: int
    total_variaveis: int
    total_orfas: int
    total_vinculos: int

class ArvoreDecisaoResponse(BaseModel):
    swimlanes: list[SwimlaneDTO]
    modulos: list[ModuloDTO]
    variaveis: list[VariavelDTO]
    stats: StatsDTO
```

### Arquivos backend

| Arquivo | Conteúdo |
|---------|---------|
| `sistemas/gerador_pecas/router_admin.py` | Endpoint novo |
| `sistemas/gerador_pecas/services_arvore_decisao.py` | Service que monta o grafo (queries + lógica) |
| `sistemas/gerador_pecas/schemas_arvore.py` | DTOs Pydantic |

---

## 8. Frontend — Conversão AST → Nós React Flow

O frontend é responsável por converter a regra AST JSON em nós e edges do React Flow. Isso acontece em `ruleToNodes.ts`:

### Algoritmo

```
Para cada módulo com regra != null:
  1. Criar edge: módulo → nó raiz da regra
  2. Percorrer AST recursivamente:
     - type "condition" → criar ConditionNode (losango) + VariableNode (oval)
       - Edge do losango para a variável (label: operador + valor)
     - type "and"/"or" → criar ConnectorNode (círculo & ou ∥)
       - Edges do conector para cada sub-condição
     - type "not" → criar ConnectorNode (círculo !)
       - Edge para a condição negada
  3. Se fallback_habilitado && regra_secundaria:
     - Repetir processo com label "Fallback" no edge raiz
  4. Se regras_tipo_peca não vazio:
     - Não renderizar no canvas (apenas no detail panel)
```

### Nós gerados por tipo de regra

| AST `type` | Nó React Flow | Formato |
|------------|---------------|---------|
| `condition` | ConditionNode + VariableNode | Losango → Oval |
| `and` | ConnectorNode (label "&") | Círculo pequeno |
| `or` | ConnectorNode (label "∥") | Círculo pequeno |
| `not` | ConnectorNode (label "!") | Círculo pequeno vermelho |

---

## 9. Estrutura de Arquivos Frontend

```
frontend-react/src/pages/admin/arvore-decisao/
├── ArvoreDecisaoPage.tsx          # Página principal, React Flow provider
├── components/
│   ├── Toolbar.tsx                # Filtros, busca, toggles, exportar
│   ├── DetailPanel.tsx            # Painel lateral slide-in
│   ├── nodes/
│   │   ├── SwimLaneNode.tsx       # Raia por categoria
│   │   ├── ModuleNode.tsx         # Retângulo do módulo
│   │   ├── ConditionNode.tsx      # Losango de condição
│   │   ├── ConnectorNode.tsx      # Círculo AND/OR/NOT
│   │   ├── VariableNode.tsx       # Oval da variável
│   │   └── OrphanVariableNode.tsx # Oval tracejado
│   └── edges/
│       ├── YesNoEdge.tsx          # Edge verde/vermelho
│       ├── DependencyEdge.tsx     # Edge tracejado cinza (dependência entre variáveis)
│       └── SharedVarEdge.tsx      # Edge pontilhado entre raias
├── hooks/
│   ├── useArvoreDecisaoData.ts    # Fetch + cache dos dados da API
│   ├── useSemanticZoom.ts         # Lógica dos 3 níveis com debounce
│   ├── useGraphLayout.ts          # Dagre layout + posicionamento
│   └── useNodeExpansion.ts        # Expand/collapse de módulos
├── store/
│   └── useArvoreStore.ts          # Zustand: collapsedSwimlanes, expandedModules, searchTerm, filters
├── utils/
│   ├── layoutEngine.ts            # Configuração dagre (rankdir: LR, nodesep: 150, ranksep: 200)
│   ├── ruleToNodes.ts             # AST JSON → nós React Flow (algoritmo seção 8)
│   └── searchHighlight.ts         # Busca substring e estilos de highlight
└── types.ts                       # Tipos TypeScript (CustomNodeType, EdgeType, etc.)
```

### Tipos principais

```typescript
type CustomNodeType = 'swimlane' | 'module' | 'condition' | 'connector' | 'variable' | 'orphan-variable';
type CustomEdgeType = 'rule' | 'yes-no' | 'dependency' | 'shared-var';

interface ArvoreState {
  collapsedSwimlanes: Set<string>;
  expandedModules: Set<number>;
  searchTerm: string;
  grupoId: number;
  tipoPecaId: number | null;
  showOrphans: boolean;
  zoomLevel: 'macro' | 'medium' | 'detail';
}
```

### Dependências novas

| Pacote | Uso | Tamanho |
|--------|-----|---------|
| `@xyflow/react` | React Flow v12 — canvas interativo | ~150KB gz |
| `dagre` | Layout automático de grafos direcionados | ~30KB gz |
| `html-to-image` | Exportar canvas como PNG | ~10KB gz |

### Configuração dagre

```typescript
const dagreConfig = {
  rankdir: 'LR',      // Esquerda → direita (módulo → condição → variável)
  align: 'DL',
  nodesep: 150,        // Espaço entre nós
  ranksep: 200,        // Espaço entre ranks
};
```

### Integração com SPA existente

- Rota no React Router: `/admin/arvore-decisao`
- Link no menu admin (sidebar) agrupado com "Prompts e Módulos" e "Variáveis"
- Usa `createApiClient`, `useAuth`, componentes shadcn do projeto

### Performance

- React Flow v12 suporta ~1000 nós sem degradação
- No nível 2 (médio): ~162 módulos visíveis (sem árvores expandidas) — dentro do limite
- No nível 3: árvores expandidas sob demanda (click), não todas de uma vez
- "Expandir tudo" mostra aviso se > 50 módulos (estimativa: ~500 nós totais com condições)
