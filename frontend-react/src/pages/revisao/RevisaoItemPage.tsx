/**
 * Página de revisão de um item específico.
 * Layout split-panel: banner IA + barra de status + painel esquerdo (editor/detalhes) +
 * painel direito (documentos do TJ-MS).
 */

import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { ClipboardCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { useAuthStore } from '@/stores/auth-store'
import { C } from '@/lib/designTokens'

import { useRevisaoItem } from './hooks/useRevisaoItem'
import { ResumoIA } from './components/Revisao/ResumoIA'
import { BarraStatus } from './components/Revisao/BarraStatus'
import { EncaminharDialog } from './components/Revisao/EncaminharDialog'
import { RejeicaoForm } from './components/Revisao/RejeicaoForm'
import { PainelDocumentos } from './components/Documentos/PainelDocumentos'

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

/**
 * Página de revisão individual com layout de dois painéis.
 * O painel esquerdo exibe o editor de peça (Task 11) ou detalhes do item.
 * O painel direito exibe os documentos vinculados ao processo (Task 13).
 */
export function RevisaoItemPage() {
  // Extrai itemId da URL (TanStack Router)
  const { itemId } = useParams({ strict: false }) as { itemId: string }
  const id = parseInt(itemId, 10)

  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.is_admin ?? false

  // Estado dos dialogs de ação
  const [showEncaminhar, setShowEncaminhar] = useState(false)
  const [showRejeicao, setShowRejeicao] = useState(false)

  const {
    item,
    loading,
    handleIniciarRevisao,
    handleAprovar,
    handleRejeitar,
    handleEncaminhar,
    handleMarcarInserido,
  } = useRevisaoItem(id)

  // ---------------------------------------------------------------------------
  // Handlers de ações da barra de status
  // ---------------------------------------------------------------------------

  const handleAprovarClick = () => {
    const conteudo = item?.conteudo_editado ?? item?.conteudo_peca ?? ''
    void handleAprovar(conteudo)
  }

  const handleEncaminharConfirm = (assessorId: number) => {
    void handleEncaminhar(assessorId)
  }

  const handleRejeitarConfirm = (motivo: string, acao: string) => {
    void handleRejeitar(motivo, acao)
  }

  // ---------------------------------------------------------------------------
  // Estado de carregamento
  // ---------------------------------------------------------------------------

  if (loading && !item) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <span className="text-sm text-gray-400">Carregando item...</span>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-2">
        <span className="text-sm text-gray-500">Item não encontrado.</span>
        <span className="text-xs text-gray-400">ID: {itemId}</span>
      </div>
    )
  }

  const temPeca = Boolean(item.conteudo_peca || item.conteudo_editado)
  const conteudoExibir = item.conteudo_editado ?? item.conteudo_peca

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className="flex flex-col"
      style={{ height: 'calc(100vh - 4rem)', overflow: 'hidden' }}
    >
      {/* Breadcrumb */}
      <BreadcrumbBar
        title={`Revisar — ${item.numero_cnj}`}
        icon={<ClipboardCheck className="w-3.5 h-3.5" />}
        backTo="/revisao"
        fullWidth
        className="flex-shrink-0"
      />

      {/* Banner azul: Resumo da IA */}
      <ResumoIA item={item} />

      {/* Barra cinza: status + ações */}
      <BarraStatus
        item={item}
        isAdmin={isAdmin}
        onAprovar={handleAprovarClick}
        onRejeitar={() => setShowRejeicao(true)}
        onEncaminhar={() => setShowEncaminhar(true)}
        onMarcarInserido={() => void handleMarcarInserido()}
        onIniciarRevisao={() => void handleIniciarRevisao()}
      />

      {/* Corpo split-panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* ---------------------------------------------------------------- */}
        {/* Painel esquerdo: editor de peça ou detalhes                      */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="flex flex-col flex-1 overflow-hidden border-r"
          style={{ borderColor: C.gray200 }}
        >
          {/* Área de conteúdo principal (editor ou detalhes) */}
          <div className="flex-1 overflow-y-auto p-5">
            {temPeca ? (
              /* Placeholder para EditorPeca (Task 11) — exibe conteúdo como texto */
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-3"
                  style={{ color: C.text400 }}
                >
                  Peça gerada
                  {item.conteudo_editado && (
                    <span
                      className="ml-2 normal-case font-normal"
                      style={{ color: C.navy600 }}
                    >
                      (editada)
                    </span>
                  )}
                </p>
                {/* TODO: Task 11 — substituir por <EditorPeca /> com TipTap */}
                <div
                  className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed rounded-lg border p-4"
                  style={{ color: C.text700, borderColor: C.gray200, background: C.gray50 }}
                >
                  {conteudoExibir}
                </div>
              </div>
            ) : (
              /* Sem peça: mostra detalhes da classificação e opção de rejeitar */
              <DetalhesItemSemPeca
                item={item}
                onRejeitar={() => setShowRejeicao(true)}
              />
            )}
          </div>

          {/* Placeholder para ChatRevisao (Task 12) */}
          <div
            className="flex-shrink-0 border-t p-3"
            style={{ borderColor: C.gray200, background: C.gray50 }}
          >
            <p className="text-xs text-center" style={{ color: C.text400 }}>
              {/* TODO: Task 12 — substituir por <ChatRevisao /> */}
              Chat com a IA — disponível em breve
            </p>
          </div>
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Painel direito: documentos do processo                           */}
        {/* ---------------------------------------------------------------- */}
        <div className="flex-1 overflow-hidden">
          <PainelDocumentos itemId={item.id} numeroCnj={item.numero_cnj} />
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Dialogs de ação                                                      */}
      {/* ------------------------------------------------------------------ */}
      <EncaminharDialog
        open={showEncaminhar}
        onClose={() => setShowEncaminhar(false)}
        onEncaminhar={handleEncaminharConfirm}
      />

      <RejeicaoForm
        open={showRejeicao}
        onClose={() => setShowRejeicao(false)}
        onRejeitar={handleRejeitarConfirm}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Subcomponente: detalhes para itens sem peça (ex: nada_a_fazer)
