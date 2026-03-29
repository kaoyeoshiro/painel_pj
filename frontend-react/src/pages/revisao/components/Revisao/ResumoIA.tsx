/**
 * Banner de resumo da IA no topo da página de revisão individual.
 * Exibe o resumo gerado pela IA e os badges de classificação do item.
 */

import { C } from '@/lib/designTokens'
import {
  RESULTADO_CONFIG,
  URGENCIA_CONFIG,
  CONFIANCA_CONFIG,
} from '../../constants'
import type { ItemRevisao } from '../../types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ResumoIAProps {
  item: ItemRevisao
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Badge inline com cor dinâmica baseada em config */
function ConfigBadge({
  value,
  config,
  label,
}: {
  value: string | null | undefined
  config: Record<string, { label: string; color: string }>
  label?: string
}) {
  if (!value) return null
  const cfg = config[value]
  const displayLabel = label ?? cfg?.label ?? value

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{
        color: cfg?.color ?? C.gray400,
        background: `${cfg?.color ?? C.gray400}28`,
        border: `1px solid ${cfg?.color ?? C.gray400}40`,
      }}
    >
      {displayLabel}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Banner azul-escuro com gradiente exibido no topo da página de revisão.
 * Lado esquerdo: resumo da IA. Lado direito: badges de classificação.
 */
export function ResumoIA({ item }: ResumoIAProps) {
  const classificacao = item.classificacao_data

  return (
    <div
      className="flex-shrink-0 flex items-start gap-6 px-5 py-3.5"
      style={{
        background: 'linear-gradient(135deg, #1e3a5f, #2c5282)',
        color: 'white',
      }}
    >
      {/* Lado esquerdo: resumo */}
      <div className="flex-1 min-w-0">
        <p
          className="text-xs font-semibold uppercase tracking-wider mb-1 opacity-70"
        >
          Resumo da IA
        </p>
        <p className="text-sm leading-relaxed opacity-90 line-clamp-3">
          {item.resumo_revisor ?? 'Nenhum resumo disponível para este item.'}
        </p>
      </div>

      {/* Lado direito: badges de classificação */}
      <div
        className="flex-shrink-0 rounded-xl p-3 flex flex-col gap-2"
        style={{ background: 'rgba(255,255,255,0.10)', minWidth: 200 }}
      >
        {/* Resultado */}
        {item.resultado && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs opacity-60">Resultado</span>
            <ConfigBadge value={item.resultado} config={RESULTADO_CONFIG} />
          </div>
        )}

        {/* Ação sugerida */}
        {item.acao_sugerida && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs opacity-60">Ação</span>
            <span
              className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: 'rgba(255,255,255,0.15)', color: 'white' }}
            >
              {item.acao_sugerida}
            </span>
          </div>
        )}

        {/* Urgência */}
        {classificacao?.urgencia && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs opacity-60">Urgência</span>
            <ConfigBadge value={classificacao.urgencia} config={URGENCIA_CONFIG} />
          </div>
        )}

        {/* Confiança */}
        {classificacao?.confianca && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs opacity-60">Confiança</span>
            <ConfigBadge value={classificacao.confianca} config={CONFIANCA_CONFIG} />
          </div>
        )}
      </div>
    </div>
  )
}
