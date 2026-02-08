import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
// Usa native <select> para dropdowns simples com <option>

// Interfaces de dados
interface PromptModulo {
  id: number
  titulo: string
  conteudo: string
  categoria: string
  group_id: number | null
  subgroup_id: number | null
  tags: string[]
  tipo: 'conteudo' | 'instrucao' | 'exemplo'
  ordem: number
  ativo: boolean
  modo_ativacao: 'llm' | 'deterministic'
  created_at: string
  updated_at: string
  updated_by: string | null
}

interface PromptGroup {
  id: number
  nome: string
  descricao: string | null
  ordem: number
  ativo: boolean
}

interface PromptSubgroup {
  id: number
  group_id: number
  nome: string
  descricao: string | null
  ordem: number
  ativo: boolean
}

type TipoFiltro = 'conteudo' | 'instrucao' | 'exemplo' | null
type ModoFiltro = 'llm' | 'deterministic' | null
type StatusFiltro = 'ativo' | 'inativo' | null

export function PromptsModulosPage() {
  const { toast } = useToast()

  // Estado de dados
  const [modulos, setModulos] = useState<PromptModulo[]>([])
  const [grupos, setGrupos] = useState<PromptGroup[]>([])
  const [subgrupos, setSubgrupos] = useState<PromptSubgroup[]>([])
  const [loading, setLoading] = useState(true)

  // Estado de filtros
  const [grupoSelecionado, setGrupoSelecionado] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>(null)
  const [modoFiltro, setModoFiltro] = useState<ModoFiltro>(null)
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>(null)

  // Estado de dialogs
  const [dialogAberto, setDialogAberto] = useState(false)
  const [dialogExclusao, setDialogExclusao] = useState(false)
  const [moduloEditando, setModuloEditando] = useState<PromptModulo | null>(null)

  // Estado do formulário
  const [formData, setFormData] = useState({
    titulo: '',
    conteudo: '',
    categoria: '',
    group_id: null as number | null,
    subgroup_id: null as number | null,
    tags: '',
    tipo: 'conteudo' as 'conteudo' | 'instrucao' | 'exemplo',
    ordem: 0,
    ativo: true,
    modo_ativacao: 'llm' as 'llm' | 'deterministic'
  })

  // Carregar grupos ao montar
  useEffect(() => {
    carregarGrupos()
  }, [])

  // Carregar módulos quando grupo selecionado muda
  useEffect(() => {
    if (grupoSelecionado !== null) {
      carregarModulos()
    }
  }, [grupoSelecionado])

  // Carregar subgrupos quando grupo do formulário muda
  useEffect(() => {
    if (formData.group_id) {
      carregarSubgrupos(formData.group_id)
    } else {
      setSubgrupos([])
    }
  }, [formData.group_id])

  async function carregarGrupos() {
    try {
      const data = await adminApi.get<PromptGroup[]>('/admin/api/prompts-modulos/grupos')
      setGrupos(data)
      if (data.length > 0 && grupoSelecionado === null) {
        setGrupoSelecionado(data[0].id)
      }
    } catch (error) {
      toast({
        title: 'Erro ao carregar grupos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    }
  }

  async function carregarModulos() {
    if (grupoSelecionado === null) return

    setLoading(true)
    try {
      const data = await adminApi.get<PromptModulo[]>(
        `/admin/api/prompts-modulos?group_id=${grupoSelecionado}`
      )
      setModulos(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar módulos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  async function carregarSubgrupos(groupId: number) {
    try {
      const data = await adminApi.get<PromptSubgroup[]>(
        `/admin/api/prompts-modulos/grupos/${groupId}/subgrupos`
      )
      setSubgrupos(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar subgrupos',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    }
  }

  function abrirDialogNovo() {
    setModuloEditando(null)
    setFormData({
      titulo: '',
      conteudo: '',
      categoria: '',
      group_id: grupoSelecionado,
      subgroup_id: null,
      tags: '',
      tipo: 'conteudo',
      ordem: 0,
      ativo: true,
      modo_ativacao: 'llm'
    })
    setDialogAberto(true)
  }

  function abrirDialogEditar(modulo: PromptModulo) {
    setModuloEditando(modulo)
    setFormData({
      titulo: modulo.titulo,
      conteudo: modulo.conteudo,
      categoria: modulo.categoria,
      group_id: modulo.group_id,
      subgroup_id: modulo.subgroup_id,
      tags: modulo.tags.join(', '),
      tipo: modulo.tipo,
      ordem: modulo.ordem,
      ativo: modulo.ativo,
      modo_ativacao: modulo.modo_ativacao
    })
    setDialogAberto(true)
  }

  function abrirDialogExcluir(modulo: PromptModulo) {
    setModuloEditando(modulo)
    setDialogExclusao(true)
  }

  async function salvarModulo() {
    try {
      const payload = {
        ...formData,
        tags: formData.tags
          .split(',')
          .map(t => t.trim())
          .filter(t => t.length > 0)
      }

      if (moduloEditando) {
        await adminApi.put(`/admin/api/prompts-modulos/${moduloEditando.id}`, payload)
        toast({
          title: 'Módulo atualizado',
          description: 'Alterações salvas com sucesso'
        })
      } else {
        await adminApi.post('/admin/api/prompts-modulos', payload)
        toast({
          title: 'Módulo criado',
          description: 'Novo módulo adicionado com sucesso'
        })
      }

      setDialogAberto(false)
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao salvar módulo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    }
  }

  async function excluirModulo() {
    if (!moduloEditando) return

    try {
      await adminApi.delete(`/admin/api/prompts-modulos/${moduloEditando.id}`)
      toast({
        title: 'Módulo excluído',
        description: 'Módulo removido com sucesso'
      })
      setDialogExclusao(false)
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao excluir módulo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    }
  }

  async function toggleAtivo(modulo: PromptModulo) {
    try {
      await adminApi.patch(`/admin/api/prompts-modulos/${modulo.id}/toggle`)
      toast({
        title: modulo.ativo ? 'Módulo desativado' : 'Módulo ativado',
        description: 'Status alterado com sucesso'
      })
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao alterar status',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    }
  }

  // Aplicar filtros
  const modulosFiltrados = modulos.filter(modulo => {
    // Filtro de busca
    if (busca && !modulo.titulo.toLowerCase().includes(busca.toLowerCase()) &&
        !modulo.conteudo.toLowerCase().includes(busca.toLowerCase())) {
      return false
    }

    // Filtro de tipo
    if (tipoFiltro && modulo.tipo !== tipoFiltro) {
      return false
    }

    // Filtro de modo
    if (modoFiltro && modulo.modo_ativacao !== modoFiltro) {
      return false
    }

    // Filtro de status
    if (statusFiltro === 'ativo' && !modulo.ativo) {
      return false
    }
    if (statusFiltro === 'inativo' && modulo.ativo) {
      return false
    }

    return true
  })

  // Agrupar módulos por categoria
  const modulosPorCategoria = modulosFiltrados.reduce((acc, modulo) => {
    const cat = modulo.categoria || 'Sem categoria'
    if (!acc[cat]) {
      acc[cat] = []
    }
    acc[cat].push(modulo)
    return acc
  }, {} as Record<string, PromptModulo[]>)

  // Ordenar categorias
  const categorias = Object.keys(modulosPorCategoria).sort()

  function getTipoBadgeColor(tipo: string) {
    switch (tipo) {
      case 'conteudo': return 'bg-blue-500'
      case 'instrucao': return 'bg-purple-500'
      case 'exemplo': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  function getModoBadgeColor(modo: string) {
    switch (modo) {
      case 'deterministic': return 'bg-green-500'
      case 'llm': return 'bg-blue-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Título */}
      <h1 className="text-3xl font-bold mb-6">Módulos de Prompts</h1>

      {/* Header com filtros e ações */}
      <div className="mb-6 space-y-4">
        <div className="flex gap-4 flex-wrap items-center">
          {/* Seletor de grupo */}
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="grupo-select">Grupo</Label>
            <select
              id="grupo-select"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={grupoSelecionado?.toString() || ''}
              onChange={(e) => setGrupoSelecionado(Number(e.target.value))}
            >
              <option value="">Selecione um grupo</option>
              {grupos.map(grupo => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Campo de busca */}
          <div className="flex-1 min-w-[200px]">
            <Label htmlFor="busca">Buscar</Label>
            <Input
              id="busca"
              type="text"
              placeholder="Buscar por título ou conteúdo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          {/* Botão novo módulo */}
          <div className="flex items-end">
            <Button onClick={abrirDialogNovo} disabled={grupoSelecionado === null}>
              Novo Módulo
            </Button>
          </div>
        </div>

        {/* Badges de filtro */}
        <div className="flex gap-2 flex-wrap">
          <Badge
            className={`cursor-pointer ${tipoFiltro === 'conteudo' ? 'bg-blue-500' : 'bg-gray-200'}`}
            onClick={() => setTipoFiltro(tipoFiltro === 'conteudo' ? null : 'conteudo')}
          >
            Conteúdo
          </Badge>
          <Badge
            className={`cursor-pointer ${tipoFiltro === 'instrucao' ? 'bg-purple-500' : 'bg-gray-200'}`}
            onClick={() => setTipoFiltro(tipoFiltro === 'instrucao' ? null : 'instrucao')}
          >
            Instrução
          </Badge>
          <Badge
            className={`cursor-pointer ${tipoFiltro === 'exemplo' ? 'bg-green-500' : 'bg-gray-200'}`}
            onClick={() => setTipoFiltro(tipoFiltro === 'exemplo' ? null : 'exemplo')}
          >
            Exemplo
          </Badge>
          <Badge
            className={`cursor-pointer ${modoFiltro === 'deterministic' ? 'bg-green-500' : 'bg-gray-200'}`}
            onClick={() => setModoFiltro(modoFiltro === 'deterministic' ? null : 'deterministic')}
          >
            Determinístico
          </Badge>
          <Badge
            className={`cursor-pointer ${modoFiltro === 'llm' ? 'bg-blue-500' : 'bg-gray-200'}`}
            onClick={() => setModoFiltro(modoFiltro === 'llm' ? null : 'llm')}
          >
            LLM
          </Badge>
          <Badge
            className={`cursor-pointer ${statusFiltro === 'ativo' ? 'bg-green-500' : 'bg-gray-200'}`}
            onClick={() => setStatusFiltro(statusFiltro === 'ativo' ? null : 'ativo')}
          >
            Ativo
          </Badge>
          <Badge
            className={`cursor-pointer ${statusFiltro === 'inativo' ? 'bg-red-500' : 'bg-gray-200'}`}
            onClick={() => setStatusFiltro(statusFiltro === 'inativo' ? null : 'inativo')}
          >
            Inativo
          </Badge>
        </div>
      </div>

      {/* Lista de módulos agrupados por categoria */}
      {loading ? (
        <div className="text-center py-8">Carregando...</div>
      ) : categorias.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhum módulo encontrado
        </div>
      ) : (
        <div className="space-y-6">
          {categorias.map(categoria => (
            <div key={categoria}>
              {/* Header da categoria */}
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-xl font-semibold">{categoria}</h2>
                <Badge variant="secondary">
                  {modulosPorCategoria[categoria].length}
                </Badge>
              </div>

              {/* Cards dos módulos */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {modulosPorCategoria[categoria].map(modulo => (
                  <Card key={modulo.id} className="p-4">
                    <div className="space-y-3">
                      {/* Título e badges */}
                      <div>
                        <h3 className="font-semibold mb-2">{modulo.titulo}</h3>
                        <div className="flex gap-2 flex-wrap">
                          <Badge className={getTipoBadgeColor(modulo.tipo)}>
                            {modulo.tipo}
                          </Badge>
                          <Badge className={getModoBadgeColor(modulo.modo_ativacao)}>
                            {modulo.modo_ativacao}
                          </Badge>
                        </div>
                      </div>

                      {/* Tags */}
                      {modulo.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {modulo.tags.map((tag, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Info de atualização */}
                      <div className="text-xs text-gray-500">
                        Atualizado em {new Date(modulo.updated_at).toLocaleDateString('pt-BR')}
                        {modulo.updated_by && ` por ${modulo.updated_by}`}
                      </div>

                      {/* Ações */}
                      <div className="flex gap-2 justify-between items-center pt-2 border-t">
                        <div className="flex items-center gap-2">
                          <label className="text-sm">
                            <input
                              type="checkbox"
                              checked={modulo.ativo}
                              onChange={() => toggleAtivo(modulo)}
                              className="mr-1"
                            />
                            Ativo
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirDialogEditar(modulo)}
                          >
                            Editar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => abrirDialogExcluir(modulo)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6">
            <h2 className="text-2xl font-bold mb-4">
              {moduloEditando ? 'Editar Módulo' : 'Novo Módulo'}
            </h2>

            <div className="space-y-4">
              {/* Título */}
              <div>
                <Label htmlFor="titulo">Título</Label>
                <Input
                  id="titulo"
                  value={formData.titulo}
                  onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
                />
              </div>

              {/* Conteúdo */}
              <div>
                <Label htmlFor="conteudo">Conteúdo</Label>
                <Textarea
                  id="conteudo"
                  value={formData.conteudo}
                  onChange={(e) => setFormData({ ...formData, conteudo: e.target.value })}
                  className="font-mono min-h-[300px]"
                />
              </div>

              {/* Categoria */}
              <div>
                <Label htmlFor="categoria">Categoria</Label>
                <Input
                  id="categoria"
                  value={formData.categoria}
                  onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                />
              </div>

              {/* Grupo */}
              <div>
                <Label htmlFor="group_id">Grupo</Label>
                <select
                  id="group_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.group_id?.toString() || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    group_id: e.target.value ? Number(e.target.value) : null,
                    subgroup_id: null
                  })}
                >
                  <option value="">Nenhum</option>
                  {grupos.map(grupo => (
                    <option key={grupo.id} value={grupo.id}>
                      {grupo.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subgrupo */}
              <div>
                <Label htmlFor="subgroup_id">Subgrupo</Label>
                <select
                  id="subgroup_id"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.subgroup_id?.toString() || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    subgroup_id: e.target.value ? Number(e.target.value) : null
                  })}
                  disabled={!formData.group_id}
                >
                  <option value="">Nenhum</option>
                  {subgrupos.map(subgrupo => (
                    <option key={subgrupo.id} value={subgrupo.id}>
                      {subgrupo.nome}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="tag1, tag2, tag3"
                />
              </div>

              {/* Tipo */}
              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.tipo}
                  onChange={(e) => setFormData({
                    ...formData,
                    tipo: e.target.value as 'conteudo' | 'instrucao' | 'exemplo'
                  })}
                >
                  <option value="conteudo">Conteúdo</option>
                  <option value="instrucao">Instrução</option>
                  <option value="exemplo">Exemplo</option>
                </select>
              </div>

              {/* Modo de ativação */}
              <div>
                <Label htmlFor="modo_ativacao">Modo de Ativação</Label>
                <select
                  id="modo_ativacao"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.modo_ativacao}
                  onChange={(e) => setFormData({
                    ...formData,
                    modo_ativacao: e.target.value as 'llm' | 'deterministic'
                  })}
                >
                  <option value="llm">LLM</option>
                  <option value="deterministic">Determinístico</option>
                </select>
              </div>

              {/* Ordem */}
              <div>
                <Label htmlFor="ordem">Ordem</Label>
                <Input
                  id="ordem"
                  type="number"
                  value={formData.ordem}
                  onChange={(e) => setFormData({ ...formData, ordem: Number(e.target.value) })}
                />
              </div>

              {/* Ativo */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                />
                <Label htmlFor="ativo">Ativo</Label>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="flex gap-2 justify-end mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarModulo}>
                {moduloEditando ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={dialogExclusao} onOpenChange={setDialogExclusao}>
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Confirmar Exclusão</h2>
            <p className="mb-6">
              Tem certeza que deseja excluir o módulo "{moduloEditando?.titulo}"?
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogExclusao(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={excluirModulo}>
                Excluir
              </Button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
