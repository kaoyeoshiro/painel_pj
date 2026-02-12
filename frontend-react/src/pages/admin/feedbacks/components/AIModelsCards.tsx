import { useEffect, useState } from 'react'
import { C } from '@/lib/designTokens'
import { fetchAIModels } from '../api'
import type { AIModelsMap } from '../types'

const MODELS_DISPLAY: { key: string; label: string; colorClass: string; borderClass: string }[] = [
  { key: 'assistencia_judiciaria', label: 'Assistência Judiciária', colorClass: 'text-blue-600', borderClass: 'bg-blue-50 border-blue-100' },
  { key: 'matriculas', label: 'Matrículas Confrontantes', colorClass: 'text-green-600', borderClass: 'bg-green-50 border-green-100' },
  { key: 'gerador_pecas', label: 'Gerador de Peças', colorClass: 'text-purple-600', borderClass: 'bg-purple-50 border-purple-100' },
  { key: 'pedido_calculo', label: 'Pedido de Cálculo', colorClass: 'text-amber-600', borderClass: 'bg-amber-50 border-amber-100' },
]

export function AIModelsCards() {
  const [models, setModels] = useState<AIModelsMap | null>(null)

  useEffect(() => {
    fetchAIModels().then(setModels).catch(() => setModels(null))
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
      <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: C.text900 }}>
        Modelos de IA em Uso
      </h3>
      <div className="grid md:grid-cols-2 gap-4">
        {MODELS_DISPLAY.map((m) => (
          <div
            key={m.key}
            className={`flex items-center gap-3 p-4 rounded-lg border ${m.borderClass}`}
          >
            <div>
              <p className="text-sm font-medium" style={{ color: C.text700 }}>{m.label}</p>
              <p className={`text-xs font-mono ${m.colorClass}`}>
                {models ? (models[m.key]?.modelo ?? 'Não configurado') : 'Carregando...'}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
