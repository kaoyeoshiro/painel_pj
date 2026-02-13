import { Button } from '@/components/ui/button'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentDialog } from '@/components/layout/ContentDialog'
import { ContentArea } from '@/components/layout/ContentArea'
import { FeedbackStarsCard } from '@/components/shared/FeedbackStarsCard'
import { FeedbackGateModal } from '@/components/shared/FeedbackGateModal'
import { useFeedbackGate } from '@/hooks/useFeedbackGate'
import { Building2, Download, RotateCw } from 'lucide-react'

import { usePrestacaoContas } from './hooks/usePrestacaoContas'
import {
  Formulario,
  InfoCard,
  Progresso,
  DocumentContent,
  Duvidas,
  DocumentosFaltantes,
  ErroSection,
  HistoricoRecente,
  HistoricoSheet,
  ResumoResultado,
} from './components/PrestacaoSections'
import { ConfirmacaoDialog } from './components/PrestacaoDialogs'

// ============================================================
// Componente principal — composicao fina usando hook e subcomponentes
// ============================================================

export function PrestacaoContasPage() {
  const vm = usePrestacaoContas()

  const {
    gateOpen,
    guardAction,
    onFeedbackDone,
    markAsRated,
  } = useFeedbackGate(vm.geracaoId)

  /** Wraps the inline FeedbackStarsCard submit: calls API then marks as rated */
  const handleInlineFeedback = async (data: { nota: number; comentario: string | null }) => {
    await vm.handleFeedbackSubmit(data)
    markAsRated()
  }

  /** Wraps the gate modal submit: calls API, marks as rated, then runs pending action */
  const handleGateFeedback = async (data: { nota: number; comentario: string | null }) => {
    await vm.handleFeedbackSubmit(data)
    onFeedbackDone()
  }

  return (
    <>
      <BreadcrumbBar
        title="Prestacao de Contas"
        icon={<Building2 className="w-3.5 h-3.5" />}
        maxWidthClass="max-w-4xl"
        actions={<HistoricoSheet vm={vm} />}
      />

      <ContentArea maxWidthClass="max-w-4xl">
        <div className="space-y-6">
          {vm.estadoPagina === 'idle' && (
            <>
              <Formulario
                numeroCNJ={vm.numeroCNJ}
                setNumeroCNJ={vm.setNumeroCNJ}
                estadoPagina={vm.estadoPagina}
                onSubmit={() => void vm.iniciarAnalise()}
              />
              <InfoCard />
              <HistoricoRecente vm={vm} />
            </>
          )}

          {vm.estadoPagina === 'verificando' && (
            <>
              <Formulario
                numeroCNJ={vm.numeroCNJ}
                setNumeroCNJ={vm.setNumeroCNJ}
                estadoPagina={vm.estadoPagina}
                onSubmit={() => void vm.iniciarAnalise()}
              />
              <InfoCard />
            </>
          )}

          {vm.estadoPagina === 'processando' && (
            <Progresso
              etapas={vm.etapas}
              progressoMensagem={vm.progressoMensagem}
              progressoPercent={vm.progressoPercent}
            />
          )}

          {vm.estadoPagina === 'resultado' && !vm.showResultDialog && (
            <ResumoResultado vm={vm} />
          )}

          {vm.estadoPagina === 'duvidas' && (
            <Duvidas
              perguntas={vm.perguntas}
              respostas={vm.respostas}
              setRespostas={vm.setRespostas}
              isEnviandoRespostas={vm.isEnviandoRespostas}
              onEnviar={vm.enviarRespostas}
              onCancelar={vm.resetarParaInicio}
            />
          )}

          {vm.estadoPagina === 'aguardando_documentos' && (
            <DocumentosFaltantes vm={vm} />
          )}

          {vm.estadoPagina === 'erro' && (
            <>
              <ErroSection
                mensagem={vm.geracaoAtual?.erro || vm.progressoMensagem || ''}
                onResetar={vm.resetarParaInicio}
              />
              <Formulario
                numeroCNJ={vm.numeroCNJ}
                setNumeroCNJ={vm.setNumeroCNJ}
                estadoPagina={vm.estadoPagina}
                onSubmit={() => void vm.iniciarAnalise()}
              />
            </>
          )}
        </div>
      </ContentArea>

      {/* ContentDialog para resultado */}
      {vm.geracaoAtual && vm.estadoPagina === 'resultado' && (
        <ContentDialog
          open={vm.showResultDialog}
          onOpenChange={vm.setShowResultDialog}
          title="Parecer de Prestacao de Contas"
          subtitle={vm.geracaoAtual.numero_cnj_formatado || vm.geracaoAtual.numero_cnj}
          icon={<Building2 className="h-5 w-5 text-white" />}
          headerActions={
            <>
              <Button
                onClick={() => guardAction(() => void vm.exportarDocx())}
                size="sm"
                className="text-white/70 hover:text-white"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <Download className="mr-2 h-4 w-4" /> DOCX
              </Button>
              <Button
                onClick={() => { vm.setShowResultDialog(false); vm.resetarParaInicio() }}
                size="sm"
                className="text-white/70 hover:text-white"
                style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <RotateCw className="mr-2 h-4 w-4" /> Nova Analise
              </Button>
            </>
          }
          documentContent={
            <DocumentContent
              geracaoAtual={vm.geracaoAtual}
              parecerBadgeStyle={vm.parecerBadgeStyle}
              parecerTexto={vm.parecerTexto}
              formatarValor={vm.formatarValor}
            />
          }
          feedbackSection={
            <FeedbackStarsCard
              onSubmit={(data) => void handleInlineFeedback(data)}
              isSubmitting={vm.isSubmittingFeedback}
              isSubmitted={vm.isFeedbackSubmitted}
            />
          }
        />
      )}

      {/* Gate modal — blocks download/export until user rates */}
      <FeedbackGateModal
        open={gateOpen}
        onOpenChange={() => {/* controlled by useFeedbackGate */}}
        onFeedbackSubmit={(data) => void handleGateFeedback(data)}
        isSubmitting={vm.isSubmittingFeedback}
        pendingActionLabel="download"
      />

      <ConfirmacaoDialog vm={vm} />
    </>
  )
}
