import { useState, useEffect, useRef } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageContainer, PageHeader, SectionCard } from '@/components/layout'
import {
  ChevronDown, ChevronRight, Edit2, Trash2, ToggleLeft, ToggleRight,
  Plus, Search, Download, Upload, History, Settings, RotateCcw,
} from 'lucide-react'
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

interface HistoricoVersao {
  versao: number
  conteudo: string
  titulo: string
  categoria: string
  tipo: string
  modo_ativacao: string
  atualizado_em: string
  atualizado_por: string | null
}

interface Subcategoria {
  id: number
  group_id: number
  nome: string
  slug: string
  descricao: string | null
}

type TipoFiltro = 'conteudo' | 'instrucao' | 'exemplo' | null
type ModoFiltro = 'llm' | 'deterministic' | null
type StatusFiltro = 'ativo' | 'inativo' | null

// ---- Helpers de cor (badge) ----

function getTipoBadgeColor(tipo: string) {
  switch (tipo) {
    case 'conteudo': return 'bg-blue-100 text-blue-700'
    case 'instrucao': return 'bg-purple-100 text-purple-700'
    case 'exemplo': return 'bg-green-100 text-green-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

function getModoBadgeColor(modo: string) {
  switch (modo) {
    case 'deterministic': return 'bg-emerald-100 text-emerald-700'
    case 'llm': return 'bg-sky-100 text-sky-700'
    default: return 'bg-gray-100 text-gray-700'
  }
}

// ---- Componente de Grupo por Categoria (colapsável) ----

interface CategoriaGroupProps {
  categoria: string
  modulos: PromptModulo[]
  onEdit: (m: PromptModulo) => void
  onDelete: (m: PromptModulo) => void
  onToggle: (m: PromptModulo) => void
  onHistory: (m: PromptModulo) => void
}

function CategoriaGroup({ categoria, modulos, onEdit, onDelete, onToggle, onHistory }: CategoriaGroupProps) {
  const [aberto, setAberto] = useState(true)

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Cabeçalho da categoria — clicável para colapsar */}
      <button
        type="button"
        onClick={() => setAberto(!aberto)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {aberto ? (
          <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
        )}
        <span className="font-semibold text-gray-800">{categoria}</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {modulos.length}
        </Badge>
      </button>

      {/* Lista de módulos */}
      {aberto && (
        <ul className="divide-y divide-gray-100">
          {modulos
            .sort((a, b) => a.ordem - b.ordem)
            .map((modulo) => (
              <li
                key={modulo.id}
                className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                  !modulo.ativo ? 'opacity-50' : ''
                }`}
              >
                {/* Ordem */}
                <span className="text-xs text-gray-400 w-6 text-right flex-shrink-0">
                  #{modulo.ordem}
                </span>

                {/* Título + tags */}
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-gray-900 truncate block">
                    {modulo.titulo}
                  </span>
                  {modulo.tags.length > 0 && (
                    <span className="text-xs text-gray-400 truncate block mt-0.5">
                      {modulo.tags.join(', ')}
                    </span>
                  )}
                </div>

                {/* Badges: tipo + modo */}
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${getTipoBadgeColor(modulo.tipo)}`}>
                  {modulo.tipo}
                </span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${getModoBadgeColor(modulo.modo_ativacao)}`}>
                  {modulo.modo_ativacao === 'deterministic' ? 'regra' : 'LLM'}
                </span>

                {/* Ações */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => onToggle(modulo)}
                    title={modulo.ativo ? 'Desativar' : 'Ativar'}
                    className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    {modulo.ativo ? (
                      <ToggleRight className="h-4 w-4 text-green-600" />
                    ) : (
                      <ToggleLeft className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onHistory(modulo)}
                    title="Histórico"
                    className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    <History className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(modulo)}
                    title="Editar"
                    className="p-1.5 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    <Edit2 className="h-4 w-4 text-gray-500" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(modulo)}
                    title="Excluir"
                    className="p-1.5 rounded-md hover:bg-red-100 transition-colors"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}

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

  // Estado de histórico
  const [dialogHistorico, setDialogHistorico] = useState(false)
  const [moduloHistorico, setModuloHistorico] = useState<PromptModulo | null>(null)
  const [versoes, setVersoes] = useState<HistoricoVersao[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Estado de import/export
  const [dialogImportar, setDialogImportar] = useState(false)
  const [importData, setImportData] = useState('')
  const [importando, setImportando] = useState(false)

  // Estado de gestão de grupos
  const [dialogGrupos, setDialogGrupos] = useState(false)
  const [novoGrupoNome, setNovoGrupoNome] = useState('')
  const [novoGrupoDescricao, setNovoGrupoDescricao] = useState('')

  // Estado de subcategorias
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])

  // Ref para input de arquivo (importação)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // ========== Histórico ==========

  async function abrirHistorico(modulo: PromptModulo) {
    setModuloHistorico(modulo)
    setDialogHistorico(true)
    setLoadingHistorico(true)
    try {
      const data = await adminApi.get<HistoricoVersao[]>(
        `/admin/api/prompts-modulos/${modulo.id}/historico`
      )
      setVersoes(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar histórico',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    } finally {
      setLoadingHistorico(false)
    }
  }

  async function restaurarVersao(versao: number) {
    if (!moduloHistorico) return
    try {
      await adminApi.post(`/admin/api/prompts-modulos/${moduloHistorico.id}/restaurar/${versao}`)
      toast({
        title: 'Versão restaurada',
        description: `Módulo restaurado para a versão ${versao}`
      })
      setDialogHistorico(false)
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao restaurar versão',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    }
  }

  // ========== Import/Export ==========

  async function exportarTodos() {
    try {
      const data = await adminApi.get<unknown>('/admin/api/prompts-modulos/exportar/todos')
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prompts-modulos-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: 'Exportação concluída',
        description: 'Arquivo JSON baixado com sucesso'
      })
    } catch (error) {
      toast({
        title: 'Erro ao exportar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    }
  }

  async function importarModulos() {
    if (!importData.trim()) return
    setImportando(true)
    try {
      const parsed = JSON.parse(importData)
      await adminApi.post('/admin/api/prompts-modulos/importar', parsed)
      toast({
        title: 'Importação concluída',
        description: 'Módulos importados com sucesso'
      })
      setDialogImportar(false)
      setImportData('')
      carregarGrupos()
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao importar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    } finally {
      setImportando(false)
    }
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImportData(ev.target?.result as string)
      setDialogImportar(true)
    }
    reader.readAsText(file)
    // Reset input so the same file can be selected again
    e.target.value = ''
  }

  // ========== Gestão de Grupos ==========

  async function criarGrupo() {
    if (!novoGrupoNome.trim()) return
    try {
      await adminApi.post('/admin/api/prompts-modulos/grupos', {
        nome: novoGrupoNome.trim(),
        descricao: novoGrupoDescricao.trim() || null,
        ordem: grupos.length + 1,
        ativo: true
      })
      toast({
        title: 'Grupo criado',
        description: `Grupo "${novoGrupoNome}" criado com sucesso`
      })
      setNovoGrupoNome('')
      setNovoGrupoDescricao('')
      carregarGrupos()
    } catch (error) {
      toast({
        title: 'Erro ao criar grupo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    }
  }

  // ========== Subcategorias ==========

  useEffect(() => {
    if (grupoSelecionado !== null) {
      carregarSubcategorias(grupoSelecionado)
    }
  }, [grupoSelecionado])

  async function carregarSubcategorias(groupId: number) {
    try {
      const data = await adminApi.get<Subcategoria[]>(
        `/admin/api/prompts-modulos/grupos/${groupId}/subcategorias`
      )
      setSubcategorias(data)
    } catch {
      // Subcategorias são opcionais, ignorar erro silenciosamente
      setSubcategorias([])
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

  return (
    <PageContainer className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Módulos de Prompts"
        description={`${modulosFiltrados.length} módulo(s) encontrado(s)`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setDialogGrupos(true)} className="gap-1.5">
              <Settings className="h-4 w-4" />
              Grupos
            </Button>
            <Button variant="outline" size="sm" onClick={exportarTodos} className="gap-1.5">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileImport}
            />
            <Button onClick={abrirDialogNovo} disabled={grupoSelecionado === null} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Novo Módulo
            </Button>
          </div>
        }
      />

      {/* Filtros — card branco inline como no legado */}
      <SectionCard>
        <div className="flex flex-wrap gap-3 items-center">
          {/* Busca */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por título ou conteúdo..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tipo */}
          <select
            className="flex-shrink-0 w-[140px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            value={tipoFiltro || ''}
            onChange={(e) => setTipoFiltro((e.target.value || null) as TipoFiltro)}
          >
            <option value="">Todos os tipos</option>
            <option value="conteudo">Conteúdo</option>
            <option value="instrucao">Instrução</option>
            <option value="exemplo">Exemplo</option>
          </select>

          {/* Modo de ativação */}
          <select
            className="flex-shrink-0 w-[160px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            value={modoFiltro || ''}
            onChange={(e) => setModoFiltro((e.target.value || null) as ModoFiltro)}
          >
            <option value="">Tipo de Ativação</option>
            <option value="llm">LLM</option>
            <option value="deterministic">Regra Determinística</option>
          </select>

          {/* Grupo */}
          <select
            className="flex-shrink-0 w-[150px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            value={grupoSelecionado?.toString() || ''}
            onChange={(e) => setGrupoSelecionado(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Todos os grupos</option>
            {grupos.map(grupo => (
              <option key={grupo.id} value={grupo.id}>
                {grupo.nome}
              </option>
            ))}
          </select>

          {/* Status */}
          <label className="flex-shrink-0 flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={statusFiltro === 'ativo'}
              onChange={(e) => setStatusFiltro(e.target.checked ? 'ativo' : null)}
              className="rounded text-primary-600"
            />
            Apenas ativos
          </label>
        </div>
      </SectionCard>

      {/* Lista de módulos — estilo lista do legado */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando módulos...</div>
      ) : categorias.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Nenhum módulo encontrado</div>
      ) : (
        <div className="space-y-4">
          {categorias.map(categoria => (
            <CategoriaGroup
              key={categoria}
              categoria={categoria}
              modulos={modulosPorCategoria[categoria]}
              onEdit={abrirDialogEditar}
              onDelete={abrirDialogExcluir}
              onToggle={toggleAtivo}
              onHistory={abrirHistorico}
            />
          ))}
        </div>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {moduloEditando ? 'Editar Módulo' : 'Novo Módulo'}
            </DialogTitle>
          </DialogHeader>

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

            <DialogFooter className="mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setDialogAberto(false)}>
                Cancelar
              </Button>
              <Button onClick={salvarModulo}>
                {moduloEditando ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={dialogExclusao} onOpenChange={setDialogExclusao}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="mb-6">
            Tem certeza que deseja excluir o módulo &quot;{moduloEditando?.titulo}&quot;?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogExclusao(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={excluirModulo}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de histórico */}
      <Dialog open={dialogHistorico} onOpenChange={setDialogHistorico}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Histórico — {moduloHistorico?.titulo}</DialogTitle>
            <DialogDescription>Versões anteriores deste módulo</DialogDescription>
          </DialogHeader>
          {loadingHistorico ? (
            <div className="text-center py-8 text-gray-400">Carregando histórico...</div>
          ) : versoes.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Nenhuma versão anterior encontrada</div>
          ) : (
            <div className="space-y-3">
              {versoes.map((versao) => (
                <div key={versao.versao} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">v{versao.versao}</Badge>
                      <span className="text-sm text-gray-500">
                        {new Date(versao.atualizado_em).toLocaleString('pt-BR')}
                      </span>
                      {versao.atualizado_por && (
                        <span className="text-xs text-gray-400">por {versao.atualizado_por}</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => restaurarVersao(versao.versao)}
                      className="gap-1.5"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Restaurar
                    </Button>
                  </div>
                  <div className="text-sm">
                    <span className="font-medium">{versao.titulo}</span>
                    <span className="text-gray-400 ml-2">({versao.categoria})</span>
                  </div>
                  <pre className="mt-2 text-xs text-gray-600 bg-gray-50 p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap">
                    {versao.conteudo.slice(0, 500)}{versao.conteudo.length > 500 ? '...' : ''}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de importação */}
      <Dialog open={dialogImportar} onOpenChange={setDialogImportar}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importar Módulos</DialogTitle>
            <DialogDescription>
              Cole ou carregue um arquivo JSON exportado anteriormente
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            className="font-mono text-xs min-h-[300px]"
            placeholder='{"version": "2.0", "modulos": [...]}'
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogImportar(false); setImportData('') }}>
              Cancelar
            </Button>
            <Button onClick={importarModulos} disabled={importando || !importData.trim()}>
              {importando ? 'Importando...' : 'Importar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de gestão de grupos */}
      <Dialog open={dialogGrupos} onOpenChange={setDialogGrupos}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gerenciar Grupos</DialogTitle>
            <DialogDescription>Gerencie os grupos de módulos de prompts</DialogDescription>
          </DialogHeader>

          {/* Lista de grupos existentes */}
          <div className="space-y-2">
            {grupos.map(grupo => (
              <div key={grupo.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <span className="font-medium">{grupo.nome}</span>
                  {grupo.descricao && (
                    <p className="text-xs text-gray-500 mt-0.5">{grupo.descricao}</p>
                  )}
                </div>
                <Badge variant={grupo.ativo ? 'default' : 'secondary'}>
                  {grupo.ativo ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            ))}
          </div>

          {/* Formulário de novo grupo */}
          <div className="border-t pt-4 mt-4 space-y-3">
            <h4 className="font-medium text-sm">Novo Grupo</h4>
            <div>
              <Label htmlFor="novo-grupo-nome">Nome</Label>
              <Input
                id="novo-grupo-nome"
                value={novoGrupoNome}
                onChange={(e) => setNovoGrupoNome(e.target.value)}
                placeholder="Nome do grupo"
              />
            </div>
            <div>
              <Label htmlFor="novo-grupo-desc">Descrição (opcional)</Label>
              <Input
                id="novo-grupo-desc"
                value={novoGrupoDescricao}
                onChange={(e) => setNovoGrupoDescricao(e.target.value)}
                placeholder="Descrição do grupo"
              />
            </div>
            <Button onClick={criarGrupo} disabled={!novoGrupoNome.trim()} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Criar Grupo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
