import { useState, useCallback } from 'react'
import { FileText } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentDialog } from '@/components/layout/ContentDialog'
import { ChatPanel } from '@/components/layout/ChatPanel'
import { ContentArea } from '@/components/layout/ContentArea'
import { FeedbackStarsCard } from '@/components/shared/FeedbackStarsCard'
import { FeedbackGateModal } from '@/components/shared/FeedbackGateModal'
import { useFeedbackGate } from '@/hooks/useFeedbackGate'

import { useRelatorioCumprimento } from './hooks/useRelatorioCumprimento'
import {
  HistoricoSheet,
  FormularioEntrada,
  ErroAlert,
  PipelineProcessamento,
  ResumoGerado,
  HistoricoRecente,
  DocumentContent,
  HeaderActions,
} from './components/RelatorioSections'

// ============================================================
// Componente principal — composicao fina usando hook e subcomponentes
// ============================================================

export function RelatorioCumprimentoPage() {
  const vm = useRelatorioCumprimento()

  // Feedback gate — blocks download/copy/export until user rates
  const gate = useFeedbackGate(vm.geracaoId)

  // Local submitting state for the gate modal feedback card
  const [gateSubmitting, setGateSubmitting] = useState(false)

  /** Shared handler for feedback submission (used by both inline card and gate modal) */
  const handleFeedbackSubmit = useCallback(
    async (data: { nota: number; comentario: string | null }) => {
      await vm.handleEnviarFeedback(data)
      gate.markAsRated()
    },
    [vm, gate],
  )

  /** Handler specifically for the gate modal (also calls onFeedbackDone to execute pending action) */
  const handleGateFeedbackSubmit = useCallback(
    async (data: { nota: number; comentario: string | null }) => {
      setGateSubmitting(true)
      try {
        await vm.handleEnviarFeedback(data)
        gate.onFeedbackDone()
      } finally {
        setGateSubmitting(false)
      }
    },
    [vm, gate],
  )

  // Sync: if feedback was already sent (loaded from server), mark the gate as rated
  if (vm.feedbackEnviado && !gate.hasFeedback) {
    gate.markAsRated()
  }

  return (
    <>
      {/* ============================================================ */}
      {/* BREADCRUMB BAR — subordinada ao Header global                */}
      {/* ============================================================ */}
      <BreadcrumbBar
        title="Relatorio de Cumprimento"
        icon={<FileText className="w-3.5 h-3.5" />}
        maxWidthClass="max-w-4xl"
        actions={
          <HistoricoSheet
            historico={vm.historico}
            onCarregarHistorico={vm.handleCarregarHistorico}
          />
        }
      />

      {/* ============================================================ */}
      {/* CONTEUDO PRINCIPAL                                           */}
      {/* ============================================================ */}
      <ContentArea maxWidthClass="max-w-4xl">
        <div className="space-y-6">
          {/* Card de Entrada — Numero do Processo */}
          <FormularioEntrada vm={vm} />

          {/* Alerta de Erro */}
          {vm.erro && (
            <ErroAlert
              erro={vm.erro}
              onLimpar={() => {
                vm.setErro(null)
                vm.setPageState('idle')
              }}
            />
          )}

          {/* Pipeline de Processamento (visivel durante streaming) */}
          {(vm.pageState === 'streaming' || vm.pageState === 'error') && (
            <PipelineProcessamento vm={vm} />
          )}

          {/* Botao para reabrir relatorio (quando completed mas dialog fechado) */}
          {vm.pageState === 'completed' && vm.relatorioMarkdown && !vm.showEditor && (
            <ResumoGerado vm={vm} />
          )}

          {/* Historico Recente (visivel no estado idle) */}
          {vm.pageState === 'idle' && (
            <HistoricoRecente
              historico={vm.historico}
              onCarregarHistorico={vm.handleCarregarHistorico}
            />
          )}
        </div>
      </ContentArea>

      {/* ============================================================ */}
      {/* CONTENT DIALOG — Visualizacao do relatorio gerado            */}
      {/* ============================================================ */}
      <ContentDialog
        open={vm.showEditor}
        onOpenChange={(open) => {
          vm.setShowEditor(open)
        }}
        title="Relatorio de Cumprimento"
        subtitle={vm.processoSubtitle}
        icon={<FileText className="h-5 w-5 text-white" />}
        headerActions={<HeaderActions vm={vm} guardAction={gate.guardAction} />}
        documentContent={<DocumentContent vm={vm} />}
        chatPanel={
          <ChatPanel
            messages={vm.chatMessages}
            inputValue={vm.chatInput}
            onInputChange={vm.setChatInput}
            onSend={vm.handleEditarRelatorio}
            isSending={vm.chatEditando}
            placeholder="Ex: Adicione mais detalhes sobre o transito em julgado..."
            title="Assistente de Edicao"
            subtitle="Solicite alteracoes no relatorio"
          />
        }
        feedbackSection={
          <FeedbackStarsCard
            onSubmit={handleFeedbackSubmit}
            isSubmitting={vm.enviandoFeedback}
            isSubmitted={vm.feedbackEnviado}
          />
        }
      />

      {/* ============================================================ */}
      {/* FEEDBACK GATE MODAL — blocks actions until rated             */}
      {/* ============================================================ */}
      <FeedbackGateModal
        open={gate.gateOpen}
        onOpenChange={(open) => {
          if (!open) {
            // User cannot dismiss without submitting — do nothing
          }
        }}
        onFeedbackSubmit={handleGateFeedbackSubmit}
        isSubmitting={gateSubmitting}
        pendingActionLabel="download"
      />
    </>
  )
}
