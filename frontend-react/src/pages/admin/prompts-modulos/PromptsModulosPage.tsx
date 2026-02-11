import { useState, useEffect, useRef } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { PageContainer, PageHeader, SectionCard, AdminSubNav } from '@/components/layout'
import {
  ChevronDown, ChevronRight, Edit2, Trash2, ToggleLeft, ToggleRight,
  Plus, Search, Download, Upload, History, Settings, RotateCcw,
  FileText, Lightbulb, X,
} from 'lucide-react'

// ---- Interfaces ----

interface PromptModulo {
  id: number
  titulo: string
  nome: string
  conteudo: string
  categoria: string
  subcategoria: string | null
  subcategoria_ids?: number[]
  subcategorias_nomes?: string[]
  group_id: number | null
  subgroup_id: number | null
  tags: string[]
  tipo: 'base' | 'peca' | 'conteudo'
  ordem: number
  ativo: boolean
  modo_ativacao: 'llm' | 'deterministic'
  effective_activation_mode?: string
  versao: number
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

type TipoPrompt = 'base' | 'peca' | 'conteudo'
type TipoFiltro = TipoPrompt | null
type ModoFiltro = 'llm' | 'deterministic' | null

// ---- Configuração visual por tipo (alinhado ao legado) ----

const TIPO_CONFIG: Record<TipoPrompt, {
  label: string
  Icon: typeof Settings
  bgHeader: string
  borderHeader: string
  iconBg: string
  iconColor: string
  titleColor: string
  countBg: string
  countColor: string
  badgeBg: string
  badgeColor: string
}> = {
  base: {
    label: 'Base (Prompt do Sistema)',
    Icon: Settings,
    bgHeader: 'bg-indigo-50',
    borderHeader: 'border-indigo-100',
    iconBg: 'bg-indigo-100',
    iconColor: 'text-indigo-600',
    titleColor: 'text-indigo-900',
    countBg: 'bg-indigo-200',
    countColor: 'text-indigo-700',
    badgeBg: 'bg-indigo-100',
    badgeColor: 'text-indigo-700',
  },
  peca: {
    label: 'Peças (Estrutura/Template)',
    Icon: FileText,
    bgHeader: 'bg-green-50',
    borderHeader: 'border-green-100',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600',
    titleColor: 'text-green-900',
    countBg: 'bg-green-200',
    countColor: 'text-green-700',
    badgeBg: 'bg-green-100',
    badgeColor: 'text-green-700',
  },
  conteudo: {
    label: 'Conteúdo (Teses e Argumentos)',
    Icon: Lightbulb,
    bgHeader: 'bg-orange-50',
    borderHeader: 'border-orange-100',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600',
    titleColor: 'text-orange-900',
    countBg: 'bg-orange-200',
    countColor: 'text-orange-700',
    badgeBg: 'bg-orange-100',
    badgeColor: 'text-orange-700',
  },
}

const TIPO_ORDER: TipoPrompt[] = ['base', 'peca', 'conteudo']

function getTipoLabel(tipo: string) {
  switch (tipo) {
    case 'base': return 'Base'
    case 'peca': return 'Peça'
    case 'conteudo': return 'Conteúdo'
    default: return tipo
  }
}

function getModoBadge(modo: string) {
  if (modo === 'deterministic') {
    return { label: 'Regra', className: 'bg-amber-100 text-amber-700' }
  }
  return { label: 'LLM', className: 'bg-blue-100 text-blue-700' }
}

// ---- Componente de item de módulo ----

interface ModuloItemProps {
  modulo: PromptModulo
  showCategoria?: boolean
  showSubcategoria?: boolean
  showModoBadge?: boolean
  onEdit: (m: PromptModulo) => void
  onDelete: (m: PromptModulo) => void
  onToggle: (m: PromptModulo) => void
  onHistory: (m: PromptModulo) => void
}

function ModuloItem({ modulo, showCategoria, showSubcategoria = true, showModoBadge = true, onEdit, onDelete, onToggle, onHistory }: ModuloItemProps) {
  const modoEfetivo = modulo.effective_activation_mode || modulo.modo_ativacao
  const modo = getModoBadge(modoEfetivo)

  return (
    <li
      className={`flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
        !modulo.ativo ? 'opacity-50' : ''
      }`}
    >
      {/* Conteúdo principal */}
      <div className="flex-1 min-w-0">
        {/* Linha 1: Título + badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-800">{modulo.titulo}</span>

          {/* Badge de subcategoria (campo texto) */}
          {showSubcategoria && modulo.subcategoria && (
            <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
              {modulo.subcategoria}
            </span>
          )}

          {/* Badge de status */}
          {modulo.ativo ? (
            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Ativo</span>
          ) : (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">Inativo</span>
          )}

          {/* Badge de modo de ativação */}
          {showModoBadge && (
            <span className={`px-2 py-0.5 text-xs rounded-full ${modo.className}`}>
              {modo.label}
            </span>
          )}

          {/* Badge de categoria (para base/peca) */}
          {showCategoria && modulo.categoria && (
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              {modulo.categoria}
            </span>
          )}

          {/* Versão */}
          <span className="text-xs text-gray-400">v{modulo.versao}</span>
        </div>

        {/* Linha 2: Código (nome) + subcategorias M2M */}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          {modulo.nome && (
            <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-600">
              {modulo.nome}
            </code>
          )}
          {modulo.subcategorias_nomes && modulo.subcategorias_nomes.length > 0 && (
            <>
              {modulo.subcategorias_nomes.map((nome, i) => (
                <span key={i} className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-600 rounded-full">
                  {nome}
                </span>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
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
          <Edit2 className="h-4 w-4 text-blue-600" />
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
  )
}

// ---- Seção de tipo simples (Base e Peça) ----

interface TipoSectionProps {
  tipo: TipoPrompt
  modulos: PromptModulo[]
  onEdit: (m: PromptModulo) => void
  onDelete: (m: PromptModulo) => void
  onToggle: (m: PromptModulo) => void
  onHistory: (m: PromptModulo) => void
}

function TipoSection({ tipo, modulos, onEdit, onDelete, onToggle, onHistory }: TipoSectionProps) {
  const config = TIPO_CONFIG[tipo]
  const { Icon } = config

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header do tipo */}
      <div className={`flex items-center gap-3 px-4 py-3 ${config.bgHeader} border-b ${config.borderHeader}`}>
        <div className={`flex items-center justify-center w-8 h-8 ${config.iconBg} rounded-lg`}>
          <Icon className={`h-4 w-4 ${config.iconColor}`} />
        </div>
        <h3 className={`font-semibold ${config.titleColor}`}>{config.label}</h3>
        <span className={`ml-auto text-xs ${config.countBg} ${config.countColor} px-2 py-0.5 rounded-full font-medium`}>
          {modulos.length}
        </span>
      </div>

      {/* Lista de módulos */}
      <ul className="divide-y divide-gray-100">
        {modulos
          .sort((a, b) => a.ordem - b.ordem)
          .map((modulo) => (
            <ModuloItem
              key={modulo.id}
              modulo={modulo}
              showCategoria={true}
              showSubcategoria={true}
              showModoBadge={false}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
              onHistory={onHistory}
            />
          ))}
      </ul>
    </div>
  )
}

// ---- Seção de Conteúdo com categorias colapsáveis ----

interface CategoriaGroupProps {
  categoria: string
  modulos: PromptModulo[]
  subcategoriasNomes: string[]
  onEdit: (m: PromptModulo) => void
  onDelete: (m: PromptModulo) => void
  onToggle: (m: PromptModulo) => void
  onHistory: (m: PromptModulo) => void
}

function CategoriaGroup({ categoria, modulos, subcategoriasNomes, onEdit, onDelete, onToggle, onHistory }: CategoriaGroupProps) {
  const [aberto, setAberto] = useState(true)

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
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
        <span className="font-semibold text-gray-800">=== {categoria} ===</span>
        <Badge variant="secondary" className="text-xs">
          {modulos.length} módulo{modulos.length !== 1 ? 's' : ''}
        </Badge>
        {/* Subcategorias únicas como tags no cabeçalho */}
        {subcategoriasNomes.length > 0 && (
          <div className="flex items-center gap-1 ml-2 flex-wrap">
            {subcategoriasNomes.map((nome, i) => (
              <span key={i} className="px-1.5 py-0.5 text-[10px] bg-purple-50 text-purple-600 rounded-full">
                {nome}
              </span>
            ))}
          </div>
        )}
      </button>

      {/* Lista de módulos */}
      {aberto && (
        <ul className="divide-y divide-gray-100">
          {modulos
            .sort((a, b) => a.ordem - b.ordem)
            .map((modulo) => (
              <ModuloItem
                key={modulo.id}
                modulo={modulo}
                showCategoria={false}
                showSubcategoria={true}
                showModoBadge={true}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggle={onToggle}
                onHistory={onHistory}
              />
            ))}
        </ul>
      )}
    </div>
  )
}

// ---- Multi-select de Assuntos ----

interface AssuntoMultiSelectProps {
  subcategorias: Subcategoria[]
  selected: number[]
  onChange: (ids: number[]) => void
}

function AssuntoMultiSelect({ subcategorias, selected, onChange }: AssuntoMultiSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = subcategorias.filter(s =>
    s.nome.toLowerCase().includes(search.toLowerCase())
  )

  function toggle(id: number) {
    if (selected.includes(id)) {
      onChange(selected.filter(x => x !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-[170px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-left flex items-center justify-between"
      >
        <span className="truncate">
          {selected.length > 0
            ? `${selected.length} assunto(s)`
            : 'Todos os assuntos'}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* Busca */}
          <div className="p-2 border-b">
            <Input
              placeholder="Buscar assunto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Ações rápidas */}
          {selected.length > 0 && (
            <div className="px-2 py-1.5 border-b">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Limpar seleção
              </button>
            </div>
          )}

          {/* Lista */}
          <div className="overflow-y-auto max-h-44">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">Nenhum assunto encontrado</div>
            ) : (
              filtered.map(s => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    className="rounded text-blue-600"
                  />
                  <span className="truncate">{s.nome}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Componente principal
// ============================================================

export function PromptsModulosPage() {
  const { toast } = useToast()

  // Estado de dados
  const [modulos, setModulos] = useState<PromptModulo[]>([])
  const [grupos, setGrupos] = useState<PromptGroup[]>([])
  const [formSubgrupos, setFormSubgrupos] = useState<PromptSubgroup[]>([])
  const [filterSubgrupos, setFilterSubgrupos] = useState<PromptSubgroup[]>([])
  const [loading, setLoading] = useState(true)

  // Estado de filtros
  const [grupoSelecionado, setGrupoSelecionado] = useState<number | null>(null)
  const [busca, setBusca] = useState('')
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>(null)
  const [modoFiltro, setModoFiltro] = useState<ModoFiltro>(null)
  const [apenasAtivos, setApenasAtivos] = useState(true)
  const [subgrupoFiltro, setSubgrupoFiltro] = useState<number | null>(null)
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null)
  const [assuntosFiltro, setAssuntosFiltro] = useState<number[]>([])

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

  // Estado de subcategorias (assuntos)
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])

  // Ref para input de arquivo (importação)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Estado do formulário
  const [formData, setFormData] = useState({
    titulo: '',
    nome: '',
    conteudo: '',
    categoria: '',
    group_id: null as number | null,
    subgroup_id: null as number | null,
    tags: '',
    tipo: 'conteudo' as TipoPrompt,
    ordem: 0,
    ativo: true,
    modo_ativacao: 'llm' as 'llm' | 'deterministic'
  })

  // ========== Effects ==========

  // Carregar grupos ao montar
  useEffect(() => {
    carregarGrupos()
  }, [])

  // Carregar módulos e dados dependentes quando grupo selecionado muda
  useEffect(() => {
    carregarModulos()
    if (grupoSelecionado !== null) {
      carregarFilterSubgrupos(grupoSelecionado)
      carregarSubcategorias(grupoSelecionado)
    } else {
      setFilterSubgrupos([])
      setSubcategorias([])
    }
    // Resetar filtros dependentes do grupo
    setSubgrupoFiltro(null)
    setCategoriaFiltro(null)
    setAssuntosFiltro([])
  }, [grupoSelecionado])

  // Carregar subgrupos para o formulário quando grupo do form muda
  useEffect(() => {
    if (formData.group_id) {
      carregarFormSubgrupos(formData.group_id)
    } else {
      setFormSubgrupos([])
    }
  }, [formData.group_id])

  // ========== API functions ==========

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
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (grupoSelecionado !== null) {
        params.set('group_id', grupoSelecionado.toString())
      }
      params.set('apenas_ativos', 'false')
      const data = await adminApi.get<PromptModulo[]>(
        `/admin/api/prompts-modulos?${params.toString()}`
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

  async function carregarFilterSubgrupos(groupId: number) {
    try {
      const data = await adminApi.get<PromptSubgroup[]>(
        `/admin/api/prompts-modulos/grupos/${groupId}/subgrupos`
      )
      setFilterSubgrupos(data)
    } catch {
      setFilterSubgrupos([])
    }
  }

  async function carregarFormSubgrupos(groupId: number) {
    try {
      const data = await adminApi.get<PromptSubgroup[]>(
        `/admin/api/prompts-modulos/grupos/${groupId}/subgrupos`
      )
      setFormSubgrupos(data)
    } catch {
      setFormSubgrupos([])
    }
  }

  async function carregarSubcategorias(groupId: number) {
    try {
      const data = await adminApi.get<Subcategoria[]>(
        `/admin/api/prompts-modulos/grupos/${groupId}/subcategorias`
      )
      setSubcategorias(data)
    } catch {
      setSubcategorias([])
    }
  }

  // ========== CRUD ==========

  function abrirDialogNovo() {
    setModuloEditando(null)
    setFormData({
      titulo: '',
      nome: '',
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
      nome: modulo.nome || '',
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

  // ========== Filtragem ==========

  const modulosFiltrados = modulos.filter(modulo => {
    // Busca por título ou conteúdo
    if (busca) {
      const buscaLower = busca.toLowerCase()
      if (!modulo.titulo.toLowerCase().includes(buscaLower) &&
          !modulo.conteudo.toLowerCase().includes(buscaLower) &&
          !(modulo.nome || '').toLowerCase().includes(buscaLower)) {
        return false
      }
    }

    // Filtro de tipo
    if (tipoFiltro && modulo.tipo !== tipoFiltro) {
      return false
    }

    // Filtro de modo de ativação
    if (modoFiltro) {
      const modoEfetivo = modulo.effective_activation_mode || modulo.modo_ativacao
      if (modoEfetivo !== modoFiltro) {
        return false
      }
    }

    // Filtro de status (apenas ativos)
    if (apenasAtivos && !modulo.ativo) {
      return false
    }

    // Filtro de subgrupo
    if (subgrupoFiltro !== null && modulo.subgroup_id !== subgrupoFiltro) {
      return false
    }

    // Filtro de categoria
    if (categoriaFiltro && modulo.categoria !== categoriaFiltro) {
      return false
    }

    // Filtro de assuntos (subcategorias M2M)
    if (assuntosFiltro.length > 0) {
      const ids = modulo.subcategoria_ids || []
      if (!ids.some(id => assuntosFiltro.includes(id))) {
        return false
      }
    }

    return true
  })

  // Separar módulos por tipo
  const modulosPorTipo: Record<TipoPrompt, PromptModulo[]> = {
    base: [],
    peca: [],
    conteudo: [],
  }
  for (const m of modulosFiltrados) {
    if (m.tipo in modulosPorTipo) {
      modulosPorTipo[m.tipo].push(m)
    }
  }

  // Para conteúdo: agrupar por categoria
  const conteudoPorCategoria = modulosPorTipo.conteudo.reduce((acc, modulo) => {
    const cat = modulo.categoria || 'Sem categoria'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(modulo)
    return acc
  }, {} as Record<string, PromptModulo[]>)
  const categoriasConteudo = Object.keys(conteudoPorCategoria).sort()

  // Extrair subcategorias únicas por categoria (para cabeçalho)
  function getSubcategoriasUnicas(modulos: PromptModulo[]): string[] {
    const nomes = new Set<string>()
    for (const m of modulos) {
      if (m.subcategorias_nomes) {
        for (const n of m.subcategorias_nomes) nomes.add(n)
      }
    }
    return Array.from(nomes).sort()
  }

  // Categorias únicas de todos os módulos (para o filtro de categoria)
  const categoriasDisponiveis = Array.from(
    new Set(modulos.map(m => m.categoria).filter(Boolean))
  ).sort()

  // Contagem total filtrada
  const totalFiltrados = modulosFiltrados.length
  const temResultados = totalFiltrados > 0

  // Algum filtro ativo?
  const filtrosAtivos = !!(busca || tipoFiltro || modoFiltro || subgrupoFiltro !== null || categoriaFiltro || assuntosFiltro.length > 0 || !apenasAtivos)

  const conteudoConfig = TIPO_CONFIG.conteudo

  // ========== Render ==========

  return (
    <PageContainer wide className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Módulos de Prompts"
        description={`${totalFiltrados} módulo(s) encontrado(s)`}
        backTo="/dashboard"
        icon={<Lightbulb className="h-5 w-5" />}
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

      <AdminSubNav />

      {/* Filtros */}
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

          {/* Tipo de prompt */}
          <select
            className="flex-shrink-0 w-[150px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            value={tipoFiltro || ''}
            onChange={(e) => setTipoFiltro((e.target.value || null) as TipoFiltro)}
          >
            <option value="">Todos os tipos</option>
            <option value="base">Base (Sistema)</option>
            <option value="peca">Peça</option>
            <option value="conteudo">Conteúdo</option>
          </select>

          {/* Modo de ativação */}
          <select
            className="flex-shrink-0 w-[170px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            value={modoFiltro || ''}
            onChange={(e) => setModoFiltro((e.target.value || null) as ModoFiltro)}
          >
            <option value="">Tipo de Ativação</option>
            <option value="llm">LLM</option>
            <option value="deterministic">Regra Determinística</option>
          </select>

          {/* Grupo */}
          <select
            className="flex-shrink-0 w-[160px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
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

          {/* Subgrupo */}
          <select
            className="flex-shrink-0 w-[160px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-50"
            value={subgrupoFiltro?.toString() || ''}
            onChange={(e) => setSubgrupoFiltro(e.target.value ? Number(e.target.value) : null)}
            disabled={grupoSelecionado === null || filterSubgrupos.length === 0}
          >
            <option value="">Todos os subgrupos</option>
            {filterSubgrupos.map(sg => (
              <option key={sg.id} value={sg.id}>
                {sg.nome}
              </option>
            ))}
          </select>

          {/* Categoria */}
          <select
            className="flex-shrink-0 w-[160px] px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white disabled:opacity-50"
            value={categoriaFiltro || ''}
            onChange={(e) => setCategoriaFiltro(e.target.value || null)}
            disabled={categoriasDisponiveis.length === 0}
          >
            <option value="">Todas as categorias</option>
            {categoriasDisponiveis.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Assuntos (multi-select) */}
          {subcategorias.length > 0 && (
            <AssuntoMultiSelect
              subcategorias={subcategorias}
              selected={assuntosFiltro}
              onChange={setAssuntosFiltro}
            />
          )}

          {/* Apenas ativos */}
          <label className="flex-shrink-0 flex items-center gap-2 text-sm text-gray-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={apenasAtivos}
              onChange={(e) => setApenasAtivos(e.target.checked)}
              className="rounded text-primary-600"
            />
            Apenas ativos
          </label>

          {/* Limpar filtros */}
          {filtrosAtivos && (
            <button
              type="button"
              onClick={() => {
                setBusca('')
                setTipoFiltro(null)
                setModoFiltro(null)
                setSubgrupoFiltro(null)
                setCategoriaFiltro(null)
                setAssuntosFiltro([])
                setApenasAtivos(true)
              }}
              className="flex-shrink-0 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100"
              title="Limpar todos os filtros"
            >
              <X className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>
      </SectionCard>

      {/* Lista de módulos organizada por tipo */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando módulos...</div>
      ) : !temResultados ? (
        <div className="text-center py-12 text-gray-400">Nenhum módulo encontrado</div>
      ) : (
        <div className="space-y-6">
          {/* ---- Base (Prompt do Sistema) ---- */}
          {modulosPorTipo.base.length > 0 && (
            <TipoSection
              tipo="base"
              modulos={modulosPorTipo.base}
              onEdit={abrirDialogEditar}
              onDelete={abrirDialogExcluir}
              onToggle={toggleAtivo}
              onHistory={abrirHistorico}
            />
          )}

          {/* ---- Peças (Estrutura/Template) ---- */}
          {modulosPorTipo.peca.length > 0 && (
            <TipoSection
              tipo="peca"
              modulos={modulosPorTipo.peca}
              onEdit={abrirDialogEditar}
              onDelete={abrirDialogExcluir}
              onToggle={toggleAtivo}
              onHistory={abrirHistorico}
            />
          )}

          {/* ---- Conteúdo (Teses e Argumentos) ---- */}
          {modulosPorTipo.conteudo.length > 0 && (
            <div>
              {/* Header do tipo Conteúdo */}
              <div className={`flex items-center gap-3 px-4 py-3 ${conteudoConfig.bgHeader} rounded-t-xl border border-b-0 ${conteudoConfig.borderHeader}`}>
                <div className={`flex items-center justify-center w-8 h-8 ${conteudoConfig.iconBg} rounded-lg`}>
                  <Lightbulb className={`h-4 w-4 ${conteudoConfig.iconColor}`} />
                </div>
                <h3 className={`font-semibold ${conteudoConfig.titleColor}`}>{conteudoConfig.label}</h3>
                <span className={`text-xs ${conteudoConfig.countBg} ${conteudoConfig.countColor} px-2 py-0.5 rounded-full font-medium`}>
                  {modulosPorTipo.conteudo.length}
                </span>
              </div>

              {/* Categorias colapsáveis */}
              <div className="space-y-3 mt-3">
                {categoriasConteudo.map(categoria => (
                  <CategoriaGroup
                    key={categoria}
                    categoria={categoria}
                    modulos={conteudoPorCategoria[categoria]}
                    subcategoriasNomes={getSubcategoriasUnicas(conteudoPorCategoria[categoria])}
                    onEdit={abrirDialogEditar}
                    onDelete={abrirDialogExcluir}
                    onToggle={toggleAtivo}
                    onHistory={abrirHistorico}
                  />
                ))}
              </div>
            </div>
          )}
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

              {/* Nome (código) */}
              <div>
                <Label htmlFor="nome">Nome (código identificador)</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  placeholder="ex: argumento_prescricao"
                  className="font-mono"
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

              {/* Tipo */}
              <div>
                <Label htmlFor="tipo">Tipo</Label>
                <select
                  id="tipo"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  value={formData.tipo}
                  onChange={(e) => setFormData({
                    ...formData,
                    tipo: e.target.value as TipoPrompt
                  })}
                >
                  <option value="base">Base (Sistema)</option>
                  <option value="peca">Peça (Estrutura/Template)</option>
                  <option value="conteudo">Conteúdo (Teses e Argumentos)</option>
                </select>
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
                  {formSubgrupos.map(subgrupo => (
                    <option key={subgrupo.id} value={subgrupo.id}>
                      {subgrupo.nome}
                    </option>
                  ))}
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
                  <option value="deterministic">Regra Determinística</option>
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
