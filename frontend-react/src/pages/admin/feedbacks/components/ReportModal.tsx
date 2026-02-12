import { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { useMarkdown } from '@/hooks/useMarkdown'
import { C } from '@/lib/designTokens'
import { fetchConsultaReport } from '../api'
import { SISTEMA_MAP, formatarDataHora } from '../constants'
import { AvaliacaoBadge } from './AvaliacaoBadge'
import { ModoBadge } from './ModoBadge'
import type { ConsultaReport, ChatMessage, Versao } from '../types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ReportModalProps {
  open: boolean
  onClose: () => void
  consultaId: number | null
  sistema: string | null
  onOpenCurationAudit: (geracaoId: number) => void
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

function MarkdownBlock({ content }: { content: string }) {
  const { html } = useMarkdown(content)
  return <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
}

function ChatTab({ messages, totalEdits }: { messages: ChatMessage[]; totalEdits: number }) {
  if (!messages || messages.length === 0) {
    return <p className="text-center py-8 text-gray-400">Nenhuma edição via chat</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500 mb-2">{totalEdits} edição(ões) via chat</p>
      {messages.map((msg, i) => (
        <div
          key={i}
          className={`p-3 rounded-lg text-sm ${
            msg.role === 'user'
              ? 'bg-blue-50 border border-blue-100 ml-8'
              : 'bg-gray-50 border border-gray-100 mr-8'
          }`}
        >
          <p className="text-xs font-medium mb-1 text-gray-500">
            {msg.role === 'user' ? 'Usuário' : 'IA'}
          </p>
          <MarkdownBlock content={msg.content} />
        </div>
      ))}
    </div>
  )
}

function VersoesTab({ versoes }: { versoes: Versao[] }) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  if (!versoes || versoes.length === 0) {
    return <p className="text-center py-8 text-gray-400">Nenhuma versão disponível</p>
  }

  return (
    <div className="space-y-3">
      {versoes.map((v) => (
        <div key={v.id} className="border rounded-lg overflow-hidden">
          <div
            className="p-3 bg-gray-50 flex items-center justify-between cursor-pointer"
            onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
          >
            <div className="flex items-center gap-2">
              <Badge variant="secondary">v{v.numero_versao}</Badge>
              <span className="text-sm font-medium">{v.origem}</span>
              <span className="text-xs text-gray-500">{v.descricao_alteracao}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">{formatarDataHora(v.criado_em)}</span>
              <span className="text-xs text-gray-400">{expandedId === v.id ? '▲' : '▼'}</span>
            </div>
          </div>
          {expandedId === v.id && (
            <div className="p-3 border-t max-h-60 overflow-y-auto">
              <MarkdownBlock content={v.conteudo} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CuradoriaInfoBanner
// ---------------------------------------------------------------------------

function CuradoriaInfoBanner({
  report,
  onOpenAudit,
}: {
  report: ConsultaReport
  onOpenAudit: (id: number) => void
}) {
  const modo = report.modo_ativacao
  if (!modo || modo.modo !== 'semi_automatico') return null

  const manuais = modo.total_manuais ?? 0
  const totalIncluidos = modo.total_curados ?? 0
  const confirmados = totalIncluidos - manuais
  const excluidos = modo.total_excluidos ?? 0

  return (
    <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-semibold text-amber-800">Curadoria Humana</span>
          <p className="text-xs text-amber-600">Argumentos validados com tag [HUMAN_VALIDATED]</p>
        </div>
        <Button
          size="sm"
          className="bg-amber-600 text-white hover:bg-amber-700 text-xs"
          onClick={() => onOpenAudit(report.id)}
        >
          Ver Auditoria Completa
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="bg-blue-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{modo.total_preview ?? 0}</p>
          <span className="text-blue-700">Sugestões do Sistema</span>
        </div>
        <div className="bg-green-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{confirmados}</p>
          <span className="text-green-700">Confirmados</span>
        </div>
        <div className="bg-amber-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-amber-600">{manuais}</p>
          <span className="text-amber-700">Adicionados pelo Usuário</span>
        </div>
        <div className="bg-red-100 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-600">{excluidos}</p>
          <span className="text-red-700">Removidos</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-600 flex items-center gap-1">
        Todos os argumentos incluídos foram validados pelo usuário e utilizados integralmente na peça final.
      </p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ReportModal
// ---------------------------------------------------------------------------

export function ReportModal({ open, onClose, consultaId, sistema, onOpenCurationAudit }: ReportModalProps) {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ConsultaReport | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || !consultaId || !sistema) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Estado de loading para fetch assíncrono no effect
    setLoading(true)
    setError(false)
    setReport(null)

    fetchConsultaReport(consultaId, sistema)
      .then(setReport)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [open, consultaId, sistema])

  const sistemaLabel = sistema ? (SISTEMA_MAP[sistema]?.label ?? sistema) : ''
  const dataConsulta = report?.consultado_em ?? report?.analisado_em ?? report?.criado_em
  const hasTabs = sistema === 'gerador_pecas' || sistema === 'relatorio_cumprimento'

  const chatMessages = report?.edicoes_chat ?? (report?.historico_chat ?? []).filter((m) => m.role === 'user')
  const totalEdits = report?.total_edicoes_chat ?? chatMessages.length

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-lg text-white">
          <DialogTitle className="text-white">Relatório — {sistemaLabel}</DialogTitle>
          <p className="text-sm text-blue-100">{report?.identificador ?? report?.cnj ?? ''}</p>
        </DialogHeader>

        {/* Meta info */}
        {report && (
          <div className="p-4 border-b bg-gray-50 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <span style={{ color: C.text500 }}>Usuário:</span>
                <p className="font-medium" style={{ color: C.text900 }}>{report.usuario}</p>
              </div>
              <div>
                <span style={{ color: C.text500 }}>Data:</span>
                <p className="font-medium" style={{ color: C.text900 }}>{formatarDataHora(dataConsulta)}</p>
              </div>
              <div>
                <span style={{ color: C.text500 }}>Modelo IA:</span>
                <p className="font-medium text-purple-600">{report.modelo || 'N/A'}</p>
              </div>
              {sistema === 'gerador_pecas' && (
                <div>
                  <span style={{ color: C.text500 }}>Modo:</span>
                  <div className="mt-0.5">
                    <ModoBadge modo={report.modo_ativacao ?? null} sistema={sistema} />
                  </div>
                </div>
              )}
              <div>
                <span style={{ color: C.text500 }}>Avaliação:</span>
                <div className="mt-0.5">
                  <AvaliacaoBadge avaliacao={report.feedback?.avaliacao} />
                </div>
              </div>
            </div>

            {/* Banner de curadoria */}
            <CuradoriaInfoBanner report={report} onOpenAudit={onOpenCurationAudit} />
          </div>
        )}

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          {loading && (
            <div className="space-y-3">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-red-400">
              <p className="text-lg">Erro ao carregar o relatório</p>
            </div>
          )}

          {report && !loading && !error && (
            hasTabs ? (
              <Tabs defaultValue="relatorio">
                <TabsList>
                  <TabsTrigger value="relatorio">Relatório</TabsTrigger>
                  <TabsTrigger value="chat">
                    Edições Chat
                    {totalEdits > 0 && (
                      <Badge variant="secondary" className="ml-1.5 text-[10px]">{totalEdits}</Badge>
                    )}
                  </TabsTrigger>
                  {sistema === 'gerador_pecas' && (
                    <TabsTrigger value="versoes">
                      Versões
                      {(report.total_versoes ?? report.versoes?.length ?? 0) > 0 && (
                        <Badge variant="secondary" className="ml-1.5 text-[10px]">
                          {report.total_versoes ?? report.versoes?.length ?? 0}
                        </Badge>
                      )}
                    </TabsTrigger>
                  )}
                </TabsList>
                <TabsContent value="relatorio" className="mt-4">
                  {report.relatorio ? (
                    <MarkdownBlock content={report.relatorio} />
                  ) : (
                    <p className="text-gray-400 italic text-center py-8">
                      Relatório não disponível para esta consulta.
                    </p>
                  )}
                </TabsContent>
                <TabsContent value="chat" className="mt-4">
                  <ChatTab messages={report.historico_chat ?? []} totalEdits={totalEdits} />
                </TabsContent>
                {sistema === 'gerador_pecas' && (
                  <TabsContent value="versoes" className="mt-4">
                    <VersoesTab versoes={report.versoes ?? []} />
                  </TabsContent>
                )}
              </Tabs>
            ) : (
              report.relatorio ? (
                <MarkdownBlock content={report.relatorio} />
              ) : (
                <p className="text-gray-400 italic text-center py-8">
                  Relatório não disponível para esta consulta.
                </p>
              )
            )
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t bg-gray-50 rounded-b-lg">
          <Button variant="outline" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
