# Redesenho da Fila de Revisão — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformar a fila de revisão de uma listagem simples em um sistema gerencial com abas "Minha Fila" e "Assessores", eliminar o status `em_revisao`, corrigir o filtro de status, e atualizar cards de estatísticas.

**Architecture:** Backend-first — atualizar transições de status e endpoints antes do frontend. O backend aceita `pendente` como origem para aprovar/rejeitar/encaminhar (além de `em_revisao` para legados). Frontend reorganiza abas, cria componente CardAssessor, e atualiza BarraStatus.

**Tech Stack:** Python/FastAPI (backend), React/TypeScript (frontend), SQLAlchemy, TanStack Router, Zustand, Radix UI

---

### Task 1: Backend — Aceitar `pendente` nas transições de status

**Files:**
- Modify: `sistemas/revisao_pecas/services.py:146-304` (aprovar_item, rejeitar_item, encaminhar_item)
- Modify: `sistemas/revisao_pecas/services.py:117-143` (iniciar_revisao — tornar no-op)
- Modify: `sistemas/revisao_pecas/router.py:436-462` (desfazer — voltar para pendente)

- [ ] **Step 1: Atualizar `aprovar_item` para aceitar `pendente`**

Em `sistemas/revisao_pecas/services.py`, alterar a validação de status na função `aprovar_item`:

```python
# Linha 169 — substituir:
    if item.status != STATUS_EM_REVISAO:
        raise HTTPException(
            status_code=422,
            detail=f"Item precisa estar em revisao para ser aprovado (status atual: '{item.status}')."
        )
# Por:
    if item.status not in (STATUS_PENDENTE, STATUS_EM_REVISAO):
        raise HTTPException(
            status_code=422,
            detail=f"Item precisa estar pendente ou em revisao para ser aprovado (status atual: '{item.status}')."
        )
```

- [ ] **Step 2: Atualizar `rejeitar_item` para aceitar `pendente`**

Em `sistemas/revisao_pecas/services.py`, alterar a validação na função `rejeitar_item`:

```python
# Linha 235 — substituir:
    if item.status != STATUS_EM_REVISAO:
        raise HTTPException(
            status_code=422,
            detail=f"Item precisa estar em revisao para ser rejeitado (status atual: '{item.status}')."
        )
# Por:
    if item.status not in (STATUS_PENDENTE, STATUS_EM_REVISAO):
        raise HTTPException(
            status_code=422,
            detail=f"Item precisa estar pendente ou em revisao para ser rejeitado (status atual: '{item.status}')."
        )
```

- [ ] **Step 3: Atualizar `encaminhar_item` para aceitar `pendente`**

Em `sistemas/revisao_pecas/services.py`, alterar a validação no ramo `else` (encaminhamento para revisao):

```python
# Linha 300-304 — substituir:
    else:
        if item.status != STATUS_EM_REVISAO:
            raise HTTPException(
                status_code=422,
                detail=f"Item precisa estar em revisao para ser encaminhado (status atual: '{item.status}')."
            )
# Por:
    else:
        if item.status not in (STATUS_PENDENTE, STATUS_EM_REVISAO):
            raise HTTPException(
                status_code=422,
                detail=f"Item precisa estar pendente ou em revisao para ser encaminhado (status atual: '{item.status}')."
            )
```

- [ ] **Step 4: Atualizar `desfazer` para voltar a `pendente`**

Em `sistemas/revisao_pecas/router.py`, alterar a função `endpoint_desfazer`:

```python
# Linha 449 — substituir:
    item.status = "em_revisao"
# Por:
    item.status = "pendente"
```

- [ ] **Step 5: Commit**

```bash
git add sistemas/revisao_pecas/services.py sistemas/revisao_pecas/router.py
git commit -m "refactor(revisao): aceita status pendente nas transicoes de aprovacao/rejeicao/encaminhamento"
```

---

### Task 2: Backend — Nova tab `minha_fila` e `assessores` + estatísticas atualizadas

**Files:**
- Modify: `sistemas/revisao_pecas/router.py:210-301` (listar_itens)
- Modify: `sistemas/revisao_pecas/schemas.py:79-88` (EstatisticasResponse)
- Modify: `sistemas/revisao_pecas/services.py:509-553` (obter_estatisticas)

