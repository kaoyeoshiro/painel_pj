import { useState, useEffect, useMemo } from 'react'
import { adminApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { PageContainer, PageHeader, AdminSubNav } from '@/components/layout'
import { RotateCcw, Plus, FileEdit, ChevronDown, ChevronRight } from 'lucide-react'

interface Prompt {
  id: number
  sistema: string
  tipo: string
  nome: string
  descricao?: string
  conteudo: string
  is_active: boolean
  updated_at: string
  updated_by?: string
}

interface ConfigIA {
  sistema: string
  chave: string
  valor: string
}

const SISTEMAS = [
  { value: 'matriculas', label: 'Matrículas' },
  { value: 'assistencia_judiciaria', label: 'Assistência Judiciária' },
  { value: 'gerador_pecas', label: 'Gerador de Peças' },
  { value: 'pedido_calculo', label: 'Pedido de Cálculo' },
  { value: 'prestacao_contas', label: 'Prestação de Contas' },
  { value: 'relatorio_cumprimento', label: 'Relatório de Cumprimento' },
  { value: 'global', label: 'Global' },
]

const TIPO_BADGES: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  system: { label: 'Sistema', variant: 'default' },
  analise: { label: 'Análise', variant: 'secondary' },
  relatorio: { label: 'Relatório', variant: 'outline' },
  resumo: { label: 'Resumo', variant: 'outline' },
}

/** Agrupamento de chaves de configuração por propósito, com cor */
interface ConfigGroup {
  label: string
  color: string
  /** Padrões para match de chaves (suporta * como wildcard) */
  patterns: string[]
}

const CONFIG_GROUPS: ConfigGroup[] = [
  { label: 'Modelo de IA', color: 'blue', patterns: ['modelo', 'thinking_level'] },
  { label: 'Critérios de Relevância', color: 'amber', patterns: ['prompt_criterios_relevancia', '*criterio*'] },
  { label: 'Limites de Processamento', color: 'indigo', patterns: ['competencia_999_*', 'max_*', 'limite_*'] },
  { label: 'Busca Vetorial', color: 'emerald', patterns: ['busca_vetorial_*', '*embedding*'] },
  { label: 'Chat de Edição', color: 'violet', patterns: ['prompt_chat_*', 'chat_*'] },
]

/** Verifica se uma chave corresponde a um padrão (com suporte a wildcard *) */
function matchPattern(key: string, pattern: string): boolean {
  if (pattern === key) return true
  if (!pattern.includes('*')) return false
  const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
  return regex.test(key)
}

/** Retorna o grupo de uma chave, ou null se não pertencer a nenhum */
function getConfigGroup(key: string): ConfigGroup | null {
  for (const group of CONFIG_GROUPS) {
    if (group.patterns.some(p => matchPattern(key, p))) return group
  }
  return null
}

