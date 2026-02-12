/**
 * Pagina de Treinamento de IA (BERT).
 *
 * Composicao fina: orquestra o hook principal e delega a renderizacao
 * para os subcomponentes de cada aba e modal.
 */

import {
  Brain,
  Play,
  RefreshCw,
  FlaskConical,
  GitCompareArrows,
  HelpCircle,
} from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import { useBertTraining } from './hooks/useBertTraining'
import { NovoTreinoTab } from './components/NovoTreinoTab'
import { MonitorarJobsTab } from './components/MonitorarJobsTab'
import { TestarModeloTab } from './components/TestarModeloTab'
import { CompararTab } from './components/CompararTab'
import {
  DebugWorkerModal,
  HelpDialog,
  UploadDatasetDialog,
  ChunksModal,
} from './components/BertModals'

// ============================================================================
// Componente principal
// ============================================================================

export function BertTrainingPage() {
  const h = useBertTraining()

  return (
    <>
      <BreadcrumbBar
        title="Treinamento de IA"
        icon={<Brain style={{ width: 14, height: 14 }} />}
        actions={
          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg transition-colors"
            style={{ color: C.text400 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = C.gray100
              e.currentTarget.style.color = C.text700
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = C.text400
            }}
            onClick={() => h.setShowHelpDialog(true)}
            title="Ajuda"
            data-testid="btn-ajuda-onboarding"
          >
            <HelpCircle style={{ width: 16, height: 16 }} />
          </button>
        }
      />

      <ContentArea>

      <Tabs value={h.activeTab} onValueChange={h.setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="novo-treino" className="gap-2" data-testid="tab-novo-treino">
              <Play className="h-4 w-4" />
              Novo Treino
            </TabsTrigger>
            <TabsTrigger value="monitorar" className="gap-2" data-testid="tab-monitorar">
              <RefreshCw className="h-4 w-4" />
              Monitorar Jobs
            </TabsTrigger>
            <TabsTrigger value="testar" className="gap-2" data-testid="tab-testar">
              <FlaskConical className="h-4 w-4" />
              Testar Modelo
            </TabsTrigger>
            <TabsTrigger value="comparar" className="gap-2" data-testid="tab-comparar">
              <GitCompareArrows className="h-4 w-4" />
              Comparar BERT vs LLM
            </TabsTrigger>
          </TabsList>

          {/* Aba 1: Novo Treino */}
          <TabsContent value="novo-treino">
            <NovoTreinoTab
              datasets={h.datasets}
              loadingDatasets={h.loadingDatasets}
              selectedDataset={h.selectedDataset}
              onSelectDataset={h.setSelectedDataset}
              config={h.config}
              onConfigChange={h.setConfig}
              activePreset={h.activePreset}
              onAplicarPreset={h.aplicarPreset}
              startingTraining={h.startingTraining}
              onIniciarTreinamento={h.iniciarTreinamento}
              onOpenUploadDialog={() => {
                h.resetUploadWizard()
                h.setShowUploadDialog(true)
              }}
              gpuInfo={h.gpuInfo}
              loadingGpuInfo={h.loadingGpuInfo}
              onRefreshGpuInfo={h.fetchGpuInfo}
            />
          </TabsContent>

          {/* Aba 2: Monitorar Jobs */}
          <TabsContent value="monitorar">
            <MonitorarJobsTab
              jobs={h.jobs}
              loadingJobs={h.loadingJobs}
              filteredJobs={h.filteredJobs}
              selectedJob={h.selectedJob}
              jobMetrics={h.jobMetrics}
              loadingMetrics={h.loadingMetrics}
              stoppingJobId={h.stoppingJobId}
              statusFilter={h.statusFilter}
              onStatusFilterChange={h.setStatusFilter}
              realtimeLogs={h.realtimeLogs}
              logsAutoScroll={h.logsAutoScroll}
              onToggleAutoScroll={() => h.setLogsAutoScroll(!h.logsAutoScroll)}
              logContainerRef={h.logContainerRef}
              chartData={h.chartData}
              onRefreshJobs={h.fetchJobs}
              onSelectJob={h.selecionarJob}
              onStopJob={h.pararJob}
              onShowChunks={(jobId) => {
                h.setSelectedChunkJobId(jobId)
                h.setShowChunkModal(true)
              }}
            />
          </TabsContent>

          {/* Aba 3: Testar Modelo */}
          <TabsContent value="testar">
            <TestarModeloTab
              models={h.models}
              loadingModels={h.loadingModels}
              selectedModel={h.selectedModel}
              onSelectModel={h.setSelectedModel}
              testText={h.testText}
              onTestTextChange={h.setTestText}
              prediction={h.prediction}
              loadingPrediction={h.loadingPrediction}
              batchText={h.batchText}
              onBatchTextChange={h.setBatchText}
              batchResults={h.batchResults}
              loadingBatch={h.loadingBatch}
              pdfFile={h.pdfFile}
              onPdfFileChange={h.setPdfFile}
              pdfResult={h.pdfResult}
              onPdfResultClear={() => h.setPdfResult(null)}
              loadingPdf={h.loadingPdf}
              pdfInputRef={h.pdfInputRef}
              testHistory={h.testHistory}
              onExecutarPredicao={h.executarPredicao}
              onExecutarPredicaoLote={h.executarPredicaoLote}
              onClassificarPdf={h.classificarPdf}
              onLimparHistorico={h.limparHistoricoTestes}
            />
          </TabsContent>

          {/* Aba 4: Comparar BERT vs LLM */}
          <TabsContent value="comparar">
            <CompararTab
              compareText={h.compareText}
              onCompareTextChange={h.setCompareText}
              comparison={h.comparison}
              loadingComparison={h.loadingComparison}
              onExecutarComparacao={h.executarComparacao}
            />
          </TabsContent>
        </Tabs>

      {/* Modais globais */}
      <DebugWorkerModal
        open={h.showDebugModal}
        onOpenChange={h.setShowDebugModal}
        workerStatus={h.workerStatus}
        loading={h.loadingWorkerStatus}
        onRetry={h.fetchWorkerStatus}
      />

      <HelpDialog
        open={h.showHelpDialog}
        onOpenChange={h.setShowHelpDialog}
      />

      <UploadDatasetDialog
        open={h.showUploadDialog}
        onOpenChange={h.setShowUploadDialog}
        uploadStep={h.uploadStep}
        onStepChange={h.setUploadStep}
        uploadFile={h.uploadFile}
        uploadPreview={h.uploadPreview}
        uploadValidation={h.uploadValidation}
        loadingValidation={h.loadingUploadValidation}
        uploadDatasetName={h.uploadDatasetName}
        onDatasetNameChange={h.setUploadDatasetName}
        uploadDatasetDescription={h.uploadDatasetDescription}
        onDatasetDescriptionChange={h.setUploadDatasetDescription}
        uploading={h.uploading}
        uploadInputRef={h.uploadInputRef}
        onFileSelect={h.handleUploadFileSelect}
        onValidate={h.validarDatasetUpload}
        onReset={h.resetUploadWizard}
        onUpload={h.executarUploadDataset}
      />

      <ChunksModal
        open={h.showChunkModal}
        onOpenChange={h.setShowChunkModal}
        selectedJobId={h.selectedChunkJobId}
        jobs={h.jobs}
      />
      </ContentArea>
    </>
  )
}
