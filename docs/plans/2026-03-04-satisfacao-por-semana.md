# Satisfação por Semana — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Substituir a métrica "Taxa de Acerto (%)" (baseada no campo texto `avaliacao`) no gráfico de evolução semanal por "Satisfação (%)" calculada a partir da média de estrelas (`avg(nota) / 5 × 100`).

**Architecture:** A query `evolucao_semanal()` no repositório recebe um campo `AVG(nota)` adicional. O formatador calcula `satisfacao = avg_nota / 5 * 100`. O frontend substitui o tipo `'taxa_acerto'` por `'satisfacao'` em constantes, tipos e no componente `EvolutionChart`.

**Tech Stack:** Python/SQLAlchemy (backend), TypeScript/React/Recharts (frontend), Vite (build)

---

## Contexto Essencial

- Arquivo de repositório: `admin/repositories.py`
- Rota do dashboard: `admin/router_feedbacks.py`
- Componente do gráfico: `frontend-react/src/pages/admin/feedbacks/components/EvolutionChart.tsx`
- Constantes: `frontend-react/src/pages/admin/feedbacks/constants.ts`
- Tipos: `frontend-react/src/pages/admin/feedbacks/types.ts`

A "Taxa de Acerto" atual usa `avaliacao == 'correto'` (campo texto legado), não as estrelas.
O campo `nota` (int 1-5) já existe nos modelos de feedback. A `media_nota_global()` já existe no repositório.

---

### Task 1: Adicionar `satisfacao` ao `evolucao_semanal()` no repositório

**Files:**
- Modify: `admin/repositories.py:1312-1339`

**Step 1: Localizar o método `evolucao_semanal`**

```bash
# Confirma a linha exata
grep -n "def evolucao_semanal" admin/repositories.py
```

**Step 2: Adicionar `AVG(nota)` à query**

Alterar a query em `evolucao_semanal()`. O campo `nota` existe em todos os modelos de feedback.

**Código atual (linhas 1320-1326):**
```python
query = self.db.query(
    extract('isoyear', modelo_feedback.criado_em).label('ano'),
    extract('week', modelo_feedback.criado_em).label('semana'),
    func.count(modelo_feedback.id).label('total'),
    func.sum(case((modelo_feedback.avaliacao == 'correto', 1), else_=0)).label('corretos'),
    func.sum(case((modelo_feedback.avaliacao == 'parcial', 1), else_=0)).label('parciais'),
    func.sum(case((modelo_feedback.avaliacao == 'incorreto', 1), else_=0)).label('incorretos')
)
```

**Código novo:**
```python
query = self.db.query(
    extract('isoyear', modelo_feedback.criado_em).label('ano'),
    extract('week', modelo_feedback.criado_em).label('semana'),
    func.count(modelo_feedback.id).label('total'),
    func.sum(case((modelo_feedback.avaliacao == 'correto', 1), else_=0)).label('corretos'),
    func.sum(case((modelo_feedback.avaliacao == 'parcial', 1), else_=0)).label('parciais'),
    func.sum(case((modelo_feedback.avaliacao == 'incorreto', 1), else_=0)).label('incorretos'),
    func.avg(case((modelo_feedback.nota.isnot(None), modelo_feedback.nota), else_=None)).label('media_nota')
)
```

**Também atualizar a docstring:**
```python
"""Calcula métricas por semana para um modelo de feedback (taxa de acerto e satisfação)."""
```

**Step 3: Verificar manualmente que o método não quebra**

```bash
cd E:/Projetos/PGE/portal-pge
python -c "from admin.repositories import FeedbackRepository; print('OK')"
```
Esperado: `OK`

**Step 4: Commit**

```bash
git add admin/repositories.py
git commit -m "feat(feedbacks): adiciona avg(nota) por semana ao evolucao_semanal"
```

---

### Task 2: Adicionar campo `satisfacao` ao formatador no router

**Files:**
- Modify: `admin/router_feedbacks.py:411-441`

**Step 1: Localizar `formatar_dados_evolucao`**

```bash
grep -n "formatar_dados_evolucao\|taxa_acerto" admin/router_feedbacks.py | head -20
```

