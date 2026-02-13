/**
 * Aba "Testar Modelo" do modulo de Treinamento BERT.
 *
 * Permite testar predicao individual, em lote e classificacao de PDF,
 * com historico de testes acumulado.
 */

import {
  Loader2,
  FlaskConical,
  AlertCircle,
  Trash2,
  FileText,
  Upload,
  CheckCircle2,
  X,
} from 'lucide-react'
import { C } from '@/lib/designTokens'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ModelInfo, PredictionResult } from '@/types/bert-training'
import type { PdfClassificationResult } from '../types'
import { formatarPct } from '../types'

// ============================================================================
// Props
// ============================================================================

interface TestarModeloTabProps {
  models: ModelInfo[]
  loadingModels: boolean
  selectedModel: string
  onSelectModel: (value: string) => void
  testText: string
  onTestTextChange: (value: string) => void
  prediction: PredictionResult | null
  loadingPrediction: boolean
  batchText: string
  onBatchTextChange: (value: string) => void
  batchResults: PredictionResult[]
  loadingBatch: boolean
  pdfFile: File | null
  onPdfFileChange: (file: File | null) => void
  pdfResult: PdfClassificationResult | null
  onPdfResultClear: () => void
  loadingPdf: boolean
  pdfInputRef: React.RefObject<HTMLInputElement | null>
  testHistory: PredictionResult[]
  onExecutarPredicao: () => void
  onExecutarPredicaoLote: () => void
  onClassificarPdf: () => void
  onLimparHistorico: () => void
}

// ============================================================================
// Componente
// ============================================================================

