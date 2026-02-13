/**
 * ActivationTracePanel — Painel de rastreamento de ativação de módulos.
 *
 * Exibe um resumo, filtros, grid compacto de módulos (2 colunas desktop,
 * 1 mobile) e Dialog de detalhes ao clicar em cada card.
 *
 * Design System: PGE-DESIGN-SYSTEM.md — cores, tipografia, radius, badges.
 */

import { useEffect, useState, useCallback, useMemo } from 'react'
import { geradorApi, adminApi } from '@/lib/api'
import { C } from '@/lib/designTokens'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Check,
  X,
  Minus,
  Search,
  Zap,
  Brain,
  Copy,
  ChevronDown,
  Info,
  Filter,
  ChevronRight,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ============================================================================
// TYPES
// ============================================================================

interface ActivationTraceCondition {
  check_id: string
  label: string
  variable: string
  operator: string
  expected: unknown
  actual: unknown
  result: boolean | null
  notes: string | null
}

interface ActivationTraceModule {
  module_id: number
  slug: string
  titulo: string
  categoria: string | null
  activated: boolean
  mode: 'deterministic' | 'llm' | 'not_evaluated'
  rule_used: string | null
  rule_expression: Record<string, unknown> | null
  conditions: ActivationTraceCondition[]
  evaluation_mode: string | null
  short_circuit: { at_index: number; reason: string } | null
  llm_justification: string | null
  llm_evidence_variables: string[] | null
  details: string | null
}

interface ActivationTraceData {
  geracao_id: number
  modo_ativacao: string | null
  summary: {
    total_avaliados: number
    total_ativados: number
    total_nao_ativados: number
    total_det: number
    total_llm: number
  } | null
  variaveis_snapshot: Record<string, unknown> | null
  modulos: ActivationTraceModule[]
}

interface ActivationTracePanelProps {
  geracaoId: number
  /** When true, uses the admin API endpoint instead of the user-facing one. */
  adminMode?: boolean
}

type FilterState = 'todos' | 'ativados' | 'nao_ativados'

// ============================================================================
// HELPERS
// ============================================================================

const maskSensitiveData = (value: unknown): string => {
  if (typeof value !== 'string') return String(value)
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value)) {
    return value.replace(/\d(?=\d{2})/g, '*')
  }
  if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(value)) {
    return value.replace(/\d(?=\d{2})/g, '*')
  }
  return value
}

