import { useMemo, useState } from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { C } from '@/lib/designTokens'
import {
  SISTEMAS,
  EVOLUCAO_CORES,
  EVOLUCAO_SEMANAS_OPTIONS,
  EVOLUCAO_METRICA_OPTIONS,
} from '../constants'
import type { EvolucaoSemana } from '../types'

interface EvolutionChartProps {
  data: Record<string, EvolucaoSemana[]>
  loading?: boolean
  /** Callback para recarregar dashboard com novo semanas_evolucao */
  onSemanasChange?: (semanas: string) => void
}

type Metrica = 'taxa_acerto' | 'total' | 'corretos'

/** Formata rótulo de semana: "2026-S05" → "S05" */
function formatarSemana(s: string): string {
  const match = s.match(/\d{4}-S(\d{2})/)
  return match ? `S${match[1]}` : s
}

export function EvolutionChart({ data, loading, onSemanasChange }: EvolutionChartProps) {
  const [sistemaFiltro, setSistemaFiltro] = useState('')
  const [semanas, setSemanas] = useState('12')
  const [metrica, setMetrica] = useState<Metrica>('taxa_acerto')

  const handleSemanasChange = (v: string) => {
    setSemanas(v)
    onSemanasChange?.(v)
  }

  /** Dados filtrados por sistema (se selecionado) */
  const dadosFiltrados = useMemo(() => {
    if (!data) return {}
    if (sistemaFiltro && data[sistemaFiltro]) {
      return { [sistemaFiltro]: data[sistemaFiltro] }
    }
    return data
  }, [data, sistemaFiltro])

  /** Dados agrupados para Recharts: array de objetos {semana, sistema1, sistema2, ...} */
  const chartData = useMemo(() => {
    const todasSemanas = new Set<string>()
    for (const arr of Object.values(dadosFiltrados)) {
      for (const d of arr) todasSemanas.add(d.semana)
    }
    const semanasOrdenadas = Array.from(todasSemanas).sort()

    return semanasOrdenadas.map((semana) => {
      const ponto: Record<string, string | number | null> = { semana: formatarSemana(semana) }
      for (const [sistema, arr] of Object.entries(dadosFiltrados)) {
        const d = arr.find((x) => x.semana === semana)
        if (!d) {
          ponto[sistema] = null
          continue
        }
        if (metrica === 'taxa_acerto') {
          ponto[sistema] = d.taxa_acerto ?? d.taxa ?? null
        } else if (metrica === 'total') {
          ponto[sistema] = d.total > 0 ? d.total : null
        } else {
          ponto[sistema] = (d.corretos ?? 0) > 0 ? d.corretos! : null
        }
      }
      return ponto
    })
  }, [dadosFiltrados, metrica])

  /** Sistemas que têm dados reais */
  const sistemasComDados = useMemo(() => {
    return Object.keys(dadosFiltrados).filter((sistema) => {
      const arr = dadosFiltrados[sistema]
      return arr.some((d) => {
        if (metrica === 'taxa_acerto') return (d.taxa_acerto ?? d.taxa) !== null
        if (metrica === 'total') return d.total > 0
        return (d.corretos ?? 0) > 0
      })
    })
  }, [dadosFiltrados, metrica])

  const yLabel =
    metrica === 'taxa_acerto' ? 'Taxa de Acerto (%)'
    : metrica === 'total' ? 'Total de Feedbacks'
    : 'Feedbacks Corretos'

  const semVazio = chartData.length === 0 || sistemasComDados.length === 0

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
      {/* Header com filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: C.text900 }}>
          Evolução da Taxa de Acerto por Sistema
        </h3>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: C.text500 }}>Sistema:</label>
            <Select value={sistemaFiltro || '__all__'} onValueChange={(v) => setSistemaFiltro(v === '__all__' ? '' : v)}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os sistemas</SelectItem>
                {SISTEMAS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.shortLabel}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: C.text500 }}>Período:</label>
            <Select value={semanas} onValueChange={handleSemanasChange}>
              <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVOLUCAO_SEMANAS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: C.text500 }}>Métrica:</label>
            <Select value={metrica} onValueChange={(v) => setMetrica(v as Metrica)}>
              <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVOLUCAO_METRICA_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Gráfico */}
      {loading ? (
        <div className="h-80 flex items-center justify-center text-sm" style={{ color: C.text500 }}>
          Carregando dados...
        </div>
      ) : semVazio ? (
        <div className="h-80 flex items-center justify-center text-sm" style={{ color: C.text500 }}>
          Nenhum dado de evolução disponível no período
        </div>
      ) : (
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid stroke={C.gray200} strokeDasharray="3 3" />
              <XAxis
                dataKey="semana"
                stroke={C.gray500}
                tick={{ fontSize: 12 }}
                label={{ value: 'Semana', position: 'insideBottomRight', offset: -5, style: { fontSize: 11, fill: C.gray500 } }}
              />
              <YAxis
                stroke={C.gray500}
                tick={{ fontSize: 12 }}
                domain={metrica === 'taxa_acerto' ? [0, 100] : [0, 'auto']}
                label={{ value: yLabel, angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: C.gray500 } }}
              />
              <Tooltip
                formatter={(value: number | null, name: string) => {
                  if (value === null || value === undefined) return ['Sem avaliações', name]
                  const sistemaConfig = SISTEMAS.find((s) => s.value === name)
                  const label = sistemaConfig?.shortLabel ?? name
                  return [metrica === 'taxa_acerto' ? `${value.toFixed(1)}%` : value, label]
                }}
              />
              <Legend
                formatter={(value: string) => {
                  const sistemaConfig = SISTEMAS.find((s) => s.value === value)
                  return sistemaConfig?.shortLabel ?? value
                }}
              />
              {sistemasComDados.map((sistema) => (
                <Line
                  key={sistema}
                  type="monotone"
                  dataKey={sistema}
                  stroke={EVOLUCAO_CORES[sistema]?.border ?? C.gray500}
                  strokeWidth={sistemasComDados.length === 1 ? 3 : 2}
                  dot={{ r: sistemasComDados.length === 1 ? 5 : 4 }}
                  connectNulls={false}
                  fill={sistemasComDados.length === 1 ? (EVOLUCAO_CORES[sistema]?.bg ?? 'rgba(107,114,128,0.2)') : undefined}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <p className="text-xs mt-2" style={{ color: C.text500 }}>
        Evolução independente do filtro de período do dashboard. Semanas sem avaliações aparecem como lacunas.
      </p>
    </div>
  )
}
