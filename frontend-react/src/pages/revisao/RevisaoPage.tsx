/**
 * Página principal do Sistema de Revisão de Peças.
 * Exibe a fila de itens aguardando revisão com estatísticas, filtros e tabela.
 */

import { useNavigate } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { useAuthStore } from '@/stores/auth-store'

import { useFilaRevisao } from './hooks/useFilaRevisao'
import { EstatisticasCards } from './components/FilaRevisao/EstatisticasCards'
import { FiltrosRevisao } from './components/FilaRevisao/FiltrosRevisao'
import { TabelaItens } from './components/FilaRevisao/TabelaItens'
import type { ItemRevisao } from './types'

// ---------------------------------------------------------------------------
// Estatísticas padrão (evita null no carregamento inicial)
// ---------------------------------------------------------------------------

const STATS_VAZIO = {
  total: 0,
  pendentes: 0,
  em_revisao: 0,
  aprovados: 0,
  encaminhados: 0,
  rejeitados: 0,
  concluidos: 0,
  aguardando_insercao: 0,
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function RevisaoPage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.is_admin ?? false

  const {
    itens,
    estatisticas,
    loading,
    tab,
    setTab,
    status,
    setStatus,
    urgencia,
    setUrgencia,
    acao,
    setAcao,
  } = useFilaRevisao()

  const handleItemClick = (item: ItemRevisao) => {
    void navigate({ to: '/revisao/$itemId', params: { itemId: String(item.id) } })
  }

  return (
    <>
      <BreadcrumbBar
        title="Fila de Revisão"
        icon={<ClipboardCheck className="w-3.5 h-3.5" />}
      />

      <ContentArea className="space-y-6">
        {/* Cards de estatísticas */}
        <EstatisticasCards
          stats={estatisticas ?? STATS_VAZIO}
          loading={loading}
        />

        {/* Filtros e abas */}
        <FiltrosRevisao
          tab={tab}
          setTab={setTab}
          status={status}
          setStatus={setStatus}
          urgencia={urgencia}
          setUrgencia={setUrgencia}
          acao={acao}
          setAcao={setAcao}
          isAdmin={isAdmin}
        />

        {/* Tabela de itens */}
        <TabelaItens
          itens={itens}
          loading={loading}
          onItemClick={handleItemClick}
        />
      </ContentArea>
    </>
  )
}
