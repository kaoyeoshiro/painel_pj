import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '@/lib/api'
import { PageContainer } from '@/components/layout'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/DataTable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MarkdownRenderer } from '@/components/shared/MarkdownRenderer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Download,
  FileText,
  ClipboardList,
  Users,
  Bot,
  AlertTriangle,
  Eye,
} from 'lucide-react'

// =============================================================================
// Tipos locais
// =============================================================================

interface DashboardData {
  total_consultas: number
  total_feedbacks: number
  taxa_acerto: number
  consultas_sem_feedback: number
  avaliacoes: { correto: number; parcial: number; incorreto: number; erro_ia: number }
}

interface FeedbackItem {
  id: number
  sistema: string
  usuario_nome: string
  avaliacao: 'correto' | 'parcial' | 'incorreto' | null
  comentario: string | null
  created_at: string
  modo_geracao?: string
}

interface FeedbackLista {
  feedbacks: FeedbackItem[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

/** Dados de evolucao temporal dos feedbacks */
interface FeedbackEvolution {
  data: string
  total: number
  correto: number
  parcial: number
  incorreto: number
  taxa_acerto: number
}

/** Ranking de usuarios com mais feedbacks */
interface TopUsuario {
  usuario_nome: string
  total_feedbacks: number
  taxa_acerto: number
}

/** Modelo de IA em uso no sistema */
interface ModeloEmUso {
  modelo: string
  sistema: string
  total_chamadas: number
}

/** Detalhes do relatorio associado a um feedback */
interface FeedbackRelatorio {
  id: number
  sistema: string
  numero_cnj: string
  conteudo_gerado: string
  historico_chat: Array<{ role: string; content: string }>
  versoes: Array<{ versao: number; conteudo: string; criado_em: string }>
}

/** Feedback pendente de avaliacao */
interface FeedbackPendente {
  id: number
  sistema: string
  usuario_nome: string
  created_at: string
}

// =============================================================================
// Constantes
// =============================================================================

const SISTEMAS = [
  { value: '', label: 'Todos os sistemas' },
  { value: 'gerador_pecas', label: 'Gerador de Pecas' },
  { value: 'relatorio_cumprimento', label: 'Relatorio de Cumprimento' },
  { value: 'pedido_calculo', label: 'Pedido de Calculo' },
  { value: 'prestacao_contas', label: 'Prestacao de Contas' },
]

const MESES = [
  { value: '', label: 'Todos os meses' },
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Marco' },
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

const AVALIACOES = [
  { value: '', label: 'Todas as avaliacoes' },
  { value: 'correto', label: 'Correto' },
  { value: 'parcial', label: 'Parcial' },
  { value: 'incorreto', label: 'Incorreto' },
  { value: 'sem_avaliacao', label: 'Sem avaliacao' },
]

const PERIODOS_EVOLUCAO = [
  { value: '7d', label: 'Ultimos 7 dias' },
  { value: '30d', label: 'Ultimos 30 dias' },
  { value: '90d', label: 'Ultimos 90 dias' },
  { value: '1ano', label: 'Ultimo ano' },
]

const METRICAS_EVOLUCAO = [
  { value: 'taxa_acerto', label: 'Taxa de Acerto (%)' },
  { value: 'total', label: 'Total de Feedbacks' },
  { value: 'media', label: 'Media' },
]

/** Cores padrao para graficos */
const CORES_GRAFICO = {
  correto: '#22c55e',
  parcial: '#f59e0b',
  incorreto: '#ef4444',
  total: '#3b82f6',
  taxa_acerto: '#8b5cf6',
}

/** Cores para fatias do PieChart */
const CORES_PIE = [CORES_GRAFICO.correto, CORES_GRAFICO.parcial, CORES_GRAFICO.incorreto]

// Gerar anos (ano atual - 2 ate ano atual)
const currentYear = new Date().getFullYear()
const ANOS = [
  { value: '', label: 'Todos os anos' },
  ...Array.from({ length: 3 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  })),
]

// =============================================================================
// Componente principal
// =============================================================================

export function FeedbacksPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [feedbacks, setFeedbacks] = useState<FeedbackLista | null>(null)

  // Filtros gerais
  const [sistema, setSistema] = useState('')
  const [mes, setMes] = useState('')
  const [ano, setAno] = useState('')
  const [avaliacao, setAvaliacao] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Filtros de evolucao
  const [evolucaoSistema, setEvolucaoSistema] = useState('')
  const [evolucaoPeriodo, setEvolucaoPeriodo] = useState('30d')
  const [evolucaoMetrica, setEvolucaoMetrica] = useState('taxa_acerto')

  // Dados complementares
  const [evolucaoData, setEvolucaoData] = useState<FeedbackEvolution[]>([])
  const [topUsuarios, setTopUsuarios] = useState<TopUsuario[]>([])
  const [modelosEmUso, setModelosEmUso] = useState<ModeloEmUso[]>([])
  const [pendentes, setPendentes] = useState<FeedbackPendente[]>([])
  const [loadingEvolucao, setLoadingEvolucao] = useState(false)
  const [exportando, setExportando] = useState(false)

  // Modal de relatorio
  const [relatorioModalOpen, setRelatorioModalOpen] = useState(false)
  const [relatorioData, setRelatorioData] = useState<FeedbackRelatorio | null>(null)
  const [loadingRelatorio, setLoadingRelatorio] = useState(false)

  // ---------------------------------------------------------------------------
  // Funcoes de carregamento de dados
  // ---------------------------------------------------------------------------

  /** Carrega estatisticas do dashboard */
  const carregarDashboard = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (mes) params.append('mes', mes)
      if (ano) params.append('ano', ano)
      if (sistema) params.append('sistema', sistema)

      const response = await adminApi.get<DashboardData>(`/admin/feedbacks/dashboard?${params}`)
      setDashboard(response)
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar estatisticas de feedbacks',
        variant: 'destructive',
      })
    }
  }, [mes, ano, sistema, toast])

  /** Carrega lista paginada de feedbacks */
  const carregarFeedbacks = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sistema) params.append('sistema', sistema)
      if (avaliacao) params.append('avaliacao', avaliacao)
      params.append('page', String(page))
      params.append('page_size', String(pageSize))

      const response = await adminApi.get<FeedbackLista>(`/admin/feedbacks/lista?${params}`)
      setFeedbacks(response)
    } catch (error) {
      console.error('Erro ao carregar feedbacks:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar lista de feedbacks',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [sistema, avaliacao, page, toast])

  /** Carrega dados de evolucao temporal */
  const carregarEvolucao = useCallback(async () => {
    setLoadingEvolucao(true)
    try {
      const params = new URLSearchParams()
      if (evolucaoSistema) params.append('sistema', evolucaoSistema)
      params.append('periodo', evolucaoPeriodo)
      params.append('metrica', evolucaoMetrica)

      const response = await adminApi.get<FeedbackEvolution[]>(
        `/admin/feedbacks/evolucao?${params}`
      )
      setEvolucaoData(response)
    } catch (error) {
      console.error('Erro ao carregar evolucao:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar dados de evolucao',
        variant: 'destructive',
      })
    } finally {
      setLoadingEvolucao(false)
    }
  }, [evolucaoSistema, evolucaoPeriodo, evolucaoMetrica, toast])

  /** Carrega top 10 usuarios */
  const carregarTopUsuarios = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (mes) params.append('mes', mes)
      if (ano) params.append('ano', ano)

      const response = await adminApi.get<TopUsuario[]>(
        `/admin/feedbacks/top-usuarios?${params}`
      )
      setTopUsuarios(response)
    } catch (error) {
      console.error('Erro ao carregar top usuarios:', error)
    }
  }, [mes, ano])

  /** Carrega modelos de IA em uso */
  const carregarModelosEmUso = useCallback(async () => {
    try {
      const response = await adminApi.get<ModeloEmUso[]>('/admin/feedbacks/modelos-em-uso')
      setModelosEmUso(response)
    } catch (error) {
      console.error('Erro ao carregar modelos em uso:', error)
    }
  }, [])

  /** Carrega feedbacks pendentes de avaliacao */
  const carregarPendentes = useCallback(async () => {
    try {
      const response = await adminApi.get<FeedbackPendente[]>('/admin/feedbacks/pendentes')
      setPendentes(response)
    } catch (error) {
      console.error('Erro ao carregar pendentes:', error)
    }
  }, [])

  /** Exporta feedbacks como CSV */
  const exportarFeedbacks = async () => {
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
      toast({
        title: 'Sucesso',
        description: 'Arquivo exportado com sucesso',
      })
    } catch (error) {
      console.error('Erro ao exportar feedbacks:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao exportar feedbacks',
        variant: 'destructive',
      })
    } finally {
      setExportando(false)
    }
  }

  /** Abre modal com detalhes do relatorio de um feedback */
  const abrirRelatorio = async (feedbackId: number) => {
    setRelatorioModalOpen(true)
    setLoadingRelatorio(true)
    setRelatorioData(null)
    try {
      const response = await adminApi.get<FeedbackRelatorio>(
        `/admin/feedbacks/${feedbackId}/relatorio`
      )
      setRelatorioData(response)
    } catch (error) {
      console.error('Erro ao carregar relatorio:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar detalhes do relatorio',
        variant: 'destructive',
      })
      setRelatorioModalOpen(false)
    } finally {
      setLoadingRelatorio(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Effects - recarrega dados quando filtros mudam
  // ---------------------------------------------------------------------------

  useEffect(() => {
    carregarDashboard()
  }, [carregarDashboard])

  useEffect(() => {
    carregarFeedbacks()
  }, [carregarFeedbacks])

  useEffect(() => {
    carregarEvolucao()
  }, [carregarEvolucao])

  useEffect(() => {
    carregarTopUsuarios()
  }, [carregarTopUsuarios])

  // Modelos e pendentes carregam uma vez
  useEffect(() => {
    carregarModelosEmUso()
    carregarPendentes()
  }, [carregarModelosEmUso, carregarPendentes])

  // ---------------------------------------------------------------------------
  // Helpers de renderizacao
  // ---------------------------------------------------------------------------

  /** Renderiza badge colorido conforme tipo de avaliacao */
  const renderAvaliacaoBadge = (avaliacaoValue: 'correto' | 'parcial' | 'incorreto' | null) => {
    if (!avaliacaoValue) {
      return <Badge variant="secondary">Sem avaliacao</Badge>
    }

    const variants = {
      correto: { variant: 'success' as const, label: 'Correto' },
      parcial: { variant: 'warning' as const, label: 'Parcial' },
      incorreto: { variant: 'destructive' as const, label: 'Incorreto' },
    }

    const config = variants[avaliacaoValue]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  /** Formata data ISO para exibicao pt-BR */
  const formatarData = (dataStr: string) => {
    const data = new Date(dataStr)
    return data.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /** Calcula porcentagens para a barra de distribuicao */
  const calcularDistribuicao = () => {
    if (!dashboard || dashboard.total_feedbacks === 0) {
      return { correto: 0, parcial: 0, incorreto: 0 }
    }

    const total = dashboard.total_feedbacks
    return {
      correto: (dashboard.avaliacoes.correto / total) * 100,
      parcial: (dashboard.avaliacoes.parcial / total) * 100,
      incorreto: (dashboard.avaliacoes.incorreto / total) * 100,
    }
  }

  const distribuicao = calcularDistribuicao()

  /** Monta dados para o PieChart de distribuicao */
  const dadosPie = dashboard
    ? [
        { name: 'Correto', value: dashboard.avaliacoes.correto },
        { name: 'Parcial', value: dashboard.avaliacoes.parcial },
        { name: 'Incorreto', value: dashboard.avaliacoes.incorreto },
      ]
    : []

  /** Agrupa dados de evolucao por sistema para o grafico de barras */
  const dadosEvolucaoPorSistema = evolucaoData.reduce<
    Array<{ data: string; [key: string]: string | number }>
  >((acc, item) => {
    const existing = acc.find((a) => a.data === item.data)
    if (existing) {
      existing.total = (existing.total as number) + item.total
    } else {
      acc.push({ data: item.data, total: item.total })
    }
    return acc
  }, [])

  // ---------------------------------------------------------------------------
  // Colunas da tabela principal
  // ---------------------------------------------------------------------------

  const columns = [
    {
      accessor: 'sistema',
      header: 'Sistema',
      render: (_value: unknown, row: FeedbackItem) => (
        <span className="font-medium">{row.sistema}</span>
      ),
    },
    {
      accessor: 'usuario_nome',
      header: 'Usuario',
    },
    {
      accessor: 'avaliacao',
      header: 'Avaliacao',
      render: (_value: unknown, row: FeedbackItem) => renderAvaliacaoBadge(row.avaliacao),
    },
    {
      accessor: 'comentario',
      header: 'Comentario',
      render: (_value: unknown, row: FeedbackItem) => (
        <span className="text-sm text-gray-600 truncate max-w-md block">
          {row.comentario || '-'}
        </span>
      ),
    },
    {
      accessor: 'created_at',
      header: 'Data',
      render: (_value: unknown, row: FeedbackItem) => (
        <span className="text-sm">{formatarData(row.created_at)}</span>
      ),
    },
    {
      accessor: 'acoes',
      header: 'Acoes',
      render: (_value: unknown, row: FeedbackItem) => (
        <Button
          variant="ghost"
          size="sm"
          data-testid={`btn-relatorio-${row.id}`}
          onClick={(e) => {
            e.stopPropagation()
            abrirRelatorio(row.id)
          }}
        >
          <Eye className="h-4 w-4 mr-1" />
          Ver Relatorio
        </Button>
      ),
    },
  ]

  // ---------------------------------------------------------------------------
  // Renderizacao
  // ---------------------------------------------------------------------------

  return (
    <PageContainer className="space-y-6">
      {/* Titulo e botoes de acao */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Feedbacks</h1>
          <p className="text-gray-600 mt-1">
            Acompanhamento de avaliacoes e comentarios dos usuarios
          </p>
        </div>
        <div className="flex gap-2">
          {/* 21.21 - Botao de auditoria completa */}
          <Button
            variant="outline"
            data-testid="btn-auditoria"
            onClick={() => window.open('/admin/feedbacks/auditoria', '_blank')}
          >
            <ClipboardList className="h-4 w-4 mr-2" />
            Auditoria Completa
          </Button>

          {/* 21.1 - Botao de exportar */}
          <Button
            data-testid="btn-exportar"
            onClick={exportarFeedbacks}
            disabled={exportando}
          >
            <Download className="h-4 w-4 mr-2" />
            {exportando ? 'Exportando...' : 'Exportar'}
          </Button>
        </div>
      </div>

      {/* Filtros principais */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Filtro Sistema */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium mb-1">Sistema</label>
            <select
              data-testid="filtro-sistema"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={sistema}
              onChange={(e) => {
                setSistema(e.target.value)
                setPage(1)
              }}
            >
              {SISTEMAS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Mes */}
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">Mes</label>
            <select
              data-testid="filtro-mes"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
            >
              {MESES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro Ano */}
          <div className="flex-1 min-w-[130px]">
            <label className="block text-sm font-medium mb-1">Ano</label>
            <select
              data-testid="filtro-ano"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
            >
              {ANOS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* 21.7 - Filtro Avaliacao */}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-sm font-medium mb-1">Avaliacao</label>
            <select
              data-testid="filtro-avaliacao"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={avaliacao}
              onChange={(e) => {
                setAvaliacao(e.target.value)
                setPage(1)
              }}
            >
              {AVALIACOES.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {/* Botao limpar filtros */}
          <Button
            variant="outline"
            data-testid="btn-limpar-filtros"
            onClick={() => {
              setSistema('')
              setMes('')
              setAno('')
              setAvaliacao('')
              setPage(1)
            }}
          >
            Limpar Filtros
          </Button>
        </div>
      </Card>

      {/* Cards de Estatisticas */}
      {dashboard && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total de Consultas</div>
            <div className="text-2xl font-bold mt-1">
              {dashboard.total_consultas.toLocaleString()}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total de Feedbacks</div>
            <div className="text-2xl font-bold mt-1">
              {dashboard.total_feedbacks.toLocaleString()}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Taxa de Acerto</div>
            <div className="text-2xl font-bold mt-1 text-green-600">
              {dashboard.taxa_acerto.toFixed(1)}%
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Sem Feedback</div>
            <div className="text-2xl font-bold mt-1">
              {dashboard.consultas_sem_feedback.toLocaleString()}
            </div>
          </Card>
        </div>
      )}

      {/* Distribuicao de Avaliacoes - Barra + PieChart (21.12) */}
      {dashboard && dashboard.total_feedbacks > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Barra horizontal de distribuicao (existente) */}
          <Card className="p-4">
            <h3 className="font-semibold mb-3">Distribuicao de Avaliacoes</h3>
            <div className="flex h-8 rounded-md overflow-hidden">
              <div
                className="bg-green-500 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${distribuicao.correto}%` }}
              >
                {distribuicao.correto > 10 && `${distribuicao.correto.toFixed(0)}%`}
              </div>
              <div
                className="bg-amber-500 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${distribuicao.parcial}%` }}
              >
                {distribuicao.parcial > 10 && `${distribuicao.parcial.toFixed(0)}%`}
              </div>
              <div
                className="bg-red-500 flex items-center justify-center text-white text-sm font-medium"
                style={{ width: `${distribuicao.incorreto}%` }}
              >
                {distribuicao.incorreto > 10 && `${distribuicao.incorreto.toFixed(0)}%`}
              </div>
            </div>
            <div className="flex gap-4 mt-3 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded"></div>
                <span>Correto: {dashboard.avaliacoes.correto}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-amber-500 rounded"></div>
                <span>Parcial: {dashboard.avaliacoes.parcial}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span>Incorreto: {dashboard.avaliacoes.incorreto}</span>
              </div>
            </div>
          </Card>

          {/* PieChart de distribuicao - complementar ao legado */}
          <Card className="p-4" data-testid="chart-pie-distribuicao">
            <h3 className="font-semibold mb-3">Distribuicao (Grafico)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={dadosPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {dadosPie.map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={CORES_PIE[index % CORES_PIE.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      {/* 21.8 / 21.9 / 21.10 - Filtros de Evolucao + Graficos */}
      <Card className="p-4" data-testid="secao-evolucao">
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <h3 className="font-semibold text-lg mr-auto">Evolucao Temporal</h3>

          {/* 21.8 - Filtro evolucao por sistema */}
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium mb-1">Sistema</label>
            <Select
              value={evolucaoSistema}
              onValueChange={setEvolucaoSistema}
            >
              <SelectTrigger data-testid="filtro-evolucao-sistema">
                <SelectValue placeholder="Todos os sistemas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os sistemas</SelectItem>
                {SISTEMAS.filter((s) => s.value !== '').map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 21.9 - Filtro evolucao periodo */}
          <div className="min-w-[160px]">
            <label className="block text-sm font-medium mb-1">Periodo</label>
            <Select
              value={evolucaoPeriodo}
              onValueChange={setEvolucaoPeriodo}
            >
              <SelectTrigger data-testid="filtro-evolucao-periodo">
                <SelectValue placeholder="Selecione o periodo" />
              </SelectTrigger>
              <SelectContent>
                {PERIODOS_EVOLUCAO.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 21.10 - Filtro evolucao metrica */}
          <div className="min-w-[180px]">
            <label className="block text-sm font-medium mb-1">Metrica</label>
            <Select
              value={evolucaoMetrica}
              onValueChange={setEvolucaoMetrica}
            >
              <SelectTrigger data-testid="filtro-evolucao-metrica">
                <SelectValue placeholder="Selecione a metrica" />
              </SelectTrigger>
              <SelectContent>
                {METRICAS_EVOLUCAO.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loadingEvolucao ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Carregando dados de evolucao...
          </div>
        ) : evolucaoData.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            Nenhum dado de evolucao disponivel para os filtros selecionados.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 21.13 - Grafico de linha timeline */}
            <div data-testid="chart-timeline">
              <h4 className="text-sm font-medium mb-2">Timeline de Feedbacks</h4>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={evolucaoData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="data"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: string) => {
                      const d = new Date(value)
                      return d.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(label: string) => {
                      const d = new Date(label)
                      return d.toLocaleDateString('pt-BR')
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="correto"
                    stroke={CORES_GRAFICO.correto}
                    name="Correto"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="parcial"
                    stroke={CORES_GRAFICO.parcial}
                    name="Parcial"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="incorreto"
                    stroke={CORES_GRAFICO.incorreto}
                    name="Incorreto"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="taxa_acerto"
                    stroke={CORES_GRAFICO.taxa_acerto}
                    name="Taxa de Acerto (%)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* 21.14 - Grafico de barras evolucao por sistema */}
            <div data-testid="chart-evolucao-sistema">
              <h4 className="text-sm font-medium mb-2">Evolucao por Volume</h4>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dadosEvolucaoPorSistema}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="data"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value: string) => {
                      const d = new Date(value)
                      return d.toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                      })
                    }}
                  />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    labelFormatter={(label: string) => {
                      const d = new Date(label)
                      return d.toLocaleDateString('pt-BR')
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="total"
                    fill={CORES_GRAFICO.total}
                    name="Total"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </Card>

      {/* 21.18 - Modelos de IA em Uso */}
      <Card className="p-4" data-testid="secao-modelos-ia">
        <CardHeader className="p-0 pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Modelos de IA em Uso
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {modelosEmUso.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum modelo em uso encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {modelosEmUso.map((modelo, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30"
                  data-testid={`modelo-ia-${index}`}
                >
                  <Bot className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate" title={modelo.modelo}>
                      {modelo.modelo}
                    </div>
                    <div className="text-xs text-gray-500">
                      Sistema: {modelo.sistema}
                    </div>
                    <div className="text-xs text-gray-500">
                      Chamadas: {modelo.total_chamadas.toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 21.19 - Top 10 Usuarios + 21.20 - Pendentes de Avaliacao */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 10 usuarios por numero de feedbacks */}
        <Card className="p-4" data-testid="secao-top-usuarios">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 10 Usuarios
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topUsuarios.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum dado disponivel.</p>
            ) : (
              <div className="space-y-2">
                {topUsuarios.slice(0, 10).map((usuario, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded-lg"
                    data-testid={`top-usuario-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <span className="text-sm font-medium">{usuario.usuario_nome}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-600">
                        {usuario.total_feedbacks} feedback{usuario.total_feedbacks !== 1 ? 's' : ''}
                      </span>
                      <Badge variant={usuario.taxa_acerto >= 70 ? 'success' : usuario.taxa_acerto >= 40 ? 'warning' : 'destructive'}>
                        {usuario.taxa_acerto.toFixed(0)}% acerto
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feedbacks pendentes de avaliacao */}
        <Card className="p-4" data-testid="secao-pendentes">
          <CardHeader className="p-0 pb-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Pendentes de Avaliacao
              {pendentes.length > 0 && (
                <Badge variant="warning" className="ml-2">{pendentes.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {pendentes.length === 0 ? (
              <p className="text-sm text-gray-500">
                Nenhum feedback pendente de avaliacao.
              </p>
            ) : (
              <ScrollArea className="max-h-[360px]">
                <div className="space-y-2">
                  {pendentes.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 border rounded-lg"
                      data-testid={`pendente-${item.id}`}
                    >
                      <div>
                        <div className="text-sm font-medium">{item.sistema}</div>
                        <div className="text-xs text-gray-500">{item.usuario_nome}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {formatarData(item.created_at)}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-testid={`btn-ver-pendente-${item.id}`}
                          onClick={() => abrirRelatorio(item.id)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Feedbacks */}
      <Card>
        <DataTable
          data={feedbacks?.feedbacks || []}
          columns={columns}
          isLoading={loading}
          emptyMessage="Nenhum feedback encontrado"
        />

        {/* Paginacao */}
        {feedbacks && feedbacks.total > pageSize && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-sm text-gray-600">
              Mostrando {(page - 1) * pageSize + 1} a{' '}
              {Math.min(page * pageSize, feedbacks.total)} de {feedbacks.total}{' '}
              feedbacks
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={page * pageSize >= feedbacks.total}
              >
                Proxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 21.16 / 21.17 - Modal de Relatorio com Tabs */}
      <Dialog open={relatorioModalOpen} onOpenChange={setRelatorioModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detalhes do Relatorio
            </DialogTitle>
            <DialogDescription>
              {relatorioData
                ? `${relatorioData.sistema} - Processo ${relatorioData.numero_cnj}`
                : 'Carregando...'}
            </DialogDescription>
          </DialogHeader>

          {loadingRelatorio ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              Carregando relatorio...
            </div>
          ) : relatorioData ? (
            <Tabs defaultValue="relatorio" className="flex-1 overflow-hidden flex flex-col">
              <TabsList data-testid="tabs-relatorio">
                <TabsTrigger value="relatorio" data-testid="tab-relatorio">
                  Relatorio
                </TabsTrigger>
                <TabsTrigger value="chat" data-testid="tab-chat">
                  Chat
                </TabsTrigger>
                <TabsTrigger value="versoes" data-testid="tab-versoes">
                  Versoes
                </TabsTrigger>
              </TabsList>

              {/* Aba Relatorio */}
              <TabsContent value="relatorio" className="flex-1 overflow-auto">
                <ScrollArea className="h-full max-h-[55vh] p-4 border rounded-lg">
                  <MarkdownRenderer content={relatorioData.conteudo_gerado} />
                </ScrollArea>
              </TabsContent>

              {/* Aba Chat */}
              <TabsContent value="chat" className="flex-1 overflow-auto">
                <ScrollArea className="h-full max-h-[55vh]">
                  <div className="space-y-3 p-2">
                    {relatorioData.historico_chat.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">
                        Nenhum historico de chat disponivel.
                      </p>
                    ) : (
                      relatorioData.historico_chat.map((msg, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg text-sm ${
                            msg.role === 'user'
                              ? 'bg-blue-50 border-blue-200 border ml-8'
                              : 'bg-gray-50 border-gray-200 border mr-8'
                          }`}
                          data-testid={`chat-msg-${index}`}
                        >
                          <div className="font-medium text-xs mb-1 text-gray-500">
                            {msg.role === 'user' ? 'Usuario' : 'Assistente'}
                          </div>
                          <div className="whitespace-pre-wrap">{msg.content}</div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Aba Versoes */}
              <TabsContent value="versoes" className="flex-1 overflow-auto">
                <ScrollArea className="h-full max-h-[55vh]">
                  {relatorioData.versoes.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">
                      Nenhuma versao anterior disponivel.
                    </p>
                  ) : (
                    <div className="space-y-4 p-2">
                      {relatorioData.versoes.map((versao, index) => (
                        <div
                          key={index}
                          className="border rounded-lg p-3"
                          data-testid={`versao-${versao.versao}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="secondary">
                              Versao {versao.versao}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {formatarData(versao.criado_em)}
                            </span>
                          </div>
                          <div className="text-sm bg-muted/30 rounded p-2 whitespace-pre-wrap max-h-48 overflow-auto">
                            {versao.conteudo}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          ) : null}
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
