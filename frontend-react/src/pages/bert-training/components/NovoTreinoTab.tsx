/**
 * Aba "Novo Treino" do modulo de Treinamento BERT.
 *
 * Permite selecionar dataset, configurar hiperparametros via presets
 * ou manualmente, e iniciar o treinamento. Tambem exibe info de GPU.
 */

import {
  Play,
  Loader2,
  AlertCircle,
  Upload,
  RefreshCw,
  Cpu,
} from 'lucide-react'
import { C } from '@/lib/designTokens'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { Dataset, TrainingConfig } from '@/types/bert-training'
import type { GpuInfo } from '../types'
import { MODELOS_BASE, TRAINING_PRESETS } from '../types'

// ============================================================================
// Props
// ============================================================================

interface NovoTreinoTabProps {
  datasets: Dataset[]
  loadingDatasets: boolean
  selectedDataset: string
  onSelectDataset: (value: string) => void
  config: TrainingConfig
  onConfigChange: (updater: (prev: TrainingConfig) => TrainingConfig) => void
  activePreset: string
  onAplicarPreset: (presetId: string) => void
  startingTraining: boolean
  onIniciarTreinamento: () => void
  onOpenUploadDialog: () => void
  gpuInfo: GpuInfo | null
  loadingGpuInfo: boolean
  onRefreshGpuInfo: () => void
}

// ============================================================================
// Componente
// ============================================================================

