# Ranking de Modulos de Prompts — Plano de Implementacao

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova aba "Ranking de Ativacoes" na pagina admin prompts-modulos, mostrando ranking de modulos mais/menos ativados a partir do campo `activation_trace` em `geracoes_pecas`.

**Architecture:** Backend: novo metodo no `PromptModuloRepository` com raw SQL (CTE + jsonb_array_elements), endpoint GET no `router_prompts.py`. Frontend: nova tab Radix no `PromptsModulosPage`, componente `RankingModulos` com cards de resumo + tabela, hook `useRankingModulos` para fetch.

**Tech Stack:** Python/FastAPI, SQLAlchemy raw SQL, PostgreSQL JSONB, React/TypeScript, Radix UI Tabs

**Spec:** `docs/superpowers/specs/2026-03-12-ranking-modulos-design.md`

---

## Chunk 1: Backend

### Task 1: Metodo `get_activation_ranking` no repositorio

**Files:**
- Modify: `admin/repositories.py:239` (apos metodo `get_tipos_peca_by_categoria`)

- [ ] **Step 1: Adicionar metodo ao PromptModuloRepository**

No arquivo `admin/repositories.py`, adicionar apos o metodo `get_tipos_peca_by_categoria` (linha ~239), dentro da classe `PromptModuloRepository`:

```python
def get_activation_ranking(self, group_id: int) -> dict:
    """
    Retorna ranking de modulos de conteudo por total de ativacoes.

    Usa activation_trace (JSONB) de geracoes_pecas para contar
    quantas vezes cada modulo foi ativado (activated=true).
    Inclui modulos ativos que nunca foram ativados (total=0).

    Retorna dict com 'ranking' (lista ordenada) e 'metadata'.
    """
    try:
        # Query principal: agregar ativacoes do activation_trace
        result = self.db.execute(sql_text("""
            WITH ativacoes AS (
                SELECT
                    (modulo->>'module_id')::int AS module_id,
                    COUNT(*) FILTER (
                        WHERE (modulo->>'activated')::boolean = true
                    ) AS total_ativacoes
                FROM geracoes_pecas g
                    CROSS JOIN jsonb_array_elements(
                        g.activation_trace->'modulos'
                    ) AS modulo
                WHERE g.activation_trace IS NOT NULL
                GROUP BY (modulo->>'module_id')::int
            )
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
        """), {"group_id": group_id}).fetchall()

        # Metadata: total de geracoes analisadas
        count_result = self.db.execute(sql_text(
            "SELECT COUNT(*) FROM geracoes_pecas WHERE activation_trace IS NOT NULL"
        )).scalar() or 0

    except Exception:
        # Se activation_trace nao existir (migracao pendente), retornar vazio
        import logging
        logging.getLogger(__name__).warning(
            "Erro ao consultar activation_trace para ranking. "
            "Coluna pode nao existir ainda."
        )
        return {
            "ranking": [],
            "metadata": {
                "total_modulos_ativos": 0,
                "total_geracoes_analisadas": 0,
                "modulos_nunca_ativados": 0,
            },
        }

    # Montar ranking com posicao
    ranking = []
    for i, row in enumerate(result, 1):
        total = row[4]
        ranking.append({
            "posicao": i,
            "modulo_id": row[0],
            "nome": row[1],
            "titulo": row[2],
            "categoria": row[3],
            "total_ativacoes": total,
            "nunca_ativado": total == 0,
        })

    nunca_ativados = sum(1 for r in ranking if r["nunca_ativado"])

    return {
        "ranking": ranking,
        "metadata": {
            "total_modulos_ativos": len(ranking),
            "total_geracoes_analisadas": count_result,
            "modulos_nunca_ativados": nunca_ativados,
        },
    }
```

- [ ] **Step 2: Verificar que `sql_text` ja esta importado**

Na linha 15 de `repositories.py` ja existe:
```python
from sqlalchemy import func, and_, case, extract, text as sql_text, literal_column
```
E na linha 40:
```python
from sistemas.gerador_pecas.models import GeracaoPeca, FeedbackPeca, VersaoPeca
```
Nenhum import novo necessario.

- [ ] **Step 3: Commit backend repository**

