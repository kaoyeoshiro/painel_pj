/**
 * Pagina do Gerador de Pecas Juridicas.
 *
 * Composicao fina: orquestra o hook principal e delega a renderizacao
 * para os subcomponentes de cada estado da pagina e modais.
 */

import { useState, useCallback } from 'react'
import { Scale, Clock, Download, Copy, RotateCcw, Loader2 } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentDialog } from '@/components/layout/ContentDialog'
import { ChatPanel } from '@/components/layout/ChatPanel'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { C, FONT_DOC } from '@/lib/designTokens'
import { FeedbackStarsCard } from '@/components/shared/FeedbackStarsCard'
import { FeedbackGateModal } from '@/components/shared/FeedbackGateModal'
import { useFeedbackGate } from '@/hooks/useFeedbackGate'
import { geradorApi } from '@/lib/api'

import { useGeradorPecas } from './hooks/useGeradorPecas'
import { FormSection } from './components/FormSection'
import { CuradoriaPreview } from './components/CuradoriaPreview'
import { HistorySidebar } from './components/HistorySidebar'
import {
  ProgressModal,
  ParecerDialog,
  FeedbackDialog,
  VersionHistoryDialog,
} from './components/GeradorModals'

// ============================================================================
// Componente principal
// ============================================================================

