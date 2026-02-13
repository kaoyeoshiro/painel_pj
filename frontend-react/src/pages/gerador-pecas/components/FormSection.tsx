/**
 * Secao de formulario do Gerador de Pecas.
 *
 * Contem: tabs CNJ/PDF, tipo de peca, grupo, observacao,
 * botoes de acao, pipeline visual, historico recente e estado vazio.
 */

import {
  FileText,
  Upload,
  X,
  Search,
  Zap,
  Eye,
  ChevronRight,
  AlertTriangle,
  Trash2,
  Scale,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { C } from '@/lib/designTokens'
import type { UseGeradorPecasReturn } from '../hooks/useGeradorPecas'
import { AGENT_META, formatDate } from '../types'

// ============================================================================
// Props
// ============================================================================

interface FormSectionProps {
  h: UseGeradorPecasReturn
}

// ============================================================================
// Componente
// ============================================================================

export function FormSection({ h }: FormSectionProps) {
  return (
    <>
      {/* Error banner */}
      {h.pageState === 'erro' && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-red-800">Erro na geracao</p>
            <p className="mt-0.5 text-sm text-red-600">{h.errorMessage}</p>
          </div>
          <button
            onClick={h.voltarParaInicio}
            className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Form card */}
      <div className="overflow-hidden rounded-2xl border bg-white shadow-sm" style={{ borderColor: C.gray200 }}>
        {/* Navy accent bar */}
        <div className="h-1" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
        {/* Input mode tabs */}
        <div className="flex border-b" style={{ borderColor: C.gray100 }}>
          <button
            type="button"
            className={cn(
              'relative flex-1 px-5 py-3.5 font-medium transition-colors',
              h.inputMode === 'cnj'
                ? 'text-slate-800'
                : 'text-slate-400 hover:text-slate-600',
            )}
            onClick={() => h.setInputMode('cnj')}
            disabled={h.isFormDisabled}
          >
            <span className="flex items-center justify-center gap-2">
              <Search className="h-3.5 w-3.5" />
              Por Processo (CNJ)
            </span>
            {h.inputMode === 'cnj' && (
              <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
            )}
          </button>
          <button
            type="button"
            className={cn(
              'relative flex-1 px-5 py-3.5 font-medium transition-colors',
              h.inputMode === 'pdf'
                ? 'text-slate-800'
                : 'text-slate-400 hover:text-slate-600',
            )}
            onClick={() => h.setInputMode('pdf')}
            disabled={h.isFormDisabled}
          >
            <span className="flex items-center justify-center gap-2">
              <Upload className="h-3.5 w-3.5" />
              Upload de PDF
            </span>
            {h.inputMode === 'pdf' && (
              <span className="absolute inset-x-0 bottom-0 h-0.5" style={{ background: `linear-gradient(90deg, ${C.navy950}, ${C.navy500})` }} />
            )}
          </button>
        </div>

        <div className="p-5 sm:p-6">
          <div className="space-y-5">
            {/* CNJ Input */}
            {h.inputMode === 'cnj' && (
              <div>
                <Label htmlFor="numero-cnj" className="text-[15px] font-medium text-slate-600">
                  Numero do Processo
                </Label>
                <Input
                  id="numero-cnj"
                  value={h.numeroCNJ_raw}
                  onChange={(e) => h.setNumeroCNJ(e.target.value)}
                  placeholder="0000000-00.0000.0.00.0000"
                  className="mt-2 h-11 rounded-xl border-slate-200 bg-slate-50/50 font-mono text-base tracking-wide placeholder:text-slate-300 focus:border-slate-400 focus:bg-white focus:ring-slate-400/20"
                  disabled={h.isFormDisabled}
                />
              </div>
            )}

            {/* PDF Upload */}
            {h.inputMode === 'pdf' && (
              <div>
                <Label className="text-[15px] font-medium text-slate-600">
                  Arquivos PDF
                </Label>
                <div
                  className="mt-2 cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/30 p-8 text-center transition-all hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => h.pdfInputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter') h.pdfInputRef.current?.click() }}
                >
                  <input
                    ref={h.pdfInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      h.setPdfFiles(prev => [...prev, ...files])
                      e.target.value = ''
                    }}
                    disabled={h.isFormDisabled}
                  />
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
                    <Upload className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-600">
                    Arraste PDFs aqui ou clique para selecionar
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Documentos do processo em formato PDF
                  </p>
                </div>
                {h.pdfFiles.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    {h.pdfFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-150 bg-white px-3 py-2.5">
                        <div className="flex items-center gap-2.5 truncate">
                          <FileText className="h-4 w-4 flex-shrink-0 text-red-500" />
                          <span className="truncate text-sm text-slate-700">{file.name}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => h.setPdfFiles(prev => prev.filter((_, i) => i !== idx))}
                          className="ml-2 flex-shrink-0 rounded p-0.5 text-slate-300 transition-colors hover:bg-red-50 hover:text-red-500"
                          aria-label={`Remover ${file.name}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tipo de Peca */}
            <div>
              <Label htmlFor="tipo-peca" className="text-[15px] font-medium text-slate-600">
                Tipo de Peca
              </Label>
              {h.isLoadingTipos ? (
                <Skeleton className="mt-2 h-11 w-full rounded-xl" />
              ) : (
                <Select
                  value={h.tipoPeca || (h.tiposPecaData?.permite_auto ? '__auto__' : '')}
                  onValueChange={(v) => h.setTipoPeca(v === '__auto__' ? '' : v)}
                  disabled={h.isFormDisabled || (!h.tiposPecaData?.tipos?.length && !h.tiposPecaData?.permite_auto)}
                >
                  <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:border-slate-400 focus:ring-slate-400/20" id="tipo-peca">
                    <SelectValue placeholder={
                      !h.tiposPecaData?.tipos?.length && !h.tiposPecaData?.permite_auto
                        ? 'Nenhum tipo de peca configurado'
                        : 'Selecione o tipo de peca'
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {h.tiposPecaData?.permite_auto && (
                      <SelectItem value="__auto__">Deteccao automatica (IA decide)</SelectItem>
                    )}
                    {h.tiposPecaData?.tipos?.map((tipo) => (
                      <SelectItem key={tipo.valor} value={tipo.valor}>
                        {tipo.label}
                      </SelectItem>
                    ))}
                    {!h.tiposPecaData?.tipos?.length && !h.tiposPecaData?.permite_auto && (
                      <div className="px-3 py-2 text-sm text-slate-400">
                        Nenhum tipo de peca disponivel. Configure prompts modulares no admin.
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
              {h.tiposPecaData && !h.tiposPecaData.permite_auto && (
                <p className="mt-1.5 text-xs text-slate-400">Selecao obrigatoria &mdash; deteccao automatica desabilitada</p>
              )}
            </div>

            {/* Grupo (opcional) */}
            {h.gruposData && h.gruposData.grupos.length > 0 && (
              <div>
                <Label htmlFor="grupo" className="text-[15px] font-medium text-slate-600">
                  Grupo de Argumentos
                </Label>
                <Select
                  value={h.selectedGroupId ? String(h.selectedGroupId) : '__all__'}
                  onValueChange={(v) => h.setSelectedGroupId(v === '__all__' ? null : Number(v))}
                  disabled={h.isFormDisabled}
                >
                  <SelectTrigger className="mt-2 h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:border-slate-400 focus:ring-slate-400/20" id="grupo">
                    <SelectValue placeholder="Todos os grupos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Todos os grupos</SelectItem>
                    {h.gruposData?.grupos?.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Subcategorias — campo legado, ocultado da UI (backend mantido) */}

            {/* Observacao */}
            <div>
              <Label htmlFor="observacao" className="text-[15px] font-medium text-slate-600">
                Observacoes
                <span className="ml-1 font-normal normal-case tracking-normal text-slate-400">(opcional)</span>
              </Label>
              <Textarea
                id="observacao"
                value={h.observacao}
                onChange={(e) => h.setObservacao(e.target.value)}
                placeholder="Instrucoes adicionais para a geracao..."
                rows={3}
                className="mt-2 rounded-xl border-slate-200 bg-slate-50/50 placeholder:text-slate-300 focus:border-slate-400 focus:ring-slate-400/20"
                disabled={h.isFormDisabled}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            <Button
              onClick={h.inputMode === 'cnj' ? h.iniciarGeracaoAutomatica : h.iniciarGeracaoPdf}
              className="h-11 flex-1 gap-2 rounded-xl text-sm font-medium text-white shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ background: C.navy950 }}
              disabled={h.isFormDisabled || (h.inputMode === 'cnj' ? !h.numeroCNJ_raw.trim() : h.pdfFiles.length === 0) || (!h.tipoPeca && !h.tiposPecaData?.permite_auto)}
            >
              <Zap className="h-4 w-4" />
              {h.isStreaming ? 'Gerando...' : 'Gerar Automatico'}
            </Button>
            {h.inputMode === 'cnj' && (
              <Button
                onClick={h.iniciarCuradoria}
                variant="outline"
                className="h-11 flex-1 gap-2 rounded-xl border-slate-200 text-sm font-medium text-slate-800 transition-all hover:bg-slate-50 active:scale-[0.98]"
                disabled={h.isFormDisabled || !h.numeroCNJ_raw.trim() || !h.tipoPeca || h.isCuradoriaLoading}
              >
                <Eye className="h-4 w-4" />
                {h.isCuradoriaLoading ? 'Carregando...' : 'Semi-Automatico'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* "Como funciona" — pipeline visual */}
      {h.pageState === 'idle' && (
        <div className="mt-8">
          <h3 className="mb-4 text-[15px] font-semibold" style={{ color: C.text700 }}>Pipeline de Geracao</h3>
          <div className="flex items-center gap-0">
            {AGENT_META.map((agent, i) => {
              const Icon = agent.icon
              return (
                <div key={agent.numero} className="flex flex-1 items-center">
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: C.navy100, color: C.navy700 }}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <p className="mt-2.5 text-[13px] font-semibold" style={{ color: C.text700 }}>{agent.nome}</p>
                    <p className="mt-0.5 text-xs leading-tight" style={{ color: C.text400 }}>{agent.descricao}</p>
                  </div>
                  {i < AGENT_META.length - 1 && (
                    <ChevronRight className="mx-1 h-4 w-4 flex-shrink-0" style={{ color: C.gray500 }} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent history */}
      {h.pageState === 'idle' && h.historico && h.historico.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold" style={{ color: C.text700 }}>Recentes</h3>
            <button
              onClick={() => h.setShowSidebar(true)}
              className="text-xs font-medium transition-colors"
              style={{ color: C.navy600 }}
            >
              Ver todos
            </button>
          </div>
          <div className="space-y-1.5">
            {(h.historico ?? []).slice(0, 4).map((item) => (
              <div
                key={item.id}
                onClick={() => h.carregarDoHistorico(item.id)}
                className="group flex cursor-pointer items-center gap-3 rounded-xl border border-transparent bg-white p-3.5 transition-all hover:border-slate-200 hover:shadow-sm"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') h.carregarDoHistorico(item.id) }}
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg" style={{ background: C.navy100, color: C.navy700 }}>
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" style={{ color: C.text700 }}>{item.cnj}</p>
                  <p className="mt-0.5 text-xs" style={{ color: C.text400 }}>{item.tipo_peca || 'Peca'} &middot; {formatDate(item.data)}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => h.excluirDoHistorico(item.id, e)}
                  className="flex-shrink-0 rounded p-1 text-slate-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  aria-label="Excluir geracao"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {h.pageState === 'idle' && (!h.historico || h.historico.length === 0) && !h.isLoadingHistorico && (
        <div className="mt-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: C.navy100, color: C.navy600 }}>
            <Scale className="h-6 w-6" />
          </div>
          <p className="mt-4 text-[15px] font-medium" style={{ color: C.text500 }}>Nenhuma geracao ainda</p>
          <p className="mt-1 text-[13px]" style={{ color: C.text400 }}>Preencha o formulario acima para gerar sua primeira peca</p>
        </div>
      )}
    </>
  )
}