export function TestarModeloTab({
  models,
  loadingModels,
  selectedModel,
  onSelectModel,
  testText,
  onTestTextChange,
  prediction,
  loadingPrediction,
  batchText,
  onBatchTextChange,
  batchResults,
  loadingBatch,
  pdfFile,
  onPdfFileChange,
  pdfResult,
  onPdfResultClear,
  loadingPdf,
  pdfInputRef,
  testHistory,
  onExecutarPredicao,
  onExecutarPredicaoLote,
  onClassificarPdf,
  onLimparHistorico,
}: TestarModeloTabProps) {
  return (
    <>
      {/* Barra de acoes do teste com botao Limpar Historico */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold" style={{ color: C.text900 }}>Testes de Classificacao</h3>
        <div className="flex items-center gap-2">
          {testHistory.length > 0 && (
            <Badge variant="secondary" data-testid="badge-historico-count">
              {testHistory.length} teste{testHistory.length !== 1 ? 's' : ''} no historico
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onLimparHistorico}
            disabled={testHistory.length === 0}
            data-testid="btn-limpar-historico-testes"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Limpar Historico
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Predicao individual */}
        <Card className="overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
          <CardHeader>
            <CardTitle>Predicao Individual</CardTitle>
            <CardDescription>Classifique um texto usando o modelo treinado</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="model-select">Modelo</Label>
              {loadingModels ? (
                <Skeleton className="h-10 w-full" />
              ) : models.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Nenhum modelo treinado disponivel</AlertDescription>
                </Alert>
              ) : (
                <Select value={selectedModel} onValueChange={onSelectModel}>
                  <SelectTrigger id="model-select" data-testid="select-modelo-teste">
                    <SelectValue placeholder="Selecione um modelo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.name} (Acc: {m.final_accuracy != null ? formatarPct(m.final_accuracy) : 'N/A'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="test-text">Texto para classificar</Label>
              <Textarea
                id="test-text"
                value={testText}
                onChange={(e) => onTestTextChange(e.target.value)}
                placeholder="Digite o texto que deseja classificar..."
                rows={4}
                data-testid="textarea-texto-teste"
              />
            </div>

            <Button
              onClick={onExecutarPredicao}
              disabled={loadingPrediction || !selectedModel || !testText.trim()}
              className="w-full"
              data-testid="btn-classificar-texto"
            >
              {loadingPrediction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Classificando...
                </>
              ) : (
                <>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Classificar
                </>
              )}
            </Button>

            {/* Resultado da predicao */}
            {prediction && (
              <div className="space-y-3 rounded-lg border p-4" style={{ background: C.gray50, borderColor: C.gray200 }} data-testid="resultado-predicao">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: C.text700 }}>Categoria predita:</span>
                  <Badge variant="default" className="text-sm">
                    {prediction.categoria_predita}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: C.text700 }}>Confianca:</span>
                  <span className="text-sm font-bold" style={{ color: C.statusSuccess }}>
                    {formatarPct(prediction.confianca)}
                  </span>
                </div>

                {/* Distribuicao de probabilidades */}
                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    Distribuicao de probabilidades:
                  </p>
                  {prediction.todas_categorias
                    .sort((a, b) => b.probabilidade - a.probabilidade)
                    .slice(0, 5)
                    .map((cat) => (
                      <div key={cat.categoria} className="flex items-center gap-2">
                        <span className="w-28 truncate text-xs" style={{ color: C.text700 }}>{cat.categoria}</span>
                        <div className="h-2 flex-1 rounded-full" style={{ background: C.gray200 }}>
                          <div
                            className="h-2 rounded-full"
                            style={{ width: `${cat.probabilidade * 100}%`, background: C.navy700 }}
                          />
                        </div>
                        <span className="w-14 text-right text-xs" style={{ color: C.text500 }}>
                          {formatarPct(cat.probabilidade)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Predicao em lote */}
        <Card className="overflow-hidden">
          <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
          <CardHeader>
            <CardTitle>Predicao em Lote</CardTitle>
            <CardDescription>Classifique multiplos textos de uma vez (um por linha)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="batch-text">Textos (um por linha)</Label>
              <Textarea
                id="batch-text"
                value={batchText}
                onChange={(e) => onBatchTextChange(e.target.value)}
                placeholder={"Texto 1 para classificar\nTexto 2 para classificar\nTexto 3 para classificar"}
                rows={6}
                data-testid="textarea-batch-texto"
              />
            </div>

            <Button
              onClick={onExecutarPredicaoLote}
              disabled={loadingBatch || !selectedModel || !batchText.trim()}
              className="w-full"
              data-testid="btn-classificar-lote"
            >
              {loadingBatch ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Classificando lote...
                </>
              ) : (
                <>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Classificar Lote
                </>
              )}
            </Button>

            {/* Resultados em lote */}
            {batchResults.length > 0 && (
              <div className="max-h-[400px] overflow-y-auto" data-testid="resultados-lote">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Texto</TableHead>
                      <TableHead className="text-xs">Categoria</TableHead>
                      <TableHead className="text-right text-xs">Confianca</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchResults.map((r, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="max-w-[200px] truncate text-xs">
                          {r.texto}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {r.categoria_predita}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {formatarPct(r.confianca)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Classificar PDF (teste) */}
      <Card className="mt-6 overflow-hidden" data-testid="classificar-pdf-card">
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-base">Classificar PDF (teste)</CardTitle>
              <CardDescription>
                Envie um arquivo PDF para classificar seus chunks com o modelo selecionado
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {/* Zona de upload de PDF */}
            <div
              className={cn(
                'flex-1 cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors',
                pdfFile ? 'border-green-300 bg-green-50' : 'hover:border-primary'
              )}
              style={pdfFile ? undefined : { borderColor: C.gray300 }}
              onMouseEnter={(e) => {
                if (!pdfFile) e.currentTarget.style.background = C.gray50
              }}
              onMouseLeave={(e) => {
                if (!pdfFile) e.currentTarget.style.background = 'transparent'
              }}
              onClick={() => pdfInputRef.current?.click()}
              data-testid="pdf-upload-zone"
            >
              <input
                ref={pdfInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onPdfFileChange(file)
                }}
                data-testid="pdf-file-input"
              />
              {pdfFile ? (
                <div className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-700">{pdfFile.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 h-6 px-2"
                    onClick={(e) => {
                      e.stopPropagation()
                      onPdfFileChange(null)
                      onPdfResultClear()
                      if (pdfInputRef.current) pdfInputRef.current.value = ''
                    }}
                    data-testid="btn-remover-pdf"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div>
                  <Upload className="mx-auto mb-2 h-8 w-8" style={{ color: C.text400 }} />
                  <p className="text-sm" style={{ color: C.text500 }}>
                    Clique para selecionar um arquivo PDF
                  </p>
                </div>
              )}
            </div>

            <Button
              onClick={onClassificarPdf}
              disabled={loadingPdf || !selectedModel || !pdfFile}
              data-testid="btn-classificar-pdf"
            >
              {loadingPdf ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Classificar PDF
                </>
              )}
            </Button>
          </div>

          {/* Resultado da classificacao de PDF */}
          {pdfResult && (
            <div className="space-y-3" data-testid="pdf-resultado">
              <div className="flex items-center gap-4 text-sm">
                <span><strong>Arquivo:</strong> {pdfResult.filename}</span>
                <span><strong>Paginas:</strong> {pdfResult.total_pages}</span>
                <span><strong>Chunks:</strong> {pdfResult.chunks.length}</span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">#</TableHead>
                      <TableHead className="text-xs">Trecho</TableHead>
                      <TableHead className="text-xs">Categoria</TableHead>
                      <TableHead className="text-right text-xs">Confianca</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pdfResult.chunks.map((chunk, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-mono">{idx + 1}</TableCell>
                        <TableCell className="max-w-[300px] truncate text-xs">
                          {chunk.texto}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {chunk.categoria_predita}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs font-mono">
                          {formatarPct(chunk.confianca)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  )
}
