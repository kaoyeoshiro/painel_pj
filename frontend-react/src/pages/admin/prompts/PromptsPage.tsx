import { useState, useEffect, useCallback, useRef } from 'react'
import { adminApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { AdminSubNav } from '@/components/layout'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import { FileEdit, ChevronsUpDown } from 'lucide-react'
import type { Prompt, ConfigIA, PerAgentResponse } from './types'
import { SISTEMAS } from './constants'
import { CollapsibleSection } from './components/CollapsibleSection'
import { AgentConfigSection } from './components/AgentConfigSection'
import { ExtraConfigsSection } from './components/ExtraConfigsSection'
import { PromptsSection } from './components/PromptsSection'
import { PromptEditDialog } from './components/PromptEditDialog'
import { SistemasAcessoriosSection } from './components/SistemasAcessoriosSection'
import { GlobalConfigSection } from './components/GlobalConfigSection'

export function PromptsPage() {
  const { toast } = useToast()

  // --- Estado global ---
  const [configsIA, setConfigsIA] = useState<ConfigIA[]>([])
  const [editedExtras, setEditedExtras] = useState<Record<string, Record<string, string>>>({})
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [isLoadingConfigs, setIsLoadingConfigs] = useState(true)
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(true)
  const [isSavingExtras, setIsSavingExtras] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('matriculas')

  // --- Per-agent state (lazy por aba) ---
  const [perAgentCache, setPerAgentCache] = useState<Record<string, PerAgentResponse>>({})
  const [loadingPerAgent, setLoadingPerAgent] = useState<Record<string, boolean>>({})
  const fetchedSistemas = useRef<Set<string>>(new Set())

  // --- Prompts edit state ---
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isSavingPrompt, setIsSavingPrompt] = useState(false)
  const [restoreConfirmPromptId, setRestoreConfirmPromptId] = useState<number | null>(null)
  const [isRestoringDefault, setIsRestoringDefault] = useState(false)
  const [isCreatingDefaults, setIsCreatingDefaults] = useState<string | null>(null)

  // --- Collapse state ---
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    agentes: true,
    extras: false,
    prompts: false,
  })

  // =============================================
  // Loaders
  // =============================================

  const loadConfigsIA = useCallback(async () => {
    setIsLoadingConfigs(true)
    try {
      const data = await adminApi.get<ConfigIA[]>('/admin/config-ia')
      setConfigsIA(data)
      const configs: Record<string, Record<string, string>> = {}
      data.forEach(config => {
        if (!configs[config.sistema]) configs[config.sistema] = {}
        configs[config.sistema][config.chave] = config.valor
      })
      setEditedExtras(configs)
    } catch (error) {
      toast({ title: 'Erro ao carregar configurações', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setIsLoadingConfigs(false)
    }
  }, [toast])

  const loadPrompts = useCallback(async () => {
    setIsLoadingPrompts(true)
    try {
      const data = await adminApi.get<{ prompts: Prompt[]; total: number }>('/admin/api/prompts')
      setPrompts(data.prompts)
    } catch (error) {
      toast({ title: 'Erro ao carregar prompts', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setIsLoadingPrompts(false)
    }
  }, [toast])

  const loadPerAgent = useCallback(async (sistema: string) => {
    if (sistema === 'global' || sistema === 'sistemas_acessorios' || fetchedSistemas.current.has(sistema)) return
    fetchedSistemas.current.add(sistema)
    setLoadingPerAgent(prev => ({ ...prev, [sistema]: true }))
    try {
      const data = await adminApi.get<PerAgentResponse>(`/admin/config-ia/per-agent/${sistema}`)
      setPerAgentCache(prev => ({ ...prev, [sistema]: data }))
    } catch (error) {
      fetchedSistemas.current.delete(sistema)
      toast({ title: 'Erro ao carregar agentes', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setLoadingPerAgent(prev => ({ ...prev, [sistema]: false }))
    }
  }, [toast])

  useEffect(() => { loadConfigsIA() }, [loadConfigsIA])
  useEffect(() => { loadPrompts() }, [loadPrompts])
  useEffect(() => { loadPerAgent(activeTab) }, [activeTab, loadPerAgent])

  // =============================================
  // Handlers: Extras
  // =============================================

  const handleExtraChange = (sistema: string, chave: string, valor: string) => {
    setEditedExtras(prev => ({
      ...prev,
      [sistema]: { ...prev[sistema], [chave]: valor },
    }))
  }

  const saveExtras = async (sistema: string) => {
    setIsSavingExtras(sistema)
    try {
      const configsToSave = editedExtras[sistema] || {}
      await adminApi.post('/admin/config-ia/upsert', {
        configs: Object.entries(configsToSave).map(([chave, valor]) => ({ sistema, chave, valor })),
      })
      toast({ title: 'Configurações salvas', description: `Configurações extras de ${SISTEMAS.find(s => s.value === sistema)?.label} atualizadas` })
      await loadConfigsIA()
    } catch (error) {
      toast({ title: 'Erro ao salvar', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setIsSavingExtras(null)
    }
  }

  // =============================================
  // Handlers: Agentes
  // =============================================

  const saveAgentEdits = async (sistema: string, edits: Record<string, Record<string, string>>) => {
    const configs: { sistema: string; chave: string; valor: string }[] = []
    for (const [agente, campos] of Object.entries(edits)) {
      for (const [campo, valor] of Object.entries(campos)) {
        // Chave no formato: campo_agente (ex: modelo_geracao, temperatura_coletor)
        configs.push({ sistema, chave: `${campo}_${agente}`, valor })
      }
    }
    if (configs.length === 0) return

    await adminApi.post('/admin/config-ia/upsert', { configs })
    toast({ title: 'Agentes salvos', description: `Configurações de agentes atualizadas` })

    // Refetch per-agent
    fetchedSistemas.current.delete(sistema)
    await loadPerAgent(sistema)
  }

  const resetAgent = async (sistema: string, agente: string) => {
    const campos = ['modelo', 'temperatura', 'max_tokens', 'thinking_level']
    const configs = campos.map(campo => ({
      sistema,
      chave: `${campo}_${agente}`,
      valor: '',
    }))
    await adminApi.post('/admin/config-ia/upsert', { configs })
    toast({ title: 'Agente resetado', description: `Configurações de "${agente}" limpas` })
    fetchedSistemas.current.delete(sistema)
    await loadPerAgent(sistema)
  }

  // =============================================
  // Handlers: Prompts
  // =============================================

  const savePrompt = async () => {
    if (!editingPrompt) return
    setIsSavingPrompt(true)
    try {
      await adminApi.put(`/admin/api/prompts/${editingPrompt.id}`, {
        nome: editingPrompt.nome,
        descricao: editingPrompt.descricao,
        conteudo: editingPrompt.conteudo,
        is_active: editingPrompt.is_active,
      })
      toast({ title: 'Prompt atualizado', description: 'As alterações foram salvas com sucesso' })
      setEditingPrompt(null)
      setIsEditDialogOpen(false)
      await loadPrompts()
    } catch (error) {
      toast({ title: 'Erro ao salvar prompt', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
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
      toast({ title: 'Erro ao restaurar', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setIsRestoringDefault(false)
    }
  }

  const createDefaultPrompts = async (sistema: string) => {
    setIsCreatingDefaults(sistema)
    try {
      await adminApi.post(`/admin/api/prompts/criar-padrao/${sistema}`)
      toast({ title: 'Prompts criados', description: `Prompts padrão criados para ${SISTEMAS.find(s => s.value === sistema)?.label || sistema}` })
      await loadPrompts()
    } catch (error) {
      toast({ title: 'Erro ao criar prompts', description: error instanceof Error ? error.message : 'Erro desconhecido', variant: 'destructive' })
    } finally {
      setIsCreatingDefaults(null)
    }
  }

  // =============================================
  // Expand / Collapse all
  // =============================================

  const expandAll = () => setSectionsOpen({ agentes: true, extras: true, prompts: true })
  const collapseAll = () => setSectionsOpen({ agentes: false, extras: false, prompts: false })

  // =============================================
  // Helpers
  // =============================================

  const getConfigsForSistema = (sistema: string): ConfigIA[] => configsIA.filter(c => c.sistema === sistema)
  const isSpecialTab = (value: string) => value === 'global' || value === 'sistemas_acessorios'
  const hasAgents = (value: string) => !isSpecialTab(value)

  // =============================================
  // Render
  // =============================================

  return (
    <>
      <BreadcrumbBar
        title="Gerenciamento de Prompts e IA"
        icon={<FileEdit style={{ width: 14, height: 14 }} />}
      />

      <ContentArea className="space-y-6">
        <AdminSubNav />

        <Card className="rounded-2xl" style={{ border: `1px solid ${C.gray200}` }}>
          <div style={{ height: 4, background: `linear-gradient(135deg, ${C.navy950}, ${C.navy700})`, borderRadius: '16px 16px 0 0' }} />
          <CardHeader>
            <CardTitle style={{ color: C.text900 }}>Configurações de IA</CardTitle>
            <CardDescription style={{ color: C.text500 }}>
              Configure modelos, parâmetros de IA e prompts por sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingConfigs && isLoadingPrompts ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <TabsList className="flex flex-wrap gap-1 h-auto p-1">
                    {SISTEMAS.map(sistema => (
                      <TabsTrigger key={sistema.value} value={sistema.value} className="text-xs sm:text-sm">
                        {sistema.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {/* Expandir / Recolher tudo (so para abas com secoes collapsiveis) */}
                  {!isSpecialTab(activeTab) && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={expandAll} className="text-xs" style={{ color: C.text500 }}>
                        <ChevronsUpDown className="h-3.5 w-3.5 mr-1" />
                        Expandir tudo
                      </Button>
                      <Button variant="ghost" size="sm" onClick={collapseAll} className="text-xs" style={{ color: C.text500 }}>
                        Recolher tudo
                      </Button>
                    </div>
                  )}
                </div>

                {SISTEMAS.map(sistema => (
                  <TabsContent key={sistema.value} value={sistema.value} className="space-y-4 mt-4">

                    {/* Aba especial: Sistemas Acessorios */}
                    {sistema.value === 'sistemas_acessorios' && (
                      <SistemasAcessoriosSection
                        values={editedExtras['sistemas_acessorios'] || {}}
                        onChange={(chave, valor) => handleExtraChange('sistemas_acessorios', chave, valor)}
                        onSave={() => saveExtras('sistemas_acessorios')}
                        isSaving={isSavingExtras === 'sistemas_acessorios'}
                      />
                    )}

                    {/* Aba especial: Global */}
                    {sistema.value === 'global' && (
                      <GlobalConfigSection
                        values={editedExtras['global'] || {}}
                        onChange={(chave, valor) => handleExtraChange('global', chave, valor)}
                        onSave={() => saveExtras('global')}
                        isSaving={isSavingExtras === 'global'}
                      />
                    )}

                    {/* Abas normais: sistemas com agentes */}
                    {hasAgents(sistema.value) && (
                      <>
                        {/* Seção: Configuração por Agente */}
                        <CollapsibleSection
                          title="Configuração por Agente"
                          subtitle={`${Object.keys(perAgentCache[sistema.value]?.agentes || {}).length} agente(s)`}
                          isOpen={sectionsOpen.agentes}
                          onToggle={(open) => setSectionsOpen(prev => ({ ...prev, agentes: open }))}
                          testId={`section-agentes-${sistema.value}`}
                        >
                          <AgentConfigSection
                            perAgentData={perAgentCache[sistema.value] || null}
                            isLoading={loadingPerAgent[sistema.value] || false}
                            onSave={(edits) => saveAgentEdits(sistema.value, edits)}
                            onReset={(agente) => resetAgent(sistema.value, agente)}
                          />
                        </CollapsibleSection>

                        {/* Seção: Configurações Extras */}
                        <CollapsibleSection
                          title="Configurações Extras"
                          isOpen={sectionsOpen.extras}
                          onToggle={(open) => setSectionsOpen(prev => ({ ...prev, extras: open }))}
                          testId={`section-extras-${sistema.value}`}
                        >
                          <ExtraConfigsSection
                            configs={getConfigsForSistema(sistema.value)}
                            editedValues={editedExtras[sistema.value] || {}}
                            onValueChange={(chave, valor) => handleExtraChange(sistema.value, chave, valor)}
                            onSave={() => saveExtras(sistema.value)}
                            isSaving={isSavingExtras === sistema.value}
                          />
                        </CollapsibleSection>

                        {/* Seção: Prompts do Sistema */}
                        <CollapsibleSection
                          title="Prompts do Sistema"
                          subtitle={`${prompts.filter(p => p.sistema === sistema.value).length} prompt(s)`}
                          isOpen={sectionsOpen.prompts}
                          onToggle={(open) => setSectionsOpen(prev => ({ ...prev, prompts: open }))}
                          testId={`section-prompts-${sistema.value}`}
                        >
                          <PromptsSection
                            prompts={prompts}
                            activeSistema={sistema.value}
                            onEdit={(prompt) => {
                              setEditingPrompt({ ...prompt })
                              setIsEditDialogOpen(true)
                            }}
                            onRestore={(id) => setRestoreConfirmPromptId(id)}
                            onCreateDefaults={createDefaultPrompts}
                            isCreatingDefaults={isCreatingDefaults}
                          />
                        </CollapsibleSection>
                      </>
                    )}

                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* Dialog de edição de prompt */}
        <PromptEditDialog
          prompt={editingPrompt}
          open={isEditDialogOpen}
          onOpenChange={(open) => {
            setIsEditDialogOpen(open)
            if (!open) setEditingPrompt(null)
          }}
          onPromptChange={setEditingPrompt}
          onSave={savePrompt}
          isSaving={isSavingPrompt}
        />

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
                style={{ background: C.navy950, color: 'white' }}
              >
                {isRestoringDefault ? 'Restaurando...' : 'Restaurar Padrão'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ContentArea>
    </>
  )
}
