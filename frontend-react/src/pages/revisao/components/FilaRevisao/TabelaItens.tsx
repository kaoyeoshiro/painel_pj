/**
 * Tabela de itens da fila de revisão.
 * Cada linha é clicável e direciona para a página de revisão do item.
 */

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { C } from '@/lib/designTokens'
import {
  STATUS_CONFIG,
  URGENCIA_CONFIG,
  CONFIANCA_CONFIG,
  RESULTADO_CONFIG,
  formatarData,
} from '../../constants'
import type { ItemRevisao } from '../../types'

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface TabelaItensProps {
  itens: ItemRevisao[]
  loading: boolean
  onItemClick: (item: ItemRevisao) => void
  ordenarPor?: string
  ordem?: string
  onSort?: (campo: string) => void
}

// ---------------------------------------------------------------------------
// Helpers visuais
// ---------------------------------------------------------------------------

/** Badge de cor baseado em config (label + color) */
function ConfigBadge({
  value,
  config,
}: {
  value: string | null | undefined
  config: Record<string, { label: string; color: string; bgColor?: string }>
}) {
  if (!value) return <span style={{ color: C.gray400 }}>—</span>

  const cfg = config[value]
  if (!cfg) {
    return (
      <span
        className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ color: C.gray600, background: C.gray100 }}
      >
        {value}
      </span>
    )
  }

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        color: cfg.color,
        background: cfg.bgColor ?? `${cfg.color}18`,
      }}
    >
      {cfg.label}
    </span>
  )
}

/** Badge simples (apenas cor como dot + texto) */
function ColorDotBadge({
  value,
  config,
}: {
  value: string | null | undefined
  config: Record<string, { label: string; color: string }>
}) {
  if (!value) return <span style={{ color: C.gray400 }}>—</span>

  const cfg = config[value]
  if (!cfg) return <span style={{ color: C.gray500, fontSize: 12 }}>{value}</span>

  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: cfg.color }}>
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: cfg.color }}
      />
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Estado vazio / carregando
// ---------------------------------------------------------------------------

function TabelaPlaceholder({ loading }: { loading: boolean }) {
  return (
    <TableRow>
      <TableCell colSpan={7} className="text-center py-12" style={{ color: C.text400 }}>
        {loading ? 'Carregando...' : 'Nenhum item encontrado para os filtros selecionados.'}
      </TableCell>
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function TabelaItens({ itens, loading, onItemClick, ordenarPor, ordem, onSort }: TabelaItensProps) {
  /** Renderiza header clicável com indicador de ordenação */
  function SortableHead({ campo, children }: { campo: string; children: React.ReactNode }) {
    const isActive = ordenarPor === campo
    const arrow = isActive ? (ordem === 'asc' ? ' ▲' : ' ▼') : ''
    return (
      <TableHead
        className="cursor-pointer select-none hover:bg-gray-50"
        onClick={() => onSort?.(campo)}
      >
        {children}{arrow}
      </TableHead>
    )
  }

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border overflow-hidden"
      style={{ borderColor: C.gray200 }}
    >
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead campo="numero_cnj">Processo</SortableHead>
            <SortableHead campo="acao_sugerida">Ação</SortableHead>
            <SortableHead campo="resultado">Resultado</SortableHead>
            <TableHead>Urgência</TableHead>
            <TableHead>Confiança IA</TableHead>
            <SortableHead campo="status">Status</SortableHead>
            <SortableHead campo="criado_em">Recebido em</SortableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading || itens.length === 0 ? (
            <TabelaPlaceholder loading={loading} />
          ) : (
            itens.map((item) => (
              <TableRow
                key={item.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => onItemClick(item)}
              >
                {/* Número CNJ */}
                <TableCell>
                  <span
                    className="font-mono text-xs"
                    style={{ color: C.navy700 }}
                    title={item.numero_cnj}
                  >
                    {item.numero_cnj.length > 25
                      ? `${item.numero_cnj.slice(0, 25)}…`
                      : item.numero_cnj}
                  </span>
                </TableCell>

                {/* Ação sugerida */}
                <TableCell>
                  {item.acao_sugerida ? (
                    <span className="text-sm" style={{ color: C.text700 }}>
                      {item.acao_sugerida}
                    </span>
                  ) : (
                    <span style={{ color: C.gray400 }}>—</span>
                  )}
                </TableCell>

                {/* Resultado */}
                <TableCell>
                  <ColorDotBadge value={item.resultado} config={RESULTADO_CONFIG} />
                </TableCell>

                {/* Urgência */}
                <TableCell>
                  <ColorDotBadge value={item.classificacao_data?.urgencia} config={URGENCIA_CONFIG} />
                </TableCell>

                {/* Confiança IA */}
                <TableCell>
                  <ColorDotBadge value={item.classificacao_data?.confianca} config={CONFIANCA_CONFIG} />
                </TableCell>

                {/* Status */}
                <TableCell>
                  <ConfigBadge value={item.status} config={STATUS_CONFIG} />
                </TableCell>

                {/* Recebido em */}
                <TableCell>
                  <span className="text-xs" style={{ color: C.text400 }}>
                    {formatarData(item.criado_em)}
                  </span>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
