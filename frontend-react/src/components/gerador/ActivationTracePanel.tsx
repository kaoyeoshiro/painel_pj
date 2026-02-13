import { useEffect, useState, useCallback, useMemo } from 'react'
import { geradorApi, adminApi } from '@/lib/api'
import { C } from '@/lib/designTokens'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
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
// DISCLOSURE (inline collapsible section — replaces Accordion)
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
// HELPER FUNCTIONS
// ============================================================================

const maskSensitiveData = (value: unknown): string => {
  if (typeof value !== 'string') return String(value)

  // Mask CPF (XXX.XXX.XXX-XX)
  if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(value)) {
    return value.replace(/\d(?=\d{2})/g, '*')
  }

  // Mask CNPJ (XX.XXX.XXX/XXXX-XX)
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
      return { bg: C.orange500 + '20', text: C.orange500, label: 'MISTO' }
    case 'LLM':
      return { bg: '#f3e8ff', text: '#7c3aed', label: 'LLM' }
    case 'SEMI_AUTOMATICO':
      return { bg: C.warningBg, text: C.warningText, label: 'SEMI-AUTOMÁTICO' }
    default:
      return { bg: C.gray100, text: C.text700, label: 'DESCONHECIDO' }
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
// COMPONENT
// ============================================================================

export function ActivationTracePanel({ geracaoId, adminMode = false }: ActivationTracePanelProps) {
  const [data, setData] = useState<ActivationTraceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterState, setFilterState] = useState<FilterState>('todos')
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
      } catch (err) {
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

    // Apply activation filter
    if (filterState === 'ativados') {
      modules = modules.filter(m => m.activated)
    } else if (filterState === 'nao_ativados') {
      modules = modules.filter(m => !m.activated)
    }

    // Apply search
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

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center py-12 px-4 text-center"
        style={{ color: C.errorText }}
      >
        <X className="w-12 h-12 mb-4" style={{ color: C.errorText }} />
        <p className="text-lg font-semibold">{error}</p>
      </div>
    )
  }

  // ============================================================================
  // EMPTY STATE
  // ============================================================================

  if (!data || data.modulos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center" style={{ color: C.text400 }}>
        <Zap className="w-12 h-12 mb-4" style={{ color: C.text400 }} />
        <p className="text-lg font-semibold" style={{ color: C.text700 }}>
          Dados de ativação não disponíveis para esta geração.
        </p>
        <p className="text-sm mt-2">
          Gerações anteriores à implementação deste recurso não possuem rastreamento.
        </p>
      </div>
    )
  }

  const { summary, modo_ativacao, variaveis_snapshot } = data
  const modeBadge = getModeBadgeStyle(modo_ativacao)

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="flex flex-col h-full">
      {/* HEADER SUMMARY (STICKY) */}
      <div
        className="sticky top-0 z-10 border-b px-4 py-3 space-y-2"
        style={{ backgroundColor: 'white', borderColor: C.gray200 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold" style={{ color: C.text700 }}>
              {summary?.total_ativados ?? 0} módulos ativados de {summary?.total_avaliados ?? 0} avaliados
            </span>
          </div>
          <Badge style={{ backgroundColor: modeBadge.bg, color: modeBadge.text, border: 'none' }}>
            {modeBadge.label}
          </Badge>
        </div>

        {summary && (summary.total_det > 0 || summary.total_llm > 0) && (
          <div className="flex items-center gap-2">
            {summary.total_det > 0 && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{ backgroundColor: C.navy100, color: C.navy950 }}
              >
                {summary.total_det} Determinísticos
              </span>
            )}
            {summary.total_llm > 0 && (
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{ backgroundColor: C.orange500 + '20', color: C.orange500 }}
              >
                {summary.total_llm} LLM
              </span>
            )}
          </div>
        )}
      </div>

      {/* FILTER BAR */}
      <div className="border-b px-4 py-3 flex items-center gap-3" style={{ borderColor: C.gray200 }}>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.text400 }} />
          <Input
            type="text"
            placeholder="Buscar módulos..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-1 border rounded-lg p-1" style={{ borderColor: C.gray200 }}>
          {(['todos', 'ativados', 'nao_ativados'] as FilterState[]).map(state => (
            <button
              key={state}
              onClick={() => setFilterState(state)}
              className="px-3 py-1 text-xs font-medium rounded transition-colors"
              style={{
                backgroundColor: filterState === state ? C.navy950 : 'transparent',
                color: filterState === state ? 'white' : C.text700,
              }}
            >
              {state === 'todos' ? 'Todos' : state === 'ativados' ? 'Ativados' : 'Não ativados'}
            </button>
          ))}
        </div>
      </div>

      {/* MODULE CARDS */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-3">
          {filteredModules.length === 0 ? (
            <div className="text-center py-8" style={{ color: C.text400 }}>
              <Filter className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Nenhum módulo encontrado com os filtros aplicados.</p>
            </div>
          ) : (
            filteredModules.map(module => (
              <ModuleCard
                key={module.module_id}
                module={module}
                onCopyRule={handleCopyRule}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* VARIABLES PANEL */}
      {variaveis_snapshot && Object.keys(variaveis_snapshot).length > 0 && (
        <div className="border-t px-4 py-3" style={{ borderColor: C.gray200 }}>
          <Disclosure title={`Variáveis do Processo (${Object.keys(variaveis_snapshot).length})`}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 max-h-64 overflow-y-auto">
              {Object.entries(variaveis_snapshot).map(([name, value]) => (
                <VariableCard key={name} name={name} value={value} onCopy={handleCopyVariable} />
              ))}
            </div>
          </Disclosure>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MODULE CARD COMPONENT
// ============================================================================

interface ModuleCardProps {
  module: ActivationTraceModule
  onCopyRule: (rule: Record<string, unknown> | null) => void
}

function ModuleCard({ module, onCopyRule }: ModuleCardProps) {
  const isActivated = module.activated
  const isDeterministic = module.mode === 'deterministic'
  const isLLM = module.mode === 'llm'

  const borderColor = isActivated ? C.statusSuccess : C.gray300
  const badgeBg = isActivated ? C.successBg : C.gray100
  const badgeText = isActivated ? C.successText : C.text400
  const badgeBorder = isActivated ? C.successBorder : C.gray300

  return (
    <Card
      className="relative overflow-hidden"
      style={{ borderLeft: `3px solid ${borderColor}` }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <CardTitle className="text-base font-semibold truncate" style={{ color: C.text700 }}>
                {module.titulo}
              </CardTitle>
            </div>
            {module.categoria && (
              <p className="text-xs" style={{ color: C.text400 }}>
                {module.categoria}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge
              style={{
                backgroundColor: badgeBg,
                color: badgeText,
                borderColor: badgeBorder,
                border: '1px solid',
              }}
            >
              {isActivated ? 'ATIVADO' : 'NÃO ATIVADO'}
            </Badge>

            {isDeterministic && (
              <span
                className="text-xs px-2 py-1 rounded"
                style={{ backgroundColor: C.navy100, color: C.navy950 }}
              >
                Determinístico
              </span>
            )}

            {isLLM && (
              <span
                className="text-xs px-2 py-1 rounded flex items-center gap-1"
                style={{ backgroundColor: C.orange500 + '20', color: C.orange500 }}
              >
                <Brain className="w-3 h-3" />
                LLM
              </span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {/* RULE SECTION (DETERMINISTIC) */}
        {isDeterministic && module.rule_expression && (
          <Disclosure title="Regra utilizada">
            <div className="relative">
              <pre
                className="text-xs p-3 rounded overflow-x-auto"
                style={{ backgroundColor: C.gray50, color: C.text700, fontFamily: 'monospace' }}
              >
                {JSON.stringify(module.rule_expression, null, 2)}
              </pre>
              <button
                onClick={() => onCopyRule(module.rule_expression)}
                className="absolute top-2 right-2 p-1 rounded hover:bg-white/50 transition-colors"
                title="Copiar regra"
              >
                <Copy className="w-4 h-4" style={{ color: C.text400 }} />
              </button>
            </div>
          </Disclosure>
        )}

        {/* CONDITIONS SECTION (DETERMINISTIC) */}
        {isDeterministic && module.conditions.length > 0 && (
          <Disclosure title={`Condições avaliadas (${module.conditions.length})`}>
            <div className="space-y-2">
              {module.short_circuit && (
                <div
                  className="flex items-center gap-2 text-xs px-3 py-2 rounded"
                  style={{ backgroundColor: C.warningBg, color: C.warningText }}
                >
                  <Info className="w-4 h-4" />
                  Short-circuit na condição {module.short_circuit.at_index + 1}: {module.short_circuit.reason}
                </div>
              )}

              {module.conditions.map((cond, idx) => (
                <ConditionRow key={cond.check_id} condition={cond} index={idx} />
              ))}
            </div>
          </Disclosure>
        )}

        {/* LLM SECTION */}
        {isLLM && (
          <Disclosure title="Avaliação LLM">
            <div className="space-y-3 text-sm">
              {module.details && (
                <div>
                  <p className="font-medium mb-1" style={{ color: C.text700 }}>
                    Condição de ativação:
                  </p>
                  <p className="text-xs" style={{ color: C.text400 }}>
                    {module.details}
                  </p>
                </div>
              )}

              {module.llm_justification && (
                <div>
                  <p className="font-medium mb-1" style={{ color: C.text700 }}>
                    Justificativa da IA:
                  </p>
                  <p
                    className="text-xs p-3 rounded"
                    style={{ backgroundColor: C.gray50, color: C.text700 }}
                  >
                    {module.llm_justification}
                  </p>
                </div>
              )}

              {module.llm_evidence_variables && module.llm_evidence_variables.length > 0 && (
                <div>
                  <p className="font-medium mb-1" style={{ color: C.text700 }}>
                    Variáveis consideradas:
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {module.llm_evidence_variables.map(varName => (
                      <span
                        key={varName}
                        className="text-xs px-2 py-1 rounded"
                        style={{ backgroundColor: C.navy100, color: C.navy950, fontFamily: 'monospace' }}
                      >
                        {varName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Disclosure>
        )}
      </CardContent>
    </Card>
  )
}

// ============================================================================
// CONDITION ROW COMPONENT
// ============================================================================

interface ConditionRowProps {
  condition: ActivationTraceCondition
  index: number
}

function ConditionRow({ condition }: ConditionRowProps) {
  const isPassed = condition.result === true
  const isFailed = condition.result === false

  const icon = isPassed ? (
    <Check className="w-4 h-4 flex-shrink-0" style={{ color: C.statusSuccess }} />
  ) : isFailed ? (
    <X className="w-4 h-4 flex-shrink-0" style={{ color: C.errorText }} />
  ) : (
    <Minus className="w-4 h-4 flex-shrink-0" style={{ color: C.text400 }} />
  )

  const bgColor = isPassed ? C.successBg : isFailed ? C.errorBg : C.gray50

  return (
    <div className="flex items-start gap-3 p-3 rounded text-xs" style={{ backgroundColor: bgColor }}>
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
// VARIABLE CARD COMPONENT
// ============================================================================

interface VariableCardProps {
  name: string
  value: unknown
  onCopy: (name: string, value: unknown) => void
}

function VariableCard({ name, value, onCopy }: VariableCardProps) {
  return (
    <div
      className="p-2 rounded border text-xs hover:shadow-sm transition-shadow group relative"
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
