# Ranking de Módulos de Prompts — Design Spec

**Data**: 2026-03-12
**Sistema**: Gerador de Peças
**Escopo**: Nova aba "Ranking de Ativações" na página admin de prompts-modulos

## Objetivo

Mostrar um ranking dos módulos de prompts do mais ativado ao menos ativado, permitindo identificar quais módulos nunca foram ativados e quais são ativados com frequência. O ranking considera todas as gerações históricas, mas exibe apenas módulos ativos na atualidade.

## Decisões de Design

| Decisão | Escolha | Alternativas descartadas |
|---------|---------|--------------------------|
| Fonte de dados | `activation_trace` em `geracoes_pecas` (ambos os modos) | `prompt_activation_logs` (só modo automático) |
| Atualização | Refresh manual (ao abrir a aba) | Auto-refresh periódico, SSE/WebSocket |
| Métricas | Mínimo: posição, nome, categoria, total ativações, badge "nunca ativado" | Taxa de ativação, tendências, sparklines |
| Filtro | Por grupo ativo (PS/DETRAN/PP) | Todos juntos, ambos |
| Localização | Nova aba dentro de prompts-modulos | Página separada |
| Layout | Tabela + 3 cards de resumo no topo | Tabela sem cards |
| Backend | Query direta no JSON (sem cache) | Cache TTL, tabela materializada |

## Arquitetura

### Fluxo de Dados

```
[Browser] → GET /admin/api/prompts-modulos/ranking?group_id=X
                ↓
[router_prompts.py] → Query SQL
                ↓
[PostgreSQL] → jsonb_array_elements(activation_trace->'modulos')
             → GROUP BY module_id
             → LEFT JOIN prompt_modulos (ativo=true, group_id=X)
                ↓
[Response JSON] → ranking[] + metadata{}
                ↓
[RankingModulos.tsx] → Cards de resumo + Tabela ordenada
```

### Endpoint

**Rota**: `GET /admin/api/prompts-modulos/ranking`

**Query params**:
- `group_id` (int, obrigatório): Filtra módulos pelo grupo

**Dependências do endpoint**:
- `modulo_repo: PromptModuloRepository = Depends(get_prompt_modulo_repo)` — acesso ao banco via repositório (padrão do router)
- `current_user = Depends(get_current_active_user)` — autenticação (`from auth.dependencies import get_current_active_user`)

**Nota**: A query raw SQL será encapsulada em um novo método `get_activation_ranking(group_id: int)` no `PromptModuloRepository`, mantendo o padrão do router de não usar `get_db` diretamente. O repositório já tem acesso à sessão internamente.

**Lógica SQL** (PostgreSQL):

```sql
-- 1. Agregar ativações do activation_trace
WITH ativacoes AS (
  SELECT
    (modulo->>'module_id')::int AS module_id,
    COUNT(*) FILTER (WHERE (modulo->>'activated')::boolean = true) AS total_ativacoes
  FROM geracoes_pecas g
    CROSS JOIN jsonb_array_elements(g.activation_trace->'modulos') AS modulo
  WHERE g.activation_trace IS NOT NULL
  GROUP BY (modulo->>'module_id')::int
)
-- 2. Cruzar com módulos ativos do grupo
SELECT
  pm.id AS modulo_id,
  pm.nome,
  pm.titulo,
  pm.categoria,
  COALESCE(a.total_ativacoes, 0) AS total_ativacoes
FROM prompt_modulos pm
  LEFT JOIN ativacoes a ON a.module_id = pm.id
WHERE pm.ativo = true
  AND pm.group_id = :group_id
  AND pm.tipo = 'conteudo'
ORDER BY COALESCE(a.total_ativacoes, 0) DESC, pm.titulo ASC
```

**Nota**: Filtra `tipo = 'conteudo'` porque módulos base e peça não passam pelo detector de ativação (Agent 2). Apenas módulos de conteúdo (teses/argumentos) são ativados dinamicamente.

**Campo `posicao`**: Computado em Python ao montar a response, enumerando os resultados ordenados: `for i, row in enumerate(results, 1): row["posicao"] = i`.

**Metadata** (computada em Python a partir do resultado da query principal):
- `total_modulos_ativos`: `len(ranking)` (total de linhas retornadas)
- `modulos_nunca_ativados`: `sum(1 for r in ranking if r.total_ativacoes == 0)`
- `total_geracoes_analisadas`: query separada:

