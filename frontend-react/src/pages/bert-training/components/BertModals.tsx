/**
 * Modais do modulo de Treinamento BERT.
 *
 * Inclui: Debug Worker, Ajuda/Onboarding, Upload Dataset (wizard 4 passos),
 * e Comparacao de Chunks.
 */

import {
  Loader2,
  RefreshCw,
  AlertCircle,
  HelpCircle,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Info,
  Wifi,
  FileText,
  Eye,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { C } from '@/lib/designTokens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { TrainingJob } from '@/types/bert-training'
import type { WorkerStatus, DatasetValidation, UploadStep } from '../types'
import { formatarData, formatarPct } from '../types'
import { StatusBadge } from './StatusBadge'

// ============================================================================
// Modal: Debug Conexao Worker
// ============================================================================

interface DebugWorkerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  workerStatus: WorkerStatus | null
  loading: boolean
  onRetry: () => void
}

export function DebugWorkerModal({
  open,
  onOpenChange,
  workerStatus,
  loading,
  onRetry,
}: DebugWorkerModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="modal-debug-conexao">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wifi className="h-5 w-5" />
            Debug Conexao Worker
          </DialogTitle>
          <DialogDescription>
            Informacoes detalhadas sobre a conexao com o worker de treinamento
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : workerStatus ? (
            <>
              <StatusRow label="Status">
                <Badge variant={workerStatus.connected ? 'success' : 'destructive'}>
                  {workerStatus.connected ? 'Conectado' : 'Desconectado'}
                </Badge>
              </StatusRow>
              <StatusRow label="URL">
                <span className="text-sm font-mono" style={{ color: C.text500 }}>{workerStatus.url}</span>
              </StatusRow>
              <StatusRow label="Latencia">
                <span className="text-sm font-mono" style={{ color: C.text900 }}>{workerStatus.latency_ms}ms</span>
              </StatusRow>
              <StatusRow label="Versao">
                <span className="text-sm font-mono" style={{ color: C.text900 }}>{workerStatus.version}</span>
              </StatusRow>
              <StatusRow label="Uptime">
                <span className="text-sm font-mono" style={{ color: C.text900 }}>{workerStatus.uptime}</span>
              </StatusRow>
              {workerStatus.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{workerStatus.error}</AlertDescription>
                </Alert>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nao foi possivel obter informacoes do worker
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onRetry} disabled={loading} data-testid="btn-retry-debug">
            <RefreshCw className={cn('mr-2 h-4 w-4', loading && 'animate-spin')} />
            Tentar Novamente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Linha de status reutilizavel para o modal de debug */
function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
      <span className="text-sm font-medium" style={{ color: C.text700 }}>{label}</span>
      {children}
    </div>
  )
}

// ============================================================================
// Modal: Ajuda / Onboarding
// ============================================================================

interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]" data-testid="modal-ajuda-onboarding">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            Ajuda - Sistema de Treinamento BERT
          </DialogTitle>
          <DialogDescription>
            Guia completo para utilizar o sistema de treinamento de modelos BERT
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6">
            {/* Visao geral */}
            <div>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: C.text900 }}>O que e este sistema?</h3>
              <p className="text-sm text-muted-foreground">
                O sistema de Treinamento BERT permite treinar modelos de classificacao de documentos
                juridicos usando aprendizado de maquina. Voce pode criar datasets, treinar modelos
                BERT e testar os resultados diretamente nesta interface.
              </p>
            </div>

            {/* Fluxo de trabalho */}
            <div>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: C.text900 }}>Fluxo de Trabalho</h3>
              <div className="space-y-3">
                <FlowStep step={1} title="Preparar Dataset" description="Faca upload de um CSV com colunas 'texto' e 'categoria'. O sistema validara automaticamente o formato e a distribuicao das categorias." />
                <FlowStep step={2} title="Configurar e Iniciar Treinamento" description="Escolha um preset (Rapido, Padrao ou Completo) ou ajuste os hiperparametros manualmente. Selecione o dataset e inicie o treinamento." />
                <FlowStep step={3} title="Monitorar" description="Acompanhe o progresso na aba Monitorar. Veja metricas em tempo real, graficos de loss/accuracy e logs do treinamento." />
                <FlowStep step={4} title="Testar e Comparar" description="Teste o modelo treinado com textos individuais, em lote ou com PDFs. Compare os resultados com a LLM para validar a qualidade." />
              </div>
            </div>

            {/* Dicas */}
            <div>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: C.text900 }}>Dicas Importantes</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  Use o modelo BERTimbau (Base) para datasets menores e BERTimbau (Large) para resultados melhores.
                </li>
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  Datasets com pelo menos 100 exemplos por categoria produzem modelos mais confiaveis.
                </li>
                <li className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
                  Verifique a conexao com o worker antes de iniciar treinamentos longos.
                </li>
                <li className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  O modelo Large requer mais memoria GPU. Verifique a disponibilidade no painel de GPU.
                </li>
              </ul>
            </div>

            {/* Presets */}
            <div>
              <h3 className="mb-2 text-sm font-semibold" style={{ color: C.text900 }}>Presets de Treinamento</h3>
              <div className="space-y-2">
                <div className="rounded-lg border bg-blue-50 p-3">
                  <p className="text-sm font-medium text-blue-800">Padrao</p>
                  <p className="text-xs text-blue-600">LR: 2e-5 | Batch: 16 | Epocas: 5 | MaxLen: 256</p>
                </div>
                <div className="rounded-lg border bg-amber-50 p-3">
                  <p className="text-sm font-medium text-amber-800">Rapido</p>
                  <p className="text-xs text-amber-600">LR: 5e-5 | Batch: 32 | Epocas: 2 | MaxLen: 128</p>
                </div>
                <div className="rounded-lg border bg-green-50 p-3">
                  <p className="text-sm font-medium text-green-800">Completo</p>
                  <p className="text-xs text-green-600">LR: 1e-5 | Batch: 8 | Epocas: 10 | MaxLen: 512</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="btn-fechar-ajuda">Entendi</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Passo do fluxo de trabalho para o dialog de ajuda */
