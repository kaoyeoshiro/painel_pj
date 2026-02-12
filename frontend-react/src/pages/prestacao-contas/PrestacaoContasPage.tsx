import { Button } from '@/components/ui/button'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentDialog } from '@/components/layout/ContentDialog'
import { ContentArea } from '@/components/layout/ContentArea'
import { Building2, Download, RotateCw } from 'lucide-react'

import { usePrestacaoContas } from './hooks/usePrestacaoContas'
import {
  Formulario,
  InfoCard,
  Progresso,
  DocumentContent,
  FeedbackSection,
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
                onClick={vm.exportarDocx}
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
            <FeedbackSection
              avaliacaoSelecionada={vm.avaliacaoSelecionada}
              setAvaliacaoSelecionada={vm.setAvaliacaoSelecionada}
              comentarioFeedback={vm.comentarioFeedback}
              setComentarioFeedback={vm.setComentarioFeedback}
              isEnviandoFeedback={vm.isEnviandoFeedback}
              onEnviar={vm.enviarFeedback}
            />
          }
        />
      )}

      <ConfirmacaoDialog vm={vm} />
    </>
  )
}