**Step 2: Adicionar `satisfacao` ao dicionário de cada semana**

**Código atual (linhas ~418-424):**
```python
{
    'semana': semana_str,
    'total': r.total,
    'corretos': r.corretos or 0,
    'parciais': r.parciais or 0,
    'incorretos': r.incorretos or 0,
    'taxa_acerto': round((r.corretos or 0) / r.total * 100, 1) if r.total > 0 else 0
}
```

**Código novo:**
```python
{
    'semana': semana_str,
    'total': r.total,
    'corretos': r.corretos or 0,
    'parciais': r.parciais or 0,
    'incorretos': r.incorretos or 0,
    'taxa_acerto': round((r.corretos or 0) / r.total * 100, 1) if r.total > 0 else 0,
    'satisfacao': round(float(r.media_nota) / 5 * 100, 1) if r.media_nota is not None else None
}
```

**Step 3: Verificar import**

`func.avg` e `case` já estão importados via SQLAlchemy (usados em outros lugares). Confirmar:
```bash
grep -n "^from sqlalchemy\|^import sqlalchemy" admin/repositories.py | head -5
```

**Step 4: Commit**

```bash
git add admin/router_feedbacks.py
git commit -m "feat(feedbacks): inclui campo satisfacao na evolucao semanal"
```

---

### Task 3: Atualizar tipos TypeScript

**Files:**
- Modify: `frontend-react/src/pages/admin/feedbacks/types.ts:7-14`

**Step 1: Adicionar `satisfacao` à interface `EvolucaoSemana`**

**Código atual:**
```typescript
export interface EvolucaoSemana {
  semana: string
  total: number
  feedbacks: number
  taxa: number | null
  corretos?: number
  taxa_acerto?: number | null
}
```

**Código novo:**
```typescript
export interface EvolucaoSemana {
  semana: string
  total: number
  feedbacks: number
  taxa: number | null
  corretos?: number
  taxa_acerto?: number | null
  satisfacao?: number | null
}
```

**Step 2: Commit**

```bash
git add frontend-react/src/pages/admin/feedbacks/types.ts
git commit -m "feat(feedbacks): adiciona campo satisfacao ao tipo EvolucaoSemana"
```

---

### Task 4: Atualizar constantes do dropdown de métrica

**Files:**
- Modify: `frontend-react/src/pages/admin/feedbacks/constants.ts:129-133`

**Step 1: Substituir `taxa_acerto` por `satisfacao` em `EVOLUCAO_METRICA_OPTIONS`**

**Código atual:**
```typescript
export const EVOLUCAO_METRICA_OPTIONS = [
  { value: 'taxa_acerto', label: 'Taxa de Acerto (%)' },
  { value: 'total', label: 'Total de Feedbacks' },
  { value: 'corretos', label: 'Feedbacks Corretos' },
]
```

**Código novo:**
```typescript
export const EVOLUCAO_METRICA_OPTIONS = [
  { value: 'satisfacao', label: 'Satisfação (%)' },
  { value: 'total', label: 'Total de Feedbacks' },
  { value: 'corretos', label: 'Feedbacks Corretos' },
]
```

**Step 2: Commit**

```bash
git add frontend-react/src/pages/admin/feedbacks/constants.ts
git commit -m "feat(feedbacks): renomeia metrica taxa_acerto para satisfacao no dropdown"
```

---

### Task 5: Atualizar o componente `EvolutionChart`

**Files:**
- Modify: `frontend-react/src/pages/admin/feedbacks/components/EvolutionChart.tsx`

**Step 1: Substituir o tipo `Metrica`**

**Linha 35 atual:**
```typescript
type Metrica = 'taxa_acerto' | 'total' | 'corretos'
```
**Linha 35 nova:**
```typescript
type Metrica = 'satisfacao' | 'total' | 'corretos'
```

**Step 2: Atualizar valor padrão do estado**

**Linha 46 atual:**
```typescript
const [metrica, setMetrica] = useState<Metrica>('taxa_acerto')
```
**Linha 46 nova:**
```typescript
const [metrica, setMetrica] = useState<Metrica>('satisfacao')
```

**Step 3: Atualizar leitura do dado no `chartData`**

