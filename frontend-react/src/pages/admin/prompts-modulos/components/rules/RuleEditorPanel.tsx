// Painel principal do editor de regras deterministicas
// Inclui: gerador IA, builder visual, display humanizado, fallback

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { C } from '@/lib/designTokens'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import {
  Wand2, Plus, FolderPlus, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Eye, Code, Info,
} from 'lucide-react'
import { RuleConditionItem } from './RuleConditionItem'
import { RulePreviewModal } from './RulePreviewModal'
import { humanizeRule, countConditions, extractVariables } from './humanize'
import type {
  RuleNode, RuleCondition, RuleGroup, RuleVariable,
  ComparisonOperator, GerarRegraResponse, ValidarRegraResponse,
} from './types'

// --- Tipos internos ---

interface RuleEditorPanelProps {
  // Regra primaria
  regraPrimaria: RuleNode | null
  regraTextoOriginal: string | null
  onRegraPrimariaChange: (regra: RuleNode | null) => void
  onRegraTextoOriginalChange: (texto: string | null) => void
  // Regra secundaria (fallback)
  regraSecundaria: RuleNode | null
  regraSecundariaTexto: string | null
  fallbackHabilitado: boolean
  onRegraSecundariaChange: (regra: RuleNode | null) => void
  onRegraSecundariaTextoChange: (texto: string | null) => void
  onFallbackHabilitadoChange: (habilitado: boolean) => void
}

// --- Subcomponentes ---

