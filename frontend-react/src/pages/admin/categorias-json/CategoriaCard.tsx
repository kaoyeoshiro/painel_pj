/**
 * Card individual de categoria JSON.
 * Exibe titulo, badges, code pills, preview JSON e acoes.
 */

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { C } from '@/lib/designTokens'
import type { CategoriaJSON } from './types'

interface CategoriaCardProps {
  categoria: CategoriaJSON
  onEdit: (id: number) => void
  onDeactivate: (id: number, titulo: string) => void
}

const MAX_PILLS = 10

export function CategoriaCard({ categoria, onEdit, onDeactivate }: CategoriaCardProps) {
  const [jsonExpanded, setJsonExpanded] = useState(false)

  const isInactive = !categoria.ativo
  const codigos = categoria.codigos_documento || []
  const overflowCount = codigos.length > MAX_PILLS ? codigos.length - MAX_PILLS : 0

  /** Formata o JSON para preview */
  const formatJson = (): string => {
    try {
      const parsed = JSON.parse(categoria.formato_json)
      return JSON.stringify(parsed, null, 2)
    } catch {
      return categoria.formato_json
    }
  }

  return (
    <Card
      className="rounded-2xl p-4 flex flex-col h-full"
      style={{
        borderColor: isInactive ? C.errorBorderLight : C.gray200,
        backgroundColor: isInactive ? C.errorBgLight : undefined,
      }}
      data-testid={`categoria-card-${categoria.id}`}
    >
      {/* Titulo + badges */}
      <div className="mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-base" style={{ color: C.text900 }}>
            {categoria.titulo}
          </h3>
          {categoria.json_gerado_por_ia && (
            <Badge className="bg-indigo-100 text-indigo-700 border-transparent text-[10px]">
              GERADO POR IA
            </Badge>
          )}
          {categoria.is_residual && (
            <Badge className="bg-purple-100 text-purple-700 border-transparent text-[10px]">
              RESIDUAL
            </Badge>
          )}
          {isInactive && (
            <Badge variant="destructive" className="text-[10px]">
              INATIVO
            </Badge>
          )}
        </div>
        <p className="text-xs font-mono mt-0.5" style={{ color: C.text400 }}>
          {categoria.nome}
        </p>
      </div>

      {/* Descricao */}
      {categoria.descricao && (
        <p className="text-sm mb-3" style={{ color: C.text500 }}>
          {categoria.descricao}
        </p>
      )}

      {/* Source type */}
      {categoria.usa_fonte_especial && (
        <p className="text-xs mb-2" style={{ color: C.text400 }}>
          Fonte especial: <span className="font-mono">{categoria.source_special_type}</span>
        </p>
      )}

      {/* Code pills */}
      {codigos.length > 0 && (
        <div className="mb-3">
          <div className="text-xs mb-1" style={{ color: C.text400 }}>Codigos:</div>
          <div className="flex gap-1 flex-wrap">
            {codigos.slice(0, MAX_PILLS).map(codigo => (
              <span
                key={codigo}
                className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700 font-mono"
              >
                {codigo}
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-500">
                +{overflowCount} mais
              </span>
            )}
          </div>
        </div>
      )}

      {/* JSON preview expansivel */}
      {categoria.formato_json && (
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setJsonExpanded(!jsonExpanded)}
            className="flex items-center gap-1 text-xs transition-colors"
            style={{ color: C.navy700 }}
            data-testid={`btn-toggle-json-${categoria.id}`}
          >
            {jsonExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            Formato JSON
          </button>
          {jsonExpanded && (
            <pre
              className="mt-1 p-3 bg-gray-50 rounded-lg text-xs font-mono overflow-x-auto max-h-48 overflow-y-auto border"
              style={{ borderColor: C.gray200 }}
            >
              {formatJson()}
            </pre>
          )}
        </div>
      )}

      {/* Acoes */}
      <div className="flex gap-2 mt-auto pt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(categoria.id)}
          className="flex-1"
          data-testid={`btn-editar-${categoria.id}`}
        >
          Editar
        </Button>
        {!categoria.is_residual && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDeactivate(categoria.id, categoria.titulo)}
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
            data-testid={`btn-desativar-${categoria.id}`}
          >
            Desativar
          </Button>
        )}
      </div>
    </Card>
  )
}