- [ ] **Step 1: Adicionar campo `concluidos_7d` ao schema de estatísticas**

Em `sistemas/revisao_pecas/schemas.py`, alterar `EstatisticasResponse`:

```python
class EstatisticasResponse(BaseModel):
    total: int = 0
    pendentes: int = 0
    em_revisao: int = 0
    aprovados: int = 0
    encaminhados: int = 0
    rejeitados: int = 0
    concluidos: int = 0
    aguardando_insercao: int = 0
    concluidos_7d: int = 0
```

- [ ] **Step 2: Atualizar `obter_estatisticas` para contar concluídos dos últimos 7 dias**

Em `sistemas/revisao_pecas/services.py`, adicionar import e atualizar a função:

```python
# No topo do arquivo, adicionar ao import existente de datetime:
from datetime import timedelta
```

Depois, no final da função `obter_estatisticas`, antes do `return`, adicionar:

```python
    # Concluidos nos ultimos 7 dias
    sete_dias_atras = get_utc_now() - timedelta(days=7)
    concluidos_7d_query = db.query(func.count(ItemRevisao.id)).filter(
        ItemRevisao.status == STATUS_CONCLUIDO,
        ItemRevisao.concluido_em >= sete_dias_atras,
    )
    if usuario.role == "assessor":
        concluidos_7d_query = concluidos_7d_query.filter(
            ItemRevisao.usuario_encaminhado_id == usuario.id
        )
    concluidos_7d_count = concluidos_7d_query.scalar() or 0
```

E atualizar o return para incluir o novo campo:

```python
    return EstatisticasResponse(
        total=total,
        pendentes=contagens.get(STATUS_PENDENTE, 0),
        em_revisao=contagens.get(STATUS_EM_REVISAO, 0),
        aprovados=contagens.get(STATUS_APROVADO, 0),
        encaminhados=contagens.get(STATUS_ENCAMINHADO, 0),
        rejeitados=contagens.get(STATUS_REJEITADO, 0),
        concluidos=contagens.get(STATUS_CONCLUIDO, 0),
        aguardando_insercao=aguardando_count,
        concluidos_7d=concluidos_7d_count,
    )
```

- [ ] **Step 3: Adicionar tabs `minha_fila` e `assessores` ao endpoint de listagem**

Em `sistemas/revisao_pecas/router.py`, na função `listar_itens`, adicionar os novos casos no bloco de filtro por aba. Após o bloco `elif tab == "para_inserir":` (linha ~268) e antes do `else:` (linha ~270), inserir:

```python
    elif tab == "minha_fila":
        # Admin: pendentes + aprovados + rejeitados + em_revisao (legado), sem concluidos/encaminhados
        if is_admin:
            query = query.filter(
                ItemRevisao.status.in_(["pendente", "em_revisao", "aprovado", "rejeitado"])
            )
        else:
            query = query.filter(
                ItemRevisao.status.in_(["pendente", "em_revisao", "aprovado", "rejeitado"]),
                ItemRevisao.usuario_revisor_id == current_user.id,
            )
    elif tab == "assessores":
        # Todos os itens encaminhados (admin ve todos)
        query = query.filter(ItemRevisao.status == "encaminhado")
```

- [ ] **Step 4: Corrigir filtro de status para funcionar junto com tab**

Em `sistemas/revisao_pecas/router.py`, na função `listar_itens`, o filtro de status já está na linha 277:

```python
    if status:
        query = query.filter(ItemRevisao.status == status)
```

Esse filtro já funciona junto com a tab (é aplicado DEPOIS do filtro de tab). O bug está no frontend (que não envia o parâmetro quando há tab ativo). Nenhuma mudança necessária no backend aqui.

- [ ] **Step 5: Commit**

```bash
git add sistemas/revisao_pecas/router.py sistemas/revisao_pecas/schemas.py sistemas/revisao_pecas/services.py
git commit -m "feat(revisao): adiciona tabs minha_fila e assessores, estatistica concluidos_7d"
```

---

### Task 3: Frontend — Corrigir `useFilaRevisao` e atualizar tab padrão

**Files:**
- Modify: `frontend-react/src/pages/revisao/hooks/useFilaRevisao.ts`