/** Builder visual de uma regra (primaria ou secundaria) */
function RuleBuilder({
  rule,
  onChange,
  variaveis,
  label,
}: {
  rule: RuleNode | null
  onChange: (rule: RuleNode | null) => void
  variaveis: RuleVariable[]
  label: string
}) {
  // Extrai o operador e condicoes do no raiz
  const rootGroup: RuleGroup = normalizeToGroup(rule)
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual')

  function normalizeToGroup(node: RuleNode | null): RuleGroup {
    if (!node) return { type: 'and', conditions: [] }
    if (node.type === 'and' || node.type === 'or') return node
    // Se e uma condicao unica, wrappa em AND
    return { type: 'and', conditions: [node] }
  }

  function emitChange(group: RuleGroup) {
    if (group.conditions.length === 0) {
      onChange(null)
    } else if (group.conditions.length === 1) {
      // Uma unica condicao nao precisa de wrapper
      onChange(group.conditions[0])
    } else {
      onChange(group)
    }
  }

  function handleOperatorChange(op: 'and' | 'or') {
    emitChange({ ...rootGroup, type: op })
  }

  function handleConditionChange(index: number, updated: RuleCondition) {
    const newConditions = [...rootGroup.conditions]
    newConditions[index] = updated
    emitChange({ ...rootGroup, conditions: newConditions })
  }

  function handleConditionRemove(index: number) {
    const newConditions = rootGroup.conditions.filter((_, i) => i !== index)
    emitChange({ ...rootGroup, conditions: newConditions })
  }

  function addCondition() {
    const newCond: RuleCondition = {
      type: 'condition',
      variable: '',
      operator: 'equals' as ComparisonOperator,
      value: '',
    }
    emitChange({ ...rootGroup, conditions: [...rootGroup.conditions, newCond] })
  }

  function addGroup() {
    const newGroup: RuleGroup = {
      type: rootGroup.type === 'and' ? 'or' : 'and',
      conditions: [
        { type: 'condition', variable: '', operator: 'equals' as ComparisonOperator, value: '' },
      ],
    }
    emitChange({ ...rootGroup, conditions: [...rootGroup.conditions, newGroup] })
  }

  // Handler para sub-grupos
  function handleSubGroupChange(index: number, updated: RuleNode | null) {
    const newConditions = [...rootGroup.conditions]
    if (updated === null) {
      newConditions.splice(index, 1)
    } else {
      newConditions[index] = updated
    }
    emitChange({ ...rootGroup, conditions: newConditions })
  }

  const condCount = countConditions(rule)
  const usedVars = extractVariables(rule)

  return (
    <div className="space-y-3">
      {/* Header com operador e modo de visualizacao */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium" style={{ color: C.text700 }}>
            {label}
          </span>
          {condCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {condCount} {condCount === 1 ? 'condição' : 'condições'}
            </Badge>
          )}
          {usedVars.length > 0 && (
            <Badge
              variant="outline"
              className="text-xs"
              style={{ color: C.navy700, borderColor: C.navy100 }}
            >
              {usedVars.length} {usedVars.length === 1 ? 'variável' : 'variáveis'}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-l-md border transition-colors"
            style={{
              background: viewMode === 'visual' ? C.navy950 : 'transparent',
              color: viewMode === 'visual' ? 'white' : C.text500,
              borderColor: C.gray300,
            }}
            onClick={() => setViewMode('visual')}
          >
            <Eye className="h-3 w-3 inline mr-1" />
            Visual
          </button>
          <button
            type="button"
            className="px-2 py-1 text-xs rounded-r-md border border-l-0 transition-colors"
            style={{
              background: viewMode === 'json' ? C.navy950 : 'transparent',
              color: viewMode === 'json' ? 'white' : C.text500,
              borderColor: C.gray300,
            }}
            onClick={() => setViewMode('json')}
          >
            <Code className="h-3 w-3 inline mr-1" />
            JSON
          </button>
        </div>
      </div>

      {viewMode === 'json' ? (
        <pre
          className="text-xs p-3 rounded-lg overflow-auto max-h-64 font-mono"
          style={{ background: C.gray50, border: `1px solid ${C.gray200}`, color: C.text700 }}
        >
          {rule ? JSON.stringify(rule, null, 2) : '// Nenhuma regra definida'}
        </pre>
      ) : (
        <>
          {/* Operador raiz */}
          {rootGroup.conditions.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: C.text500 }}>
                Operador:
              </span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                value={rootGroup.type}
                onChange={(e) => handleOperatorChange(e.target.value as 'and' | 'or')}
              >
                <option value="and">E (AND) — todas devem ser verdadeiras</option>
                <option value="or">OU (OR) — pelo menos uma verdadeira</option>
              </select>
            </div>
          )}

          {/* Lista de condicoes */}
          <div className="space-y-2">
            {rootGroup.conditions.map((cond, index) => {
              if (cond.type === 'condition') {
                return (
                  <div key={index}>
                    {index > 0 && (
                      <div
                        className="text-center text-xs font-bold py-1"
                        style={{ color: C.navy700 }}
                      >
                        {rootGroup.type === 'and' ? 'E' : 'OU'}
                      </div>
                    )}
                    <RuleConditionItem
                      condition={cond}
                      variaveis={variaveis}
                      onChange={(updated) => handleConditionChange(index, updated)}
                      onRemove={() => handleConditionRemove(index)}
                    />
                  </div>
                )
              }

              // Sub-grupo (AND/OR aninhado)
              if (cond.type === 'and' || cond.type === 'or') {
                return (
                  <div key={index}>
                    {index > 0 && (
                      <div
                        className="text-center text-xs font-bold py-1"
                        style={{ color: C.navy700 }}
                      >
                        {rootGroup.type === 'and' ? 'E' : 'OU'}
                      </div>
                    )}
                    <SubGroupEditor
                      group={cond}
                      variaveis={variaveis}
                      onChange={(updated) => handleSubGroupChange(index, updated)}
                      onRemove={() => handleConditionRemove(index)}
                      parentType={rootGroup.type}
                    />
                  </div>
                )
              }

              return null
            })}
          </div>

          {/* Botoes de adicionar */}
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addCondition}
              className="gap-1.5 text-xs"
            >
              <Plus className="h-3 w-3" />
              Condição
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGroup}
              className="gap-1.5 text-xs"
            >
              <FolderPlus className="h-3 w-3" />
              Grupo
            </Button>
          </div>

          {/* Display humanizado */}
          {condCount > 0 && (
            <div
              className="p-3 rounded-lg text-sm"
              style={{ background: C.navy50, border: `1px solid ${C.navy100}`, color: C.navy700 }}
            >
              <span className="text-xs font-medium block mb-1" style={{ color: C.text500 }}>
                Leitura:
              </span>
              {humanizeRule(rule, variaveis)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

/** Editor de sub-grupo (aninhado) */
function SubGroupEditor({
  group,
  variaveis,
  onChange,
  onRemove,
  parentType,
}: {
  group: RuleGroup
  variaveis: RuleVariable[]
  onChange: (updated: RuleNode | null) => void
  onRemove: () => void
  parentType: 'and' | 'or'
}) {
  const [collapsed, setCollapsed] = useState(false)

  function handleOperatorChange(op: 'and' | 'or') {
    onChange({ ...group, type: op })
  }

  function handleConditionChange(index: number, updated: RuleCondition) {
    const newConds = [...group.conditions]
    newConds[index] = updated
    onChange({ ...group, conditions: newConds })
  }

  function handleConditionRemove(index: number) {
    const newConds = group.conditions.filter((_, i) => i !== index)
    if (newConds.length === 0) {
      onRemove()
    } else {
      onChange({ ...group, conditions: newConds })
    }
  }

  function addCondition() {
    const newCond: RuleCondition = {
      type: 'condition',
      variable: '',
      operator: 'equals' as ComparisonOperator,
      value: '',
    }
    onChange({ ...group, conditions: [...group.conditions, newCond] })
  }

  return (
    <div
      className="rounded-lg p-3 space-y-2"
      style={{
        border: `2px dashed ${C.gray300}`,
        background: 'white',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-0.5"
            style={{ color: C.text500 }}
          >
            {collapsed ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </button>
          <Badge variant="outline" className="text-xs">
            Grupo
          </Badge>
          <select
            className="h-7 rounded border border-input bg-background px-2 text-xs"
            value={group.type}
            onChange={(e) => handleOperatorChange(e.target.value as 'and' | 'or')}
          >
            <option value="and">E (AND)</option>
            <option value="or">OU (OR)</option>
          </select>
          <span className="text-xs" style={{ color: C.text400 }}>
            {group.conditions.length} {group.conditions.length === 1 ? 'condição' : 'condições'}
          </span>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
          style={{ color: C.statusError }}
        >
          Remover grupo
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="space-y-2 pl-2">
            {group.conditions.map((cond, index) => {
              if (cond.type !== 'condition') return null
              return (
                <div key={index}>
                  {index > 0 && (
                    <div
                      className="text-center text-xs font-bold py-0.5"
                      style={{ color: C.navy700 }}
                    >
                      {group.type === 'and' ? 'E' : 'OU'}
                    </div>
                  )}
                  <RuleConditionItem
                    condition={cond}
                    variaveis={variaveis}
                    onChange={(updated) => handleConditionChange(index, updated)}
                    onRemove={() => handleConditionRemove(index)}
                  />
                </div>
              )
            })}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addCondition}
            className="gap-1.5 text-xs ml-2"
          >
            <Plus className="h-3 w-3" />
            Condição ao grupo
          </Button>
        </>
      )}
    </div>
  )
}

// --- Componente principal ---

export function RuleEditorPanel({
  regraPrimaria,
  regraTextoOriginal,
  onRegraPrimariaChange,
  onRegraTextoOriginalChange,
  regraSecundaria,
  regraSecundariaTexto,
  fallbackHabilitado,
  onRegraSecundariaChange,
  onRegraSecundariaTextoChange,
  onFallbackHabilitadoChange,
}: RuleEditorPanelProps) {
  const { toast } = useToast()
  const [variaveis, setVariaveis] = useState<RuleVariable[]>([])
  const [loadingVars, setLoadingVars] = useState(false)

  // AI Generation state (primaria)
  const [textoNatural, setTextoNatural] = useState(regraTextoOriginal || '')
  const [gerando, setGerando] = useState(false)

  // Preview modal state (primaria)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [candidateRule, setCandidateRule] = useState<RuleNode | null>(null)
  const [candidateTexto, setCandidateTexto] = useState<string | null>(null)
  const [candidateError, setCandidateError] = useState<string | null>(null)

  // AI Generation state (secundaria)
  const [textoNaturalSec, setTextoNaturalSec] = useState(regraSecundariaTexto || '')
  const [gerandoSec, setGerandoSec] = useState(false)

  // Preview modal state (secundaria)
  const [previewSecOpen, setPreviewSecOpen] = useState(false)
  const [candidateRuleSec, setCandidateRuleSec] = useState<RuleNode | null>(null)
  const [candidateTextoSec, setCandidateTextoSec] = useState<string | null>(null)
  const [candidateErrorSec, setCandidateErrorSec] = useState<string | null>(null)

  // Fallback section visibility
  const [fallbackExpanded, setFallbackExpanded] = useState(fallbackHabilitado)

  // Validacao
  const [validacao, setValidacao] = useState<ValidarRegraResponse | null>(null)
  const [validando, setValidando] = useState(false)

  // Carregar variaveis disponiveis
  const carregarVariaveis = useCallback(async () => {
    setLoadingVars(true)
    try {
      // Carregar variaveis de extracao
      const extRaw = await adminApi.get<unknown>(
        '/admin/api/extraction/variaveis?apenas_ativos=true&limit=500'
      )
      const extVars = Array.isArray(extRaw) ? extRaw : []

      // Carregar variaveis de processo
      let procVars: { slug: string; label: string; tipo: string }[] = []
      try {
        const procRaw = await adminApi.get<unknown>(
          '/admin/api/extraction/variaveis/processo'
        )
        // Endpoint retorna { variaveis: [...] } — extrair o array
        if (Array.isArray(procRaw)) {
          procVars = procRaw
        } else if (procRaw && typeof procRaw === 'object' && 'variaveis' in procRaw) {
          const arr = (procRaw as { variaveis: unknown }).variaveis
          procVars = Array.isArray(arr) ? arr : []
        }
      } catch {
        // Endpoint pode nao existir, ignora
      }

      const allVars: RuleVariable[] = [
        ...extVars.map((v: { slug: string; label: string; tipo: string; opcoes?: string[] | null }) => ({
          slug: v.slug,
          label: v.label,
          tipo: v.tipo as RuleVariable['tipo'],
          opcoes: v.opcoes || undefined,
          fonte: 'extracao' as const,
        })),
        ...procVars.map((v) => ({
          slug: v.slug,
          label: v.label,
          tipo: v.tipo as RuleVariable['tipo'],
          fonte: 'processo' as const,
        })),
      ]

      setVariaveis(allVars)
    } catch (error) {
      toast({
        title: 'Erro ao carregar variáveis',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setLoadingVars(false)
    }
  }, [toast])

  useEffect(() => {
    carregarVariaveis()
  }, [carregarVariaveis])

  // Gerar regra via IA (primaria) — abre modal de preview
  async function gerarRegraIA() {
    if (!textoNatural.trim()) {
      toast({ title: 'Digite uma condição', variant: 'destructive' })
      return
    }

    // Abrir modal em estado de loading
    setCandidateRule(null)
    setCandidateError(null)
    setCandidateTexto(textoNatural.trim())
    setPreviewOpen(true)
    setGerando(true)

    try {
      const resp = await adminApi.post<GerarRegraResponse>(
        '/admin/api/extraction/regras-deterministicas/gerar',
        { condicao_texto: textoNatural.trim() }
      )
      if (resp.success && resp.regra) {
        setCandidateRule(resp.regra)
      } else {
        const msg = resp.erro === 'variaveis_insuficientes'
          ? `Variáveis necessárias não encontradas. ${resp.sugestoes_variaveis?.map((s) => s.slug).join(', ') || ''}`
          : resp.erro || 'Erro na geração'
        setCandidateError(msg)
      }
    } catch (error) {
      setCandidateError(error instanceof Error ? error.message : 'Erro desconhecido')
    } finally {
      setGerando(false)
    }
  }

  function handleApprovePrimary() {
    if (candidateRule) {
      onRegraPrimariaChange(candidateRule)
      onRegraTextoOriginalChange(candidateTexto)
      toast({ title: 'Regra aprovada e aplicada' })
    }
    setPreviewOpen(false)
    setCandidateRule(null)
    setCandidateError(null)
  }

  function handleRejectPrimary() {
    setPreviewOpen(false)
    setCandidateRule(null)
    setCandidateError(null)
  }

  function handleRetryPrimary() {
    gerarRegraIA()
  }

  // Gerar regra via IA (secundaria) — abre modal de preview
  async function gerarRegraSecundariaIA() {
    if (!textoNaturalSec.trim()) {
      toast({ title: 'Digite uma condição para o fallback', variant: 'destructive' })
      return
    }

    setCandidateRuleSec(null)
    setCandidateErrorSec(null)
    setCandidateTextoSec(textoNaturalSec.trim())
    setPreviewSecOpen(true)
    setGerandoSec(true)

    try {
      const resp = await adminApi.post<GerarRegraResponse>(
        '/admin/api/extraction/regras-deterministicas/gerar',
        { condicao_texto: textoNaturalSec.trim() }
      )
      if (resp.success && resp.regra) {
        setCandidateRuleSec(resp.regra)
      } else {
        setCandidateErrorSec(resp.erro || 'Erro na geração')
      }
    } catch (error) {
      setCandidateErrorSec(error instanceof Error ? error.message : 'Erro desconhecido')
    } finally {
      setGerandoSec(false)
    }
  }

  function handleApproveSecondary() {
    if (candidateRuleSec) {
      onRegraSecundariaChange(candidateRuleSec)
      onRegraSecundariaTextoChange(candidateTextoSec)
      toast({ title: 'Regra secundária aprovada e aplicada' })
    }
    setPreviewSecOpen(false)
    setCandidateRuleSec(null)
    setCandidateErrorSec(null)
  }

  function handleRejectSecondary() {
    setPreviewSecOpen(false)
    setCandidateRuleSec(null)
    setCandidateErrorSec(null)
  }

  function handleRetrySecondary() {
    gerarRegraSecundariaIA()
  }

  // Validar regra
  async function validarRegra() {
    if (!regraPrimaria) {
      toast({ title: 'Nenhuma regra para validar', variant: 'destructive' })
      return
    }
    setValidando(true)
    try {
      const resp = await adminApi.post<ValidarRegraResponse>(
        '/admin/api/extraction/regras-deterministicas/validar',
        { regra: regraPrimaria }
      )
      setValidacao(resp)
      if (resp.valid) {
        toast({ title: 'Regra válida' })
      } else {
        toast({
          title: 'Regra com problemas',
          description: resp.errors.join('; ') || 'Verifique os detalhes',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Erro ao validar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setValidando(false)
    }
  }

  return (
    <div
      className="space-y-4 p-4 rounded-lg"
      style={{ border: `1px solid ${C.navy100}`, background: C.navy50 }}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-1.5 h-6 rounded-full"
          style={{ background: C.navy700 }}
        />
        <h3 className="text-sm font-semibold" style={{ color: C.navy950 }}>
          Regra Determinística
        </h3>
        <div
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs"
          style={{ background: C.navy100, color: C.navy700 }}
        >
          <Info className="h-3 w-3" />
          Ativação baseada em variáveis do processo
        </div>
      </div>

      {/* Gerador IA - Regra Primaria */}
      <div className="space-y-2">
        <Label className="text-xs font-medium" style={{ color: C.text700 }}>
          Gerar regra a partir de linguagem natural
        </Label>
        <div className="flex gap-2 items-start">
          <Textarea
            value={textoNatural}
            onChange={(e) => setTextoNatural(e.target.value)}
            placeholder='Ex: "O medicamento não está na lista RENAME" ou "O autor é idoso e o valor supera 210 SM"'
            className="flex-1 text-sm resize-none overflow-y-auto"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey && !gerando) gerarRegraIA()
            }}
          />
          <Button
            type="button"
            size="sm"
            onClick={gerarRegraIA}
            disabled={gerando || !textoNatural.trim()}
            className="gap-1.5 shrink-0"
            style={{ background: C.navy950, color: 'white' }}
          >
            <Wand2 className="h-4 w-4" />
            {gerando ? 'Gerando...' : 'Gerar via IA'}
          </Button>
        </div>
      </div>

      {/* Builder Visual - Regra Primaria */}
      <div
        className="p-3 rounded-lg space-y-3"
        style={{ background: 'white', border: `1px solid ${C.gray200}` }}
      >
        {loadingVars ? (
          <div className="text-sm py-4 text-center" style={{ color: C.text400 }}>
            Carregando variáveis...
          </div>
        ) : (
          <RuleBuilder
            rule={regraPrimaria}
            onChange={onRegraPrimariaChange}
            variaveis={variaveis}
            label="Regra Primária"
          />
        )}
      </div>

      {/* Botao de validacao */}
      {regraPrimaria && (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={validarRegra}
            disabled={validando}
            className="gap-1.5 text-xs"
          >
            <CheckCircle className="h-3 w-3" />
            {validando ? 'Validando...' : 'Validar variáveis'}
          </Button>
          {validacao && (
            <span
              className="text-xs flex items-center gap-1"
              style={{ color: validacao.valid ? C.statusSuccess : C.statusError }}
            >
              {validacao.valid ? (
                <>
                  <CheckCircle className="h-3 w-3" />
                  Todas as variáveis existem
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  {validacao.errors.length} erro(s) —{' '}
                  {validacao.variaveis_faltantes.join(', ')}
                </>
              )}
            </span>
          )}
        </div>
      )}

      {/* Secao Fallback (Regra Secundaria) */}
      <div
        className="pt-3 space-y-3"
        style={{ borderTop: `1px solid ${C.gray200}` }}
      >
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={fallbackHabilitado}
            onChange={(e) => {
              onFallbackHabilitadoChange(e.target.checked)
              setFallbackExpanded(e.target.checked)
            }}
          />
          <span className="text-sm font-medium" style={{ color: C.text700 }}>
            Habilitar regra secundária (fallback)
          </span>
        </label>

        <div
          className="text-xs px-3 py-2 rounded flex items-start gap-1.5"
          style={{ background: C.gray50, color: C.text500 }}
        >
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Regra de backup avaliada <strong>apenas</strong> quando a variável da regra
            primária não existe no documento. Útil para garantir ativação mesmo sem
            extração completa.
          </span>
        </div>

        {fallbackHabilitado && fallbackExpanded && (
          <div className="space-y-3 pl-4">
            {/* Gerador IA - Secundaria */}
            <div className="flex gap-2">
              <Input
                value={textoNaturalSec}
                onChange={(e) => setTextoNaturalSec(e.target.value)}
                placeholder="Condição para a regra de fallback..."
                className="flex-1 text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !gerandoSec) gerarRegraSecundariaIA()
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={gerarRegraSecundariaIA}
                disabled={gerandoSec || !textoNaturalSec.trim()}
                className="gap-1.5 shrink-0 text-xs"
              >
                <Wand2 className="h-3 w-3" />
                {gerandoSec ? 'Gerando...' : 'Gerar'}
              </Button>
            </div>

            {/* Builder - Secundaria */}
            <div
              className="p-3 rounded-lg"
              style={{ background: 'white', border: `1px solid ${C.gray200}` }}
            >
              <RuleBuilder
                rule={regraSecundaria}
                onChange={onRegraSecundariaChange}
                variaveis={variaveis}
                label="Regra Secundária (Fallback)"
              />
            </div>
          </div>
        )}
      </div>

      {/* Modal de aprovacao — Regra Primaria */}
      <RulePreviewModal
        open={previewOpen}
        onOpenChange={(open) => { if (!open) handleRejectPrimary() }}
        candidateRule={candidateRule}
        candidateTexto={candidateTexto}
        isLoading={gerando}
        error={candidateError}
        variaveis={variaveis}
        onApprove={handleApprovePrimary}
        onReject={handleRejectPrimary}
        onRetry={handleRetryPrimary}
      />

      {/* Modal de aprovacao — Regra Secundaria */}
      <RulePreviewModal
        open={previewSecOpen}
        onOpenChange={(open) => { if (!open) handleRejectSecondary() }}
        candidateRule={candidateRuleSec}
        candidateTexto={candidateTextoSec}
        isLoading={gerandoSec}
        error={candidateErrorSec}
        variaveis={variaveis}
        onApprove={handleApproveSecondary}
        onReject={handleRejectSecondary}
        onRetry={handleRetrySecondary}
      />
    </div>
  )
}
