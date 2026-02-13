/**
 * Aba "Monitorar Jobs" do modulo de Treinamento BERT.
 *
 * Lista os jobs de treinamento com filtro de status, mostra detalhes
 * do job selecionado (metricas, graficos, matriz de confusao, logs).
 */

import {
  Loader2,
  RefreshCw,
  Square,
  AlertCircle,
  Eye,
  Terminal,
} from 'lucide-react'
import { C } from '@/lib/designTokens'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import type { TrainingJob, TrainingMetrics } from '@/types/bert-training'
import type { LogEntry, RunStatusFilter } from '../types'
import { STATUS_FILTER_OPTIONS, formatarData, formatarPct, logLevelColor } from '../types'
import { StatusBadge } from './StatusBadge'

// ============================================================================
// Props
// ============================================================================

interface MonitorarJobsTabProps {
  jobs: TrainingJob[]
  loadingJobs: boolean
  filteredJobs: TrainingJob[]
  selectedJob: TrainingJob | null
  jobMetrics: TrainingMetrics | null
  loadingMetrics: boolean
  stoppingJobId: number | null
  statusFilter: RunStatusFilter
  onStatusFilterChange: (value: RunStatusFilter) => void
  realtimeLogs: LogEntry[]
  logsAutoScroll: boolean
  onToggleAutoScroll: () => void
  logContainerRef: React.RefObject<HTMLDivElement | null>
  chartData: Array<{
    epoca: number
    loss: number
    accuracy: number
    val_loss?: number
    val_accuracy?: number
  }>
  onRefreshJobs: () => void
  onSelectJob: (job: TrainingJob) => void
  onStopJob: (jobId: number) => void
  onShowChunks: (jobId: number) => void
}

// ============================================================================
// Componente
// ============================================================================

