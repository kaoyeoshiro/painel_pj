/**
 * Pagina do Gerador de Pecas Juridicas.
 *
 * Composicao fina: orquestra o hook principal e delega a renderizacao
 * para os subcomponentes de cada estado da pagina e modais.
 */

import { Scale, Sparkles, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { TooltipProvider } from '@/components/ui/tooltip'
import { C } from '@/lib/designTokens'

import { useGeradorPecas } from './hooks/useGeradorPecas'
import { FormSection } from './components/FormSection'
import { CuradoriaPreview } from './components/CuradoriaPreview'
import { ResultadoView } from './components/ResultadoView'
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full flex-col overflow-hidden">

        {/* Breadcrumb */}
        <BreadcrumbBar
          title="Gerador de Pecas"
          icon={<Scale className="h-3.5 w-3.5" />}
          className="flex-shrink-0"
          actions={
            <>
              {(h.pageState === 'resultado' || h.pageState === 'editando') && (
                <button
                  onClick={h.voltarParaInicio}
                  className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white transition-all hover:opacity-90"
                  style={{ background: C.navy950 }}
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Nova Geracao</span>
                </button>
              )}
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
            </>
          }
        />

        {/* Conteudo principal */}
        <div className={cn(
          'mx-auto w-full max-w-pge flex-1 px-4 sm:px-6 lg:px-10',
          (h.pageState === 'resultado' || h.pageState === 'editando') ? 'overflow-hidden py-0' : 'overflow-y-auto py-6',
        )}>

          {/* Estado: Formulario (idle / streaming / erro) */}
          {(h.pageState === 'idle' || h.isFormDisabled) && h.pageState !== 'curadoria_preview' && h.pageState !== 'resultado' && h.pageState !== 'editando' && (
            <FormSection h={h} />
          )}

          {/* Estado: Curadoria (preview de modulos) */}
          {h.pageState === 'curadoria_preview' && (
            <CuradoriaPreview
              curadoriaModulos={h.curadoriaModulos}
              curadoriaSelected={h.curadoriaSelected}
              toggleModulo={h.toggleModulo}
              gerarComCuradoria={h.gerarComCuradoria}
              voltarParaInicio={h.voltarParaInicio}
            />
          )}

          {/* Estado: Resultado + Chat */}
          {(h.pageState === 'resultado' || h.pageState === 'editando') && (
            <ResultadoView h={h} />
          )}
        </div>

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
          streamingContent={h.streamingContent}
          minutaHtml={h.minutaHtml}
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