function FlowStep({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border p-3" style={{ borderColor: C.gray200 }}>
      <Badge className="mt-0.5 shrink-0">{step}</Badge>
      <div>
        <p className="text-sm font-medium" style={{ color: C.text900 }}>{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

// ============================================================================
// Modal: Upload Dataset (wizard 4 passos)
// ============================================================================

interface UploadDatasetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  uploadStep: UploadStep
  onStepChange: (step: UploadStep) => void
  uploadFile: File | null
  uploadPreview: string[][]
  uploadValidation: DatasetValidation | null
  loadingValidation: boolean
  uploadDatasetName: string
  onDatasetNameChange: (value: string) => void
  uploadDatasetDescription: string
  onDatasetDescriptionChange: (value: string) => void
  uploading: boolean
  uploadInputRef: React.RefObject<HTMLInputElement | null>
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onValidate: () => void
  onReset: () => void
  onUpload: () => void
}

export function UploadDatasetDialog({
  open,
  onOpenChange,
  uploadStep,
  onStepChange,
  uploadFile,
  uploadPreview,
  uploadValidation,
  loadingValidation,
  uploadDatasetName,
  onDatasetNameChange,
  uploadDatasetDescription,
  onDatasetDescriptionChange,
  uploading,
  uploadInputRef,
  onFileSelect,
  onValidate,
  onReset,
  onUpload,
}: UploadDatasetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => {
      onOpenChange(v)
      if (!v) onReset()
    }}>
      <DialogContent className="max-w-2xl" data-testid="modal-upload-dataset">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload de Dataset
          </DialogTitle>
          <DialogDescription>
            Passo {uploadStep} de 4 - {
              uploadStep === 1 ? 'Selecionar arquivo' :
              uploadStep === 2 ? 'Pre-visualizar dados' :
              uploadStep === 3 ? 'Configurar dataset' :
              'Enviar dataset'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Indicador de progresso dos passos */}
        <div className="flex items-center gap-2" data-testid="upload-steps-indicator">
          {[1, 2, 3, 4].map((step) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  step === uploadStep
                    ? 'text-white'
                    : step < uploadStep
                      ? 'text-green-700'
                      : ''
                )}
                style={{
                  background: step === uploadStep
                    ? C.navy950
                    : step < uploadStep
                      ? C.successBgStrong
                      : C.gray100,
                  color: step > uploadStep ? C.text400 : undefined,
                }}
              >
                {step < uploadStep ? <CheckCircle2 className="h-4 w-4" /> : step}
              </div>
              {step < 4 && (
                <div className="h-0.5 w-8" style={{ background: step < uploadStep ? C.successBorder : C.gray200 }} />
              )}
            </div>
          ))}
        </div>

        {/* Passo 1: Selecionar Arquivo */}
        {uploadStep === 1 && (
          <div className="space-y-4 py-4" data-testid="upload-step-1">
            <div
              className={cn(
                'cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                uploadFile ? 'border-green-300 bg-green-50' : 'hover:border-primary'
              )}
              style={uploadFile ? undefined : { borderColor: C.gray300 }}
              onMouseEnter={(e) => {
                if (!uploadFile) e.currentTarget.style.background = C.gray50
              }}
              onMouseLeave={(e) => {
                if (!uploadFile) e.currentTarget.style.background = 'transparent'
              }}
              onClick={() => uploadInputRef.current?.click()}
            >
              <input
                ref={uploadInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onFileSelect}
                data-testid="upload-file-input"
              />
              <Upload className="mx-auto mb-3 h-10 w-10" style={{ color: C.text400 }} />
              <p className="text-sm font-medium" style={{ color: C.text700 }}>Clique para selecionar um arquivo</p>
              <p className="mt-1 text-xs" style={{ color: C.text500 }}>
                Formatos aceitos: CSV, Excel (.xlsx, .xls)
              </p>
            </div>
          </div>
        )}

        {/* Passo 2: Pre-visualizar dados */}
        {uploadStep === 2 && (
          <div className="space-y-4 py-4" data-testid="upload-step-2">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{uploadFile?.name}</span>
              <span className="text-muted-foreground">
                ({((uploadFile?.size ?? 0) / 1024).toFixed(1)} KB)
              </span>
            </div>
            {uploadPreview.length > 0 && (
              <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.gray200 }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b" style={{ background: C.gray50 }}>
                      {uploadPreview[0]?.map((header, i) => (
                        <th key={i} className="px-3 py-2 text-left font-medium">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {uploadPreview.slice(1, 6).map((row, rowIdx) => (
                      <tr key={rowIdx} className="border-b">
                        {row.map((cell, cellIdx) => (
                          <td key={cellIdx} className="max-w-[200px] truncate px-3 py-2">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Mostrando as primeiras 5 linhas do arquivo. Clique em "Proximo" para validar o dataset.
            </p>
          </div>
        )}

        {/* Passo 3: Configurar (com validacao) */}
        {uploadStep === 3 && (
          <div className="space-y-4 py-4" data-testid="upload-step-3">
            {/* Campos de configuracao */}
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="upload-nome">Nome do Dataset *</Label>
                <Input
                  id="upload-nome"
                  value={uploadDatasetName}
                  onChange={(e) => onDatasetNameChange(e.target.value)}
                  placeholder="Ex: Documentos Tributarios 2024"
                  data-testid="input-upload-nome"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="upload-descricao">Descricao (opcional)</Label>
                <Textarea
                  id="upload-descricao"
                  value={uploadDatasetDescription}
                  onChange={(e) => onDatasetDescriptionChange(e.target.value)}
                  placeholder="Breve descricao do conteudo do dataset..."
                  rows={2}
                  data-testid="input-upload-descricao"
                />
              </div>
            </div>

            {/* Resultado da validacao */}
            {loadingValidation ? (
              <div className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : uploadValidation ? (
              <div className="space-y-3" data-testid="dataset-validation-result">
                {/* Estatisticas */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-2 text-center">
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{uploadValidation.total_rows}</p>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2 text-center">
                    <p className="text-xs text-green-600">Validos</p>
                    <p className="text-lg font-bold text-green-700">{uploadValidation.valid_rows}</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-center">
                    <p className="text-xs text-red-600">Invalidos</p>
                    <p className="text-lg font-bold text-red-700">{uploadValidation.invalid_rows}</p>
                  </div>
                </div>

                {/* Distribuicao de categorias */}
                {uploadValidation.categories_count && Object.keys(uploadValidation.categories_count).length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-muted-foreground">Categorias encontradas:</p>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(uploadValidation.categories_count).map(([cat, count]) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {uploadValidation.warnings.length > 0 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Avisos</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-1 space-y-1">
                        {uploadValidation.warnings.map((w, i) => (
                          <li key={i} className="text-xs">{w}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Erros */}
                {uploadValidation.errors.length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle className="text-sm">Erros</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-1 space-y-1">
                        {uploadValidation.errors.map((err, i) => (
                          <li key={i} className="text-xs">{err}</li>
                        ))}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* Passo 4: Confirmar e enviar */}
        {uploadStep === 4 && (
          <div className="space-y-4 py-4" data-testid="upload-step-4">
            <div className="rounded-lg border p-4" style={{ background: C.gray50, borderColor: C.gray200 }}>
              <h4 className="mb-3 text-sm font-medium" style={{ color: C.text900 }}>Resumo do Upload</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Arquivo:</span>
                  <span className="font-medium">{uploadFile?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{uploadDatasetName}</span>
                </div>
                {uploadDatasetDescription && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Descricao:</span>
                    <span className="font-medium truncate max-w-[250px]">{uploadDatasetDescription}</span>
                  </div>
                )}
                {uploadValidation && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Registros validos:</span>
                      <span className="font-medium">{uploadValidation.valid_rows}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Categorias:</span>
                      <span className="font-medium">{Object.keys(uploadValidation.categories_count).length}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {uploading && (
              <div className="flex items-center justify-center gap-2 py-4">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Enviando dataset...</span>
              </div>
            )}
          </div>
        )}

        {/* Navegacao entre passos */}
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {uploadStep > 1 && (
              <Button
                variant="outline"
                onClick={() => onStepChange(Math.max(1, uploadStep - 1) as UploadStep)}
                disabled={uploading}
                data-testid="btn-upload-anterior"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Anterior
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="ghost" disabled={uploading} data-testid="btn-upload-cancelar">
                Cancelar
              </Button>
            </DialogClose>
            {uploadStep < 4 ? (
              <Button
                onClick={() => {
                  if (uploadStep === 2) {
                    // Ao ir do passo 2 para o 3, valida o dataset
                    onValidate()
                  } else {
                    onStepChange(Math.min(4, uploadStep + 1) as UploadStep)
                  }
                }}
                disabled={
                  (uploadStep === 1 && !uploadFile) ||
                  (uploadStep === 2 && loadingValidation) ||
                  (uploadStep === 3 && !uploadDatasetName.trim())
                }
                data-testid="btn-upload-proximo"
              >
                Proximo
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={onUpload}
                disabled={uploading || !uploadDatasetName.trim()}
                data-testid="btn-upload-enviar"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Enviar Dataset
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Modal: Chunks de Comparacao
// ============================================================================

interface ChunksModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedJobId: number | null
  jobs: TrainingJob[]
}

export function ChunksModal({
  open,
  onOpenChange,
  selectedJobId,
  jobs,
}: ChunksModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]" data-testid="modal-chunks-comparacao">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Chunks do Job #{selectedJobId}
          </DialogTitle>
          <DialogDescription>
            Visualize e compare os chunks processados durante o treinamento
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh]">
          {selectedJobId && (() => {
            const job = jobs.find((j) => j.id === selectedJobId)
            if (!job) return <p className="text-sm text-muted-foreground">Job nao encontrado</p>

            return (
              <div className="space-y-4">
                {/* Informacoes do job */}
                <div className="flex items-center gap-4 rounded-lg border p-3" style={{ background: C.gray50, borderColor: C.gray200 }}>
                  <StatusBadge status={job.status} />
                  <div className="text-sm">
                    <span className="font-medium">{job.dataset_nome}</span>
                    <span className="ml-2 text-muted-foreground">
                      {job.total_epocas} epocas | {job.modelo_base.split('/').pop()}
                    </span>
                  </div>
                </div>

                {/* Metricas resumidas */}
                {job.metricas && (
                  <div className="grid grid-cols-4 gap-2">
                    <ChunkMetricCell label="Accuracy" value={formatarPct(job.metricas.accuracy)} color={C.statusSuccess} />
                    <ChunkMetricCell label="F1" value={formatarPct(job.metricas.f1_score)} color={C.statusInfo} />
                    <ChunkMetricCell label="Precision" value={formatarPct(job.metricas.precision)} color={C.navy700} />
                    <ChunkMetricCell label="Recall" value={formatarPct(job.metricas.recall)} color={C.orange600} />
                  </div>
                )}

                {/* Historico de loss por epoca (como chunks) */}
                {job.metricas?.historico_loss && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium" style={{ color: C.text900 }}>Progresso por Epoca</h4>
                    <div className="space-y-2">
                      {job.metricas.historico_loss.map((loss, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-4 rounded-lg border p-3 transition-colors"
                          style={{ borderColor: C.gray200 }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                          data-testid={`chunk-epoca-${idx + 1}`}
                        >
                          <Badge variant="outline" className="shrink-0">
                            Epoca {idx + 1}
                          </Badge>
                          <div className="flex-1 grid grid-cols-2 gap-4 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Loss:</span>
                              <span className="font-mono text-red-600">{loss.toFixed(4)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Accuracy:</span>
                              <span className="font-mono text-green-600">
                                {job.metricas?.historico_accuracy[idx]
                                  ? formatarPct(job.metricas.historico_accuracy[idx])
                                  : 'N/A'}
                              </span>
                            </div>
                          </div>
                          {/* Comparacao visual de melhoria */}
                          {idx > 0 && (
                            <div className="shrink-0">
                              {loss < job.metricas!.historico_loss[idx - 1] ? (
                                <Badge variant="success" className="text-xs">Melhorou</Badge>
                              ) : (
                                <Badge variant="warning" className="text-xs">Piorou</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Datas */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Criado: {formatarData(job.created_at)}</span>
                  <span>Atualizado: {formatarData(job.updated_at)}</span>
                </div>
              </div>
            )
          })()}
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" data-testid="btn-fechar-chunks">Fechar</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Celula de metrica para o modal de chunks */
function ChunkMetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded border p-2 text-center" style={{ borderColor: C.gray200 }}>
      <p className="text-xs" style={{ color: C.text500 }}>{label}</p>
      <p className="text-sm font-bold" style={{ color }}>{value}</p>
    </div>
  )
}