// ---------------------------------------------------------------------------

interface DetalhesItemSemPecaProps {
  item: Parameters<typeof ResumoIA>[0]['item']
  onRejeitar: () => void
}

function DetalhesItemSemPeca({ item, onRejeitar }: DetalhesItemSemPecaProps) {
  const classificacao = item.classificacao_data

  return (
    <div className="space-y-5">
      {/* Fundamentação */}
      {classificacao?.fundamentacao && (
        <section>
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: C.text400 }}
          >
            Fundamentação
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: C.text700 }}>
            {classificacao.fundamentacao}
          </p>
        </section>
      )}

      {/* Análise detalhada */}
      {classificacao?.acao_detalhada && (
        <section>
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: C.text400 }}
          >
            Análise detalhada
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: C.text700 }}>
            {classificacao.acao_detalhada}
          </p>
        </section>
      )}

      {/* Documentos necessários */}
      {classificacao?.documentos_necessarios && classificacao.documentos_necessarios.length > 0 && (
        <section>
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: C.text400 }}
          >
            Documentos necessários
          </h3>
          <ul className="space-y-1">
            {classificacao.documentos_necessarios.map((doc, i) => (
              <li key={i} className="flex items-start gap-2 text-sm" style={{ color: C.text700 }}>
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: C.navy500 }} />
                {doc}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Observação de rejeição (se já foi rejeitado) */}
      {item.motivo_rejeicao && (
        <section
          className="rounded-lg p-4"
          style={{ background: '#fef2f2', border: `1px solid #fecaca` }}
        >
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-1"
            style={{ color: '#991b1b' }}
          >
            Motivo da rejeição
          </h3>
          <p className="text-sm" style={{ color: '#7f1d1d' }}>
            {item.motivo_rejeicao}
          </p>
        </section>
      )}

      {/* Botão para rejeitar / definir ação */}
      {item.status === 'em_revisao' && (
        <div className="pt-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onRejeitar}
            className="text-xs border"
            style={{ borderColor: C.statusError, color: C.statusError }}
          >
            Rejeitar — Definir Ação
          </Button>
        </div>
      )}
    </div>
  )
}