```bash
git add admin/repositories.py
git commit -m "feat(ranking): adiciona metodo get_activation_ranking no PromptModuloRepository"
```

---

### Task 2: Endpoint GET /ranking no router

**Files:**
- Modify: `admin/router_prompts.py:2892` (apos ultimo endpoint)

- [ ] **Step 1: Adicionar endpoint ao final do router**

No arquivo `admin/router_prompts.py`, adicionar apos a ultima linha (2892):

```python
# ============================================================
# Ranking de ativacoes de modulos
# ============================================================

@router.get("/ranking")
async def ranking_modulos(
    group_id: int = Query(..., description="ID do grupo para filtrar modulos"),
    current_user: User = Depends(get_current_active_user),
    modulo_repo: PromptModuloRepository = Depends(get_prompt_modulo_repo),
):
    """
    Retorna ranking de modulos de conteudo ordenados por total de ativacoes.

    Usa o campo activation_trace de geracoes_pecas para contar ativacoes
    historicas. Mostra apenas modulos ativos do grupo selecionado.
    Modulos que nunca foram ativados aparecem no final com badge especial.
    """
    return modulo_repo.get_activation_ranking(group_id)
```

Nenhum import novo necessario — `Query`, `User`, `Depends`, `get_current_active_user`, `PromptModuloRepository`, `get_prompt_modulo_repo` ja estao importados no topo do arquivo.

- [ ] **Step 2: Testar endpoint manualmente**

```bash
# Iniciar servidor (se nao estiver rodando)
uvicorn main:app --reload

# Testar via curl (substituir GROUP_ID e TOKEN)
curl -H "Authorization: Bearer TOKEN" "http://localhost:8000/admin/api/prompts-modulos/ranking?group_id=1"
```

Resposta esperada:
```json
{
  "ranking": [...],
  "metadata": {
    "total_modulos_ativos": N,
    "total_geracoes_analisadas": N,
    "modulos_nunca_ativados": N
  }
}
```

- [ ] **Step 3: Commit backend endpoint**

```bash
git add admin/router_prompts.py
git commit -m "feat(ranking): adiciona endpoint GET /ranking no router de prompts"
```

---

## Chunk 2: Frontend

### Task 3: Tipos TypeScript

**Files:**
- Modify: `frontend-react/src/pages/admin/prompts-modulos/types.ts:91` (final do arquivo)

- [ ] **Step 1: Adicionar interfaces de ranking**

No final de `types.ts` (apos linha 91), adicionar:

```typescript

// ============================================================
// Ranking de ativacoes
// ============================================================

export interface RankingItem {
  posicao: number
  modulo_id: number
  nome: string
  titulo: string
  categoria: string
  total_ativacoes: number
  nunca_ativado: boolean
}

export interface RankingMetadata {
  total_modulos_ativos: number
  total_geracoes_analisadas: number
  modulos_nunca_ativados: number
}

export interface RankingResponse {
  ranking: RankingItem[]
  metadata: RankingMetadata
}
```

- [ ] **Step 2: Commit tipos**

```bash
git add frontend-react/src/pages/admin/prompts-modulos/types.ts
git commit -m "feat(ranking): adiciona tipos TypeScript para ranking de modulos"
```

---

### Task 4: Hook useRankingModulos

**Files:**
- Create: `frontend-react/src/pages/admin/prompts-modulos/hooks/useRankingModulos.ts`

- [ ] **Step 1: Criar hook**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type { RankingResponse } from '../types'

/**
 * Hook que busca o ranking de ativacoes de modulos para um grupo.
 * Refetch automatico quando groupId muda.
 */