export function GeradorPecasPage() {
  const h = useGeradorPecas()
  const { toast } = useToast()

  // --- Feedback gate: guards download/copy until user rates ---
  const {
    hasFeedback,
    gateOpen,
    guardAction,
    onFeedbackDone,
    markAsRated,
  } = useFeedbackGate(h.geracaoId)

  const [isFeedbackSubmitting, setIsFeedbackSubmitting] = useState(false)
  const [isFeedbackSubmitted, setIsFeedbackSubmitted] = useState(false)

  const submitFeedback = useCallback(
    async (data: { nota: number; comentario: string | null }) => {
      if (!h.geracaoId) return
      setIsFeedbackSubmitting(true)
      try {
        await geradorApi.post('/feedback', {
          geracao_id: h.geracaoId,
          nota: data.nota,
          comentario: data.comentario,
        })
        setIsFeedbackSubmitted(true)
        markAsRated()
        toast({ title: 'Sucesso', description: 'Avaliacao enviada! Obrigado.' })
      } catch (error) {
        toast({
          title: 'Erro',
          description: (error as Error).message || 'Falha ao enviar avaliacao',
          variant: 'destructive',
        })
      } finally {
        setIsFeedbackSubmitting(false)
      }
    },
    [h.geracaoId, markAsRated, toast],
  )

  const handleGateFeedback = useCallback(
    async (data: { nota: number; comentario: string | null }) => {
      if (!h.geracaoId) return
      setIsFeedbackSubmitting(true)
      try {
        await geradorApi.post('/feedback', {
          geracao_id: h.geracaoId,
          nota: data.nota,
          comentario: data.comentario,
        })
        toast({ title: 'Sucesso', description: 'Avaliacao enviada! Obrigado.' })
        onFeedbackDone()
      } catch (error) {
        toast({
          title: 'Erro',
          description: (error as Error).message || 'Falha ao enviar avaliacao',
          variant: 'destructive',
        })
      } finally {
        setIsFeedbackSubmitting(false)
      }
    },
    [h.geracaoId, onFeedbackDone, toast],
  )

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col overflow-hidden">

        {/* Breadcrumb */}
        <BreadcrumbBar
          title="Gerador de Pecas"
          icon={<Scale className="h-3.5 w-3.5" />}
          className="flex-shrink-0"
          actions={
            <button
              onClick={() => h.setShowSidebar(!h.showSidebar)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors"
              style={{
                color: h.showSidebar ? C.text900 : C.text500,
                background: h.showSidebar ? C.gray100 : 'transparent',
              }}
              onMouseEnter={(e) => { if (!h.showSidebar) e.currentTarget.style.background = C.gray100 }}
              onMouseLeave={(e) => { if (!h.showSidebar) e.currentTarget.style.background = 'transparent' }}
            >
              <Clock className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Historico</span>
            </button>
          }
        />

        {/* Conteudo principal */}
        <div className="mx-auto w-full max-w-pge flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-10">

          {/* Estado: Formulario (idle / streaming / erro) */}
          {(h.pageState === 'idle' || h.isFormDisabled) && h.pageState !== 'curadoria_preview' && h.pageState !== 'resultado' && h.pageState !== 'editando' && (
            <FormSection h={h} />
          )}

          {/* Estado: Curadoria (preview de modulos) */}
          {h.pageState === 'curadoria_preview' && (
            <CuradoriaPreview
              curadoriaModulos={h.curadoriaModulos}
              curadoriaSelected={h.curadoriaSelected}
              curadoriaManualIds={h.curadoriaManualIds}
              curadoriaAvailableModulos={h.curadoriaAvailableModulos}
              isLoadingAvailable={h.isLoadingAvailable}
              curadoriaSearchResults={h.curadoriaSearchResults}
              isSearching={h.isSearching}
              toggleModulo={h.toggleModulo}
              addManualModulo={h.addManualModulo}
              removeModulo={h.removeModulo}
              searchModulos={h.searchModulos}
              gerarComCuradoria={h.gerarComCuradoria}
              voltarParaInicio={h.voltarParaInicio}
            />
          )}
        </div>

        {/* ============================================================ */}
        {/* CONTENT DIALOG — Resultado da geracao (modal com X)          */}
        {/* ============================================================ */}
        <ContentDialog
          open={h.showResultDialog}
          onOpenChange={(open) => {
            if (!open) h.fecharResultDialog()
          }}
          title={h.isStreamingContent
            ? 'Gerando Peca...'
            : (h.tipoPecaResultado || 'Peca Juridica')
          }
          subtitle={h.isStreamingContent
            ? (h.numeroCNJ_raw ? `${h.numeroCNJ_raw} \u2014 Redigindo em tempo real` : 'Redigindo em tempo real')
            : (h.numeroCNJ_raw || undefined)
          }
          icon={h.isStreamingContent
            ? <Loader2 className="h-5 w-5 animate-spin text-white" />
            : <Scale className="h-5 w-5 text-white" />
          }
          headerActions={
            <>
              <Button
                onClick={() => guardAction(h.exportarDocx)}
                size="sm"
                disabled={h.isStreamingContent}
                className="text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <Download className="mr-2 h-4 w-4" /> DOCX
              </Button>
              <Button
                onClick={() => guardAction(h.copiarMinuta)}
                size="sm"
                disabled={h.isStreamingContent}
                className="text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
              <Button
                onClick={h.abrirHistoricoVersoes}
                size="sm"
                disabled={h.isStreamingContent}
                className="text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <RotateCcw className="mr-2 h-4 w-4" /> Versoes
              </Button>
            </>
          }
          documentContent={
            <div
              className="prose-legal max-w-none"
              style={{ fontFamily: FONT_DOC }}
              dangerouslySetInnerHTML={{ __html: h.minutaHtml }}
            />
          }
          chatPanel={
            <ChatPanel
              messages={h.chatMessages}
              inputValue={h.chatInput}
              onInputChange={h.setChatInput}
              onSend={h.enviarMensagemChat}
              isSending={h.isSendingChat || h.isStreamingContent}
              placeholder={h.isStreamingContent ? 'Aguarde a geracao finalizar...' : 'Descreva a alteracao desejada...'}
              title="Assistente de Edicao"
              subtitle={h.isStreamingContent ? 'Disponivel apos a geracao' : 'Solicite alteracoes na peca'}
            />
          }
          feedbackSection={
            !hasFeedback && h.geracaoId ? (
              <FeedbackStarsCard
                onSubmit={submitFeedback}
                isSubmitting={isFeedbackSubmitting}
                isSubmitted={isFeedbackSubmitted}
              />
            ) : undefined
          }
        />

        {/* Feedback gate modal — blocks download/copy until rated */}
        <FeedbackGateModal
          open={gateOpen}
          onOpenChange={() => {/* controlled by gate hook — no-op */}}
          onFeedbackSubmit={handleGateFeedback}
          isSubmitting={isFeedbackSubmitting}
          pendingActionLabel="download"
        />

        {/* Sidebar de historico */}
        <HistorySidebar
          show={h.showSidebar}
          onClose={() => h.setShowSidebar(false)}
          historico={h.historico}
          isLoading={h.isLoadingHistorico}
          onCarregar={h.carregarDoHistorico}
          onExcluir={h.excluirDoHistorico}
        />

        {/* Modais */}
        <ProgressModal
          open={h.isStreaming}
          onCancel={h.voltarParaInicio}
          agentStatuses={h.agentStatuses}
          progressMessage={h.progressMessage}
        />

        <ParecerDialog
          open={h.showParecerDialog}
          onOpenChange={h.setShowParecerDialog}
          parecerFile={h.parecerFile}
          onParecerFileChange={h.setParecerFile}
          isUploading={h.isUploadingParecer}
          onUpload={h.handleParecerUpload}
          onContinuarSem={h.handleContinuarSemParecer}
        />

        <FeedbackDialog
          open={h.showFeedback}
          onOpenChange={h.setShowFeedback}
          nota={h.feedbackNota}
          onNotaChange={h.setFeedbackNota}
          comentario={h.feedbackComentario}
          onComentarioChange={h.setFeedbackComentario}
          onEnviar={h.enviarFeedback}
        />

        <VersionHistoryDialog
          open={h.showVersionHistory}
          onOpenChange={h.setShowVersionHistory}
          versionList={h.versionList}
          onRestaurar={h.restaurarVersao}
        />

      </div>
    </TooltipProvider>
  )
}
