import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useMarkdown } from '@/hooks/useMarkdown'
import { C, FONT_DOC } from '@/lib/designTokens'
import {
  FileText,
  History,
  Loader2,
  Check,
  X,
  Upload,
  Send,
  Star,
  AlertCircle,
  Search,
  Brain,
  Building2,
  FileCode,
  Files,
  AlertTriangle,
  HelpCircle,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCw,
  ChevronRight,
  Info,
} from 'lucide-react'
import type { EtapaPipeline, GeracaoDetalhada, TipoAvaliacao } from '@/types/prestacao-contas'
import type { UsePrestacaoContasReturn } from '../hooks/usePrestacaoContas'

// =====================================================
// HELPERS
// =====================================================

function renderEtapaIcone(etapa: EtapaPipeline) {
  const iconClass = 'h-4 w-4'
  switch (etapa.numero) {
    case 1: return <Building2 className={iconClass} />
    case 2: return <FileCode className={iconClass} />
    case 3: return <Search className={iconClass} />
    case 4: return <Files className={iconClass} />
    case 5: return <Brain className={iconClass} />
    default: return <FileText className={iconClass} />
  }
}

function parecerIcone(parecer?: string) {
  switch (parecer) {
    case 'favoravel': return <CheckCircle2 className="h-5 w-5" style={{ color: C.statusSuccess }} />
    case 'desfavoravel': return <XCircle className="h-5 w-5" style={{ color: C.statusError }} />
    case 'duvida': return <HelpCircle className="h-5 w-5" style={{ color: C.statusWarning }} />
    default: return <Clock className="h-5 w-5" style={{ color: C.gray400 }} />
  }
}

export function MarkdownContent({ text }: { text: string }) {
  const { html } = useMarkdown(text)
  return (
    <div
      className="prose prose-sm max-w-none"
      style={{ color: C.text700, fontFamily: FONT_DOC }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// =====================================================
// FORMULARIO
// =====================================================

interface FormularioProps {
  numeroCNJ: string
  setNumeroCNJ: (v: string) => void
  estadoPagina: string
  onSubmit: () => void
}

export function Formulario({ numeroCNJ, setNumeroCNJ, estadoPagina, onSubmit }: FormularioProps) {
  return (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.gray200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: C.navy950 }}
          >
            <FileText className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle style={{ color: C.text900 }}>Analisar Prestacao de Contas</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            onSubmit()
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="numero-cnj" style={{ color: C.text700 }}>Numero do Processo (CNJ)</Label>
            <Input
              id="numero-cnj"
              value={numeroCNJ}
              onChange={(e) => setNumeroCNJ(e.target.value)}
              placeholder="0000000-00.2024.8.12.0001"
              disabled={estadoPagina === 'processando' || estadoPagina === 'verificando'}
              style={{ borderColor: C.gray200 }}
            />
            <p className="text-xs" style={{ color: C.text400 }}>
              Digite o numero completo do processo no formato CNJ
            </p>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base text-white"
            style={{ background: C.navy950 }}
            disabled={estadoPagina === 'processando' || estadoPagina === 'verificando'}
          >
            {estadoPagina === 'verificando' ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Verificando...</>
            ) : estadoPagina === 'processando' ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processando...</>
            ) : (
              <><Search className="mr-2 h-5 w-5" /> Analisar Prestacao de Contas</>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

// =====================================================
// INFO CARD
// =====================================================

export function InfoCard() {
  return (
    <Alert style={{ borderColor: C.navy200, background: C.navy50 }}>
      <Info className="h-4 w-4" style={{ color: C.navy700 }} />
      <AlertDescription>
        <p className="font-medium mb-1" style={{ color: C.navy950 }}>Como funciona?</p>
        <ul className="text-sm space-y-1" style={{ color: C.navy700 }}>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: C.navy500 }} /> Sistema baixa o extrato da subconta automaticamente
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: C.navy500 }} /> Identifica a peticao de prestacao de contas no processo
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: C.navy500 }} /> Analisa notas fiscais e comprovantes anexados
          </li>
          <li className="flex items-center gap-2">
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: C.navy500 }} /> Emite parecer: Favoravel, Desfavoravel ou Duvida
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  )
}

// =====================================================
// PROGRESSO
// =====================================================

interface ProgressoProps {
  etapas: EtapaPipeline[]
  progressoMensagem: string
  progressoPercent: number
}

