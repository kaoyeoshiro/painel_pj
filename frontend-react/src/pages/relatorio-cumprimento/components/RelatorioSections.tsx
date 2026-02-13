import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { C, FONT_DOC } from '@/lib/designTokens'
import { useMarkdown } from '@/hooks/useMarkdown'
import {
  FileText,
  Loader2,
  AlertCircle,
  Download,
  FileDown,
  Clock,
  History,
  RotateCw,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Sparkles,
  Copy,
} from 'lucide-react'

import type { EtapaPipeline, HistoricoItem } from '@/types/relatorio-cumprimento'
import type { UseRelatorioCumprimentoReturn } from '../hooks/useRelatorioCumprimento'

// ============================================================
// MarkdownContent — renderiza conteudo Markdown com sanitizacao
// ============================================================

export function MarkdownContent({ content }: { content: string }) {
  const { html } = useMarkdown(content)
  return (
    <div
      className="prose prose-sm max-w-none"
      style={{
        ['--tw-prose-headings' as string]: C.text900,
        ['--tw-prose-body' as string]: C.text700,
        ['--tw-prose-bold' as string]: C.text900,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// ============================================================
// EtapaStep — uma etapa individual do pipeline
// ============================================================

export function EtapaStep({ etapa }: { etapa: EtapaPipeline }) {
  let bgColor: string
  let borderColor: string
  let badgeBg: string
  let badgeColor: string
  let textColor: string

  if (etapa.status === 'concluido') {
    bgColor = C.successBg
    borderColor = C.successBorder
    badgeBg = C.statusSuccess
    badgeColor = 'white'
    textColor = C.statusSuccess
  } else if (etapa.status === 'ativo') {
    bgColor = C.navy50
    borderColor = C.navy100
    badgeBg = C.navy950
    badgeColor = 'white'
    textColor = C.navy700
  } else {
    bgColor = C.gray50
    borderColor = C.gray200
    badgeBg = C.gray200
    badgeColor = C.text400
    textColor = C.text400
  }

  return (
    <div
      className="flex items-center gap-3 rounded-xl border p-3 transition-colors"
      style={{ background: bgColor, borderColor }}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ background: badgeBg, color: badgeColor }}
      >
        {etapa.status === 'concluido' ? (
          <CheckCircle2 className="h-4 w-4" />
        ) : etapa.status === 'ativo' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Circle className="h-4 w-4" />
        )}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium" style={{ color: textColor }}>
          Etapa {etapa.numero}: {etapa.titulo}
        </div>
        {etapa.mensagem && (
          <div className="text-xs" style={{ color: C.text400 }}>{etapa.mensagem}</div>
        )}
      </div>
      {etapa.status === 'ativo' && (
        <span className="flex-shrink-0 text-[11px] font-medium" style={{ color: C.navy600 }}>Ativo</span>
      )}
      {etapa.status === 'concluido' && (
        <span className="flex-shrink-0 text-[11px] font-medium" style={{ color: C.statusSuccess }}>OK</span>
      )}
    </div>
  )
}

// ============================================================
// HistoricoSheet — drawer lateral com historico completo
// ============================================================

interface HistoricoSheetProps {
  historico: HistoricoItem[] | undefined
  onCarregarHistorico: (item: HistoricoItem) => void
}

export function HistoricoSheet({ historico, onCarregarHistorico }: HistoricoSheetProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors"
          style={{ color: C.text500, fontSize: 13 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100 }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <Clock className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Historico</span>
        </button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Relatorios Gerados</SheetTitle>
        </SheetHeader>
        <ScrollArea className="mt-4 h-[calc(100vh-80px)]">
          {!historico || historico.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: C.text400 }}>
                Nenhum relatorio gerado ainda.
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {historico.map((item) => (
                <div
                  key={item.id}
                  className="group flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 transition-colors"
                  style={{ background: 'transparent' }}
                  onClick={() => onCarregarHistorico(item)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.gray50 }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                >
                  <div
                    className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: C.navy100, color: C.navy700 }}
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" style={{ color: C.text700 }}>
                      {item.numero_cumprimento_formatado || item.numero_cumprimento}
                    </p>
                    <p className="mt-0.5 truncate text-xs" style={{ color: C.text400 }}>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(item.criado_em).toLocaleString('pt-BR')}
                      </span>
                      {item.tempo_processamento && ` · ${item.tempo_processamento}s`}
                    </p>
                    {item.dados_basicos?.cumprimento?.autor && (
                      <p className="mt-0.5 truncate text-xs" style={{ color: C.text400 }}>
                        Autor: {item.dados_basicos.cumprimento.autor}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================
// FormularioEntrada — card com campo CNJ e botao de gerar
// ============================================================

interface FormularioEntradaProps {
  vm: UseRelatorioCumprimentoReturn
}

export function FormularioEntrada({ vm }: FormularioEntradaProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: C.gray200 }}
    >
      {/* Accent bar navy */}
      <div className="h-1" style={{ background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }} />
      <div className="p-6">
        <div className="mb-5 flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: C.navy100, color: C.navy700 }}
          >
            <FileText style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <h2 className="font-bold" style={{ color: C.text900, fontSize: 17 }}>
              Gerar Relatorio de Cumprimento
            </h2>
            <p style={{ color: C.text400, fontSize: 13 }}>
              Relatorio Inicial para Cumprimento de Sentenca
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label
              htmlFor="numero-cnj"
              className="font-medium"
              style={{ color: C.text500, fontSize: 13 }}
            >
              Numero do Processo de Cumprimento (CNJ)
            </Label>
            <Input
              id="numero-cnj"
              value={vm.numeroCnj}
              onChange={(e) => vm.setNumeroCnj(e.target.value)}
              placeholder="0000000-00.2024.8.12.0001"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && vm.pageState !== 'streaming') {
                  vm.handleIniciarGeracao()
                }
              }}
              disabled={vm.pageState === 'streaming'}
              className="mt-2 h-11 rounded-xl font-mono text-base tracking-wide"
              style={{ borderColor: C.gray200 }}
            />
            <p className="mt-1 text-xs" style={{ color: C.text400 }}>
              Digite o numero do processo de cumprimento de sentenca
            </p>
          </div>

          <Button
            onClick={vm.handleIniciarGeracao}
            className="h-11 w-full gap-2 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
            style={{ background: C.navy950 }}
            disabled={
              vm.pageState === 'streaming' ||
              !vm.numeroCnj.trim() ||
              (vm.processoExistente?.existe === true && !vm.sobrescrever)
            }
          >
            {vm.pageState === 'streaming' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Relatorio
              </>
            )}
          </Button>

          {/* Aviso de processo existente */}
          {vm.processoExistente?.existe && vm.pageState === 'idle' && (
            <ProcessoExistenteAlert vm={vm} />
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// ProcessoExistenteAlert — alerta de processo ja analisado
// ============================================================

function ProcessoExistenteAlert({ vm }: { vm: UseRelatorioCumprimentoReturn }) {
  return (
    <Alert>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Processo ja gerado anteriormente</AlertTitle>
      <AlertDescription>
        <p className="mb-2">
          Este processo foi gerado em {vm.processoExistente!.criado_em}
          {vm.processoExistente!.autor && ` (Autor: ${vm.processoExistente!.autor})`}.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const itemHistorico = vm.historico?.find((h) => h.id === vm.processoExistente!.geracao_id)
              if (itemHistorico) {
                vm.handleCarregarHistorico(itemHistorico)
              }
            }}
          >
            Ver relatorio existente
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => vm.setSobrescrever(true)}
          >
            Gerar novo mesmo assim
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}

