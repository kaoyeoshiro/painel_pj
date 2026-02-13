// Secao de regras especificas por tipo de peca
// CRUD completo: listar, criar, editar, deletar, toggle

import { useState, useEffect, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { C } from '@/lib/designTokens'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import {
  Plus, Pencil, Trash2, Power, AlertTriangle, Info, Wand2,
} from 'lucide-react'
import { RuleConditionItem } from './RuleConditionItem'
import { humanizeRule, countConditions } from './humanize'
import { TIPO_PECA_LABELS } from './constants'
import type {
  RuleNode, RuleCondition, RuleGroup, RuleVariable,
  RegraTipoPeca, ComparisonOperator, GerarRegraResponse,
} from './types'

interface PieceTypeRulesSectionProps {
  moduloId: number | null
  regraPrimariaGlobal: RuleNode | null
}

export function PieceTypeRulesSection({
  moduloId,
  regraPrimariaGlobal,
}: PieceTypeRulesSectionProps) {
  const { toast } = useToast()
  const [regras, setRegras] = useState<RegraTipoPeca[]>([])
  const [tiposDisponiveis, setTiposDisponiveis] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [variaveis, setVariaveis] = useState<RuleVariable[]>([])

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editandoRegra, setEditandoRegra] = useState<RegraTipoPeca | null>(null)
  const [formTipoPeca, setFormTipoPeca] = useState('')
  const [formRegra, setFormRegra] = useState<RuleNode | null>(null)
  const [formTexto, setFormTexto] = useState('')
  const [formAtivo, setFormAtivo] = useState(true)
  const [salvando, setSalvando] = useState(false)

  // AI generation
  const [textoIA, setTextoIA] = useState('')
  const [gerandoIA, setGerandoIA] = useState(false)

  // Carregar regras
  const carregarRegras = useCallback(async () => {
    if (!moduloId) return
    setLoading(true)
    try {
      const resp = await adminApi.get<{
        regras_tipo_peca: RegraTipoPeca[]
        tipos_peca_disponiveis: string[]
      }>(`/admin/api/prompts-modulos/${moduloId}/regras-tipo-peca`)
      setRegras(resp.regras_tipo_peca || [])
      setTiposDisponiveis(resp.tipos_peca_disponiveis || [])
    } catch {
      // Silencioso se nao existe
    } finally {
      setLoading(false)
    }
  }, [moduloId])

  // Carregar variaveis
  const carregarVariaveis = useCallback(async () => {
    try {
      const extVars = await adminApi.get<{
        slug: string; label: string; tipo: string; opcoes: string[] | null
      }[]>('/admin/api/extraction/variaveis?apenas_ativos=true&limit=500')

      setVariaveis(extVars.map((v) => ({
        slug: v.slug,
        label: v.label,
        tipo: v.tipo as RuleVariable['tipo'],
        opcoes: v.opcoes || undefined,
        fonte: 'extracao' as const,
      })))
    } catch {
      // Silencioso
    }
  }, [])

  useEffect(() => {
    carregarRegras()
    carregarVariaveis()
  }, [carregarRegras, carregarVariaveis])

  // Tipos ja usados
  const tiposUsados = new Set(regras.map((r) => r.tipo_peca))
  const tiposLivres = tiposDisponiveis.filter((t) => !tiposUsados.has(t))

  // Dialog handlers
  function abrirCriar() {
    setEditandoRegra(null)
    setFormTipoPeca(tiposLivres[0] || '')
    setFormRegra(null)
    setFormTexto('')
    setFormAtivo(true)
    setTextoIA('')
    setDialogOpen(true)
  }

  function abrirEditar(regra: RegraTipoPeca) {
    setEditandoRegra(regra)
    setFormTipoPeca(regra.tipo_peca)
    setFormRegra(regra.regra_deterministica)
    setFormTexto(regra.regra_texto_original || '')
    setFormAtivo(regra.ativo)
    setTextoIA(regra.regra_texto_original || '')
    setDialogOpen(true)
  }

  async function salvar() {
    if (!moduloId || !formTipoPeca || !formRegra) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' })
      return
    }

    setSalvando(true)
    try {
      const payload = {
        tipo_peca: formTipoPeca,
        regra_deterministica: formRegra,
        regra_texto_original: formTexto || null,
        ativo: formAtivo,
      }

      if (editandoRegra) {
        await adminApi.put(
          `/admin/api/prompts-modulos/regras-tipo-peca/${editandoRegra.id}`,
          payload
        )
        toast({ title: 'Regra atualizada' })
      } else {
        await adminApi.post(
          `/admin/api/prompts-modulos/${moduloId}/regras-tipo-peca`,
          payload
        )
        toast({ title: 'Regra criada' })
      }

      setDialogOpen(false)
      carregarRegras()
    } catch (error) {
      toast({
        title: 'Erro ao salvar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(regra: RegraTipoPeca) {
    if (!confirm(`Excluir regra para "${TIPO_PECA_LABELS[regra.tipo_peca] || regra.tipo_peca}"?`)) {
      return
    }
    try {
      await adminApi.delete(`/admin/api/prompts-modulos/regras-tipo-peca/${regra.id}`)
      toast({ title: 'Regra excluída' })
      carregarRegras()
    } catch (error) {
      toast({
        title: 'Erro ao excluir',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  async function toggleAtivo(regra: RegraTipoPeca) {
    try {
      await adminApi.patch(`/admin/api/prompts-modulos/regras-tipo-peca/${regra.id}/toggle`)
      toast({ title: regra.ativo ? 'Regra desativada' : 'Regra ativada' })
      carregarRegras()
    } catch (error) {
      toast({
        title: 'Erro ao alterar status',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  // Gerar regra via IA para tipo de peca
  async function gerarRegra() {
    if (!textoIA.trim()) return
    setGerandoIA(true)
    try {
      const resp = await adminApi.post<GerarRegraResponse>(
        '/admin/api/extraction/regras-deterministicas/gerar',
        { condicao_texto: textoIA.trim(), contexto: `Tipo de peça: ${formTipoPeca}` }
      )
      if (resp.success && resp.regra) {
        setFormRegra(resp.regra)
        setFormTexto(textoIA.trim())
        toast({ title: 'Regra gerada' })
      } else {
        toast({ title: 'Erro na geração', description: resp.erro || '', variant: 'destructive' })
      }
    } catch (error) {
      toast({
        title: 'Erro ao gerar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setGerandoIA(false)
    }
  }

  // Funcoes inline para o builder dentro do dialog
  function normalizeToGroup(node: RuleNode | null): RuleGroup {
    if (!node) return { type: 'and', conditions: [] }
    if (node.type === 'and' || node.type === 'or') return node
    return { type: 'and', conditions: [node] }
  }

  function emitFormRegraChange(group: RuleGroup) {
    if (group.conditions.length === 0) setFormRegra(null)
    else if (group.conditions.length === 1) setFormRegra(group.conditions[0])
    else setFormRegra(group)
  }

  if (!moduloId) return null

  const rootGroup = normalizeToGroup(formRegra)

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold" style={{ color: C.text900 }}>
            Regras por Tipo de Peça
          </h4>
          {regras.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {regras.length}
            </Badge>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={abrirCriar}
          disabled={tiposLivres.length === 0}
          className="gap-1.5 text-xs"
        >
          <Plus className="h-3 w-3" />
          Adicionar
        </Button>
      </div>

      {/* Explicacao */}
      <div
        className="text-xs px-3 py-2 rounded flex items-start gap-1.5"
        style={{ background: C.gray50, color: C.text500 }}
      >
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          Um módulo é ativado se <strong>qualquer regra global OU específica</strong> for
          verdadeira. Regras específicas permitem comportamentos diferenciados por tipo de
          peça, <strong>sobrescrevendo</strong> a regra global quando existem.
        </span>
      </div>

      {/* Alerta de sobrescricao */}
      {regras.length > 0 && regraPrimariaGlobal && (
        <div
          className="text-xs px-3 py-2 rounded flex items-start gap-1.5"
          style={{ background: '#fef3cd', color: '#856404', border: '1px solid #ffc107' }}
        >
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Este módulo tem regras específicas que <strong>sobrescrevem</strong> a regra global
            para os tipos: {regras.map((r) => TIPO_PECA_LABELS[r.tipo_peca] || r.tipo_peca).join(', ')}.
          </span>
        </div>
      )}

      {/* Lista de regras */}
      {loading ? (
        <div className="text-sm py-4 text-center" style={{ color: C.text400 }}>
          Carregando...
        </div>
      ) : regras.length === 0 ? (
        <div className="text-sm py-4 text-center" style={{ color: C.text400 }}>
          Nenhuma regra específica configurada. A regra global será usada para todos os tipos.
        </div>
      ) : (
        <div className="space-y-2">
          {regras.map((regra) => (
            <div
              key={regra.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{
                border: `1px solid ${regra.ativo ? C.gray200 : C.gray100}`,
                opacity: regra.ativo ? 1 : 0.6,
              }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge
                    variant="secondary"
                    className="text-xs"
                    style={{ background: C.navy100, color: C.navy700 }}
                  >
                    {TIPO_PECA_LABELS[regra.tipo_peca] || regra.tipo_peca}
                  </Badge>
                  {!regra.ativo && (
                    <Badge variant="secondary" className="text-xs">
                      Inativo
                    </Badge>
                  )}
                  <span className="text-xs" style={{ color: C.text400 }}>
                    {countConditions(regra.regra_deterministica)} condição(ões)
                  </span>
                </div>
                <div className="text-xs truncate" style={{ color: C.text500 }}>
                  {humanizeRule(regra.regra_deterministica, variaveis)}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={() => toggleAtivo(regra)}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: regra.ativo ? C.statusSuccess : C.text400 }}
                  title={regra.ativo ? 'Desativar' : 'Ativar'}
                >
                  <Power className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => abrirEditar(regra)}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: C.text400 }}
                  title="Editar"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => excluir(regra)}
                  className="p-1.5 rounded-md transition-colors"
                  style={{ color: C.text400 }}
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de criacao/edicao */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editandoRegra ? 'Editar Regra por Tipo de Peça' : 'Nova Regra por Tipo de Peça'}
            </DialogTitle>
            <DialogDescription>
              {editandoRegra ? 'Edite as condicoes da regra' : 'Defina condicoes especificas para um tipo de peca'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tipo de peca */}
            <div>
              <Label>Tipo de Peça</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={formTipoPeca}
                onChange={(e) => setFormTipoPeca(e.target.value)}
                disabled={!!editandoRegra}
              >
                <option value="">Selecione...</option>
                {(editandoRegra ? tiposDisponiveis : tiposLivres).map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_PECA_LABELS[tipo] || tipo}
                  </option>
                ))}
              </select>
            </div>

            {/* Gerar via IA */}
            <div>
              <Label>Gerar regra via IA</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  value={textoIA}
                  onChange={(e) => setTextoIA(e.target.value)}
                  placeholder="Descreva a condição em linguagem natural..."
                  className="flex-1 text-sm"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={gerarRegra}
                  disabled={gerandoIA || !textoIA.trim()}
                  className="gap-1.5 shrink-0"
                  style={{ background: C.navy950, color: 'white' }}
                >
                  <Wand2 className="h-4 w-4" />
                  {gerandoIA ? 'Gerando...' : 'Gerar'}
                </Button>
              </div>
            </div>

            {/* Builder inline */}
            <div className="space-y-2">
              <Label>Condições</Label>

              {rootGroup.conditions.length > 1 && (
                <select
                  className="h-8 rounded-md border border-input bg-background px-2 text-sm"
                  value={rootGroup.type}
                  onChange={(e) =>
                    emitFormRegraChange({ ...rootGroup, type: e.target.value as 'and' | 'or' })
                  }
                >
                  <option value="and">E (AND)</option>
                  <option value="or">OU (OR)</option>
                </select>
              )}

              <div className="space-y-2">
                {rootGroup.conditions.map((cond, index) => {
                  if (cond.type !== 'condition') return null
                  return (
                    <RuleConditionItem
                      key={index}
                      condition={cond}
                      variaveis={variaveis}
                      onChange={(updated) => {
                        const newConds = [...rootGroup.conditions]
                        newConds[index] = updated
                        emitFormRegraChange({ ...rootGroup, conditions: newConds })
                      }}
                      onRemove={() => {
                        const newConds = rootGroup.conditions.filter((_, i) => i !== index)
                        emitFormRegraChange({ ...rootGroup, conditions: newConds })
                      }}
                    />
                  )
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const newCond: RuleCondition = {
                    type: 'condition',
                    variable: '',
                    operator: 'equals' as ComparisonOperator,
                    value: '',
                  }
                  emitFormRegraChange({
                    ...rootGroup,
                    conditions: [...rootGroup.conditions, newCond],
                  })
                }}
                className="gap-1.5 text-xs"
              >
                <Plus className="h-3 w-3" />
                Condição
              </Button>

              {/* Humanizado */}
              {formRegra && (
                <div
                  className="p-2 rounded text-xs"
                  style={{ background: C.navy50, color: C.navy700 }}
                >
                  {humanizeRule(formRegra, variaveis)}
                </div>
              )}
            </div>

            {/* Ativo */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="regra-tp-ativo"
                checked={formAtivo}
                onChange={(e) => setFormAtivo(e.target.checked)}
              />
              <Label htmlFor="regra-tp-ativo">Ativo</Label>
            </div>
          </div>

          <DialogFooter className="mt-4 pt-4 border-t">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={salvando || !formTipoPeca || !formRegra}
              style={{ background: C.navy950, color: 'white' }}
            >
              {salvando ? 'Salvando...' : editandoRegra ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
