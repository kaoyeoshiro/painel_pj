import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
// Usa native <select> para filtros simples
import { DataTable } from '@/components/shared/DataTable'

// Tipos locais
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

const SISTEMAS = [
  { value: '', label: 'Todos os sistemas' },
  { value: 'gerador_pecas', label: 'Gerador de Peças' },
  { value: 'relatorio_cumprimento', label: 'Relatório de Cumprimento' },
  { value: 'pedido_calculo', label: 'Pedido de Cálculo' },
  { value: 'prestacao_contas', label: 'Prestação de Contas' },
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

// Gerar anos (ano atual - 2 até ano atual)
const currentYear = new Date().getFullYear()
const ANOS = [
  { value: '', label: 'Todos os anos' },
  ...Array.from({ length: 3 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  })),
]

export function FeedbacksPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [feedbacks, setFeedbacks] = useState<FeedbackLista | null>(null)

  // Filtros
  const [sistema, setSistema] = useState('')
  const [mes, setMes] = useState('')
  const [ano, setAno] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Carregar dashboard
  const carregarDashboard = async () => {
    try {
      const params = new URLSearchParams()
      if (mes) params.append('mes', mes)
      if (ano) params.append('ano', ano)
      if (sistema) params.append('sistema', sistema)

      const response = await adminApi.get(`/admin/feedbacks/dashboard?${params}`)
      setDashboard(response)
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error)
      toast({
        title: 'Erro',
        description: 'Falha ao carregar estatísticas de feedbacks',
        variant: 'destructive',
      })
    }
  }

  // Carregar lista de feedbacks
  const carregarFeedbacks = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (sistema) params.append('sistema', sistema)
      params.append('page', String(page))
      params.append('page_size', String(pageSize))

      const response = await adminApi.get(`/admin/feedbacks/lista?${params}`)
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
  }

  // Recarregar quando filtros mudarem
  useEffect(() => {
    carregarDashboard()
  }, [mes, ano, sistema])

  useEffect(() => {
    carregarFeedbacks()
  }, [sistema, page])

  // Renderizar badge de avaliação
  const renderAvaliacaoBadge = (avaliacao: 'correto' | 'parcial' | 'incorreto' | null) => {
    if (!avaliacao) {
      return <Badge variant="secondary">Sem avaliação</Badge>
    }

    const variants = {
      correto: { variant: 'success' as const, label: 'Correto' },
      parcial: { variant: 'warning' as const, label: 'Parcial' },
      incorreto: { variant: 'destructive' as const, label: 'Incorreto' },
    }

    const config = variants[avaliacao]
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  // Formatar data
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

  // Calcular porcentagens para barra de distribuição
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

  // Colunas da tabela
  const columns = [
    {
      accessor: 'sistema',
      header: 'Sistema',
      render: (value: unknown, row: FeedbackItem) => (
        <span className="font-medium">{row.sistema}</span>
      ),
    },
    {
      accessor: 'usuario_nome',
      header: 'Usuário',
    },
    {
      accessor: 'avaliacao',
      header: 'Avaliação',
      render: (value: unknown, row: FeedbackItem) => renderAvaliacaoBadge(row.avaliacao),
    },
    {
      accessor: 'comentario',
      header: 'Comentário',
      render: (value: unknown, row: FeedbackItem) => (
        <span className="text-sm text-gray-600 truncate max-w-md block">
          {row.comentario || '-'}
        </span>
      ),
    },
    {
      accessor: 'created_at',
      header: 'Data',
      render: (value: unknown, row: FeedbackItem) => (
        <span className="text-sm">{formatarData(row.created_at)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-3xl font-bold">Feedbacks</h1>
        <p className="text-gray-600 mt-1">
          Acompanhamento de avaliações e comentários dos usuários
        </p>
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Sistema</label>
            <select
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
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Mês</label>
            <select
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
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Ano</label>
            <select
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
          <Button
            variant="outline"
            onClick={() => {
              setSistema('')
              setMes('')
              setAno('')
              setPage(1)
            }}
          >
            Limpar Filtros
          </Button>
        </div>
      </Card>

      {/* Cards de Estatísticas */}
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

      {/* Distribuição de Avaliações */}
      {dashboard && dashboard.total_feedbacks > 0 && (
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Distribuição de Avaliações</h3>
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
      )}

      {/* Tabela de Feedbacks */}
      <Card>
        <DataTable
          data={feedbacks?.feedbacks || []}
          columns={columns}
          isLoading={loading}
          emptyMessage="Nenhum feedback encontrado"
        />

        {/* Paginação */}
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
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
