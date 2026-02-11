import { useCallback, useEffect, useMemo, useState } from 'react'
import { adminApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import {
  Download,
  Search,
  MessageSquare,
  CheckCircle2,
  Clock3,
  ChartNoAxesColumn,
} from 'lucide-react'
import { PageContainer } from '@/components/layout/PageContainer'
import { PageHeader } from '@/components/layout'

interface DashboardData {
  total_consultas: number
  total_feedbacks: number
  taxa_acerto: number
  consultas_sem_feedback: number
  avaliacoes: {
    correto: number
    parcial: number
    incorreto: number
    erro_ia: number
  }
}

interface FeedbackEvolution {
  data: string
  total: number
}

const SISTEMAS = [
  { value: '', label: 'Todos os sistemas' },
  { value: 'assistencia_judiciaria', label: 'Assistência Judiciária' },
  { value: 'matriculas', label: 'Matrículas Confrontantes' },
  { value: 'gerador_pecas', label: 'Gerador de Peças' },
  { value: 'pedido_calculo', label: 'Pedido de Cálculo' },
  { value: 'prestacao_contas', label: 'Prestação de Contas' },
  { value: 'relatorio_cumprimento', label: 'Relatório de Cumprimento' },
]

const MESES = [
  { value: '', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]

const currentYear = new Date().getFullYear()
const ANOS = [
  { value: '', label: 'Todos os anos' },
  { value: String(currentYear), label: String(currentYear) },
  { value: String(currentYear - 1), label: String(currentYear - 1) },
  { value: String(currentYear - 2), label: String(currentYear - 2) },
]

const PIE_COLORS = ['#22c55e', '#eab308', '#ef4444', '#6b7280']

export function FeedbacksPage() {
  const { toast } = useToast()

  const [mes, setMes] = useState('')
  const [ano, setAno] = useState(String(currentYear))
  const [sistema, setSistema] = useState('')

  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [evolucao, setEvolucao] = useState<FeedbackEvolution[]>([])
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState(false)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (mes) params.append('mes', mes)
      if (ano) params.append('ano', ano)
      if (sistema) params.append('sistema', sistema)

      const [dashboardData, evolucaoData] = await Promise.all([
        adminApi.get<DashboardData>(`/admin/feedbacks/dashboard?${params.toString()}`),
        adminApi.get<FeedbackEvolution[]>(`/admin/feedbacks/evolucao?${params.toString()}`),
      ])

      setDashboard(dashboardData)
      setEvolucao(Array.isArray(evolucaoData) ? evolucaoData : [])
    } catch (error) {
      toast({
        title: 'Erro ao carregar feedbacks',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
      setDashboard(null)
      setEvolucao([])
    } finally {
      setLoading(false)
    }
  }, [mes, ano, sistema, toast])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  const exportarDados = async () => {
    setExportando(true)
    try {
      const blob = await adminApi.blob('/admin/feedbacks/exportar')
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `feedbacks_${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      toast({
        title: 'Erro ao exportar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setExportando(false)
    }
  }

  const limparFiltros = () => {
    setMes('')
    setAno(String(currentYear))
    setSistema('')
  }

  const pieData = useMemo(() => {
    const base = dashboard?.avaliacoes
    return [
      { name: 'Corretas', value: base?.correto ?? 0 },
      { name: 'Parciais', value: base?.parcial ?? 0 },
      { name: 'Incorretas', value: base?.incorreto ?? 0 },
      { name: 'Erro IA', value: base?.erro_ia ?? 0 },
    ]
  }, [dashboard])

  const lineData = useMemo(() => {
    if (evolucao.length > 0) return evolucao
    return [{ data: ' ', total: 0 }]
  }, [evolucao])

  const filtroInfo = ano ? `Filtro: ${ano}` : 'Filtro: todos'

  return (
    <PageContainer wide>
      <PageHeader
        title="Dashboard de Feedbacks"
        description="Avaliações das análises de IA"
        actions={
          <Button
            onClick={exportarDados}
            disabled={exportando}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            {exportando ? 'Exportando...' : 'Exportar'}
          </Button>
        }
      />

      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Período:</label>
              <Select value={mes || '__all_months__'} onValueChange={(v) => setMes(v === '__all_months__' ? '' : v)}>
                <SelectTrigger className="w-[170px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => (
                    <SelectItem key={m.value || '__all_months__'} value={m.value || '__all_months__'}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ano || '__all_years__'} onValueChange={(v) => setAno(v === '__all_years__' ? '' : v)}>
                <SelectTrigger className="w-[120px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ANOS.map((a) => (
                    <SelectItem key={a.value || '__all_years__'} value={a.value || '__all_years__'}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Sistema:</label>
              <Select value={sistema || '__all_systems__'} onValueChange={(v) => setSistema(v === '__all_systems__' ? '' : v)}>
                <SelectTrigger className="w-[220px] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SISTEMAS.map((s) => (
                    <SelectItem key={s.value || '__all_systems__'} value={s.value || '__all_systems__'}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <button
              onClick={limparFiltros}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              Limpar filtros
            </button>

            <span className="text-xs text-gray-500 ml-auto">{filtroInfo}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total de Consultas</p>
                <p className="text-4xl leading-none mt-1 font-bold text-gray-900">{dashboard?.total_consultas ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Search className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Feedbacks Recebidos</p>
                <p className="text-4xl leading-none mt-1 font-bold text-gray-900">{dashboard?.total_feedbacks ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Taxa de Acerto</p>
                <p className="text-4xl leading-none mt-1 font-bold text-green-600">{(dashboard?.taxa_acerto ?? 0).toFixed(0)}%</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Sem Avaliação</p>
                <p className="text-4xl leading-none mt-1 font-bold text-orange-600">{dashboard?.consultas_sem_feedback ?? 0}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Clock3 className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-3 font-semibold text-gray-800 mb-4">Distribuição de Avaliações</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((entry, index) => (
                      <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-600">
              <div className="flex items-center gap-1"><span className="h-2.5 w-10 bg-[#22c55e]" />Corretas</div>
              <div className="flex items-center gap-1"><span className="h-2.5 w-10 bg-[#eab308]" />Parciais</div>
              <div className="flex items-center gap-1"><span className="h-2.5 w-10 bg-[#ef4444]" />Incorretas</div>
              <div className="flex items-center gap-1"><span className="h-2.5 w-10 bg-[#6b7280]" />Erro IA</div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <h3 className="text-3 font-semibold text-gray-800 mb-4">Feedbacks do Período</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid stroke="#E2E3E5" strokeDasharray="3 3" />
                  <XAxis dataKey="data" stroke="#8D8F92" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#8D8F92" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2} dot={false} name="Feedbacks" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <ChartNoAxesColumn className="h-5 w-5 text-blue-500" />
              Evolução da Taxa de Acerto por Sistema
            </h3>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Sistema:</label>
                <Select value="__all_systems__" onValueChange={() => undefined}>
                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all_systems__">Todos os sistemas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Período:</label>
                <Select value="12" onValueChange={() => undefined}>
                  <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="8">Últimas 8 semanas</SelectItem>
                    <SelectItem value="12">Últimas 12 semanas</SelectItem>
                    <SelectItem value="16">Últimas 16 semanas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">Métrica:</label>
                <Select value="taxa" onValueChange={() => undefined}>
                  <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="taxa">Taxa de Acerto (%)</SelectItem>
                    <SelectItem value="total">Total de Feedbacks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="h-28 flex items-center justify-center text-gray-500 text-lg">
            {loading ? 'Carregando dados...' : 'Nenhum dado de evolução disponível no período'}
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