const formatValue = (value: unknown): string => {
  if (value === null) return 'null'
  if (value === undefined) return 'undefined'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return maskSensitiveData(value)
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

const getModeBadgeStyle = (mode: string | null): { bg: string; text: string; label: string } => {
  switch (mode) {
    case 'FAST_PATH':
      return { bg: C.navy100, text: C.navy950, label: 'FAST PATH' }
    case 'MISTO':
      return { bg: C.orange100, text: C.orange600, label: 'MISTO' }
    case 'LLM':
      return { bg: '#f3e8ff', text: '#7c3aed', label: 'LLM' }
    case 'SEMI_AUTOMATICO':
      return { bg: C.warningBg, text: C.warningText, label: 'SEMI-AUTOMÁTICO' }
    default:
      return { bg: C.gray100, text: C.text700, label: mode ?? 'DESCONHECIDO' }
  }
}

const copyToClipboard = async (text: string, toast: ReturnType<typeof useToast>['toast']) => {
  try {
    await navigator.clipboard.writeText(text)
    toast({ title: 'Copiado!', description: 'Conteúdo copiado para a área de transferência.' })
  } catch {
    toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' })
  }
}

// ============================================================================
// DISCLOSURE (collapsible section)
// ============================================================================

function Disclosure({
  title,
  children,
  defaultOpen = false,
}: {
  title: React.ReactNode
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t" style={{ borderColor: C.gray200 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between py-3 text-sm font-medium transition-colors hover:underline"
        style={{ color: C.text700 }}
      >
        {title}
        <ChevronDown
          className="h-4 w-4 shrink-0 transition-transform"
          style={{ color: C.text400, transform: open ? 'rotate(180deg)' : undefined }}
        />
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function ActivationTracePanel({ geracaoId, adminMode = false }: ActivationTracePanelProps) {
  const [data, setData] = useState<ActivationTraceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterState, setFilterState] = useState<FilterState>('todos')
  const [selectedModule, setSelectedModule] = useState<ActivationTraceModule | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = adminMode
          ? await adminApi.get<ActivationTraceData>(
              `/admin/api/gerador-pecas-admin/geracoes/${geracaoId}/activation-trace`
            )
          : await geradorApi.get<ActivationTraceData>(
              `/historico/${geracaoId}/activation-trace`
            )
        setData(response)
      } catch {
        setError('Erro ao carregar dados de ativação. Tente novamente.')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [geracaoId, adminMode])

  const filteredModules = useMemo(() => {
    if (!data) return []
    let modules = data.modulos
    if (filterState === 'ativados') {
      modules = modules.filter(m => m.activated)
    } else if (filterState === 'nao_ativados') {
      modules = modules.filter(m => !m.activated)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      modules = modules.filter(
        m =>
          m.titulo.toLowerCase().includes(q) ||
          m.slug.toLowerCase().includes(q) ||
          m.categoria?.toLowerCase().includes(q)
      )
    }
    return modules
  }, [data, filterState, searchQuery])

  const handleCopyRule = useCallback(
    (rule: Record<string, unknown> | null) => {
      if (!rule) return
      copyToClipboard(JSON.stringify(rule, null, 2), toast)
    },
    [toast]
  )

  const handleCopyVariable = useCallback(
    (name: string, value: unknown) => {
      copyToClipboard(`${name}: ${formatValue(value)}`, toast)
    },
    [toast]
  )

  // ---------- Loading ----------
  if (loading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  // ---------- Error ----------
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <X className="w-10 h-10 mb-3" style={{ color: C.statusError }} />
        <p className="text-base font-semibold" style={{ color: C.text700 }}>{error}</p>
      </div>
    )
  }

  // ---------- Empty ----------
  if (!data || data.modulos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <Zap className="w-10 h-10 mb-3" style={{ color: C.text400 }} />
        <p className="text-base font-semibold" style={{ color: C.text700 }}>
          Dados de ativação não disponíveis
        </p>
        <p className="text-sm mt-1" style={{ color: C.text400 }}>
          Gerações anteriores à implementação deste recurso não possuem rastreamento.
        </p>
      </div>
    )
  }

  const { summary, modo_ativacao, variaveis_snapshot } = data
  const modeBadge = getModeBadgeStyle(modo_ativacao)

  return (
    <div className="flex flex-col h-full">
      {/* ================================================================
          SUMMARY HEADER
          ================================================================ */}
      <div className="shrink-0 px-6 pt-5 pb-4">
        {/* Top row: stats + mode badge */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            {/* Activated count — hero stat */}
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold" style={{ color: C.statusSuccess }}>
                {summary?.total_ativados ?? 0}
              </span>
              <span className="text-sm" style={{ color: C.text400 }}>
                / {summary?.total_avaliados ?? 0} módulos
              </span>
            </div>

            {/* Breakdown pills */}
            <div className="flex items-center gap-2">
              {(summary?.total_det ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: C.navy100, color: C.navy950 }}
                >
                  <Zap className="w-3 h-3" />
                  {summary!.total_det} det
                </span>
              )}
              {(summary?.total_llm ?? 0) > 0 && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: '#f3e8ff', color: '#7c3aed' }}
                >
                  <Brain className="w-3 h-3" />
                  {summary!.total_llm} LLM
                </span>
              )}
            </div>
          </div>

          <Badge
            className="text-xs font-semibold px-3 py-1"
            style={{ backgroundColor: modeBadge.bg, color: modeBadge.text, border: 'none' }}
          >
            {modeBadge.label}
          </Badge>
        </div>
      </div>

      {/* ================================================================
          FILTER BAR
          ================================================================ */}
      <div
        className="shrink-0 border-y px-6 py-3 flex flex-wrap items-center gap-3"
        style={{ borderColor: C.gray200, backgroundColor: C.gray50 }}
      >
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.text400 }} />
          <Input
            type="text"
            placeholder="Buscar módulos..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10 h-9 text-sm rounded-xl"
            style={{ borderColor: C.gray200 }}
          />
        </div>

        <div
          className="flex items-center gap-0.5 rounded-xl p-0.5"
          style={{ backgroundColor: C.gray100 }}
        >
          {(['todos', 'ativados', 'nao_ativados'] as FilterState[]).map(state => {
            const active = filterState === state
            const label = state === 'todos' ? 'Todos' : state === 'ativados' ? 'Ativados' : 'Não ativados'
            return (
              <button
                key={state}
                onClick={() => setFilterState(state)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                style={{
                  backgroundColor: active ? 'white' : 'transparent',
                  color: active ? C.text900 : C.text500,
                  boxShadow: active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ================================================================
          MODULE GRID (compact cards)
          ================================================================ */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        {filteredModules.length === 0 ? (
          <div className="text-center py-12" style={{ color: C.text400 }}>
            <Filter className="w-8 h-8 mx-auto mb-2" />
            <p className="text-sm">Nenhum módulo encontrado com os filtros aplicados.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredModules.map(module => (
              <CompactModuleCard
                key={module.module_id}
                module={module}
                onClick={() => setSelectedModule(module)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ================================================================
          VARIABLES PANEL (footer, collapsible)
          ================================================================ */}
      {variaveis_snapshot && Object.keys(variaveis_snapshot).length > 0 && (
        <div className="shrink-0 border-t px-6 py-3" style={{ borderColor: C.gray200 }}>
          <Disclosure title={`Variáveis do Processo (${Object.keys(variaveis_snapshot).length})`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto">
              {Object.entries(variaveis_snapshot).map(([name, value]) => (
                <VariableCard key={name} name={name} value={value} onCopy={handleCopyVariable} />
              ))}
            </div>
          </Disclosure>
        </div>
      )}

      {/* ================================================================
          MODULE DETAILS DIALOG
          ================================================================ */}
      <ModuleDetailsDialog
        module={selectedModule}
        onClose={() => setSelectedModule(null)}
        onCopyRule={handleCopyRule}
      />
    </div>
  )
}

// ============================================================================
// COMPACT MODULE CARD (grid item)
// ============================================================================

interface CompactModuleCardProps {
  module: ActivationTraceModule
  onClick: () => void
}

function CompactModuleCard({ module, onClick }: CompactModuleCardProps) {
  const isActivated = module.activated
  const isDeterministic = module.mode === 'deterministic'
  const isLLM = module.mode === 'llm'

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-2xl border bg-white p-4 transition-all hover:shadow-md"
      style={{
        borderColor: isActivated ? C.successBorder : C.gray200,
        borderLeftWidth: 3,
        borderLeftColor: isActivated ? C.statusSuccess : C.gray300,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className="text-sm font-semibold leading-snug truncate"
            style={{ color: C.text900 }}
          >
            {module.titulo}
          </p>
          {module.categoria && (
            <p className="text-xs mt-0.5 truncate" style={{ color: C.text400 }}>
              {module.categoria}
            </p>
          )}
        </div>
        <ChevronRight
          className="w-4 h-4 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: C.text400 }}
        />
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
        {/* Status badge */}
        <span
          className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
          style={{
            backgroundColor: isActivated ? C.successBg : C.gray100,
            color: isActivated ? C.successText : C.text400,
          }}
        >
          {isActivated ? (
            <Check className="w-3 h-3" />
          ) : (
            <X className="w-3 h-3" />
          )}
          {isActivated ? 'ATIVADO' : 'NÃO ATIVADO'}
        </span>

        {/* Mode badge */}
        {isDeterministic && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: C.navy100, color: C.navy950 }}
          >
            <Zap className="w-3 h-3" />
            Determinístico
          </span>
        )}
        {isLLM && (
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
            style={{ backgroundColor: '#f3e8ff', color: '#7c3aed' }}
          >
            <Brain className="w-3 h-3" />
            LLM
          </span>
        )}
      </div>
    </button>
  )
}

// ============================================================================
// MODULE DETAILS DIALOG
// ============================================================================

interface ModuleDetailsDialogProps {
  module: ActivationTraceModule | null
  onClose: () => void
  onCopyRule: (rule: Record<string, unknown> | null) => void
}

function ModuleDetailsDialog({ module, onClose, onCopyRule }: ModuleDetailsDialogProps) {
  if (!module) return null

  const isActivated = module.activated
  const isDeterministic = module.mode === 'deterministic'
  const isLLM = module.mode === 'llm'

  return (
    <Dialog open={!!module} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="shrink-0 p-5 border-b" style={{ borderColor: C.gray200 }}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-bold leading-snug" style={{ color: C.text900 }}>
                {module.titulo}
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm" style={{ color: C.text400 }}>
                {module.categoria ?? module.slug}
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{
                  backgroundColor: isActivated ? C.successBg : C.gray100,
                  color: isActivated ? C.successText : C.text400,
                }}
              >
                {isActivated ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {isActivated ? 'ATIVADO' : 'NÃO ATIVADO'}
              </span>
              {isDeterministic && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: C.navy100, color: C.navy950 }}
                >
                  <Zap className="w-3.5 h-3.5" />
                  Determinístico
                </span>
              )}
              {isLLM && (
                <span
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full"
                  style={{ backgroundColor: '#f3e8ff', color: '#7c3aed' }}
                >
                  <Brain className="w-3.5 h-3.5" />
                  LLM
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">

          {/* RULE (deterministic) */}
          {isDeterministic && module.rule_expression && (
            <section>
              <h3 className="text-sm font-semibold mb-2" style={{ color: C.text700 }}>
                Regra utilizada
              </h3>
              <div className="relative">
                <pre
                  className="text-xs p-4 rounded-xl overflow-x-auto"
                  style={{ backgroundColor: C.gray50, color: C.text700, fontFamily: 'monospace' }}
                >
                  {JSON.stringify(module.rule_expression, null, 2)}
                </pre>
                <button
                  onClick={() => onCopyRule(module.rule_expression)}
                  className="absolute top-2 right-2 p-1.5 rounded-lg transition-colors"
                  style={{ color: C.text400 }}
                  title="Copiar regra"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </section>
          )}

          {/* CONDITIONS (deterministic) */}
          {isDeterministic && module.conditions.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold mb-2" style={{ color: C.text700 }}>
                Condições avaliadas ({module.conditions.length})
              </h3>

              {module.short_circuit && (
                <div
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded-xl mb-2"
                  style={{ backgroundColor: C.warningBg, color: C.warningText }}
                >
                  <Info className="w-4 h-4 shrink-0" />
                  Short-circuit na condição {module.short_circuit.at_index + 1}: {module.short_circuit.reason}
                </div>
              )}

              <div className="space-y-2">
                {(module.conditions ?? []).map(cond => (
                  <ConditionRow key={cond.check_id} condition={cond} />
                ))}
              </div>
            </section>
          )}

          {/* LLM details */}
          {isLLM && (
            <section className="space-y-4">
              {module.details && (
                <div>
                  <h3 className="text-sm font-semibold mb-1.5" style={{ color: C.text700 }}>
                    Condição de ativação
                  </h3>
                  <p className="text-sm" style={{ color: C.text500 }}>
                    {module.details}
                  </p>
                </div>
              )}

              {module.llm_justification && (
                <div>
                  <h3 className="text-sm font-semibold mb-1.5" style={{ color: C.text700 }}>
                    Justificativa da IA
                  </h3>
                  <p
                    className="text-sm p-4 rounded-xl"
                    style={{ backgroundColor: C.gray50, color: C.text700 }}
                  >
                    {module.llm_justification}
                  </p>
                </div>
              )}

              {module.llm_evidence_variables && module.llm_evidence_variables.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-1.5" style={{ color: C.text700 }}>
                    Variáveis consideradas
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {module.llm_evidence_variables.map(varName => (
                      <span
                        key={varName}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: C.navy100, color: C.navy950, fontFamily: 'monospace' }}
                      >
                        {varName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {/* Not evaluated */}
          {module.mode === 'not_evaluated' && (
            <div className="text-center py-6" style={{ color: C.text400 }}>
              <p className="text-sm">Este módulo não foi avaliado nesta geração.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// CONDITION ROW
// ============================================================================

function ConditionRow({ condition }: { condition: ActivationTraceCondition }) {
  const isPassed = condition.result === true
  const isFailed = condition.result === false

  const icon = isPassed ? (
    <Check className="w-4 h-4 shrink-0" style={{ color: C.statusSuccess }} />
  ) : isFailed ? (
    <X className="w-4 h-4 shrink-0" style={{ color: C.statusError }} />
  ) : (
    <Minus className="w-4 h-4 shrink-0" style={{ color: C.text400 }} />
  )

  const bgColor = isPassed ? C.successBg : isFailed ? C.errorBg : C.gray50

  return (
    <div className="flex items-start gap-3 p-3 rounded-xl text-xs" style={{ backgroundColor: bgColor }}>
      <div className="pt-0.5">{icon}</div>
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <code className="font-semibold" style={{ color: C.text700 }}>
            {condition.variable}
          </code>
          <span style={{ color: C.text400 }}>
            {condition.operator} {formatValue(condition.expected)}
          </span>
        </div>
        <div style={{ color: C.text700 }}>
          <span style={{ color: C.text400 }}>→</span> {formatValue(condition.actual)}
        </div>
        {condition.notes && (
          <p className="italic" style={{ color: C.text400 }}>
            {condition.notes}
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// VARIABLE CARD
// ============================================================================

function VariableCard({
  name,
  value,
  onCopy,
}: {
  name: string
  value: unknown
  onCopy: (name: string, value: unknown) => void
}) {
  return (
    <div
      className="p-2.5 rounded-xl border text-xs hover:shadow-sm transition-shadow group relative"
      style={{ borderColor: C.gray200, backgroundColor: 'white' }}
    >
      <div className="flex items-start justify-between gap-1">
        <code className="font-semibold break-all" style={{ color: C.navy950 }}>
          {name}
        </code>
        <button
          onClick={() => onCopy(name, value)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5"
          title="Copiar"
        >
          <Copy className="w-3 h-3" style={{ color: C.text400 }} />
        </button>
      </div>
      <div className="mt-1 break-all" style={{ color: C.text700 }}>
        {formatValue(value)}
      </div>
    </div>
  )
}