// ============================================================
// ErroAlert — alerta de erro com botao de tentar novamente
// ============================================================

interface ErroAlertProps {
  erro: string
  onLimpar: () => void
}

export function ErroAlert({ erro, onLimpar }: ErroAlertProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Erro</AlertTitle>
      <AlertDescription>
        {erro}
        <Button
          variant="outline"
          size="sm"
          className="mt-2 ml-4"
          onClick={onLimpar}
        >
          <RotateCw className="mr-2 h-4 w-4" />
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  )
}

// ============================================================
// PipelineProcessamento — card com etapas, log e streaming
// ============================================================

interface PipelineProcessamentoProps {
  vm: UseRelatorioCumprimentoReturn
}

export function PipelineProcessamento({ vm }: PipelineProcessamentoProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: C.gray200 }}
    >
      <div className="h-1" style={{ background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }} />
      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          {vm.pageState === 'streaming' && (
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: C.navy600 }} />
          )}
          <h3 className="font-bold" style={{ color: C.text900, fontSize: 16 }}>
            Pipeline de Processamento
          </h3>
        </div>

        {/* Etapas do pipeline */}
        <div className="space-y-2">
          {vm.etapas.map((etapa) => (
            <EtapaStep key={etapa.numero} etapa={etapa} />
          ))}
        </div>

        <Separator className="my-4" />

        {/* Log de mensagens */}
        <div>
          <Label className="text-sm font-medium" style={{ color: C.text700 }}>
            Log de Processamento
          </Label>
          <ScrollArea
            className="mt-2 h-[200px] w-full rounded-xl border p-3"
            style={{ background: C.gray50, borderColor: C.gray200 }}
            ref={vm.logScrollRef}
          >
            <div className="space-y-1">
              {vm.mensagensLog.map((msg, idx) => (
                <p key={idx} className="font-mono text-xs" style={{ color: C.text500 }}>
                  {msg}
                </p>
              ))}
              {vm.pageState === 'streaming' && (
                <p className="animate-pulse font-mono text-xs" style={{ color: C.navy600 }}>
                  Processando...
                </p>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Conteudo sendo gerado em tempo real */}
        {vm.streamingContent && (
          <div className="mt-4">
            <Label className="text-sm font-medium" style={{ color: C.text700 }}>
              Relatorio (gerando...)
            </Label>
            <ScrollArea
              className="mt-2 h-[300px] w-full rounded-xl border bg-white p-4"
              style={{ borderColor: C.gray200 }}
            >
              <MarkdownContent content={vm.streamingContent} />
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
// ResumoGerado — card resumo quando dialog esta fechado
// ============================================================

interface ResumoGeradoProps {
  vm: UseRelatorioCumprimentoReturn
}

export function ResumoGerado({ vm }: ResumoGeradoProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: C.gray200 }}
    >
      <div className="h-1" style={{ background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})` }} />
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ background: C.successBg, color: C.statusSuccess }}
            >
              <CheckCircle2 style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h3 className="font-bold" style={{ color: C.text900, fontSize: 16 }}>
                Relatorio Gerado
              </h3>
              <p style={{ color: C.text400, fontSize: 13 }}>
                {vm.processoSubtitle}
                {vm.dadosCumprimento?.autor && ` - ${vm.dadosCumprimento.autor}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => vm.setShowEditor(true)}
              className="gap-2 rounded-xl text-white"
              style={{ background: C.navy950 }}
            >
              <FileText className="h-4 w-4" />
              Abrir Relatorio
            </Button>
            <Button
              variant="outline"
              onClick={vm.handleReiniciar}
              className="gap-2 rounded-xl"
            >
              <RotateCw className="h-4 w-4" />
              Nova Geracao
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// HistoricoRecente — ultimos 5 relatorios (estado idle)
// ============================================================

interface HistoricoRecenteProps {
  historico: HistoricoItem[] | undefined
  onCarregarHistorico: (item: HistoricoItem) => void
}

export function HistoricoRecente({ historico, onCarregarHistorico }: HistoricoRecenteProps) {
  if (!historico || historico.length === 0) return null

  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white shadow-sm"
      style={{ borderColor: C.gray200 }}
    >
      <div className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: C.navy100, color: C.navy700 }}
          >
            <History style={{ width: 18, height: 18 }} />
          </div>
          <h3 className="font-semibold" style={{ color: C.text700, fontSize: 15 }}>
            Relatorios Recentes
          </h3>
        </div>

        <div className="space-y-1.5">
          {historico.slice(0, 5).map((item) => {
            const numero = item.numero_cumprimento_formatado || item.numero_cumprimento
            const autor = item.dados_basicos?.cumprimento?.autor || 'Relatorio de Cumprimento'
            const data = item.criado_em ? new Date(item.criado_em) : null

            return (
              <div
                key={item.id}
                onClick={() => onCarregarHistorico(item)}
                className="group flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white p-3.5 transition-all hover:shadow-sm"
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gray200 }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent' }}
              >
                <div
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                  style={{ background: C.navy100, color: C.navy700 }}
                >
                  <FileText style={{ width: 20, height: 20 }} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium" style={{ color: C.text900, fontSize: 14 }}>
                    {numero}
                  </p>
                  <p className="mt-0.5 truncate text-xs" style={{ color: C.text400 }}>
                    {autor}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs" style={{ color: C.text400 }}>
                    {data ? data.toLocaleDateString('pt-BR') : '-'}
                  </p>
                  <p className="text-xs" style={{ color: C.gray500 }}>
                    {data ? data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// DocumentContent — conteudo do documento no ContentDialog
// ============================================================

interface DocumentContentProps {
  vm: UseRelatorioCumprimentoReturn
}

export function DocumentContent({ vm }: DocumentContentProps) {
  return (
    <div>
      {/* Informacoes do processo */}
      {(vm.dadosCumprimento || vm.dadosPrincipal || vm.transitoJulgado) && (
        <InfoProcesso vm={vm} />
      )}

      {/* Conteudo do Relatorio em Markdown */}
      <div style={{ fontFamily: FONT_DOC }}>
        <MarkdownContent content={vm.relatorioMarkdown} />
      </div>
    </div>
  )
}

// ============================================================
// InfoProcesso — grid com dados do processo no ContentDialog
// ============================================================

function InfoProcesso({ vm }: { vm: UseRelatorioCumprimentoReturn }) {
  return (
    <div
      className="mb-6 rounded-xl border p-4"
      style={{ background: C.gray50, borderColor: C.gray200 }}
    >
      <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
        {vm.dadosCumprimento?.comarca && (
          <div>
            <span style={{ color: C.text400, fontSize: 12 }}>Comarca</span>
            <p className="font-medium" style={{ color: C.text700 }}>
              {vm.dadosCumprimento.comarca}
            </p>
          </div>
        )}
        {vm.dadosCumprimento?.vara && (
          <div>
            <span style={{ color: C.text400, fontSize: 12 }}>Vara</span>
            <p className="font-medium" style={{ color: C.text700 }}>
              {vm.dadosCumprimento.vara}
            </p>
          </div>
        )}
        {vm.dadosPrincipal && (
          <div>
            <span style={{ color: C.text400, fontSize: 12 }}>Processo Principal</span>
            <p className="font-medium" style={{ color: C.text700 }}>
              {vm.dadosPrincipal.numero_processo_formatado}
            </p>
          </div>
        )}
        {vm.transitoJulgado?.localizado && (
          <div>
            <span style={{ color: C.text400, fontSize: 12 }}>Transito em Julgado</span>
            <p className="font-medium" style={{ color: C.text700 }}>
              {vm.transitoJulgado.data_transito || 'Localizado'}
            </p>
          </div>
        )}
      </div>

      {/* Alerta de Agravo */}
      {vm.temAgravo && (
        <div
          className="mt-3 flex items-start gap-2 rounded-lg p-3"
          style={{ background: C.warningBg, border: `1px solid ${C.statusWarning}33` }}
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: C.statusWarning }} />
          <div>
            <p className="text-sm font-medium" style={{ color: C.text900 }}>
              Agravo de Instrumento Detectado
            </p>
            <p className="text-xs" style={{ color: C.text500 }}>
              Foram encontrados documentos de Agravo de Instrumento vinculados a este processo.
              Verifique o relatorio para garantir que as decisoes do agravo foram consideradas.
            </p>
          </div>
        </div>
      )}

      {/* Documentos baixados */}
      {vm.documentosBaixados.length > 0 && (
        <div className="mt-3">
          <span style={{ color: C.text400, fontSize: 12 }}>
            Documentos Analisados ({vm.documentosBaixados.length})
          </span>
          <div className="mt-1 flex flex-wrap gap-1">
            {vm.documentosBaixados.map((doc) => (
              <Badge
                key={doc.id_documento}
                variant="secondary"
                className="text-xs"
                style={{ background: C.navy100, color: C.navy700 }}
              >
                {doc.nome_padronizado || doc.nome_original}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// HeaderActions — botoes de exportacao no ContentDialog
// ============================================================

interface HeaderActionsProps {
  vm: UseRelatorioCumprimentoReturn
  guardAction: (fn: () => void) => void
}

export function HeaderActions({ vm, guardAction }: HeaderActionsProps) {
  return (
    <>
      <Button
        onClick={() => guardAction(() => vm.handleExportarDocx())}
        size="sm"
        className="gap-2 text-white/70 hover:bg-white/10 hover:text-white"
        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
        disabled={vm.exportando !== null}
      >
        {vm.exportando === 'docx' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        DOCX
      </Button>
      <Button
        onClick={() => guardAction(() => vm.handleExportarPdf())}
        size="sm"
        className="gap-2 text-white/70 hover:bg-white/10 hover:text-white"
        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
        disabled={vm.exportando !== null}
      >
        {vm.exportando === 'pdf' ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <FileDown className="h-4 w-4" />
        )}
        PDF
      </Button>
      <Button
        onClick={() => guardAction(() => vm.handleCopiarRelatorio())}
        size="sm"
        className="gap-2 text-white/70 hover:bg-white/10 hover:text-white"
        style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)' }}
      >
        <Copy className="h-4 w-4" />
        Copiar
      </Button>
    </>
  )
}

