import { useCallback, useEffect, useMemo, useState } from 'react'
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
} from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'

import { fetchDashboard, exportFeedbacks } from './api'
import { SISTEMAS, MESES, ANOS, PIE_COLORS } from './constants'
import type { DashboardData, FeedbackItem } from './types'

import { EvolutionChart } from './components/EvolutionChart'
import { AIModelsCards } from './components/AIModelsCards'
import { UsersFeedbackTable } from './components/UsersFeedbackTable'
import { PendingEvaluationTable } from './components/PendingEvaluationTable'
import { FeedbacksTable } from './components/FeedbacksTable'
import { ReportModal } from './components/ReportModal'
import { CommentModal } from './components/CommentModal'
import { CurationAuditModal } from './components/CurationAuditModal'

const currentYear = new Date().getFullYear()

export function FeedbacksPage() {
  const { toast } = useToast()

  // ---------------------------------------------------------------------------
  // Filtros globais
  // ---------------------------------------------------------------------------
  const [mes, setMes] = useState('')
  const [ano, setAno] = useState(String(currentYear))
  const [sistema, setSistema] = useState('')
  const [semanasEvolucao, setSemanasEvolucao] = useState('12')

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(false)
  const [exportando, setExportando] = useState(false)

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchDashboard({
        mes: mes || undefined,
        ano: ano || undefined,
        sistema: sistema || undefined,
        semanas_evolucao: semanasEvolucao,
      })
      setDashboard(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar feedbacks',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
      setDashboard(null)
    } finally {
      setLoading(false)
    }
  }, [mes, ano, sistema, semanasEvolucao, toast])

  useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  // ---------------------------------------------------------------------------
  // Modais
  // ---------------------------------------------------------------------------
  const [reportModal, setReportModal] = useState<{ open: boolean; consultaId: number | null; sistema: string | null }>({
    open: false, consultaId: null, sistema: null,
  })
  const [commentModal, setCommentModal] = useState<{ open: boolean; usuario: string; comentario: string }>({
    open: false, usuario: '', comentario: '',
  })
  const [curationModal, setCurationModal] = useState<{ open: boolean; geracaoId: number | null }>({
    open: false, geracaoId: null,
  })

  const handleViewReport = (consultaId: number, sis: string) => {
    setReportModal({ open: true, consultaId, sistema: sis })
  }

  const handleViewComment = (fb: FeedbackItem) => {
    setCommentModal({ open: true, usuario: fb.usuario, comentario: fb.comentario ?? '' })
  }

  const handleOpenCurationAudit = (geracaoId: number) => {
    setCurationModal({ open: true, geracaoId })
  }

  // ---------------------------------------------------------------------------
  // Exportar
  // ---------------------------------------------------------------------------
  const exportarDados = async () => {
    setExportando(true)
    try {
      const blob = await exportFeedbacks()
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

  // ---------------------------------------------------------------------------
  // Filtros
  // ---------------------------------------------------------------------------
  const limparFiltros = () => {
    setMes('')
    setAno(String(currentYear))
    setSistema('')
  }

  const filtroInfo = ano ? `Filtro: ${ano}` : 'Filtro: todos'

  // ---------------------------------------------------------------------------
  // Dados dos gráficos
  // ---------------------------------------------------------------------------
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
    const evo = dashboard?.evolucao_por_sistema
    if (!evo) return [{ data: ' ', total: 0 }]

    const porSemana: Record<string, number> = {}
    for (const semanas of Object.values(evo)) {
      for (const s of semanas) {
        porSemana[s.semana] = (porSemana[s.semana] ?? 0) + s.total
      }
    }
    const entries = Object.entries(porSemana)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([semana, total]) => ({ data: semana, total }))

    return entries.length > 0 ? entries : [{ data: ' ', total: 0 }]
  }, [dashboard])

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <>
      <BreadcrumbBar
        title="Dashboard de Feedbacks"
        icon={<MessageSquare className="w-3.5 h-3.5" />}
        actions={
          <Button
            onClick={exportarDados}
            disabled={exportando}
            className="text-white"
            style={{ background: C.statusSuccess }}
          >
            <Download className="h-4 w-4 mr-2" />
            {exportando ? 'Exportando...' : 'Exportar'}
          </Button>
        }
      />
      <ContentArea className="space-y-6">
        {/* ============================================================= */}
        {/* Filtros globais                                                */}
        {/* ============================================================= */}
        <div className="bg-white rounded-2xl shadow-sm p-4 border" style={{ borderColor: C.gray200 }}>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium" style={{ color: C.text700 }}>Período:</label>
              <Select value={mes || '__all_months__'} onValueChange={(v) => setMes(v === '__all_months__' ? '' : v)}>
                <SelectTrigger className="w-[170px] h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m) => (
                    <SelectItem key={m.value || '__all_months__'} value={m.value || '__all_months__'}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={ano || '__all_years__'} onValueChange={(v) => setAno(v === '__all_years__' ? '' : v)}>
                <SelectTrigger className="w-[120px] h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANOS.map((a) => (
                    <SelectItem key={a.value || '__all_years__'} value={a.value || '__all_years__'}>{a.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium" style={{ color: C.text700 }}>Sistema:</label>
              <Select value={sistema || '__all_systems__'} onValueChange={(v) => setSistema(v === '__all_systems__' ? '' : v)}>
                <SelectTrigger className="w-[220px] h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all_systems__">Todos os sistemas</SelectItem>
                  {SISTEMAS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
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

            <span className="text-xs ml-auto" style={{ color: C.text500 }}>{filtroInfo}</span>
          </div>
        </div>

        {/* ============================================================= */}
        {/* Cards resumo                                                   */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: C.text500 }}>Total de Consultas</p>
                <p className="text-4xl leading-none mt-1 font-bold" style={{ color: C.text900 }}>{dashboard?.total_consultas ?? 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: C.navy100 }}>
                <Search className="h-6 w-6" style={{ color: C.navy600 }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: C.text500 }}>Feedbacks Recebidos</p>
                <p className="text-4xl leading-none mt-1 font-bold" style={{ color: C.text900 }}>{dashboard?.total_feedbacks ?? 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: C.navy100 }}>
                <MessageSquare className="h-6 w-6" style={{ color: C.navy600 }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: C.text500 }}>Taxa de Acerto</p>
                <p className="text-4xl leading-none mt-1 font-bold" style={{ color: C.statusSuccess }}>{(dashboard?.taxa_acerto ?? 0).toFixed(0)}%</p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: C.successBgStrong }}>
                <CheckCircle2 className="h-6 w-6" style={{ color: C.statusSuccess }} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm" style={{ color: C.text500 }}>Sem Avaliação</p>
                <p className="text-4xl leading-none mt-1 font-bold" style={{ color: C.orange600 }}>{dashboard?.consultas_sem_feedback ?? 0}</p>
              </div>
              <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: C.orange100 }}>
                <Clock3 className="h-6 w-6" style={{ color: C.orange600 }} />
              </div>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* Gráficos: pizza + linha                                        */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
            <h3 className="text-3 font-semibold mb-4" style={{ color: C.text900 }}>Distribuição de Avaliações</h3>
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
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs" style={{ color: C.text500 }}>
              <div className="flex items-center gap-1"><span className="h-2.5 w-10 bg-[#22c55e]" />Corretas</div>
              <div className="flex items-center gap-1"><span className="h-2.5 w-10 bg-[#eab308]" />Parciais</div>
              <div className="flex items-center gap-1"><span className="h-2.5 w-10 bg-[#ef4444]" />Incorretas</div>
              <div className="flex items-center gap-1"><span className="h-2.5 w-10 bg-[#6b7280]" />Erro IA</div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6 border" style={{ borderColor: C.gray200 }}>
            <h3 className="text-3 font-semibold mb-4" style={{ color: C.text900 }}>Feedbacks do Período</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData}>
                  <CartesianGrid stroke={C.gray200} strokeDasharray="3 3" />
                  <XAxis dataKey="data" stroke={C.gray500} tick={{ fontSize: 12 }} />
                  <YAxis stroke={C.gray500} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke={C.chartBlue} strokeWidth={2} dot={false} name="Feedbacks" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* ============================================================= */}
        {/* Evolução por sistema (gráfico funcional)                       */}
        {/* ============================================================= */}
        <EvolutionChart
          data={dashboard?.evolucao_por_sistema ?? {}}
          loading={loading}
          onSemanasChange={setSemanasEvolucao}
        />

        {/* ============================================================= */}
        {/* Modelos de IA em uso                                           */}
        {/* ============================================================= */}
        <AIModelsCards />

        {/* ============================================================= */}
        {/* Top 10 usuários + Pendentes                                    */}
        {/* ============================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UsersFeedbackTable data={dashboard?.feedbacks_por_usuario ?? []} />
          <PendingEvaluationTable
            data={dashboard?.pendentes_feedback ?? []}
            onViewReport={handleViewReport}
          />
        </div>

        {/* ============================================================= */}
        {/* Tabela de feedbacks com paginação server-side                   */}
        {/* ============================================================= */}
        <FeedbacksTable
          sistema={sistema}
          mes={mes}
          ano={ano}
          onViewReport={handleViewReport}
          onViewComment={handleViewComment}
        />
      </ContentArea>

      {/* ================================================================= */}
      {/* Modais                                                            */}
      {/* ================================================================= */}
      <ReportModal
        open={reportModal.open}
        onClose={() => setReportModal({ open: false, consultaId: null, sistema: null })}
        consultaId={reportModal.consultaId}
        sistema={reportModal.sistema}
        onOpenCurationAudit={handleOpenCurationAudit}
      />

      <CommentModal
        open={commentModal.open}
        onClose={() => setCommentModal({ open: false, usuario: '', comentario: '' })}
        usuario={commentModal.usuario}
        comentario={commentModal.comentario}
      />

      <CurationAuditModal
        open={curationModal.open}
        onClose={() => setCurationModal({ open: false, geracaoId: null })}
        geracaoId={curationModal.geracaoId}
      />
    </>
  )
}