/** Cores CSS para os grupos (Tailwind classes dinâmicas) */
const COLOR_MAP: Record<string, { border: string; bg: string; text: string }> = {
  blue: { border: 'border-blue-200', bg: 'bg-blue-50', text: 'text-blue-700' },
  amber: { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-700' },
  indigo: { border: 'border-indigo-200', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  emerald: { border: 'border-emerald-200', bg: 'bg-emerald-50', text: 'text-emerald-700' },
  violet: { border: 'border-violet-200', bg: 'bg-violet-50', text: 'text-violet-700' },
  gray: { border: 'border-gray-200', bg: 'bg-gray-50', text: 'text-gray-700' },
}

export function PromptsPage() {
  const { toast } = useToast()
  const [configsIA, setConfigsIA] = useState<ConfigIA[]>([])
  const [editedConfigs, setEditedConfigs] = useState<Record<string, Record<string, string>>>({})
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [filteredPrompts, setFilteredPrompts] = useState<Prompt[]>([])
  const [selectedSistema, setSelectedSistema] = useState<string>('todos')
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true)
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true)
  const [isSavingConfig, setIsSavingConfig] = useState<string | null>(null)
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [restoreConfirmPromptId, setRestoreConfirmPromptId] = useState<number | null>(null)
  const [isRestoringDefault, setIsRestoringDefault] = useState(false)
  const [isCreatingDefaults, setIsCreatingDefaults] = useState<string | null>(null)
  const [expandedPrompts, setExpandedPrompts] = useState<Set<number>>(new Set())

  useEffect(() => { loadConfigsIA() }, [])
  useEffect(() => { loadPrompts() }, [])

  useEffect(() => {
    if (selectedSistema === 'todos') {
      setFilteredPrompts(prompts)
    } else {
      setFilteredPrompts(prompts.filter(p => p.sistema === selectedSistema))
    }
  }, [selectedSistema, prompts])

  const loadConfigsIA = async () => {
    setIsLoadingConfigs(true)
    try {
      const data = await adminApi.get<ConfigIA[]>('/admin/config-ia')
      setConfigsIA(data)
      const configs: Record<string, Record<string, string>> = {}
      data.forEach(config => {
        if (!configs[config.sistema]) configs[config.sistema] = {}
        configs[config.sistema][config.chave] = config.valor
      })
      setEditedConfigs(configs)
    } catch (error) {
      toast({
        title: 'Erro ao carregar configurações',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingConfigs(false)
    }
  }

  const loadPrompts = async () => {
    setIsLoadingPrompts(true)
    try {
      const data = await adminApi.get<{ prompts: Prompt[]; total: number }>('/admin/prompts')
      setPrompts(data.prompts)
      setFilteredPrompts(data.prompts)
    } catch (error) {
      toast({
        title: 'Erro ao carregar prompts',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingPrompts(false)
    }
  }

  const handleConfigChange = (sistema: string, chave: string, valor: string) => {
    setEditedConfigs(prev => ({
      ...prev,
      [sistema]: { ...prev[sistema], [chave]: valor },
    }))
  }

  const saveConfigSistema = async (sistema: string) => {
    setIsSavingConfig(sistema)
    try {
      const configsToSave = editedConfigs[sistema] || {}
      await adminApi.post('/admin/config-ia/upsert', {
        configs: Object.entries(configsToSave).map(([chave, valor]) => ({ sistema, chave, valor })),
      })
      toast({
        title: 'Configurações salvas',
        description: `Configurações de ${SISTEMAS.find(s => s.value === sistema)?.label} atualizadas com sucesso`,
      })
      await loadConfigsIA()
    } catch (error) {
      toast({
        title: 'Erro ao salvar configurações',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setIsSavingConfig(null)
    }
  }

  const openEditDialog = (prompt: Prompt) => {
    setEditingPrompt({ ...prompt })
    setIsEditDialogOpen(true)
  }

  const closeEditDialog = () => {
    setEditingPrompt(null)
    setIsEditDialogOpen(false)
  }

  const savePrompt = async () => {
    if (!editingPrompt) return
    setIsSavingPrompt(true)
    try {
      await adminApi.put(`/admin/prompts/${editingPrompt.id}`, {
        nome: editingPrompt.nome,
        descricao: editingPrompt.descricao,
        conteudo: editingPrompt.conteudo,
        is_active: editingPrompt.is_active,
      })
      toast({ title: 'Prompt atualizado', description: 'As alterações foram salvas com sucesso' })
      closeEditDialog()
      await loadPrompts()
    } catch (error) {
      toast({
        title: 'Erro ao salvar prompt',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setIsSavingPrompt(false)
    }
  }

  const restoreDefaultPrompt = async (promptId: number) => {
    setIsRestoringDefault(true)
    try {
      await adminApi.post(`/admin/api/prompts/${promptId}/restaurar-padrao`)
      toast({ title: 'Prompt restaurado', description: 'O prompt foi restaurado ao valor padrão com sucesso' })
      setRestoreConfirmPromptId(null)
      await loadPrompts()
    } catch (error) {
      toast({
        title: 'Erro ao restaurar prompt',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setIsRestoringDefault(false)
    }
  }

  const createDefaultPrompts = async (sistema: string) => {
    setIsCreatingDefaults(sistema)
    try {
      await adminApi.post(`/admin/api/prompts/criar-padrao/${sistema}`)
      toast({
        title: 'Prompts criados',
        description: `Prompts padrão criados com sucesso para ${SISTEMAS.find(s => s.value === sistema)?.label || sistema}`,
      })
      await loadPrompts()
    } catch (error) {
      toast({
        title: 'Erro ao criar prompts padrão',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setIsCreatingDefaults(null)
    }
  }

  const getConfigsForSistema = (sistema: string): ConfigIA[] => configsIA.filter(c => c.sistema === sistema)
  const getPromptsForSistema = (sistema: string): Prompt[] => prompts.filter(p => p.sistema === sistema)

  const formatDate = (dateString: string): string => {
    try {
      return new Date(dateString).toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  const shouldShowEmptyStateForSistema = (): boolean => {
    if (selectedSistema === 'todos') return false
    return getPromptsForSistema(selectedSistema).length === 0
  }

  const togglePromptExpanded = (id: number) => {
    setExpandedPrompts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  /** Agrupa as configs de um sistema por grupo de cor */
  const groupedConfigs = useMemo(() => {
    return (sistema: string) => {
      const configs = getConfigsForSistema(sistema)
      const groups: { group: ConfigGroup | null; configs: ConfigIA[] }[] = []
      const groupMap = new Map<string, ConfigIA[]>()
      const ungrouped: ConfigIA[] = []

      for (const config of configs) {
        const group = getConfigGroup(config.chave)
        if (group) {
          const key = group.label
          if (!groupMap.has(key)) groupMap.set(key, [])
          groupMap.get(key)!.push(config)
        } else {
          ungrouped.push(config)
        }
      }

      for (const cg of CONFIG_GROUPS) {
        const items = groupMap.get(cg.label)
        if (items && items.length > 0) groups.push({ group: cg, configs: items })
      }
      if (ungrouped.length > 0) groups.push({ group: null, configs: ungrouped })

      return groups
    }
  }, [configsIA])

  /** Agrupa prompts filtrados por tipo */
  const promptsByType = useMemo(() => {
    const typeOrder = ['system', 'analise', 'relatorio', 'resumo']
    const groups: { tipo: string; label: string; prompts: Prompt[] }[] = []
    const byType = new Map<string, Prompt[]>()

    for (const p of filteredPrompts) {
      if (!byType.has(p.tipo)) byType.set(p.tipo, [])
      byType.get(p.tipo)!.push(p)
    }

    // Ordenar por tipo conhecido primeiro, depois outros
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

  return (
    <PageContainer wide className="space-y-6">
      <PageHeader
        title="Gerenciamento de Prompts e IA"
        description="Configure modelos de IA e gerencie prompts dos sistemas"
        icon={<FileEdit className="h-5 w-5" />}
        backTo="/dashboard"
      />

      <AdminSubNav />

      {/* Seção 1: Configurações de IA — color-coded */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de IA</CardTitle>
          <CardDescription>Configure modelos e parâmetros de IA por sistema</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingConfigs ? (
            <div className="text-center py-8 text-muted-foreground">Carregando configurações...</div>
          ) : (
            <Tabs defaultValue="matriculas">
              <TabsList className="flex flex-wrap gap-1 h-auto p-1">
                {SISTEMAS.map(sistema => (
                  <TabsTrigger key={sistema.value} value={sistema.value} className="text-xs sm:text-sm">
                    {sistema.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {SISTEMAS.map(sistema => {
                const groups = groupedConfigs(sistema.value)
                const hasConfigs = groups.length > 0

                return (
                  <TabsContent key={sistema.value} value={sistema.value} className="space-y-4 mt-4">
                    {hasConfigs ? (
                      <>
                        {groups.map(({ group, configs }) => {
                          const colorKey = group?.color || 'gray'
                          const colors = COLOR_MAP[colorKey] || COLOR_MAP.gray

                          return (
                            <div key={group?.label || 'outros'} className={`rounded-lg border ${colors.border} ${colors.bg} p-4`}>
                              <h3 className={`text-sm font-semibold ${colors.text} mb-3`}>
                                {group?.label || 'Outros'}
                              </h3>
                              <div className="grid gap-3">
                                {configs.map(config => (
                                  <div key={`${config.sistema}-${config.chave}`} className="grid gap-1.5">
                                    <Label htmlFor={`${config.sistema}-${config.chave}`} className="text-xs font-medium text-gray-600">
                                      {config.chave}
                                    </Label>
                                    <Input
                                      id={`${config.sistema}-${config.chave}`}
                                      value={editedConfigs[sistema.value]?.[config.chave] || ''}
                                      onChange={(e) => handleConfigChange(sistema.value, config.chave, e.target.value)}
                                      placeholder={`Digite ${config.chave}`}
                                      className="bg-white"
                                    />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                        <Button
                          onClick={() => saveConfigSistema(sistema.value)}
                          disabled={isSavingConfig === sistema.value}
                        >
                          {isSavingConfig === sistema.value ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma configuração encontrada para este sistema
                      </div>
                    )}
                  </TabsContent>
                )
              })}
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Seção 2: Prompts — agrupados por tipo */}
      <Card>
        <CardHeader>
          <CardTitle>Prompts</CardTitle>
          <CardDescription>Gerencie prompts utilizados pelos sistemas de IA</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filtro por sistema */}
          <div className="flex items-center gap-4">
            <Label htmlFor="filter-sistema">Filtrar por sistema:</Label>
            <Select value={selectedSistema} onValueChange={setSelectedSistema}>
              <SelectTrigger id="filter-sistema" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os sistemas</SelectItem>
                {SISTEMAS.map(sistema => (
                  <SelectItem key={sistema.value} value={sistema.value}>
                    {sistema.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lista de prompts */}
          {isLoadingPrompts ? (
            <div className="text-center py-8 text-muted-foreground">Carregando prompts...</div>
          ) : shouldShowEmptyStateForSistema() ? (
            <div data-testid={`empty-state-${selectedSistema}`} className="text-center py-12 space-y-4">
              <p className="text-muted-foreground">Nenhum prompt configurado para este sistema</p>
              <Button
                data-testid={`btn-criar-padrao-${selectedSistema}`}
                onClick={() => createDefaultPrompts(selectedSistema)}
                disabled={isCreatingDefaults === selectedSistema}
              >
                <Plus className="mr-2 h-4 w-4" />
                {isCreatingDefaults === selectedSistema ? 'Criando prompts padrão...' : 'Criar Prompts Padrão'}
              </Button>
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum prompt encontrado</div>
          ) : (
            <div className="space-y-6">
              {promptsByType.map(({ tipo, label, prompts: groupPrompts }) => (
                <div key={tipo}>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                    {label} ({groupPrompts.length})
                  </h3>
                  <div className="grid gap-3">
                    {groupPrompts.map(prompt => {
                      const tipoBadge = TIPO_BADGES[prompt.tipo] || { label: prompt.tipo, variant: 'outline' as const }
                      const isExpanded = expandedPrompts.has(prompt.id)

                      return (
                        <Card key={prompt.id} className="shadow-sm">
                          <CardHeader className="py-3 px-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2 min-w-0">
                                <button
                                  onClick={() => togglePromptExpanded(prompt.id)}
                                  className="text-gray-400 hover:text-gray-600 flex-shrink-0"
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

                          {/* Preview colapsável */}
                          <CardContent className="py-0 px-4 pb-3">
                            <div className="bg-muted/60 p-3 rounded-md">
                              <p className="text-xs font-mono whitespace-pre-wrap text-gray-600">
                                {isExpanded
                                  ? prompt.conteudo
                                  : prompt.conteudo.length > 400
                                    ? `${prompt.conteudo.substring(0, 400)}...`
                                    : prompt.conteudo}
                              </p>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                              <div>
                                Atualizado em {formatDate(prompt.updated_at)}
                                {prompt.updated_by && ` por ${prompt.updated_by}`}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  data-testid={`btn-restaurar-padrao-${prompt.id}`}
                                  onClick={() => setRestoreConfirmPromptId(prompt.id)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                  Restaurar
                                </Button>
                                <Button onClick={() => openEditDialog(prompt)} variant="outline" size="sm">
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
        </CardContent>
      </Card>

      {/* Dialog de edição de prompt */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Prompt</DialogTitle>
            <DialogDescription>Altere as informações do prompt. As mudanças serão aplicadas imediatamente.</DialogDescription>
          </DialogHeader>
          {editingPrompt && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-nome">Nome</Label>
                <Input
                  id="edit-nome"
                  value={editingPrompt.nome}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, nome: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-descricao">Descrição</Label>
                <Input
                  id="edit-descricao"
                  value={editingPrompt.descricao || ''}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, descricao: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-conteudo">Conteúdo</Label>
                <Textarea
                  id="edit-conteudo"
                  value={editingPrompt.conteudo}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, conteudo: e.target.value })}
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-ativo"
                  checked={editingPrompt.is_active}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-ativo">Ativo</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={isSavingPrompt}>Cancelar</Button>
            <Button onClick={savePrompt} disabled={isSavingPrompt}>
              {isSavingPrompt ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação para restaurar prompt ao padrão */}
      <Dialog
        open={restoreConfirmPromptId !== null}
        onOpenChange={(open) => { if (!open) setRestoreConfirmPromptId(null) }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar Prompt ao Padrão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja restaurar este prompt ao valor padrão? Todas as alterações manuais serão perdidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreConfirmPromptId(null)} disabled={isRestoringDefault}>
              Cancelar
            </Button>
            <Button
              onClick={() => { if (restoreConfirmPromptId !== null) restoreDefaultPrompt(restoreConfirmPromptId) }}
              disabled={isRestoringDefault}
            >
              {isRestoringDefault ? 'Restaurando...' : 'Restaurar Padrão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
