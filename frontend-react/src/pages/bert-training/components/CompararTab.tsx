/**
 * Aba "Comparar BERT vs LLM" do modulo de Treinamento BERT.
 *
 * Permite comparar a classificacao de um texto entre o modelo BERT
 * treinado e uma LLM generativa, lado a lado.
 */

import {
  Brain,
  Loader2,
  FlaskConical,
  GitCompareArrows,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { C } from '@/lib/designTokens'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ComparisonResult } from '@/types/bert-training'
import { formatarPct } from '../types'

// ============================================================================
// Props
// ============================================================================

interface CompararTabProps {
  compareText: string
  onCompareTextChange: (value: string) => void
  comparison: ComparisonResult | null
  loadingComparison: boolean
  onExecutarComparacao: () => void
}

// ============================================================================
// Componente
// ============================================================================

export function CompararTab({
  compareText,
  onCompareTextChange,
  comparison,
  loadingComparison,
  onExecutarComparacao,
}: CompararTabProps) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <CardHeader>
        <CardTitle>Comparacao BERT vs LLM</CardTitle>
        <CardDescription>
          Compare os resultados de classificacao entre o modelo BERT treinado e uma LLM generativa
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="compare-text">Texto para comparar</Label>
          <Textarea
            id="compare-text"
            value={compareText}
            onChange={(e) => onCompareTextChange(e.target.value)}
            placeholder="Digite o texto que deseja classificar com ambos os modelos..."
            rows={4}
            data-testid="textarea-comparar"
          />
        </div>

        <Button
          onClick={onExecutarComparacao}
          disabled={loadingComparison || !compareText.trim()}
          className="w-full"
          data-testid="btn-comparar"
        >
          {loadingComparison ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Comparando...
            </>
          ) : (
            <>
              <GitCompareArrows className="mr-2 h-4 w-4" />
              Comparar
            </>
          )}
        </Button>

        {/* Resultado da comparacao */}
        {comparison && (
          <div className="space-y-4" data-testid="resultado-comparacao">
            {/* Indicador de concordancia */}
            <Alert variant={comparison.concordam ? 'default' : 'destructive'}>
              {comparison.concordam ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {comparison.concordam
                  ? 'Os modelos concordam na classificacao!'
                  : 'Os modelos divergem na classificacao.'}
              </AlertDescription>
            </Alert>

            {/* Comparacao lado a lado */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Resultado BERT */}
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-800">BERT</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Categoria:</span>
                    <Badge className="bg-blue-600">{comparison.bert_resultado.categoria}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">Confianca:</span>
                    <span className="font-mono font-bold text-blue-800">
                      {formatarPct(comparison.bert_resultado.confianca)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Resultado LLM */}
              <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-purple-600" />
                  <h4 className="font-semibold text-purple-800">LLM</h4>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Categoria:</span>
                    <Badge className="bg-purple-600">{comparison.llm_resultado.categoria}</Badge>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-purple-700">Confianca:</span>
                    <span className="font-mono font-bold text-purple-800">
                      {formatarPct(comparison.llm_resultado.confianca)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