export function NovoTreinoTab({
  datasets,
  loadingDatasets,
  selectedDataset,
  onSelectDataset,
  config,
  onConfigChange,
  activePreset,
  onAplicarPreset,
  startingTraining,
  onIniciarTreinamento,
  onOpenUploadDialog,
  gpuInfo,
  loadingGpuInfo,
  onRefreshGpuInfo,
}: NovoTreinoTabProps) {
  return (
    <>
      {/* Preset cards (modos de treinamento) */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-medium text-muted-foreground">Modo de Treinamento</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="preset-cards-container">
          {TRAINING_PRESETS.map((preset) => {
            const Icon = preset.icon
            return (
              <button
                key={preset.id}
                onClick={() => onAplicarPreset(preset.id)}
                className={cn(
                  'rounded-lg border-2 p-4 text-left transition-all',
                  preset.color,
                  activePreset === preset.id
                    ? 'ring-2 ring-primary ring-offset-2'
                    : 'opacity-80 hover:opacity-100'
                )}
                data-testid={`preset-card-${preset.id}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={cn('h-5 w-5', preset.iconColor)} />
                  <span className="font-semibold">{preset.label}</span>
                  {activePreset === preset.id && (
                    <Badge variant="default" className="ml-auto text-xs">Ativo</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{preset.description}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Selecao de dataset com botao de upload */}
        <Card className="overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Dataset</CardTitle>
                <CardDescription>Selecione o dataset para treinamento</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenUploadDialog}
                data-testid="btn-upload-dataset"
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload Dataset
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingDatasets ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : datasets.length === 0 ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Nenhum dataset disponivel. Crie um dataset antes de iniciar o treinamento.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="dataset-select">Dataset</Label>
                  <Select value={selectedDataset} onValueChange={onSelectDataset}>
                    <SelectTrigger id="dataset-select" data-testid="select-dataset">
                      <SelectValue placeholder="Selecione um dataset..." />
                    </SelectTrigger>
                    <SelectContent>
                      {datasets
                        .filter((d) => d.status === 'ready')
                        .map((d) => (
                          <SelectItem key={d.id} value={String(d.id)}>
                            {d.nome} ({d.total_exemplos} exemplos)
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Info do dataset selecionado */}
                {selectedDataset && (() => {
                  const ds = datasets.find((d) => d.id === Number(selectedDataset))
                  if (!ds) return null
                  return (
                    <div className="rounded-lg border p-3 text-sm" style={{ background: C.gray50, borderColor: C.gray200 }}>
                      <p><strong>Nome:</strong> {ds.nome}</p>
                      {ds.descricao && <p><strong>Descricao:</strong> {ds.descricao}</p>}
                      <p><strong>Exemplos:</strong> {ds.total_exemplos}</p>
                      <p><strong>Categorias:</strong> {ds.categorias.join(', ')}</p>
                    </div>
                  )
                })()}
              </>
            )}
          </CardContent>
        </Card>

        {/* Hiperparametros */}
        <Card className="overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
          <CardHeader>
            <CardTitle>Hiperparametros</CardTitle>
            <CardDescription>Configure os parametros de treinamento</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="modelo-base">Modelo Base</Label>
              <Select
                value={config.modelo_base}
                onValueChange={(v) => onConfigChange((c) => ({ ...c, modelo_base: v }))}
              >
                <SelectTrigger id="modelo-base" data-testid="select-modelo-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODELOS_BASE.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="learning-rate">Learning Rate</Label>
                <Input
                  id="learning-rate"
                  type="number"
                  step="0.00001"
                  min="0.000001"
                  max="0.01"
                  value={config.learning_rate}
                  onChange={(e) =>
                    onConfigChange((c) => ({ ...c, learning_rate: Number(e.target.value) }))
                  }
                  data-testid="input-learning-rate"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batch-size">Batch Size</Label>
                <Input
                  id="batch-size"
                  type="number"
                  min={1}
                  max={128}
                  value={config.batch_size}
                  onChange={(e) =>
                    onConfigChange((c) => ({ ...c, batch_size: Number(e.target.value) }))
                  }
                  data-testid="input-batch-size"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="num-epochs">Epocas</Label>
                <Input
                  id="num-epochs"
                  type="number"
                  min={1}
                  max={100}
                  value={config.num_epochs}
                  onChange={(e) =>
                    onConfigChange((c) => ({ ...c, num_epochs: Number(e.target.value) }))
                  }
                  data-testid="input-num-epochs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-length">Max Length</Label>
                <Input
                  id="max-length"
                  type="number"
                  min={32}
                  max={512}
                  value={config.max_length}
                  onChange={(e) =>
                    onConfigChange((c) => ({ ...c, max_length: Number(e.target.value) }))
                  }
                  data-testid="input-max-length"
                />
              </div>
            </div>

            <Button
              onClick={onIniciarTreinamento}
              disabled={startingTraining || !selectedDataset}
              className="w-full h-12 text-base text-white"
              style={{ background: C.navy950 }}
              data-testid="btn-iniciar-treinamento"
            >
              {startingTraining ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Iniciando...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-5 w-5" />
                  Iniciar Treinamento
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Secao de informacoes de GPU do Worker */}
      <Card className="mt-6 overflow-hidden" data-testid="worker-gpu-info-card">
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Informacoes do Worker (GPU)</CardTitle>
            </div>
            <Button variant="ghost" size="sm" onClick={onRefreshGpuInfo} disabled={loadingGpuInfo} data-testid="btn-refresh-gpu">
              <RefreshCw className={cn('h-4 w-4', loadingGpuInfo && 'animate-spin')} />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingGpuInfo ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : gpuInfo ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <GpuInfoCell label="GPU" value={gpuInfo.gpu_name} testId="gpu-name" />
              <GpuInfoCell label="Memoria Total" value={gpuInfo.gpu_memory_total} testId="gpu-memory-total" />
              <GpuInfoCell label="Memoria em Uso" value={gpuInfo.gpu_memory_used} testId="gpu-memory-used" />
              <GpuInfoCell label="Utilizacao GPU" value={gpuInfo.gpu_utilization} testId="gpu-utilization" />
              <GpuInfoCell label="Memoria Livre" value={gpuInfo.gpu_memory_free} testId="gpu-memory-free" />
              <GpuInfoCell label="CUDA" value={gpuInfo.cuda_version} testId="gpu-cuda-version" />
              <GpuInfoCell label="Driver" value={gpuInfo.driver_version} testId="gpu-driver-version" />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nao foi possivel carregar informacoes de GPU. Verifique a conexao com o worker.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

// ============================================================================
// Sub-componente auxiliar para celulas de info de GPU
// ============================================================================

function GpuInfoCell({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }} data-testid={testId}>
      <p className="text-xs" style={{ color: C.text500 }}>{label}</p>
      <p className="text-sm font-semibold" style={{ color: C.text900 }}>{value}</p>
    </div>
  )
}
