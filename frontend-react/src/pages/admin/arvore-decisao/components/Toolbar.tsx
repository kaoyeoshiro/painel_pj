/**
 * Toolbar da árvore de decisão.
 * Contém filtros (grupo, tipo peça, busca) e controles (órfãs, expandir, colapsar, exportar).
 */

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { GroupSelector } from '@/components/ui/GroupSelector'
import { Search, Maximize2, Minimize2, Download, Eye, EyeOff } from 'lucide-react'
import { useArvoreStore } from '../store/useArvoreStore'
import { C } from '@/lib/designTokens'

interface TipoPeca {
  id: number
  nome: string
  titulo: string
}

interface ToolbarProps {
  tiposPeca: TipoPeca[]
  onExport: () => void
}

export function Toolbar({ tiposPeca, onExport }: ToolbarProps) {
  const {
    grupoId, tipoPecaId, searchTerm, showOrphans, data,
    setGrupoId, setTipoPecaId, setSearchTerm, setShowOrphans,
    expandAll, collapseAll,
  } = useArvoreStore()

  const orphanCount = data?.stats.total_orfas ?? 0

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }, [setSearchTerm])

  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.gray200}`, background: '#fff' }}>
      {/* Título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text700, margin: 0 }}>
          Árvore de Decisão
        </h1>
        {data && (
          <span style={{ fontSize: 12, color: C.text400 }}>
            {data.stats.total_modulos} módulos · {data.stats.total_variaveis} variáveis · {data.stats.total_vinculos} vínculos
          </span>
        )}
      </div>

      {/* Filtros + Controles */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Grupo */}
        <GroupSelector
          selectedGroupId={grupoId}
          onGroupChange={(id) => setGrupoId(id)}
        />

        {/* Tipo de Peça */}
        <Select
          value={tipoPecaId ? String(tipoPecaId) : 'all'}
          onValueChange={(v) => setTipoPecaId(v === 'all' ? null : Number(v))}
        >
          <SelectTrigger style={{ width: 180 }}>
            <SelectValue placeholder="Tipo de Peça" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tiposPeca.map((tp) => (
              <SelectItem key={tp.id} value={String(tp.id)}>{tp.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Busca */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
          <Search style={{ position: 'absolute', left: 8, top: 8, width: 16, height: 16, color: C.text400 }} />
          <Input
            placeholder="Buscar variável, módulo ou pergunta..."
            value={searchTerm}
            onChange={handleSearch}
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* Separador */}
        <div style={{ width: 1, height: 28, background: C.gray200 }} />

        {/* Toggle Órfãs */}
        <Button
          variant={showOrphans ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowOrphans(!showOrphans)}
        >
          {showOrphans ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          Órfãs
          <Badge variant="secondary" className="ml-1">{orphanCount}</Badge>
        </Button>

        {/* Expandir/Colapsar */}
        <Button variant="outline" size="sm" onClick={expandAll}>
          <Maximize2 className="h-4 w-4 mr-1" /> Expandir
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          <Minimize2 className="h-4 w-4 mr-1" /> Colapsar
        </Button>

        {/* Exportar */}
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-1" /> PNG
        </Button>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: C.text400 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#22c55e', marginRight: 4 }} />Determinístico</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#8b5cf6', marginRight: 4 }} />LLM</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(250, 204, 21, 0.6)', marginRight: 4 }} />Condição</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(59, 130, 246, 0.4)', marginRight: 4 }} />Variável</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px dashed rgba(251, 146, 60, 0.5)', marginRight: 4 }} />Órfã</span>
      </div>
    </div>
  )
}