export function Progresso({ etapas, progressoMensagem, progressoPercent }: ProgressoProps) {
  return (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.gray200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: C.navy950 }}
          >
            <Loader2 className="h-5 w-5 text-white animate-spin" />
          </div>
          <div>
            <CardTitle style={{ color: C.text900 }}>Analisando Prestacao de Contas</CardTitle>
            <CardDescription style={{ color: C.text500 }}>{progressoMensagem || 'Processando...'}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {etapas.map(etapa => (
            <div
              key={etapa.numero}
              className="flex items-center gap-3 rounded-lg border p-3 transition-colors"
              style={{
                borderColor: etapa.status === 'ativo' ? C.navy200
                  : etapa.status === 'concluido' ? '#bbf7d0'
                  : etapa.status === 'erro' ? '#fecaca'
                  : C.gray200,
                background: etapa.status === 'ativo' ? C.navy50
                  : etapa.status === 'concluido' ? '#f0fdf4'
                  : etapa.status === 'erro' ? '#fef2f2'
                  : C.gray50,
              }}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full"
                style={{
                  background: etapa.status === 'ativo' ? C.navy200
                    : etapa.status === 'concluido' ? '#bbf7d0'
                    : etapa.status === 'erro' ? '#fecaca'
                    : C.gray200,
                  color: etapa.status === 'ativo' ? C.navy700
                    : etapa.status === 'concluido' ? '#15803d'
                    : etapa.status === 'erro' ? '#b91c1c'
                    : C.gray400,
                }}
              >
                {etapa.status === 'ativo' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : etapa.status === 'concluido' ? (
                  <Check className="h-4 w-4" />
                ) : etapa.status === 'erro' ? (
                  <X className="h-4 w-4" />
                ) : (
                  renderEtapaIcone(etapa)
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium" style={{ color: C.text700 }}>
                  Etapa {etapa.numero}: {etapa.nome}
                </p>
                <p className="text-xs" style={{ color: C.text400 }}>{etapa.descricao}</p>
              </div>
              <Badge
                variant="outline"
                style={
                  etapa.status === 'concluido' ? { background: '#dcfce7', color: '#166534', borderColor: '#bbf7d0' }
                  : etapa.status === 'ativo' ? { background: C.navy100, color: C.navy700, borderColor: C.navy200 }
                  : etapa.status === 'erro' ? { background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }
                  : { borderColor: C.gray300, color: C.text400 }
                }
              >
                {etapa.status === 'concluido' ? 'Concluido'
                  : etapa.status === 'ativo' ? 'Em andamento'
                  : etapa.status === 'erro' ? 'Erro'
                  : 'Aguardando'}
              </Badge>
            </div>
          ))}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between text-xs" style={{ color: C.text400 }}>
            <span>Progresso</span>
            <span>{progressoPercent}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: C.gray200 }}>
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${progressoPercent}%`,
                background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================
// CONTEUDO DO DOCUMENTO (para ContentDialog)
// =====================================================

interface DocumentContentProps {
  geracaoAtual: GeracaoDetalhada
  parecerBadgeStyle: (parecer?: string) => React.CSSProperties
  parecerTexto: (parecer?: string) => string
  formatarValor: (valor?: number) => string
}

export function DocumentContent({ geracaoAtual, parecerBadgeStyle, parecerTexto, formatarValor }: DocumentContentProps) {
  const fundamentacaoText = geracaoAtual.fundamentacao || ''

  return (
    <div className="space-y-6">
      {/* Header do parecer */}
      <div
        className="flex items-center justify-between rounded-xl border p-4"
        style={{
          borderColor: geracaoAtual.parecer === 'favoravel' ? '#bbf7d0'
            : geracaoAtual.parecer === 'desfavoravel' ? '#fecaca'
            : C.orange200,
          background: geracaoAtual.parecer === 'favoravel' ? '#f0fdf4'
            : geracaoAtual.parecer === 'desfavoravel' ? '#fef2f2'
            : C.orange50,
        }}
      >
        <div className="flex items-center gap-3">
          {parecerIcone(geracaoAtual.parecer)}
          <div>
            <p className="font-semibold" style={{ color: C.text900 }}>
              Parecer: {parecerTexto(geracaoAtual.parecer)}
            </p>
            <p className="text-sm" style={{ color: C.text500 }}>
              {geracaoAtual.numero_cnj_formatado || geracaoAtual.numero_cnj}
            </p>
          </div>
        </div>
        <Badge variant="outline" style={parecerBadgeStyle(geracaoAtual.parecer)}>
          {parecerTexto(geracaoAtual.parecer)}
        </Badge>
      </div>

      {/* Dados extraidos */}
      {(geracaoAtual.valor_bloqueado !== undefined ||
        geracaoAtual.valor_utilizado !== undefined ||
        geracaoAtual.medicamento_pedido) && (
        <div>
          <p className="mb-3 text-xs font-bold uppercase tracking-wider" style={{ color: C.text400 }}>
            Dados Extraidos
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {geracaoAtual.valor_bloqueado !== undefined && geracaoAtual.valor_bloqueado !== null && (
              <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                <p className="text-xs" style={{ color: C.text400 }}>Valor Bloqueado</p>
                <p className="text-sm font-semibold" style={{ color: C.text900 }}>{formatarValor(geracaoAtual.valor_bloqueado)}</p>
              </div>
            )}
            {geracaoAtual.valor_utilizado !== undefined && geracaoAtual.valor_utilizado !== null && (
              <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                <p className="text-xs" style={{ color: C.text400 }}>Valor Utilizado</p>
                <p className="text-sm font-semibold" style={{ color: C.text900 }}>{formatarValor(geracaoAtual.valor_utilizado)}</p>
              </div>
            )}
            {geracaoAtual.valor_devolvido !== undefined && geracaoAtual.valor_devolvido !== null && (
              <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                <p className="text-xs" style={{ color: C.text400 }}>Valor Devolvido</p>
                <p className="text-sm font-semibold" style={{ color: C.text900 }}>{formatarValor(geracaoAtual.valor_devolvido)}</p>
              </div>
            )}
            {geracaoAtual.medicamento_pedido && (
              <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                <p className="text-xs" style={{ color: C.text400 }}>Medicamento Pedido</p>
                <p className="text-sm font-semibold" style={{ color: C.text900 }}>{geracaoAtual.medicamento_pedido}</p>
              </div>
            )}
            {geracaoAtual.medicamento_comprado && (
              <div className="rounded-xl border p-3" style={{ borderColor: C.gray200 }}>
                <p className="text-xs" style={{ color: C.text400 }}>Medicamento Comprado</p>
                <p className="text-sm font-semibold" style={{ color: C.text900 }}>{geracaoAtual.medicamento_comprado}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fundamentacao */}
      {fundamentacaoText && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" style={{ color: C.navy700 }} />
            <p className="text-xs font-bold uppercase tracking-wider" style={{ color: C.text400 }}>
              Fundamentacao
            </p>
          </div>
          <MarkdownContent text={fundamentacaoText} />
        </div>
      )}

      {/* Irregularidades */}
      {geracaoAtual.irregularidades && geracaoAtual.irregularidades.length > 0 && (
        <div
          className="rounded-xl border p-4"
          style={{ borderColor: '#fecaca', background: '#fef2f2' }}
        >
          <div className="mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" style={{ color: C.statusError }} />
            <p className="text-sm font-semibold" style={{ color: '#991b1b' }}>
              Irregularidades Identificadas
            </p>
          </div>
          <ul className="space-y-2">
            {geracaoAtual.irregularidades.map((irr, idx) => (
              <li key={idx} className="flex items-start gap-2 text-sm" style={{ color: '#b91c1c' }}>
                <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{irr}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// =====================================================
// FEEDBACK
// =====================================================

interface FeedbackSectionProps {
  avaliacaoSelecionada: TipoAvaliacao | null
  setAvaliacaoSelecionada: (v: TipoAvaliacao | null) => void
  comentarioFeedback: string
  setComentarioFeedback: (v: string) => void
  isEnviandoFeedback: boolean
  onEnviar: () => void
}

export function FeedbackSection({ avaliacaoSelecionada, setAvaliacaoSelecionada, comentarioFeedback, setComentarioFeedback, isEnviandoFeedback, onEnviar }: FeedbackSectionProps) {
  return (
    <div
      className="rounded-xl border p-4"
      style={{ borderColor: C.gray200, background: 'white' }}
    >
      <p className="mb-3 text-sm font-medium" style={{ color: C.text700 }}>
        Como voce avalia este parecer?
      </p>
      <div className="flex flex-wrap gap-2">
        {([
          { value: 'correto' as const, label: 'Correto', icon: Check, bg: '#dcfce7', color: '#166534', border: '#bbf7d0' },
          { value: 'parcial' as const, label: 'Parcial', icon: AlertCircle, bg: C.orange100, color: '#92400e', border: C.orange200 },
          { value: 'incorreto' as const, label: 'Incorreto', icon: X, bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
        ]).map(opt => (
          <Button
            key={opt.value}
            type="button"
            variant="outline"
            size="sm"
            style={
              avaliacaoSelecionada === opt.value
                ? { background: opt.bg, color: opt.color, borderColor: opt.border }
                : { borderColor: C.gray200, color: C.text500 }
            }
            onClick={() => setAvaliacaoSelecionada(opt.value)}
          >
            <opt.icon className="mr-1 h-3 w-3" />
            {opt.label}
          </Button>
        ))}
      </div>

      {avaliacaoSelecionada && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={comentarioFeedback}
            onChange={(e) => setComentarioFeedback(e.target.value)}
            placeholder="Comentario opcional..."
            rows={2}
            className="text-sm"
            style={{ borderColor: C.gray200 }}
          />
          <Button
            size="sm"
            onClick={onEnviar}
            disabled={isEnviandoFeedback}
            style={{ background: C.navy950 }}
            className="text-white"
          >
            {isEnviandoFeedback ? (
              <><Loader2 className="mr-2 h-3 w-3 animate-spin" /> Enviando...</>
            ) : (
              <><Star className="mr-2 h-3 w-3" /> Enviar Feedback</>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}

// =====================================================
// DUVIDAS
// =====================================================

interface DuvidasProps {
  perguntas: string[]
  respostas: Record<string, string>
  setRespostas: (fn: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void
  isEnviandoRespostas: boolean
  onEnviar: () => void
  onCancelar: () => void
}

export function Duvidas({ perguntas, respostas, setRespostas, isEnviandoRespostas, onEnviar, onCancelar }: DuvidasProps) {
  return (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.orange200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.orange500}, ${C.orange400})` }} />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: C.orange500 }}
          >
            <HelpCircle className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle style={{ color: C.text900 }}>Esclarecimentos Necessarios</CardTitle>
            <CardDescription style={{ color: C.text500 }}>
              A IA precisa de mais informacoes para emitir o parecer. Responda as perguntas abaixo.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {perguntas.map((pergunta, idx) => (
          <div key={idx} className="space-y-2">
            <Label className="text-sm font-medium" style={{ color: C.text900 }}>
              {idx + 1}. {pergunta}
            </Label>
            <Textarea
              value={respostas[pergunta] || ''}
              onChange={(e) =>
                setRespostas((prev: Record<string, string>) => ({ ...prev, [pergunta]: e.target.value }))
              }
              placeholder="Digite sua resposta..."
              rows={3}
              style={{ borderColor: C.gray200, background: 'white' }}
            />
          </div>
        ))}

        <div className="flex gap-2 pt-2">
          <Button
            onClick={onEnviar}
            disabled={isEnviandoRespostas}
            className="flex-1 text-white"
            style={{ background: C.navy950 }}
          >
            {isEnviandoRespostas ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Send className="mr-2 h-4 w-4" /> Enviar Respostas</>
            )}
          </Button>
          <Button onClick={onCancelar} variant="ghost" style={{ color: C.text500 }}>
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================
// DOCUMENTOS FALTANTES
// =====================================================

