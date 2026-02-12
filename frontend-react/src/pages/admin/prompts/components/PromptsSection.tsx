import { useState, useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { RotateCcw, Plus, ChevronDown, ChevronRight } from 'lucide-react'
import { C } from '@/lib/designTokens'
import type { Prompt } from '../types'
import { SISTEMAS, TIPO_BADGES } from '../constants'

interface PromptsSectionProps {
  prompts: Prompt[]
  /** Sistema da aba ativa (para filtrar e para criar padrão) */
  activeSistema: string
  onEdit: (prompt: Prompt) => void
  onRestore: (promptId: number) => void
  onCreateDefaults: (sistema: string) => void
  isCreatingDefaults: string | null
}

function formatDate(dateString: string): string {
  try {
    return new Date(dateString).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return dateString
  }
}

/**
 * Seção de listagem de prompts com filtro por sistema e cards expandíveis.
 * Extraída 1:1 da seção de Prompts original do PromptsPage.
 */
export function PromptsSection({
  prompts,
  activeSistema,
  onEdit,
  onRestore,
  onCreateDefaults,
  isCreatingDefaults,
}: PromptsSectionProps) {
  const [selectedFilter, setSelectedFilter] = useState<string>('todos')
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set())

  const filteredPrompts = useMemo(() => {
    if (selectedFilter === 'todos') return prompts
    return prompts.filter(p => p.sistema === selectedFilter)
  }, [selectedFilter, prompts])

  const promptsByType = useMemo(() => {
    const typeOrder = ['system', 'analise', 'relatorio', 'resumo']
    const groups: { tipo: string; label: string; prompts: Prompt[] }[] = []
    const byType = new Map<string, Prompt[]>()

    for (const p of filteredPrompts) {
      if (!byType.has(p.tipo)) byType.set(p.tipo, [])
      byType.get(p.tipo)!.push(p)
    }

    for (const tipo of typeOrder) {
      const items = byType.get(tipo)
      if (items && items.length > 0) {
        groups.push({ tipo, label: TIPO_BADGES[tipo]?.label || tipo, prompts: items })
        byType.delete(tipo)
      }
    }
    for (const [tipo, items] of byType) {
      groups.push({ tipo, label: TIPO_BADGES[tipo]?.label || tipo, prompts: items })
    }

    return groups
  }, [filteredPrompts])

  const togglePromptExpanded = (id: number) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const sistemaPrompts = prompts.filter(p => p.sistema === activeSistema)
  const showEmptyState = selectedFilter !== 'todos' && filteredPrompts.length === 0 && sistemaPrompts.length === 0

  return (
    <div className="space-y-4">
      {/* Filtro por sistema */}
      <div className="flex items-center gap-4">
        <Label htmlFor="filter-sistema">Filtrar por sistema:</Label>
        <Select value={selectedFilter} onValueChange={setSelectedFilter}>
          <SelectTrigger id="filter-sistema" className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os sistemas</SelectItem>
            {SISTEMAS.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de prompts */}
      {showEmptyState ? (
        <div data-testid={`empty-state-${selectedFilter}`} className="text-center py-12 space-y-4">
          <p className="text-muted-foreground">Nenhum prompt configurado para este sistema</p>
          <Button
            data-testid={`btn-criar-padrao-${selectedFilter}`}
            onClick={() => onCreateDefaults(selectedFilter)}
            disabled={isCreatingDefaults === selectedFilter}
          >
            <Plus className="mr-2 h-4 w-4" />
            {isCreatingDefaults === selectedFilter ? 'Criando prompts padrão...' : 'Criar Prompts Padrão'}
          </Button>
        </div>
      ) : filteredPrompts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nenhum prompt encontrado</div>
      ) : (
        <div className="space-y-6">
          {promptsByType.map(({ tipo, label, prompts: groupPrompts }) => (
            <div key={tipo}>
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: C.text500 }}>
                {label} ({groupPrompts.length})
              </h3>
              <div className="grid gap-3">
                {groupPrompts.map(prompt => {
                  const tipoBadge = TIPO_BADGES[prompt.tipo] || { label: prompt.tipo, variant: 'outline' as const }
                  const isExpanded = expandedPrompts.has(prompt.id)

                  return (
                    <Card key={prompt.id} className="shadow-sm rounded-2xl" style={{ border: `1px solid ${C.gray200}` }}>
                      <CardHeader className="py-3 px-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <button
                              onClick={() => togglePromptExpanded(prompt.id)}
                              className="flex-shrink-0"
                              style={{ color: C.text400 }}
                            >
                              {isExpanded
                                ? <ChevronDown className="h-4 w-4" />
                                : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <div className="min-w-0">
                              <CardTitle className="text-base truncate">{prompt.nome}</CardTitle>
                              {prompt.descricao && (
                                <CardDescription className="text-xs mt-0.5 truncate">{prompt.descricao}</CardDescription>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Badge variant={tipoBadge.variant}>{tipoBadge.label}</Badge>
                            <Badge variant={prompt.is_active ? 'default' : 'secondary'}>
                              {prompt.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="py-0 px-4 pb-3">
                        <div className="p-3 rounded-md" style={{ background: C.gray50 }}>
                          <p className="text-xs font-mono whitespace-pre-wrap" style={{ color: C.text500 }}>
                            {isExpanded
                              ? prompt.conteudo
                              : prompt.conteudo.length > 400
                                ? `${prompt.conteudo.substring(0, 400)}...`
                                : prompt.conteudo}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs mt-2" style={{ color: C.text400 }}>
                          <div>
                            Atualizado em {formatDate(prompt.updated_at)}
                            {prompt.updated_by && ` por ${prompt.updated_by}`}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              data-testid={`btn-restaurar-padrao-${prompt.id}`}
                              onClick={() => onRestore(prompt.id)}
                              variant="outline"
                              size="sm"
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                              Restaurar
                            </Button>
                            <Button onClick={() => onEdit(prompt)} variant="outline" size="sm">
                              Editar
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