```sql
SELECT COUNT(*) FROM geracoes_pecas WHERE activation_trace IS NOT NULL
```

**Response schema**:

```json
{
  "ranking": [
    {
      "posicao": 1,
      "modulo_id": 12,
      "nome": "tema_793",
      "titulo": "Tema 793 - STF",
      "categoria": "Mérito",
      "total_ativacoes": 47,
      "nunca_ativado": false
    }
  ],
  "metadata": {
    "total_modulos_ativos": 15,
    "total_geracoes_analisadas": 230,
    "modulos_nunca_ativados": 3
  }
}
```

### Frontend

**Integração com PromptsModulosPage**: Envolver o conteúdo existente em `<Tabs>` do Radix UI.

```
PromptsModulosPage.tsx
├── <Tabs defaultValue="modulos">
│   ├── <TabsList>
│   │   ├── <TabsTrigger value="modulos">Módulos</TabsTrigger>
│   │   └── <TabsTrigger value="ranking">Ranking de Ativações</TabsTrigger>
│   ├── <TabsContent value="modulos">
│   │   └── [conteúdo atual da página, inalterado]
│   └── <TabsContent value="ranking">
│       └── {activeGroupId && <RankingModulos groupId={activeGroupId} />}
```

**Nota**: `activeGroupId` (mapeado de `vm.grupoSelecionado`) pode ser `null` inicialmente enquanto os grupos carregam. O componente `RankingModulos` só é renderizado quando `groupId` é definido.

**Componente `RankingModulos`**:
- 3 cards de resumo no topo (módulos ativos, gerações analisadas, nunca ativados)
- Tabela com colunas: #, Módulo, Categoria, Ativações
- Badge vermelho "Nunca ativado" nos módulos com 0 ativações
- Background levemente avermelhado nas linhas de módulos nunca ativados
- Badges coloridos por categoria (Mérito=verde, Forma=roxo, Responsabilidade=amarelo, etc.)
- Loading state enquanto busca dados

**Hook `useRankingModulos`**:
- Recebe `groupId`
- Chama endpoint via `adminApi.get()`
- Retorna `{ ranking, metadata, loading, error, refetch }`
- Refetch quando `groupId` muda

## Arquivos

### Novos
| Arquivo | Descrição |
|---------|-----------|
| `frontend-react/src/pages/admin/prompts-modulos/components/RankingModulos.tsx` | Componente da aba de ranking |
| `frontend-react/src/pages/admin/prompts-modulos/hooks/useRankingModulos.ts` | Hook de dados do ranking |

### Modificados
| Arquivo | Mudança |
|---------|---------|
| `admin/router_prompts.py` | Novo endpoint `GET /admin/api/prompts-modulos/ranking` |
| `frontend-react/src/pages/admin/prompts-modulos/PromptsModulosPage.tsx` | Envolver conteúdo em `<Tabs>`, importar `RankingModulos` |
| `frontend-react/src/pages/admin/prompts-modulos/types.ts` | Novas interfaces: `RankingItem`, `RankingMetadata`, `RankingResponse` |

### Inalterados
- `activation_trace` já é populado em ambos os modos (automático e semi-automático)
- Nenhuma migração de banco necessária
- Nenhuma alteração nos modelos existentes

## Observações

1. **`activation_trace` usa `deferred()`**: A query SQL roda direto no banco (raw SQL via `text()`), então o deferred do SQLAlchemy não é relevante — o JSON é acessado pelo Postgres nativamente.

2. **Módulos base/peça excluídos**: Só módulos `tipo='conteudo'` aparecem no ranking, pois são os únicos avaliados pelo Agent 2 (detector de módulos).

3. **Performance**: Para o volume atual do portal PGE (centenas de gerações, não milhares), a query JSON no Postgres é suficiente. Se escalar, adicionar cache com TTL de 5 min é trivial.

4. **Sem migração**: O endpoint usa raw SQL sobre dados existentes. Nenhuma alteração no schema do banco.

5. **Contagem global**: O CTE de ativações agrega todas as gerações independente de grupo. Isso significa que a contagem reflete ativações históricas totais do módulo, mesmo que ele tenha sido movido entre grupos. Isso é aceitável — o ranking mostra "quantas vezes esse módulo foi usado em peças geradas" globalmente.

6. **Tratamento de erros**: Se `activation_trace` não existir (migração pendente), o endpoint retorna ranking vazio com zeros em metadata. Usar `try/except` com fallback, não 500.
