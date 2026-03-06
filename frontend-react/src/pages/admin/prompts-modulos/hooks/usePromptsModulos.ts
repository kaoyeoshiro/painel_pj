import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type {
  PromptModulo,
  PromptGroup,
  PromptSubgroup,
  HistoricoVersao,
  Subcategoria,
  TipoPrompt,
  TipoFiltro,
  ModoFiltro,
  ModuloFormData,
} from '../types'

/**
 * Hook principal que orquestra todo o estado e logica da pagina
 * de modulos de prompts (CRUD, filtros, reordenacao, historico, import/export).
 */
export function usePromptsModulos() {
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

  // Estado de historico
  const [dialogHistorico, setDialogHistorico] = useState(false)
  const [moduloHistorico, setModuloHistorico] = useState<PromptModulo | null>(null)
  const [versoes, setVersoes] = useState<HistoricoVersao[]>([])
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Estado de import/export
  const [dialogImportar, setDialogImportar] = useState(false)
  const [importData, setImportData] = useState('')
  const [importando, setImportando] = useState(false)

  // Estado de gestao de grupos
  const [dialogGrupos, setDialogGrupos] = useState(false)
  const [novoGrupoNome, setNovoGrupoNome] = useState('')
  const [novoGrupoDescricao, setNovoGrupoDescricao] = useState('')

  // Estado de subcategorias (assuntos)
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])

  // Estado do formulario
  const [formData, setFormData] = useState<ModuloFormData>({
    titulo: '',
    nome: '',
    conteudo: '',
    categoria: '',
    group_id: null,
    subgroup_id: null,
    tags: '',
    tipo: 'conteudo',
    ordem: 0,
    ativo: true,
    modo_ativacao: 'llm',
    regra_deterministica: null,
    regra_texto_original: null,
    regra_deterministica_secundaria: null,
    regra_secundaria_texto_original: null,
    fallback_habilitado: false,
  })

  // ========== Effects ==========

  // Carregar grupos ao montar
  useEffect(() => {
    carregarGrupos()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Carrega apenas na montagem
  }, [])

  // Carregar modulos e dados dependentes quando grupo selecionado muda.
  // Aguarda selecao de grupo para evitar chamada desnecessaria sem group_id.
  useEffect(() => {
    if (grupoSelecionado !== null) {
      carregarModulos()
      carregarFilterSubgrupos(grupoSelecionado)
      carregarSubcategorias(grupoSelecionado)
    } else {
      setModulos([])
      setFilterSubgrupos([])
      setSubcategorias([])
      setLoading(false)
    }
    // Resetar filtros dependentes do grupo
    setSubgrupoFiltro(null)
    setCategoriaFiltro(null)
    setAssuntosFiltro([])
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Recarrega apenas quando grupo muda
  }, [grupoSelecionado])

  // Carregar subgrupos para o formulario quando grupo do form muda
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
        variant: 'destructive',
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
        variant: 'destructive',
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
      modo_ativacao: 'llm',
      regra_deterministica: null,
      regra_texto_original: null,
      regra_deterministica_secundaria: null,
      regra_secundaria_texto_original: null,
      fallback_habilitado: false,
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
      tags: (modulo.tags || []).join(', '),
      tipo: modulo.tipo,
      ordem: modulo.ordem,
      ativo: modulo.ativo,
      modo_ativacao: modulo.modo_ativacao,
      regra_deterministica: modulo.regra_deterministica || null,
      regra_texto_original: modulo.regra_texto_original || null,
      regra_deterministica_secundaria: modulo.regra_deterministica_secundaria || null,
      regra_secundaria_texto_original: modulo.regra_secundaria_texto_original || null,
      fallback_habilitado: modulo.fallback_habilitado || false,
    })
    setDialogAberto(true)
  }

  function abrirDialogExcluir(modulo: PromptModulo) {
    setModuloEditando(modulo)
    setDialogExclusao(true)
  }

  async function salvarModulo() {
    try {
      // Base (Prompt do Sistema) e Peca (Estrutura/Template) nao possuem modo de ativacao:
      // - Base ativa automaticamente por grupo
      // - Peca ativa via selecao manual do usuario no /gerador-pecas
      const tipoSemModoAtivacao = formData.tipo === 'base' || formData.tipo === 'peca'
      const incluirRegras = !tipoSemModoAtivacao && formData.modo_ativacao === 'deterministic'

      const payload = {
        ...formData,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.length > 0),
        // Nao enviar modo_ativacao para tipos que nao o utilizam
        modo_ativacao: tipoSemModoAtivacao ? undefined : formData.modo_ativacao,
        // Campos de regra: enviar apenas quando modo deterministic em tipo conteudo
        regra_deterministica: incluirRegras ? formData.regra_deterministica : undefined,
        regra_texto_original: incluirRegras ? formData.regra_texto_original : undefined,
        regra_deterministica_secundaria: incluirRegras ? formData.regra_deterministica_secundaria : undefined,
        regra_secundaria_texto_original: incluirRegras ? formData.regra_secundaria_texto_original : undefined,
        fallback_habilitado: incluirRegras ? formData.fallback_habilitado : false,
      }

      if (moduloEditando) {
        await adminApi.put(`/admin/api/prompts-modulos/${moduloEditando.id}`, payload)
        toast({
          title: 'Módulo atualizado',
          description: 'Alterações salvas com sucesso',
        })
      } else {
        await adminApi.post('/admin/api/prompts-modulos', payload)
        toast({
          title: 'Módulo criado',
          description: 'Novo módulo adicionado com sucesso',
        })
      }

      setDialogAberto(false)
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao salvar módulo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  async function excluirModulo() {
    if (!moduloEditando) return

    try {
      await adminApi.delete(`/admin/api/prompts-modulos/${moduloEditando.id}`)
      toast({
        title: 'Módulo excluído',
        description: 'Módulo removido com sucesso',
      })
      setDialogExclusao(false)
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao excluir módulo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  async function toggleAtivo(modulo: PromptModulo) {
    try {
      await adminApi.patch(`/admin/api/prompts-modulos/${modulo.id}/toggle`)
      toast({
        title: modulo.ativo ? 'Módulo desativado' : 'Módulo ativado',
        description: 'Status alterado com sucesso',
      })
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao alterar status',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  // ========== Reordenacao ==========

  function getModulosOrdenados(tipo: TipoPrompt, categoria?: string): PromptModulo[] {
    let lista = modulos.filter((m) => m.tipo === tipo)
    if (categoria) {
      lista = lista.filter((m) => (m.categoria || 'Sem categoria') === categoria)
    }
    return lista.sort((a, b) => a.ordem - b.ordem)
  }

  async function moverModulo(modulo: PromptModulo, direcao: 'up' | 'down') {
    const categoria = modulo.tipo === 'conteudo' ? modulo.categoria || 'Sem categoria' : undefined
    const ordenados = getModulosOrdenados(modulo.tipo, categoria)
    const idx = ordenados.findIndex((m) => m.id === modulo.id)
    if (idx < 0) return

    const targetIdx = direcao === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= ordenados.length) return

    const outro = ordenados[targetIdx]

    const ordemA = modulo.ordem
    const ordemB = outro.ordem
    const novaOrdemA = ordemA === ordemB ? (direcao === 'up' ? ordemB - 1 : ordemB + 1) : ordemB
    const novaOrdemB = ordemA === ordemB ? ordemA : ordemA

    setModulos((prev) =>
      prev.map((m) => {
        if (m.id === modulo.id) return { ...m, ordem: novaOrdemA }
        if (m.id === outro.id) return { ...m, ordem: novaOrdemB }
        return m
      })
    )

    try {
      await adminApi.post('/admin/api/prompts-modulos/prompts/reordenar', {
        prompts: [
          { id: modulo.id, ordem: novaOrdemA },
          { id: outro.id, ordem: novaOrdemB },
        ],
      })
    } catch (error) {
      toast({
        title: 'Erro ao reordenar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
      carregarModulos()
    }
  }

  function handleMoveUp(modulo: PromptModulo) {
    moverModulo(modulo, 'up')
  }

  function handleMoveDown(modulo: PromptModulo) {
    moverModulo(modulo, 'down')
  }

  async function handleDragReorder(items: { id: number; ordem: number }[]) {
    setModulos((prev) => {
      const updated = [...prev]
      for (const item of items) {
        const idx = updated.findIndex((m) => m.id === item.id)
        if (idx >= 0) updated[idx] = { ...updated[idx], ordem: item.ordem }
      }
      return updated
    })

    try {
      await adminApi.post('/admin/api/prompts-modulos/prompts/reordenar', {
        prompts: items,
      })
    } catch (error) {
      toast({
        title: 'Erro ao reordenar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
      carregarModulos()
    }
  }

  // ========== Historico ==========

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
        variant: 'destructive',
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
        description: `Módulo restaurado para a versão ${versao}`,
      })
      setDialogHistorico(false)
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao restaurar versão',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  // ========== Import/Export ==========

  async function exportarTodos() {
    if (grupoSelecionado === null) {
      toast({ title: 'Selecione um grupo', description: 'Escolha um grupo antes de exportar', variant: 'destructive' })
      return
    }
    try {
      const params = new URLSearchParams({ group_id: grupoSelecionado.toString() })
      const data = await adminApi.get<unknown>(`/admin/api/prompts-modulos/exportar/todos?${params}`)
      const grupoNome = grupos.find(g => g.id === grupoSelecionado)?.slug || 'grupo'
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `prompts-modulos-${grupoNome}-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast({
        title: 'Exportação concluída',
        description: 'Arquivo JSON baixado com sucesso',
      })
    } catch (error) {
      toast({
        title: 'Erro ao exportar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  async function importarModulos(sobrescrever: boolean = false, desativarAusentes: boolean = false) {
    if (!importData.trim()) return
    if (grupoSelecionado === null) {
      toast({ title: 'Selecione um grupo', description: 'Escolha um grupo antes de importar', variant: 'destructive' })
      return
    }
    setImportando(true)
    try {
      const parsed = JSON.parse(importData)
      parsed.sobrescrever_existentes = sobrescrever
      parsed.desativar_ausentes_do_grupo = desativarAusentes
      parsed.group_id = grupoSelecionado
      await adminApi.post('/admin/api/prompts-modulos/importar', parsed)
      toast({
        title: 'Importação concluída',
        description: 'Módulos importados com sucesso',
      })
      setDialogImportar(false)
      setImportData('')
      carregarGrupos()
      carregarModulos()
    } catch (error) {
      toast({
        title: 'Erro ao importar',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setImportando(false)
    }
  }


  // ========== Gestao de Grupos ==========

  async function criarGrupo() {
    if (!novoGrupoNome.trim()) return
    try {
      const nome = novoGrupoNome.trim()
      // Auto-generate slug from name
      const slug = nome
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-z0-9]+/g, '-')     // Replace non-alphanumeric with hyphens
        .replace(/^-|-$/g, '')            // Trim leading/trailing hyphens

      await adminApi.post('/admin/api/prompts-modulos/grupos', {
        nome,
        slug,
        ordem: grupos.length + 1,
        ativo: true,
      })
      toast({
        title: 'Grupo criado',
        description: `Grupo "${nome}" criado com sucesso`,
      })
      setNovoGrupoNome('')
      setNovoGrupoDescricao('')
      carregarGrupos()
    } catch (error) {
      toast({
        title: 'Erro ao criar grupo',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  // ========== Filtragem ==========

  const modulosFiltrados = modulos.filter((modulo) => {
    if (busca) {
      const buscaLower = busca.toLowerCase()
      if (
        !modulo.titulo.toLowerCase().includes(buscaLower) &&
        !modulo.conteudo.toLowerCase().includes(buscaLower) &&
        !(modulo.nome || '').toLowerCase().includes(buscaLower)
      ) {
        return false
      }
    }
    if (tipoFiltro && modulo.tipo !== tipoFiltro) return false
    if (modoFiltro) {
      const modoEfetivo = modulo.effective_activation_mode || modulo.modo_ativacao
      if (modoEfetivo !== modoFiltro) return false
    }
    if (apenasAtivos && !modulo.ativo) return false
    if (subgrupoFiltro !== null && modulo.subgroup_id !== subgrupoFiltro) return false
    if (categoriaFiltro && modulo.categoria !== categoriaFiltro) return false
    if (assuntosFiltro.length > 0) {
      const ids = modulo.subcategoria_ids || []
      if (!ids.some((id) => assuntosFiltro.includes(id))) return false
    }
    return true
  })

  // Separar modulos por tipo
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

  // Para conteudo: agrupar por categoria
  const conteudoPorCategoria = modulosPorTipo.conteudo.reduce(
    (acc, modulo) => {
      const cat = modulo.categoria || 'Sem categoria'
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(modulo)
      return acc
    },
    {} as Record<string, PromptModulo[]>
  )
  const categoriasConteudo = Object.keys(conteudoPorCategoria).sort()

  // Subcategorias unicas por lista de modulos (para cabecalho)
  function getSubcategoriasUnicas(mods: PromptModulo[]): string[] {
    const nomes = new Set<string>()
    for (const m of mods) {
      if (m.subcategorias_nomes) {
        for (const n of m.subcategorias_nomes) nomes.add(n)
      }
    }
    return Array.from(nomes).sort()
  }

  // Categorias unicas de todos os modulos (para o filtro de categoria)
  const categoriasDisponiveis = Array.from(
    new Set(modulos.map((m) => m.categoria).filter(Boolean))
  ).sort()

  // Contagem total filtrada
  const totalFiltrados = modulosFiltrados.length
  const temResultados = totalFiltrados > 0

  // Algum filtro ativo?
  const filtrosAtivos = !!(
    busca ||
    tipoFiltro ||
    modoFiltro ||
    subgrupoFiltro !== null ||
    categoriaFiltro ||
    assuntosFiltro.length > 0 ||
    !apenasAtivos
  )

  function limparFiltros() {
    setBusca('')
    setTipoFiltro(null)
    setModoFiltro(null)
    setSubgrupoFiltro(null)
    setCategoriaFiltro(null)
    setAssuntosFiltro([])
    setApenasAtivos(true)
  }

  return {
    // Dados
    modulos,
    grupos,
    formSubgrupos,
    filterSubgrupos,
    subcategorias,
    loading,

    // Filtros
    grupoSelecionado,
    setGrupoSelecionado,
    busca,
    setBusca,
    tipoFiltro,
    setTipoFiltro,
    modoFiltro,
    setModoFiltro,
    apenasAtivos,
    setApenasAtivos,
    subgrupoFiltro,
    setSubgrupoFiltro,
    categoriaFiltro,
    setCategoriaFiltro,
    assuntosFiltro,
    setAssuntosFiltro,
    filtrosAtivos,
    limparFiltros,

    // Dados derivados
    modulosPorTipo,
    conteudoPorCategoria,
    categoriasConteudo,
    categoriasDisponiveis,
    temResultados,
    getSubcategoriasUnicas,

    // Dialog de criacao/edicao
    dialogAberto,
    setDialogAberto,
    moduloEditando,
    formData,
    setFormData,
    abrirDialogNovo,
    abrirDialogEditar,
    salvarModulo,

    // Dialog de exclusao
    dialogExclusao,
    setDialogExclusao,
    abrirDialogExcluir,
    excluirModulo,

    // Toggle ativo
    toggleAtivo,

    // Reordenacao
    handleMoveUp,
    handleMoveDown,
    handleDragReorder,

    // Historico
    dialogHistorico,
    setDialogHistorico,
    moduloHistorico,
    versoes,
    loadingHistorico,
    abrirHistorico,
    restaurarVersao,

    // Import/export
    dialogImportar,
    setDialogImportar,
    importData,
    setImportData,
    importando,
    exportarTodos,
    importarModulos,

    // Gestao de grupos
    dialogGrupos,
    setDialogGrupos,
    novoGrupoNome,
    setNovoGrupoNome,
    novoGrupoDescricao,
    setNovoGrupoDescricao,
    criarGrupo,
  }
}