**Linhas 78-79 atuais:**
```typescript
if (metrica === 'taxa_acerto') {
  ponto[sistema] = d.taxa_acerto ?? d.taxa ?? null
```
**Linhas 78-79 novas:**
```typescript
if (metrica === 'satisfacao') {
  ponto[sistema] = d.satisfacao ?? null
```

**Step 4: Atualizar filtro em `sistemasComDados`**

**Linha 95 atual:**
```typescript
if (metrica === 'taxa_acerto') return (d.taxa_acerto ?? d.taxa) !== null
```
**Linha 95 nova:**
```typescript
if (metrica === 'satisfacao') return d.satisfacao !== null && d.satisfacao !== undefined
```

**Step 5: Atualizar label do eixo Y**

**Linhas 102-105 atuais:**
```typescript
const yLabel =
  metrica === 'taxa_acerto' ? 'Taxa de Acerto (%)'
  : metrica === 'total' ? 'Total de Feedbacks'
  : 'Feedbacks Corretos'
```
**Linhas 102-105 novas:**
```typescript
const yLabel =
  metrica === 'satisfacao' ? 'Satisfação (%)'
  : metrica === 'total' ? 'Total de Feedbacks'
  : 'Feedbacks Corretos'
```

**Step 6: Atualizar `domain` do `YAxis`**

**Linha 177 atual:**
```typescript
domain={metrica === 'taxa_acerto' ? [0, 100] : [0, 'auto']}
```
**Linha 177 nova:**
```typescript
domain={metrica === 'satisfacao' ? [0, 100] : [0, 'auto']}
```

**Step 7: Atualizar tooltip**

**Linha 185 atual:**
```typescript
return [metrica === 'taxa_acerto' ? `${value.toFixed(1)}%` : value, label]
```
**Linha 185 nova:**
```typescript
return [metrica === 'satisfacao' ? `${value.toFixed(1)}%` : value, label]
```

**Step 8: Atualizar título do gráfico**

**Linha 114 atual:**
```tsx
Evolução da Taxa de Acerto por Sistema
```
**Linha 114 nova:**
```tsx
Evolução da Satisfação por Sistema
```

**Step 9: Commit**

```bash
git add frontend-react/src/pages/admin/feedbacks/components/EvolutionChart.tsx
git commit -m "feat(feedbacks): substitui Taxa de Acerto por Satisfacao no grafico de evolucao"
```

---

### Task 6: Build do frontend e commit final

**Step 1: Fazer o build do dist**

```bash
cd frontend-react && node node_modules/vite/bin/vite.js build
```
Esperado: `✓ built in X.XXs`

**Step 2: Verificar que não há erros de TypeScript no build**

Se `vite build` falhar com erro de tipo, corrigir antes de continuar.

**Step 3: Commit do dist**

```bash
cd ..
git add -f frontend-react/dist/
git commit -m "build(frontend): rebuild dist apos substituicao de Taxa de Acerto por Satisfacao"
```

**Step 4: Verificar visualmente**

Abrir `/admin/feedbacks` e confirmar:
- Dropdown "Métrica" mostra "Satisfação (%)" como opção padrão selecionada
- O gráfico exibe valores entre 0-100% baseados em estrelas
- Semana de março com avaliação 3★ deve mostrar ~60% (não 100%)
- Semanas sem notas mostram lacuna (linha não conectada)

---

## Resumo das mudanças

| Arquivo | Tipo | O que muda |
|---|---|---|
| `admin/repositories.py` | Backend | `+AVG(nota)` na query `evolucao_semanal` |
| `admin/router_feedbacks.py` | Backend | `+satisfacao` no dict de cada semana |
| `frontend-react/src/.../types.ts` | Frontend | `+satisfacao?: number \| null` em `EvolucaoSemana` |
| `frontend-react/src/.../constants.ts` | Frontend | `'taxa_acerto'` → `'satisfacao'` |
| `frontend-react/src/.../EvolutionChart.tsx` | Frontend | Tipo, estado, leitura, labels, título |
| `frontend-react/dist/` | Build | Rebuild obrigatório |

**Nenhuma migration de banco necessária.** O campo `avaliacao` (correto/parcial/incorreto) permanece intacto.
