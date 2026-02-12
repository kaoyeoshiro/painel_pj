import { FileText } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentDialog } from '@/components/layout/ContentDialog'
import { ChatPanel } from '@/components/layout/ChatPanel'
import { ContentArea } from '@/components/layout/ContentArea'

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
  FeedbackSection,
} from './components/RelatorioSections'

// ============================================================
// Componente principal — composicao fina usando hook e subcomponentes
// ============================================================

export function RelatorioCumprimentoPage() {
  const vm = useRelatorioCumprimento()

  return (
    <>
      {/* ============================================================ */}
      {/* BREADCRUMB BAR — subordinada ao Header global                */}
      {/* ============================================================ */}
      <BreadcrumbBar
        title="Relatorio de Cumprimento"
        icon={<FileText style={{ width: 14, height: 14 }} />}
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
        headerActions={<HeaderActions vm={vm} />}
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
          <FeedbackSection
            feedbackEnviado={vm.feedbackEnviado}
            feedbackAvaliacao={vm.feedbackAvaliacao}
            feedbackNota={vm.feedbackNota}
            feedbackComentario={vm.feedbackComentario}
            enviandoFeedback={vm.enviandoFeedback}
            onAvaliacaoChange={vm.setFeedbackAvaliacao}
            onNotaChange={vm.setFeedbackNota}
            onComentarioChange={vm.setFeedbackComentario}
            onEnviar={vm.handleEnviarFeedback}
          />
        }
      />
    </>
  )
}