export function MonitorarJobsTab({
  jobs,
  loadingJobs,
  filteredJobs,
  selectedJob,
  jobMetrics,
  loadingMetrics,
  stoppingJobId,
  statusFilter,
  onStatusFilterChange,
  realtimeLogs,
  logsAutoScroll,
  onToggleAutoScroll,
  logContainerRef,
  chartData,
  onRefreshJobs,
  onSelectJob,
  onStopJob,
  onShowChunks,
}: MonitorarJobsTabProps) {
  return (
    <>
      {/* Filtro de status (pills) */}
      <div className="mb-4 flex flex-wrap gap-2" data-testid="status-filter-pills">
        {STATUS_FILTER_OPTIONS.map((option) => (
          <Button
            key={option.value}
            variant={statusFilter === option.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => onStatusFilterChange(option.value)}
            data-testid={`filter-status-${option.value}`}
            className={cn(
              statusFilter === option.value && option.value === 'failed' && 'bg-destructive text-destructive-foreground'
            )}
          >
            {option.label}
            {option.value !== 'all' && (
              <Badge variant="secondary" className="ml-2 h-5 min-w-[20px] px-1 text-xs">
                {option.value === 'running'
                  ? jobs.filter((j) => j.status === 'running' || j.status === 'queued' || j.status === 'stopping').length
                  : option.value === 'completed'
                    ? jobs.filter((j) => j.status === 'completed').length
                    : jobs.filter((j) => j.status === 'failed' || j.status === 'stopped').length}
              </Badge>
            )}
          </Button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lista de jobs */}
        <Card className="lg:col-span-1 overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Jobs de Treinamento</CardTitle>
            <Button variant="ghost" size="icon" onClick={onRefreshJobs} disabled={loadingJobs} data-testid="btn-refresh-jobs">
              <RefreshCw className={cn('h-4 w-4', loadingJobs && 'animate-spin')} />
            </Button>
          </CardHeader>
          <CardContent>
            {loadingJobs && jobs.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredJobs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nenhum job encontrado
              </p>
            ) : (
              <div className="max-h-[600px] space-y-2 overflow-y-auto">
                {filteredJobs.map((job) => (
                  <button
                    key={job.id}
                    onClick={() => onSelectJob(job)}
                    className={cn(
                      'w-full rounded-lg border p-3 text-left transition-colors',
                      selectedJob?.id === job.id && 'border-primary bg-primary/5'
                    )}
                    style={{ borderColor: selectedJob?.id === job.id ? undefined : C.gray200 }}
                    onMouseEnter={(e) => {
                      if (selectedJob?.id !== job.id) e.currentTarget.style.background = C.gray50
                    }}
                    onMouseLeave={(e) => {
                      if (selectedJob?.id !== job.id) e.currentTarget.style.background = 'transparent'
                    }}
                    data-testid={`job-item-${job.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Job #{job.id}</span>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {job.name}
                    </p>
                    {job.status === 'running' && (
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                          <span>{job.base_model?.split('/').pop()}</span>
                        </div>
                      </div>
                    )}
                    {/* Botao de ver chunks ao lado do job concluido */}
                    {job.status === 'completed' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-1 h-6 px-2 text-xs"
                        onClick={(e) => {
                          e.stopPropagation()
                          onShowChunks(job.id)
                        }}
                        data-testid={`btn-chunks-job-${job.id}`}
                      >
                        <Eye className="mr-1 h-3 w-3" />
                        Ver Chunks
                      </Button>
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detalhes do job selecionado */}
        <Card className="lg:col-span-2 overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
          <CardHeader>
            <CardTitle>
              {selectedJob ? `Detalhes - Job #${selectedJob.id}` : 'Detalhes do Job'}
            </CardTitle>
            <CardDescription>
              {selectedJob
                ? `${selectedJob.name} | Modelo: ${selectedJob.base_model}`
                : 'Selecione um job para ver os detalhes'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!selectedJob ? (
              <div className="flex h-64 items-center justify-center text-muted-foreground">
                <p>Selecione um job na lista ao lado</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Informacoes basicas e acoes */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <StatusBadge status={selectedJob.status} />
                    <span className="text-sm text-muted-foreground">
                      Criado em {formatarData(selectedJob.created_at)}
                    </span>
                  </div>
                  {(selectedJob.status === 'running' || selectedJob.status === 'queued') && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => onStopJob(selectedJob.id)}
                      disabled={stoppingJobId === selectedJob.id}
                      data-testid="btn-parar-job"
                    >
                      {stoppingJobId === selectedJob.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Square className="mr-2 h-4 w-4" />
                      )}
                      Parar
                    </Button>
                  )}
                </div>

                {/* Erro, se houver */}
                {selectedJob.status === 'failed' && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>O treinamento falhou</AlertDescription>
                  </Alert>
                )}

                {/* Metricas numericas */}
                {jobMetrics && (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <MetricCell label="Accuracy" value={formatarPct(jobMetrics.accuracy)} color={C.statusSuccess} />
                    <MetricCell label="F1 Score" value={formatarPct(jobMetrics.f1_score)} color={C.statusInfo} />
                    <MetricCell label="Precision" value={formatarPct(jobMetrics.precision)} color={C.navy700} />
                    <MetricCell label="Recall" value={formatarPct(jobMetrics.recall)} color={C.orange600} />
                  </div>
                )}

                {/* Graficos de treinamento */}
                {loadingMetrics ? (
                  <Skeleton className="h-64 w-full" />
                ) : chartData.length > 0 ? (
                  <div className="space-y-4">
                    {/* Grafico de Loss */}
                    <div>
                      <h4 className="mb-2 text-sm font-medium" style={{ color: C.text900 }}>Curva de Loss</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="epoca" label={{ value: 'Epoca', position: 'insideBottom', offset: -5 }} />
                          <YAxis label={{ value: 'Loss', angle: -90, position: 'insideLeft' }} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="loss" stroke={C.statusError} name="Loss (treino)" strokeWidth={2} dot={{ r: 3 }} />
                          {chartData[0]?.val_loss !== undefined && (
                            <Line type="monotone" dataKey="val_loss" stroke={C.orange500} name="Loss (validacao)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Grafico de Accuracy */}
                    <div>
                      <h4 className="mb-2 text-sm font-medium" style={{ color: C.text900 }}>Curva de Accuracy</h4>
                      <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="epoca" label={{ value: 'Epoca', position: 'insideBottom', offset: -5 }} />
                          <YAxis label={{ value: 'Accuracy', angle: -90, position: 'insideLeft' }} domain={[0, 1]} />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="accuracy" stroke={C.statusSuccess} name="Accuracy (treino)" strokeWidth={2} dot={{ r: 3 }} />
                          {chartData[0]?.val_accuracy !== undefined && (
                            <Line type="monotone" dataKey="val_accuracy" stroke={C.statusInfo} name="Accuracy (validacao)" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} />
                          )}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                ) : selectedJob.status === 'running' ? (
                  <div className="flex h-32 items-center justify-center text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Aguardando metricas...
                  </div>
                ) : null}

                {/* Matriz de confusao */}
                {jobMetrics?.confusion_matrix && jobMetrics.labels && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium" style={{ color: C.text900 }}>Matriz de Confusao</h4>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Real \ Previsto</TableHead>
                            {jobMetrics.labels.map((label) => (
                              <TableHead key={label} className="text-center text-xs">
                                {label}
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {jobMetrics.confusion_matrix.map((row, i) => {
                            const maxVal = Math.max(...row)
                            return (
                              <TableRow key={i}>
                                <TableCell className="text-xs font-medium">
                                  {jobMetrics.labels?.[i]}
                                </TableCell>
                                {row.map((val, j) => {
                                  const intensity = maxVal > 0 ? val / maxVal : 0
                                  const isCorrect = i === j
                                  return (
                                    <TableCell
                                      key={j}
                                      className={cn(
                                        'text-center text-xs font-mono',
                                        isCorrect && intensity > 0.5
                                          ? 'bg-green-100 text-green-800'
                                          : !isCorrect && val > 0
                                            ? 'bg-red-50 text-red-700'
                                            : ''
                                      )}
                                    >
                                      {val}
                                    </TableCell>
                                  )
                                })}
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Terminal de logs em tempo real */}
                {selectedJob.status === 'running' && (
                  <div data-testid="realtime-logs-terminal">
                    <div className="mb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Terminal className="h-4 w-4 text-muted-foreground" />
                        <h4 className="text-sm font-medium" style={{ color: C.text900 }}>Logs em Tempo Real</h4>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onToggleAutoScroll}
                        data-testid="btn-toggle-autoscroll"
                      >
                        {logsAutoScroll ? 'Auto-scroll: ON' : 'Auto-scroll: OFF'}
                      </Button>
                    </div>
                    <div
                      ref={logContainerRef}
                      className="h-64 overflow-y-auto rounded-lg border bg-gray-900 p-3 font-mono text-xs"
                      style={{ borderColor: C.gray200 }}
                      data-testid="logs-container"
                    >
                      {realtimeLogs.length === 0 ? (
                        <p className="text-gray-500">Aguardando logs...</p>
                      ) : (
                        realtimeLogs.map((log, idx) => (
                          <div key={idx} className="leading-5">
                            <span className="text-gray-500">{log.timestamp}</span>
                            {' '}
                            <span className={logLevelColor(log.level)}>
                              [{log.level.toUpperCase()}]
                            </span>
                            {' '}
                            <span className="text-gray-200">{log.message}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}

// ============================================================================
// Sub-componente auxiliar para celulas de metrica
// ============================================================================

function MetricCell({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg border p-3 text-center" style={{ borderColor: C.gray200 }}>
      <p className="text-xs" style={{ color: C.text500 }}>{label}</p>
      <p className="text-lg font-bold" style={{ color }}>{value}</p>
    </div>
  )
}