interface DocumentosFaltantesProps {
  vm: UsePrestacaoContasReturn
}

export function DocumentosFaltantes({ vm }: DocumentosFaltantesProps) {
  return (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.orange200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.orange500}, ${C.orange400})` }} />
      <CardHeader>
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl"
            style={{ background: C.orange500 }}
          >
            <Upload className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle style={{ color: C.text900 }}>Documentos Pendentes</CardTitle>
            <CardDescription style={{ color: C.text500 }}>{vm.mensagemDocsFaltantes}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {vm.docsFaltantes.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium" style={{ color: C.text700 }}>Documentos necessarios:</p>
            <ul className="space-y-1">
              {vm.docsFaltantes.map((doc, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: C.orange600 }}>
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{doc === 'extrato_subconta' ? 'Extrato da Subconta' : doc === 'notas_fiscais' ? 'Notas Fiscais / Comprovantes' : doc}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label style={{ color: C.text700 }}>Anexar documentos (PDF)</Label>
          <div
            className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors"
            style={{ borderColor: C.orange400, color: C.orange600 }}
            onClick={() => vm.fileInputRef.current?.click()}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.orange50 }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <Upload className="h-5 w-5" />
            <span className="text-sm">Clique para selecionar arquivos PDF</span>
          </div>
          <input
            ref={vm.fileInputRef}
            type="file"
            accept=".pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files) {
                vm.setArquivosUpload(Array.from(e.target.files))
              }
            }}
          />
        </div>

        {vm.arquivosUpload.length > 0 && (
          <div className="rounded-xl border bg-white p-3" style={{ borderColor: C.gray200 }}>
            <p className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: C.text400 }}>
              Arquivos Selecionados ({vm.arquivosUpload.length})
            </p>
            <ul className="space-y-1">
              {vm.arquivosUpload.map((file, idx) => (
                <li key={idx} className="flex items-center gap-2 text-sm" style={{ color: C.text700 }}>
                  <FileText className="h-4 w-4" style={{ color: C.orange500 }} />
                  <span className="flex-1 truncate">{file.name}</span>
                  <span className="text-xs" style={{ color: C.text400 }}>{(file.size / 1024).toFixed(0)} KB</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={vm.enviarDocumentos}
            disabled={vm.isEnviandoDocs || vm.arquivosUpload.length === 0}
            className="flex-1 text-white"
            style={{ background: C.navy950 }}
          >
            {vm.isEnviandoDocs ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando...</>
            ) : (
              <><Upload className="mr-2 h-4 w-4" /> Enviar Documentos</>
            )}
          </Button>
          <Button
            onClick={vm.reprocessarComDocumentos}
            variant="outline"
            style={{ borderColor: C.gray200, color: C.text700 }}
          >
            <RotateCw className="mr-2 h-4 w-4" />
            Reprocessar
          </Button>
          {vm.geracaoAtual?.status === 'aguardando_nota_fiscal' && (
            <Button
              onClick={vm.continuarSemNotaFiscal}
              variant="outline"
              style={{ borderColor: C.gray200, color: C.text700 }}
            >
              <ChevronRight className="mr-2 h-4 w-4" />
              Continuar sem Nota Fiscal
            </Button>
          )}
          <Button
            onClick={vm.cancelarPorFalta}
            variant="ghost"
            style={{ color: C.statusError }}
          >
            <X className="mr-2 h-4 w-4" />
            Cancelar Analise
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// =====================================================
// ERRO
// =====================================================

interface ErroProps {
  mensagem: string
  onResetar: () => void
}

export function ErroSection({ mensagem, onResetar }: ErroProps) {
  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        <p className="font-medium">Erro na analise</p>
        <p className="text-sm mt-1">{mensagem || 'Ocorreu um erro durante o processamento.'}</p>
        <Button
          onClick={onResetar}
          variant="outline"
          size="sm"
          className="mt-3"
          style={{ borderColor: C.gray200 }}
        >
          <RotateCw className="mr-2 h-4 w-4" /> Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  )
}

// =====================================================
// HISTORICO RECENTE (card na pagina)
// =====================================================

interface HistoricoRecenteProps {
  vm: UsePrestacaoContasReturn
}

export function HistoricoRecente({ vm }: HistoricoRecenteProps) {
  const geracoes = vm.historicoData?.geracoes || []

  return (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.gray200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base" style={{ color: C.text900 }}>
            <History className="h-4 w-4" style={{ color: C.navy700 }} />
            Analises Recentes
          </CardTitle>
          {geracoes.length > 0 && (
            <Badge variant="outline" style={{ borderColor: C.gray300, color: C.text500 }}>
              {vm.historicoData?.total || 0} total
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {vm.isLoadingHistorico ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : geracoes.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm" style={{ color: C.text400 }}>Nenhuma analise realizada ainda</p>
          </div>
        ) : (
          <div className="space-y-2">
            {geracoes.slice(0, 5).map(g => (
              <button
                key={g.id}
                onClick={() => vm.carregarDoHistorico(g.id)}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all"
                style={{ borderColor: C.gray200 }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.navy300; e.currentTarget.style.background = C.navy50 }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.background = 'transparent' }}
              >
                {parecerIcone(g.parecer)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: C.text900 }}>
                    {g.numero_cnj_formatado || g.numero_cnj}
                  </p>
                  <p className="text-xs" style={{ color: C.text400 }}>
                    {vm.formatarData(g.criado_em)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {g.status === 'erro' ? (
                    <Badge variant="outline" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }} className="text-xs">Erro</Badge>
                  ) : g.parecer ? (
                    <Badge variant="outline" className="text-xs" style={vm.parecerBadgeStyle(g.parecer)}>
                      {vm.parecerTexto(g.parecer)}
                    </Badge>
                  ) : g.status === 'aguardando_documentos' || g.status === 'aguardando_nota_fiscal' ? (
                    <Badge variant="outline" className="text-xs" style={{ borderColor: C.orange200, color: C.orange600 }}>Pendente</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs" style={{ borderColor: C.gray300, color: C.text400 }}>{g.status}</Badge>
                  )}
                  <ChevronRight className="h-4 w-4" style={{ color: C.text400 }} />
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// =====================================================
// HISTORICO SHEET (lateral)
// =====================================================

interface HistoricoSheetProps {
  vm: UsePrestacaoContasReturn
}

export function HistoricoSheet({ vm }: HistoricoSheetProps) {
  const geracoes = vm.historicoData?.geracoes || []

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors"
          style={{ color: C.text500, fontSize: 13 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100 }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
        >
          <Clock style={{ width: 14, height: 14 }} />
          <span className="hidden sm:inline">Historico</span>
        </button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2" style={{ color: C.text900 }}>
            <History className="h-5 w-5" style={{ color: C.navy700 }} />
            Historico de Analises
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="h-[calc(100vh-100px)] mt-4 pr-4">
          {vm.isLoadingHistorico ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : geracoes.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="mx-auto h-10 w-10" style={{ color: C.gray300 }} />
              <p className="mt-3" style={{ color: C.text400 }}>Nenhuma analise encontrada</p>
            </div>
          ) : (
            <div className="space-y-2">
              {geracoes.map(g => (
                <button
                  key={g.id}
                  onClick={() => vm.carregarDoHistorico(g.id)}
                  className="flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all"
                  style={{ borderColor: C.gray200 }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.navy300; e.currentTarget.style.background = C.navy50 }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.gray200; e.currentTarget.style.background = 'transparent' }}
                >
                  {parecerIcone(g.parecer)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: C.text900 }}>
                      {g.numero_cnj_formatado || g.numero_cnj}
                    </p>
                    <div className="flex items-center gap-2 text-xs" style={{ color: C.text400 }}>
                      <span>{vm.formatarData(g.criado_em)}</span>
                      {g.tempo_processamento_ms && (
                        <span>({(g.tempo_processamento_ms / 1000).toFixed(0)}s)</span>
                      )}
                    </div>
                    {g.erro && (
                      <p className="text-xs truncate mt-0.5" style={{ color: C.statusError }}>{g.erro}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {g.status === 'erro' ? (
                      <Badge variant="outline" className="text-xs" style={{ background: '#fee2e2', color: '#991b1b', borderColor: '#fecaca' }}>Erro</Badge>
                    ) : g.parecer ? (
                      <Badge variant="outline" className="text-xs" style={vm.parecerBadgeStyle(g.parecer)}>
                        {vm.parecerTexto(g.parecer)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: C.gray300, color: C.text400 }}>{g.status}</Badge>
                    )}
                    {g.permite_anexar && (
                      <Badge variant="outline" className="text-xs" style={{ borderColor: C.orange200, color: C.orange600 }}>
                        Docs pendentes
                      </Badge>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

// =====================================================
// RESUMO RESULTADO + CONFIRMACAO DIALOG
// =====================================================

interface ResumoResultadoProps {
  vm: UsePrestacaoContasReturn
}

export function ResumoResultado({ vm }: ResumoResultadoProps) {
  if (!vm.geracaoAtual) return null

  return (
    <Card className="overflow-hidden" style={{ borderRadius: 16, borderColor: C.gray200 }}>
      <div style={{ height: 4, background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {parecerIcone(vm.geracaoAtual.parecer)}
            <div>
              <p className="font-semibold" style={{ color: C.text900 }}>
                Parecer: {vm.parecerTexto(vm.geracaoAtual.parecer)}
              </p>
              <p className="text-sm" style={{ color: C.text500 }}>
                {vm.geracaoAtual.numero_cnj_formatado || vm.geracaoAtual.numero_cnj}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => vm.setShowResultDialog(true)}
              className="text-white"
              style={{ background: C.navy950 }}
            >
              Ver Parecer
            </Button>
            <Button
              onClick={vm.resetarParaInicio}
              variant="ghost"
              style={{ color: C.text500 }}
            >
              <RotateCw className="mr-2 h-4 w-4" />
              Nova Analise
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
