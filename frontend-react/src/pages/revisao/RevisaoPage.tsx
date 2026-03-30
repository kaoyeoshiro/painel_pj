/**
 * Página principal do Sistema de Revisão de Peças.
 * Exibe a fila de itens aguardando revisão com estatísticas, filtros e tabela.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { useAuthStore } from '@/stores/auth-store'
import { C } from '@/lib/designTokens'

import { useFilaRevisao } from './hooks/useFilaRevisao'
import { EstatisticasCards } from './components/FilaRevisao/EstatisticasCards'
import { FiltrosRevisao } from './components/FilaRevisao/FiltrosRevisao'
import { TabelaItens } from './components/FilaRevisao/TabelaItens'
import { CardAssessor } from './components/FilaRevisao/CardAssessor'
import { fetchAssessores } from './api'
import type { ItemRevisao, Assessor } from './types'

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
  concluidos_7d: 0,
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
    periodo,
    setPeriodo,
    ordenarPor,
    setOrdenarPor,
    ordem,
    setOrdem,
  } = useFilaRevisao()

  const [assessores, setAssessores] = useState<Assessor[]>([])

  useEffect(() => {
    if (tab === 'assessores') {
      fetchAssessores().then(setAssessores).catch(() => setAssessores([]))
    }
  }, [tab])

  const handleItemClick = (item: ItemRevisao) => {
    void navigate({ to: '/revisao/$itemId', params: { itemId: String(item.id) } })
  }

  const itensAgrupados = tab === 'assessores'
    ? (() => {
        const groups: Record<string, { nome: string; itens: ItemRevisao[] }> = {}
        for (const a of assessores) {
          if (a.ativo) {
            groups[String(a.usuario_id)] = { nome: a.nome, itens: [] }
          }
        }
        for (const item of itens) {
          const uid = String(item.usuario_encaminhado_id)
          if (groups[uid]) {
            groups[uid].itens.push(item)
          } else if (item.encaminhado_nome) {
            groups[uid] = { nome: item.encaminhado_nome, itens: [item] }
          }
        }
        return Object.values(groups).sort((a, b) => b.itens.length - a.itens.length)
      })()
    : []

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
          periodo={periodo}
          setPeriodo={setPeriodo}
          isAdmin={isAdmin}
        />

        {/* Conteúdo: tabela ou cards por assessor */}
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
            ordenarPor={ordenarPor}
            ordem={ordem}
            onSort={(campo) => {
              if (ordenarPor === campo) {
                setOrdem(ordem === 'asc' ? 'desc' : 'asc')
              } else {
                setOrdenarPor(campo)
                setOrdem('asc')
              }
            }}
          />
        )}
      </ContentArea>
    </>
  )
}