export function useRankingModulos(groupId: number) {
  const { toast } = useToast()
  const [data, setData] = useState<RankingResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRanking = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await adminApi.get<RankingResponse>(
        `/admin/api/prompts-modulos/ranking?group_id=${groupId}`
      )
      setData(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(msg)
      toast({
        title: 'Erro ao carregar ranking',
        description: msg,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [groupId, toast])

  useEffect(() => {
    fetchRanking()
  }, [fetchRanking])

  return {
    ranking: data?.ranking ?? [],
    metadata: data?.metadata ?? {
      total_modulos_ativos: 0,
      total_geracoes_analisadas: 0,
      modulos_nunca_ativados: 0,
    },
    loading,
    error,
    refetch: fetchRanking,
  }
}
```

- [ ] **Step 2: Commit hook**

```bash
git add frontend-react/src/pages/admin/prompts-modulos/hooks/useRankingModulos.ts
git commit -m "feat(ranking): cria hook useRankingModulos para buscar dados do ranking"
```

---

### Task 5: Componente RankingModulos

**Files:**
- Create: `frontend-react/src/pages/admin/prompts-modulos/components/RankingModulos.tsx`

- [ ] **Step 1: Criar componente**

```tsx
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { C } from '@/lib/designTokens'
import { useRankingModulos } from '../hooks/useRankingModulos'

// Cores por categoria (mesmo padrao do TipoSection)
const CATEGORIA_COLORS: Record<string, { bg: string; text: string }> = {
  'Merito': { bg: '#2d4a3e', text: '#6ee7b7' },
  'Mérito': { bg: '#2d4a3e', text: '#6ee7b7' },
  'Forma': { bg: '#3b2d4a', text: '#c4b5fd' },
  'Responsabilidade': { bg: '#4a3b2d', text: '#fcd34d' },
  'Sancoes': { bg: '#4a2d2d', text: '#fca5a5' },
  'Sanções': { bg: '#4a2d2d', text: '#fca5a5' },
}
const DEFAULT_COLOR = { bg: '#374151', text: '#9ca3af' }

function getCategoriaColor(categoria: string) {
  return CATEGORIA_COLORS[categoria] || DEFAULT_COLOR
}

interface RankingModulosProps {
  groupId: number
}

export function RankingModulos({ groupId }: RankingModulosProps) {
  const { ranking, metadata, loading, refetch } = useRankingModulos(groupId)

  if (loading) {
    return (
      <div className="text-center py-12" style={{ color: C.text400 }}>
        Carregando ranking...
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-3 gap-4">
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: 'white', border: `1px solid ${C.gray200}` }}
        >
          <div className="text-3xl font-bold" style={{ color: C.blue600 }}>
            {metadata.total_modulos_ativos}
          </div>
          <div className="text-xs mt-1" style={{ color: C.text400 }}>
            Modulos Ativos
          </div>
        </div>
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: 'white', border: `1px solid ${C.gray200}` }}
        >
          <div className="text-3xl font-bold" style={{ color: C.green600 || '#16a34a' }}>
            {metadata.total_geracoes_analisadas}
          </div>
          <div className="text-xs mt-1" style={{ color: C.text400 }}>
            Geracoes Analisadas
          </div>
        </div>
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: 'white', border: `1px solid ${C.gray200}` }}
        >
          <div className="text-3xl font-bold" style={{ color: '#ef4444' }}>
            {metadata.modulos_nunca_ativados}
          </div>
          <div className="text-xs mt-1" style={{ color: C.text400 }}>
            Nunca Ativados
          </div>
        </div>
      </div>

      {/* Botao de atualizar */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={refetch} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </Button>
      </div>

      {/* Tabela de ranking */}
      <div
        className="bg-white rounded-xl overflow-hidden"
        style={{ border: `1px solid ${C.gray200}` }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: C.gray50 || '#f9fafb' }}>
              <th className="px-4 py-3 text-left font-medium w-12" style={{ color: C.text500 }}>
                #
              </th>
              <th className="px-4 py-3 text-left font-medium" style={{ color: C.text500 }}>
                Modulo
              </th>
              <th className="px-4 py-3 text-left font-medium w-36" style={{ color: C.text500 }}>
                Categoria
              </th>
              <th className="px-4 py-3 text-right font-medium w-28" style={{ color: C.text500 }}>
                Ativacoes
              </th>
            </tr>
          </thead>
          <tbody>
            {ranking.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center" style={{ color: C.text400 }}>
                  Nenhum modulo de conteudo ativo neste grupo
                </td>
              </tr>
            ) : (
              ranking.map((item) => {
                const catColor = getCategoriaColor(item.categoria)
                return (
                  <tr
                    key={item.modulo_id}
                    className="border-t"
                    style={{
                      borderColor: C.gray200,
                      background: item.nunca_ativado ? 'rgba(239,68,68,0.03)' : undefined,
                    }}
                  >
                    <td className="px-4 py-3" style={{ color: C.text400 }}>
                      {item.posicao}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: C.text700 }}>
                      {item.titulo}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: catColor.bg, color: catColor.text }}
                      >
                        {item.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.nunca_ativado ? (
                        <span
                          className="text-xs px-2 py-0.5 rounded"
                          style={{ background: '#7f1d1d', color: '#fca5a5' }}
                        >
                          Nunca ativado
                        </span>
                      ) : (
                        <span className="font-semibold" style={{ color: C.blue600 }}>
                          {item.total_ativacoes}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit componente**

```bash
git add frontend-react/src/pages/admin/prompts-modulos/components/RankingModulos.tsx
git commit -m "feat(ranking): cria componente RankingModulos com cards e tabela"
```

---

### Task 6: Integrar tab na PromptsModulosPage

**Files:**
- Modify: `frontend-react/src/pages/admin/prompts-modulos/PromptsModulosPage.tsx`

- [ ] **Step 1: Adicionar imports**

Na linha 1 de `PromptsModulosPage.tsx`, adicionar apos os imports existentes (apos linha 22):

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RankingModulos } from './components/RankingModulos'
```

- [ ] **Step 2: Envolver conteudo em Tabs**

Substituir o bloco `<ContentArea>` (linhas 68-319) por:

```tsx
      <ContentArea className="space-y-6">
      <AdminSubNav />

      <Tabs defaultValue="modulos">
        <TabsList>
          <TabsTrigger value="modulos">Modulos</TabsTrigger>
          <TabsTrigger value="ranking">Ranking de Ativacoes</TabsTrigger>
        </TabsList>

        <TabsContent value="modulos" className="mt-4 space-y-6">
          {/* Filtros */}
          <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: `1px solid ${C.gray200}` }}>
            {/* ... todo o conteudo do bloco de filtros (linhas 72-193) inalterado ... */}
          </div>

          {/* Lista de modulos organizada por tipo */}
          {/* ... todo o conteudo da lista (linhas 195-270) inalterado ... */}
        </TabsContent>

        <TabsContent value="ranking" className="mt-4">
          {vm.grupoSelecionado && (
            <RankingModulos groupId={vm.grupoSelecionado} />
          )}
          {!vm.grupoSelecionado && (
            <div className="text-center py-12" style={{ color: C.text400 }}>
              Selecione um grupo para ver o ranking
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs (inalterados, permanecem fora do Tabs) */}
```

Concretamente, as mudancas sao:

1. Apos `<AdminSubNav />` (linha 69), abrir `<Tabs>` + `<TabsList>` + primeiro `<TabsTrigger>`
2. Antes do bloco de filtros (linha 71), abrir `<TabsContent value="modulos" className="mt-4 space-y-6">`
3. Apos o fechamento do bloco de lista (linha 270), fechar `</TabsContent>`
4. Adicionar `<TabsContent value="ranking">` com `RankingModulos`
5. Fechar `</Tabs>` antes dos Dialogs (linha 272)

**IMPORTANTE**: Todo o conteudo de filtros e lista permanece **inalterado**. Apenas adicionamos wrapper de Tabs ao redor.

- [ ] **Step 3: Commit integracao**

```bash
git add frontend-react/src/pages/admin/prompts-modulos/PromptsModulosPage.tsx
git commit -m "feat(ranking): integra aba de ranking na pagina de prompts-modulos"
```

---

### Task 7: Build e commit do dist

**Files:**
- Modify: `frontend-react/dist/` (build output)

- [ ] **Step 1: Build do frontend**

```bash
cd frontend-react && node node_modules/vite/bin/vite.js build
```

Deve completar sem erros. Verificar que nao ha erros TypeScript.

- [ ] **Step 2: Commit build**

```bash
git add -f frontend-react/dist/
git commit -m "build: rebuild dist com aba de ranking de modulos"
```

**REGRA CRITICA do CLAUDE.md**: O Railway NAO roda build — o dist commitado e servido diretamente. Se esquecer este step, as mudancas NAO aparecerao em producao.
