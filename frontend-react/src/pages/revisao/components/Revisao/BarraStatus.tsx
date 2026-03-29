/**
 * Barra de status e ações da página de revisão individual.
 * Exibe o status atual do item, o revisor atribuído e os botões de ação
 * disponíveis conforme o status e o perfil do usuário.
 */

import { Button } from '@/components/ui/button'
import { C } from '@/lib/designTokens'
import { STATUS_CONFIG, OBS_STATUS_CONFIG } from '../../constants'
import type { ItemRevisao } from '../../types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BarraStatusProps {
  item: ItemRevisao
  isAdmin: boolean
  onAprovar: () => void
  onRejeitar: () => void
  onEncaminhar: () => void
  onMarcarInserido: () => void
  onIniciarRevisao: () => void
  onBaixarDocx?: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Badge de status baseado em STATUS_CONFIG */
function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status]
  if (!cfg) return <span className="text-xs text-gray-500">{status}</span>

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold"
      style={{ color: cfg.color, background: cfg.bgColor }}
    >
      {cfg.label}
    </span>
  )
}

/** Badge de obs_status (aguardando inserção, inserido) */
function ObsStatusBadge({ obsStatus }: { obsStatus: string | null }) {
  if (!obsStatus) return null
  const cfg = OBS_STATUS_CONFIG[obsStatus]
  if (!cfg) return null

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ color: cfg.color, background: `${cfg.color}18`, border: `1px solid ${cfg.color}30` }}
    >
      {cfg.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Barra cinza exibida abaixo do banner de resumo da IA.
 * O conjunto de ações muda conforme o status do item e se o usuário é admin.
 */
export function BarraStatus({
  item,
  isAdmin,
  onAprovar,
  onRejeitar,
  onEncaminhar,
  onMarcarInserido,
  onIniciarRevisao,
  onBaixarDocx,
}: BarraStatusProps) {
  const atribuidoNome = item.revisor_nome ?? item.encaminhado_nome

  return (
    <div
      className="flex-shrink-0 flex items-center justify-between gap-4 px-5 py-2.5 border-b"
      style={{ background: C.gray50, borderColor: C.gray200 }}
    >
      {/* Lado esquerdo: status + atribuição + obs */}
      <div className="flex items-center gap-3 flex-wrap">
        <StatusBadge status={item.status} />

        {atribuidoNome && (
          <span className="text-sm" style={{ color: C.text500 }}>
            Atribuído a:{' '}
            <span className="font-medium" style={{ color: C.text700 }}>
              {atribuidoNome}
            </span>
          </span>
        )}

        <ObsStatusBadge obsStatus={item.obs_status} />
      </div>

      {/* Lado direito: botões de ação */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <AcoesStatus
          status={item.status}
          isAdmin={isAdmin}
          onAprovar={onAprovar}
          onRejeitar={onRejeitar}
          onEncaminhar={onEncaminhar}
          onMarcarInserido={onMarcarInserido}
          onIniciarRevisao={onIniciarRevisao}
          onBaixarDocx={onBaixarDocx}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Botões de ação por status
// ---------------------------------------------------------------------------

interface AcoesStatusProps {
  status: string
  isAdmin: boolean
  onAprovar: () => void
  onRejeitar: () => void
  onEncaminhar: () => void
  onMarcarInserido: () => void
  onIniciarRevisao: () => void
  onBaixarDocx?: () => void
}

function AcoesStatus({
  status,
  isAdmin,
  onAprovar,
  onRejeitar,
  onEncaminhar,
  onMarcarInserido,
  onIniciarRevisao,
  onBaixarDocx,
}: AcoesStatusProps) {
  if (status === 'pendente') {
    return (
      <Button
        size="sm"
        onClick={onIniciarRevisao}
        className="text-xs"
        style={{ background: C.navy700, color: 'white' }}
      >
        Iniciar Revisão
      </Button>
    )
  }

  if (status === 'em_revisao') {
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

  if (status === 'aprovado' || status === 'encaminhado') {
    return (
      <>
        <Button
          size="sm"
          onClick={onMarcarInserido}
          className="text-xs"
          style={{ background: C.statusSuccess, color: 'white' }}
        >
          Marcar como Inserido
        </Button>

        {onBaixarDocx && (
          <Button
            size="sm"
            variant="outline"
            onClick={onBaixarDocx}
            className="text-xs border"
            style={{ borderColor: C.navy600, color: C.navy600 }}
          >
            Baixar DOCX
          </Button>
        )}
      </>
    )
  }

  if (status === 'concluido') {
    return (
      <span
        className="text-xs font-medium px-2.5 py-1 rounded-full"
        style={{ color: '#3730a3', background: '#eef2ff' }}
      >
        Concluído
      </span>
    )
  }

  return null
}
