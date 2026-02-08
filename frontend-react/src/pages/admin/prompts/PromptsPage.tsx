import { useState, useEffect } from 'react'
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
import { PageContainer } from '@/components/layout'
import { RotateCcw, Plus } from 'lucide-react'

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

  // Estado do dialog de confirmação para restaurar padrão
  const [restoreConfirmPromptId, setRestoreConfirmPromptId] = useState<number | null>(null)
  const [isRestoringDefault, setIsRestoringDefault] = useState(false)

  // Estado para criação de prompts padrão por sistema
  const [isCreatingDefaults, setIsCreatingDefaults] = useState<string | null>(null)

  // Carregar configurações de IA
  useEffect(() => {
    loadConfigsIA()
  }, [])

  // Carregar prompts
  useEffect(() => {
    loadPrompts()
  }, [])

  // Filtrar prompts quando sistema muda
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

      // Inicializar editedConfigs com valores atuais
      const configs: Record<string, Record<string, string>> = {}
      data.forEach(config => {
        if (!configs[config.sistema]) {
          configs[config.sistema] = {}
        }
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
      [sistema]: {
        ...prev[sistema],
        [chave]: valor,
      },
    }))
  }

  const saveConfigSistema = async (sistema: string) => {
    setIsSavingConfig(sistema)
    try {
      const configsToSave = editedConfigs[sistema] || {}

      // Enviar todas as configurações do sistema
      await adminApi.post('/admin/config-ia/upsert', {
        configs: Object.entries(configsToSave).map(([chave, valor]) => ({
          sistema,
          chave,
          valor,
        })),
      })

      toast({
        title: 'Configurações salvas',
        description: `Configurações de ${SISTEMAS.find(s => s.value === sistema)?.label} atualizadas com sucesso`,
      })

      // Recarregar configs
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

      toast({
        title: 'Prompt atualizado',
        description: 'As alterações foram salvas com sucesso',
      })

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

  /** Restaura o prompt ao valor padrão via API */
  const restoreDefaultPrompt = async (promptId: number) => {
    setIsRestoringDefault(true)
    try {
      await adminApi.post(`/admin/api/prompts/${promptId}/restaurar-padrao`)

      toast({
        title: 'Prompt restaurado',
        description: 'O prompt foi restaurado ao valor padrão com sucesso',
      })

      // Fechar dialog de confirmação e recarregar prompts
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

  /** Cria prompts padrão para um sistema que não possui prompts configurados */
  const createDefaultPrompts = async (sistema: string) => {
    setIsCreatingDefaults(sistema)
    try {
      await adminApi.post(`/admin/api/prompts/criar-padrao/${sistema}`)

      toast({
        title: 'Prompts criados',
        description: `Prompts padrão criados com sucesso para ${SISTEMAS.find(s => s.value === sistema)?.label || sistema}`,
      })

      // Recarregar prompts para exibir os recém-criados
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

  const getConfigsForSistema = (sistema: string): ConfigIA[] => {
    return configsIA.filter(c => c.sistema === sistema)
  }

  /** Retorna os prompts filtrados para um sistema específico */
  const getPromptsForSistema = (sistema: string): Prompt[] => {
    return prompts.filter(p => p.sistema === sistema)
  }

  const formatDate = (dateString: string): string => {
    try {
      const date = new Date(dateString)
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  /**
   * Verifica se o filtro selecionado é um sistema específico (não "todos")
   * e se esse sistema não possui prompts, para exibir o empty state.
   */
  const shouldShowEmptyStateForSistema = (): boolean => {
    if (selectedSistema === 'todos') return false
    return getPromptsForSistema(selectedSistema).length === 0
  }

  return (
    <PageContainer className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Gerenciamento de Prompts e IA</h1>
        <p className="text-muted-foreground mt-2">
          Configure modelos de IA e gerencie prompts dos sistemas
        </p>
      </div>

      {/* Seção 1: Configurações de IA */}
      <Card>
        <CardHeader>
          <CardTitle>Configurações de IA</CardTitle>
          <CardDescription>
            Configure modelos e parâmetros de IA por sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingConfigs ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando configurações...
            </div>
          ) : (
            <Tabs defaultValue="matriculas">
              <TabsList className="grid grid-cols-7 w-full">
                {SISTEMAS.map(sistema => (
                  <TabsTrigger key={sistema.value} value={sistema.value}>
                    {sistema.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {SISTEMAS.map(sistema => {
                const configs = getConfigsForSistema(sistema.value)
                const hasConfigs = configs.length > 0

                return (
                  <TabsContent key={sistema.value} value={sistema.value} className="space-y-4">
                    {hasConfigs ? (
                      <>
                        <div className="grid gap-4">
                          {configs.map(config => (
                            <div key={`${config.sistema}-${config.chave}`} className="grid gap-2">
                              <Label htmlFor={`${config.sistema}-${config.chave}`}>
                                {config.chave}
                              </Label>
                              <Input
                                id={`${config.sistema}-${config.chave}`}
                                value={editedConfigs[sistema.value]?.[config.chave] || ''}
                                onChange={(e) => handleConfigChange(sistema.value, config.chave, e.target.value)}
                                placeholder={`Digite ${config.chave}`}
                              />
                            </div>
                          ))}
                        </div>
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

      {/* Seção 2: Prompts */}
      <Card>
        <CardHeader>
          <CardTitle>Prompts</CardTitle>
          <CardDescription>
            Gerencie prompts utilizados pelos sistemas de IA
          </CardDescription>
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
            <div className="text-center py-8 text-muted-foreground">
              Carregando prompts...
            </div>
          ) : shouldShowEmptyStateForSistema() ? (
            /* 14.6 - Empty state quando um sistema não possui prompts configurados */
            <div
              data-testid={`empty-state-${selectedSistema}`}
              className="text-center py-12 space-y-4"
            >
              <p className="text-muted-foreground">
                Nenhum prompt configurado para este sistema
              </p>
              <Button
                data-testid={`btn-criar-padrao-${selectedSistema}`}
                onClick={() => createDefaultPrompts(selectedSistema)}
                disabled={isCreatingDefaults === selectedSistema}
              >
                <Plus className="mr-2 h-4 w-4" />
                {isCreatingDefaults === selectedSistema
                  ? 'Criando prompts padrão...'
                  : 'Criar Prompts Padrão'}
              </Button>
            </div>
          ) : filteredPrompts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum prompt encontrado
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredPrompts.map(prompt => {
                const tipoBadge = TIPO_BADGES[prompt.tipo] || { label: prompt.tipo, variant: 'outline' as const }

                return (
                  <Card key={prompt.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <CardTitle className="text-lg">{prompt.nome}</CardTitle>
                          {prompt.descricao && (
                            <CardDescription>{prompt.descricao}</CardDescription>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={tipoBadge.variant}>
                            {tipoBadge.label}
                          </Badge>
                          <Badge variant={prompt.is_active ? 'default' : 'secondary'}>
                            {prompt.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-muted p-4 rounded-md">
                        <p className="text-sm font-mono whitespace-pre-wrap">
                          {prompt.conteudo.length > 200
                            ? `${prompt.conteudo.substring(0, 200)}...`
                            : prompt.conteudo}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div>
                          Atualizado em {formatDate(prompt.updated_at)}
                          {prompt.updated_by && ` por ${prompt.updated_by}`}
                        </div>
                        <div className="flex gap-2">
                          {/* 14.2 - Botão para restaurar prompt ao valor padrão */}
                          <Button
                            data-testid={`btn-restaurar-padrao-${prompt.id}`}
                            onClick={() => setRestoreConfirmPromptId(prompt.id)}
                            variant="outline"
                            size="sm"
                          >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Restaurar Padrão
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
          )}
        </CardContent>
      </Card>

      {/* Dialog de edição de prompt */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Prompt</DialogTitle>
            <DialogDescription>
              Altere as informações do prompt. As mudanças serão aplicadas imediatamente.
            </DialogDescription>
          </DialogHeader>

          {editingPrompt && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-nome">Nome</Label>
                <Input
                  id="edit-nome"
                  value={editingPrompt.nome}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, nome: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-descricao">Descrição</Label>
                <Input
                  id="edit-descricao"
                  value={editingPrompt.descricao || ''}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, descricao: e.target.value })
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-conteudo">Conteúdo</Label>
                <Textarea
                  id="edit-conteudo"
                  value={editingPrompt.conteudo}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, conteudo: e.target.value })
                  }
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-ativo"
                  checked={editingPrompt.is_active}
                  onChange={(e) =>
                    setEditingPrompt({ ...editingPrompt, is_active: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="edit-ativo">Ativo</Label>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog} disabled={isSavingPrompt}>
              Cancelar
            </Button>
            <Button onClick={savePrompt} disabled={isSavingPrompt}>
              {isSavingPrompt ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 14.2 - Dialog de confirmação para restaurar prompt ao padrão */}
      <Dialog
        open={restoreConfirmPromptId !== null}
        onOpenChange={(open) => {
          if (!open) setRestoreConfirmPromptId(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restaurar Prompt ao Padrão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja restaurar este prompt ao valor padrão?
              Todas as alterações manuais serão perdidas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRestoreConfirmPromptId(null)}
              disabled={isRestoringDefault}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (restoreConfirmPromptId !== null) {
                  restoreDefaultPrompt(restoreConfirmPromptId)
                }
              }}
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