- [ ] **Step 1: Alterar tab padrão e corrigir envio do filtro de status**

Substituir o conteúdo do hook `useFilaRevisao` em `frontend-react/src/pages/revisao/hooks/useFilaRevisao.ts`:

```typescript
// Linha 50 — alterar tab inicial de '' para 'minha_fila':
  const [tab, setTab] = useState('minha_fila')
```

```typescript
// Linhas 72-75 — remover a condicao que impedia envio do status com tab ativo.
// Substituir:
      // Filtro de status manual (sem tab ativo)
      if (!filtrosState.tab && filtrosState.status) {
        filtros.status = filtrosState.status
      }
// Por:
      // Filtro de status — sempre enviado junto com tab
      if (filtrosState.status) {
        filtros.status = filtrosState.status
      }
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/pages/revisao/hooks/useFilaRevisao.ts
git commit -m "fix(revisao): corrige filtro de status e altera tab padrao para minha_fila"
```

---

### Task 4: Frontend — Atualizar `FiltrosRevisao` com novas abas

**Files:**
- Modify: `frontend-react/src/pages/revisao/components/FilaRevisao/FiltrosRevisao.tsx`

- [ ] **Step 1: Atualizar as abas do admin e esconder filtro de status na aba Assessores**

Em `frontend-react/src/pages/revisao/components/FilaRevisao/FiltrosRevisao.tsx`:

Substituir o array `TABS_ADMIN` (linhas 41-46):

```typescript
const TABS_ADMIN: TabConfig[] = [
  { value: 'minha_fila', label: 'Minha Fila' },
  { value: 'assessores', label: 'Assessores' },
]
```

No JSX, condicionar o filtro de status para NÃO aparecer na aba `assessores`. Substituir o bloco do filtro de status (linhas 99-121):

```typescript
      {/* Filtro de status (oculto na aba Assessores) */}
      {isAdmin && tab !== 'assessores' && (
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium whitespace-nowrap" style={{ color: C.text700 }}>
            Status:
          </label>
          <Select
            value={status || '__all__'}
            onValueChange={(v) => setStatus(v === '__all__' ? '' : v)}
          >
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos</SelectItem>
              {Object.entries(STATUS_CONFIG)
                .filter(([key]) => key !== 'concluido' && key !== 'encaminhado')
                .map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>
                    {cfg.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      )}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/pages/revisao/components/FilaRevisao/FiltrosRevisao.tsx
git commit -m "feat(revisao): novas abas Minha Fila e Assessores, esconde filtro status em Assessores"
```

---

### Task 5: Frontend — Atualizar `EstatisticasCards` com novos 4 cards

**Files:**
- Modify: `frontend-react/src/pages/revisao/components/FilaRevisao/EstatisticasCards.tsx`
- Modify: `frontend-react/src/pages/revisao/types.ts` (adicionar `concluidos_7d` ao tipo)

- [ ] **Step 1: Adicionar `concluidos_7d` ao tipo `Estatisticas`**

Em `frontend-react/src/pages/revisao/types.ts`, adicionar o campo ao interface `Estatisticas`:

```typescript
export interface Estatisticas {
  total: number
  pendentes: number
  em_revisao: number
  aprovados: number
  encaminhados: number
  rejeitados: number
  concluidos: number
  aguardando_insercao: number
  concluidos_7d: number
}
```

- [ ] **Step 2: Reescrever os cards de estatísticas**

Em `frontend-react/src/pages/revisao/components/FilaRevisao/EstatisticasCards.tsx`, substituir o array `cards` e os imports:

```typescript
import { Clock, Send, AlertCircle, BookCheck } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { C } from '@/lib/designTokens'
import type { Estatisticas } from '../../types'

interface EstatisticasCardsProps {
  stats: Estatisticas
  loading: boolean
}

interface CardConfig {
  label: string
  value: number
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  valueColor: string
}

export function EstatisticasCards({ stats, loading }: EstatisticasCardsProps) {
  const cards: CardConfig[] = [
    {
      label: 'Pendentes',
      value: stats.pendentes + stats.em_revisao,
      icon: <Clock className="h-6 w-6" />,
      iconBg: C.gray100,
      iconColor: C.gray600,
      valueColor: C.gray700,
    },
    {
      label: 'Com Assessores',
      value: stats.encaminhados,
      icon: <Send className="h-6 w-6" />,
      iconBg: '#fffbeb',
      iconColor: '#92400e',
      valueColor: '#92400e',
    },
    {
      label: 'Aguardando Inserção',
      value: stats.aguardando_insercao,
      icon: <AlertCircle className="h-6 w-6" />,
      iconBg: '#fffbeb',
      iconColor: C.statusWarning,
      valueColor: C.statusWarning,
    },
    {
      label: 'Concluídos (7 dias)',
      value: stats.concluidos_7d,
      icon: <BookCheck className="h-6 w-6" />,
      iconBg: '#eef2ff',
      iconColor: '#3730a3',
      valueColor: '#3730a3',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} className="border" style={{ borderColor: C.gray200 }}>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: C.text500 }}>
                  {card.label}
                </p>
                <p
                  className="text-3xl font-bold leading-none mt-1"
                  style={{ color: loading ? C.gray300 : card.valueColor }}
                >
                  {loading ? '—' : card.value}
                </p>
              </div>
              <div
                className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: card.iconBg, color: card.iconColor }}
              >
                {card.icon}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Atualizar `STATS_VAZIO` em `RevisaoPage.tsx`**

Em `frontend-react/src/pages/revisao/RevisaoPage.tsx`, adicionar o novo campo:

```typescript
const STATS_VAZIO = {
  total: 0,
  pendentes: 0,
  em_revisao: 0,
  aprovados: 0,
  encaminhados: 0,
  rejeitados: 0,
  concluidos: 0,
  aguardando_insercao: 0,
  concluidos_7d: 0,
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend-react/src/pages/revisao/components/FilaRevisao/EstatisticasCards.tsx frontend-react/src/pages/revisao/types.ts frontend-react/src/pages/revisao/RevisaoPage.tsx
git commit -m "feat(revisao): novos cards de estatisticas (pendentes, assessores, aguardando, concluidos 7d)"
```

---

### Task 6: Frontend — Criar componente `CardAssessor`

**Files:**
- Create: `frontend-react/src/pages/revisao/components/FilaRevisao/CardAssessor.tsx`

- [ ] **Step 1: Criar o componente CardAssessor**

Criar `frontend-react/src/pages/revisao/components/FilaRevisao/CardAssessor.tsx`:

```typescript
/**
 * Card colapsável que agrupa itens de revisão por assessor.
 * Mostra avatar, nome, contagem de itens e tempo do mais antigo.
 */

import { useState } from 'react'
import { C } from '@/lib/designTokens'
import { URGENCIA_CONFIG } from '../../constants'
import type { ItemRevisao } from '../../types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface CardAssessorProps {
  nome: string
  itens: ItemRevisao[]
  onItemClick: (item: ItemRevisao) => void
  defaultExpanded?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Gera iniciais a partir do nome (ex: "João Silva" -> "JS") */
function getIniciais(nome: string): string {
  return nome
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

/** Cor do avatar baseada no hash do nome */
const AVATAR_COLORS = ['#1e3a5f', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#4f46e5']
function getAvatarColor(nome: string): string {
  let hash = 0
  for (let i = 0; i < nome.length; i++) hash = nome.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

/** Formata tempo relativo a partir de uma data ISO */
function tempoRelativo(dataISO: string | null): { texto: string; cor: string } {
  if (!dataISO) return { texto: '—', cor: C.gray400 }

  const agora = Date.now()
  const data = new Date(dataISO).getTime()
  const diffMs = agora - data
  const diffHoras = diffMs / (1000 * 60 * 60)
  const diffDias = diffHoras / 24

  let texto: string
  if (diffDias >= 1) {
    const dias = Math.floor(diffDias)
    texto = dias === 1 ? 'há 1 dia' : `há ${dias} dias`
  } else {
    const horas = Math.floor(diffHoras)
    texto = horas <= 0 ? 'agora' : horas === 1 ? 'há 1h' : `há ${horas}h`
  }

  // Cor: vermelho > 3 dias, amber > 1 dia, verde < 1 dia
  let cor: string
  if (diffDias > 3) cor = '#dc2626'
  else if (diffDias > 1) cor = '#d97706'
  else cor = '#16a34a'

  return { texto, cor }
}

/** Encontra a data mais antiga entre os itens (revisado_em = momento do encaminhamento) */
function maisAntigo(itens: ItemRevisao[]): { texto: string; cor: string } {
  if (itens.length === 0) return { texto: '', cor: C.gray400 }

  let oldest: string | null = null
  for (const item of itens) {
    const d = item.revisado_em
    if (d && (!oldest || d < oldest)) oldest = d
  }
  return tempoRelativo(oldest)
}

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

export function CardAssessor({ nome, itens, onItemClick, defaultExpanded = false }: CardAssessorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const iniciais = getIniciais(nome)
  const avatarColor = getAvatarColor(nome)
  const oldest = maisAntigo(itens)
  const count = itens.length

  // Badge color baseado na contagem
  let badgeBg: string, badgeColor: string
  if (count === 0) {
    badgeBg = C.gray100
    badgeColor = C.gray400
  } else if (count >= 5) {
    badgeBg = '#fee2e2'
    badgeColor = '#dc2626'
  } else {
    badgeBg = '#dcfce7'
    badgeColor = '#16a34a'
  }

  return (
    <div
      className="border rounded-xl overflow-hidden bg-white"
      style={{ borderColor: C.gray200 }}
    >
      {/* Header — sempre visível, clicável */}
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
        style={{ background: C.gray50, borderBottom: expanded ? `1px solid ${C.gray200}` : 'none' }}
        onClick={() => count > 0 && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ background: avatarColor }}
          >
            {iniciais}
          </div>

          {/* Nome */}
          <span className="font-semibold text-sm" style={{ color: C.text900 }}>
            {nome}
          </span>

          {/* Badge contagem */}
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: badgeBg, color: badgeColor }}
          >
            {count} {count === 1 ? 'item' : 'itens'}
          </span>

          {/* Mais antigo */}
          {count > 0 && (
            <span className="text-xs font-medium" style={{ color: oldest.cor }}>
              · mais antigo: {oldest.texto}
            </span>
          )}
        </div>

        {/* Seta */}
        {count > 0 && (
          <span className="text-xs" style={{ color: C.gray400 }}>
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </button>

      {/* Body — mini-tabela, colapsável */}
      {expanded && count > 0 && (
        <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {itens.map((item) => {
              const tempo = tempoRelativo(item.revisado_em)
              const urgCfg = item.classificacao_data?.urgencia
                ? URGENCIA_CONFIG[item.classificacao_data.urgencia]
                : null
              return (
                <tr
                  key={item.id}
                  className="cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderBottom: `1px solid ${C.gray100}` }}
                  onClick={() => onItemClick(item)}
                >
                  <td className="px-4 py-2 font-mono" style={{ color: C.navy700 }}>
                    {item.numero_cnj}
                  </td>
                  <td className="px-2 py-2" style={{ color: C.text700 }}>
                    {item.acao_sugerida ?? '—'}
                  </td>
                  <td className="px-2 py-2">
                    {urgCfg ? (
                      <span className="inline-flex items-center gap-1" style={{ color: urgCfg.color }}>
                        <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: urgCfg.color }} />
                        {urgCfg.label}
                      </span>
                    ) : (
                      <span style={{ color: C.gray400 }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-medium" style={{ color: tempo.cor }}>
                    {tempo.texto}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend-react/src/pages/revisao/components/FilaRevisao/CardAssessor.tsx
git commit -m "feat(revisao): cria componente CardAssessor com agrupamento por assessor"
```

---

### Task 7: Frontend — Atualizar `TabelaItens` e `RevisaoPage` para aba Assessores

**Files:**
- Modify: `frontend-react/src/pages/revisao/components/FilaRevisao/TabelaItens.tsx`
- Modify: `frontend-react/src/pages/revisao/RevisaoPage.tsx`

- [ ] **Step 1: Remover coluna "Atribuído a" da TabelaItens**

Em `frontend-react/src/pages/revisao/components/FilaRevisao/TabelaItens.tsx`, remover a coluna "Atribuído a" do header e do body.

No `<TableHeader>`, remover:
```html
<TableHead>Atribuído a</TableHead>
```

No body do map, remover todo o bloco:
```typescript
                {/* Atribuído a */}
                <TableCell>
                  {item.status === 'encaminhado' && item.encaminhado_nome ? (
                    <div className="flex flex-col gap-0.5">
                      <span
                        className="inline-flex items-center gap-1 text-xs font-medium"
                        style={{ color: '#92400e' }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: '#92400e' }}
                        />
                        Enc. a: {item.encaminhado_nome}
                      </span>
                      {item.revisor_nome && (
                        <span className="text-xs" style={{ color: C.text400 }}>
                          por {item.revisor_nome}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-sm" style={{ color: C.text500 }}>
                      {item.revisor_nome ?? '—'}
                    </span>
                  )}
                </TableCell>
```

Atualizar o `colSpan` do placeholder de 8 para 7:
```typescript
      <TableCell colSpan={7} className="text-center py-12" style={{ color: C.text400 }}>
```

- [ ] **Step 2: Atualizar `RevisaoPage` para renderizar CardAssessor na aba Assessores**

Em `frontend-react/src/pages/revisao/RevisaoPage.tsx`, importar o componente e a API de assessores:

```typescript
import { CardAssessor } from './components/FilaRevisao/CardAssessor'
import { fetchAssessores } from './api'
import type { ItemRevisao, Assessor } from './types'
```

Remover a importação não utilizada:
```typescript
// Remover: import type { ItemRevisao } from './types'
```

Dentro do componente `RevisaoPage`, adicionar state para assessores e lógica de agrupamento:

```typescript
  const [assessores, setAssessores] = useState<Assessor[]>([])

  // Carrega assessores quando a aba Assessores esta ativa
  useEffect(() => {
    if (tab === 'assessores') {
      fetchAssessores().then(setAssessores).catch(() => setAssessores([]))
    }
  }, [tab])
```

Precisará adicionar os imports `useState` e `useEffect`:
```typescript
import { useState, useEffect } from 'react'
```

Para agrupar itens por assessor, adicionar esta lógica:

```typescript
  // Agrupa itens por assessor para a aba Assessores
  const itensAgrupados = tab === 'assessores'
    ? (() => {
        const groups: Record<string, { nome: string; itens: ItemRevisao[] }> = {}

        // Inicializa com todos os assessores ativos (mesmo sem itens)
        for (const a of assessores) {
          if (a.ativo) {
            groups[String(a.usuario_id)] = { nome: a.nome, itens: [] }
          }
        }

        // Distribui itens nos grupos
        for (const item of itens) {
          const uid = String(item.usuario_encaminhado_id)
          if (groups[uid]) {
            groups[uid].itens.push(item)
          } else if (item.encaminhado_nome) {
            groups[uid] = { nome: item.encaminhado_nome, itens: [item] }
          }
        }

        // Ordena: mais itens primeiro, sem itens por ultimo
        return Object.values(groups).sort((a, b) => b.itens.length - a.itens.length)
      })()
    : []
```

Substituir o bloco `<TabelaItens>` para condicionar pela aba:

```typescript
        {/* Tabela ou Cards de assessores */}
        {tab === 'assessores' ? (
          <div className="space-y-3">
            {loading ? (
              <div className="text-center py-12 text-sm" style={{ color: C.text400 }}>
                Carregando...
              </div>
            ) : itensAgrupados.length === 0 ? (
              <div className="text-center py-12 text-sm" style={{ color: C.text400 }}>
                Nenhum assessor cadastrado.
              </div>
            ) : (
              itensAgrupados.map((group) => (
                <CardAssessor
                  key={group.nome}
                  nome={group.nome}
                  itens={group.itens}
                  onItemClick={handleItemClick}
                  defaultExpanded={group.itens.length > 0 && group.itens.length <= 10}
                />
              ))
            )}
          </div>
        ) : (
          <TabelaItens
            itens={itens}
            loading={loading}
            onItemClick={handleItemClick}
          />
        )}
```

Adicionar import de `C`:
```typescript
import { C } from '@/lib/designTokens'
```

- [ ] **Step 3: Commit**

```bash
git add frontend-react/src/pages/revisao/components/FilaRevisao/TabelaItens.tsx frontend-react/src/pages/revisao/RevisaoPage.tsx
git commit -m "feat(revisao): aba Assessores com CardAssessor, remove coluna Atribuido da tabela"
```

---

### Task 8: Frontend — Atualizar `BarraStatus` para eliminar "Iniciar Revisão"

**Files:**
- Modify: `frontend-react/src/pages/revisao/components/Revisao/BarraStatus.tsx`
- Modify: `frontend-react/src/pages/revisao/RevisaoItemPage.tsx`
- Modify: `frontend-react/src/pages/revisao/hooks/useRevisaoItem.ts`

- [ ] **Step 1: Atualizar BarraStatus — pendente mostra botões de ação direto**

Em `frontend-react/src/pages/revisao/components/Revisao/BarraStatus.tsx`, na função `AcoesStatus`, substituir o bloco `if (status === 'pendente')`:

```typescript
  if (status === 'pendente' || status === 'em_revisao') {
    return (
      <>
        <Button
          size="sm"
          onClick={onAprovar}
          className="text-xs"
          style={{ background: C.statusSuccess, color: 'white' }}
        >
          Aprovar
        </Button>

        {isAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={onEncaminhar}
            className="text-xs border"
            style={{ borderColor: '#92400e', color: '#92400e' }}
          >
            Encaminhar
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={onRejeitar}
          className="text-xs border"
          style={{ borderColor: C.statusError, color: C.statusError }}
        >
          Rejeitar
        </Button>
      </>
    )
  }
```

Remover o bloco separado `if (status === 'em_revisao')` que existia antes (agora está unificado acima).

Remover `onIniciarRevisao` da interface `BarraStatusProps` e de `AcoesStatusProps`.

- [ ] **Step 2: Remover `onIniciarRevisao` do RevisaoItemPage**

Em `frontend-react/src/pages/revisao/RevisaoItemPage.tsx`, remover a prop `onIniciarRevisao` da chamada ao `<BarraStatus>`:

```typescript
      <BarraStatus
        item={item}
        isAdmin={isAdmin}
        currentUserId={user?.id ?? null}
        onAprovar={handleAprovarClick}
        onRejeitar={() => setShowRejeicao(true)}
        onEncaminhar={() => setShowEncaminhar(true)}
        onEncaminharInsercao={() => setShowEncaminharInsercao(true)}
        onMarcarInserido={() => void handleMarcarInseridoClick()}
        onDesfazer={() => void handleDesfazer()}
        onBaixarDocx={() => void handleBaixarDocx()}
      />
```

- [ ] **Step 3: Tornar editor editável para status `pendente`**

Em `frontend-react/src/pages/revisao/RevisaoItemPage.tsx`, alterar a prop `readOnly` do `EditorPeca`:

```typescript
// Substituir:
                readOnly={item.status !== 'em_revisao'}
// Por:
                readOnly={item.status !== 'pendente' && item.status !== 'em_revisao'}
```

- [ ] **Step 4: Remover `handleIniciarRevisao` do hook useRevisaoItem**

Em `frontend-react/src/pages/revisao/hooks/useRevisaoItem.ts`:

Remover o import de `iniciarRevisao`:
```typescript
// Remover 'iniciarRevisao' da lista de imports da api
```

Remover `handleIniciarRevisao` da interface `UseRevisaoItemReturn`, do corpo do hook, e do return.

- [ ] **Step 5: Commit**

```bash
git add frontend-react/src/pages/revisao/components/Revisao/BarraStatus.tsx frontend-react/src/pages/revisao/RevisaoItemPage.tsx frontend-react/src/pages/revisao/hooks/useRevisaoItem.ts
git commit -m "feat(revisao): remove Iniciar Revisao, pendente mostra botoes de acao direto"
```

---

### Task 9: Build e verificação final

**Files:**
- Build: `frontend-react/`

- [ ] **Step 1: Build do frontend**

```bash
cd frontend-react && node node_modules/vite/bin/vite.js build
```

Esperado: build sem erros TypeScript.

- [ ] **Step 2: Verificar que o servidor inicia sem erros**

```bash
cd .. && python -c "from sistemas.revisao_pecas import router; print('OK')"
```

Esperado: `OK` sem ImportError.

- [ ] **Step 3: Commit do dist**

```bash
git add -f frontend-react/dist/
git commit -m "build(revisao): rebuild dist com redesenho da fila de revisao"
```
