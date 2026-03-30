/**
 * Card colapsável que agrupa itens de revisão por assessor.
 * Mostra avatar, nome, contagem de itens e tempo do mais antigo.
 */

import { useState } from 'react'
import { C } from '@/lib/designTokens'
import { URGENCIA_CONFIG } from '../../constants'
import type { ItemRevisao } from '../../types'

interface CardAssessorProps {
  nome: string
  itens: ItemRevisao[]
  onItemClick: (item: ItemRevisao) => void
  defaultExpanded?: boolean
}

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

export function CardAssessor({ nome, itens, onItemClick, defaultExpanded = false }: CardAssessorProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const iniciais = getIniciais(nome)
  const avatarColor = getAvatarColor(nome)
  const oldest = maisAntigo(itens)
  const count = itens.length

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
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
        style={{ background: C.gray50, borderBottom: expanded ? `1px solid ${C.gray200}` : 'none' }}
        onClick={() => count > 0 && setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
            style={{ background: avatarColor }}
          >
            {iniciais}
          </div>
          <span className="font-semibold text-sm" style={{ color: C.text900 }}>
            {nome}
          </span>
          <span
            className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
            style={{ background: badgeBg, color: badgeColor }}
          >
            {count} {count === 1 ? 'item' : 'itens'}
          </span>
          {count > 0 && (
            <span className="text-xs font-medium" style={{ color: oldest.cor }}>
              · mais antigo: {oldest.texto}
            </span>
          )}
        </div>
        {count > 0 && (
          <span className="text-xs" style={{ color: C.gray400 }}>
            {expanded ? '▼' : '▶'}
          </span>
        )}
      </button>

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
