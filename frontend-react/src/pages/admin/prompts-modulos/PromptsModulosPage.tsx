import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { AdminSubNav } from '@/components/layout'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import { Link } from '@tanstack/react-router'
import {
  Plus, Search, Download, Upload, Settings, FileJson,
  X, Zap, Lightbulb,
} from 'lucide-react'

import { usePromptsModulos } from './hooks/usePromptsModulos'
import { TipoSection, CategoriaGroup, TIPO_CONFIG } from './components/TipoSection'
import { AssuntoMultiSelect } from './components/AssuntoMultiSelect'
import {
  ModuloFormDialog,
  DeleteDialog,
  HistoricoDialog,
  ImportDialog,
  GruposDialog,
} from './components/ModuloDialogs'

import type { TipoFiltro, ModoFiltro } from './types'

// ============================================================
// Componente principal — composicao fina usando hook e subcomponentes
// ============================================================

export function PromptsModulosPage() {
  const vm = usePromptsModulos()

  const conteudoConfig = TIPO_CONFIG.conteudo

  return (
    <>
      <BreadcrumbBar
        title="Modulos de Prompts"
        icon={<FileJson className="w-3.5 h-3.5" />}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/admin/teste-ativacao">
              <Button variant="outline" size="sm" className="gap-1.5" style={{ borderColor: C.orange400, color: C.orange600 }}>
                <Zap className="h-4 w-4" />
                Testar Ativacao
              </Button>
            </Link>
            <Button variant="outline" size="sm" onClick={() => vm.setDialogGrupos(true)} className="gap-1.5">
              <Settings className="h-4 w-4" />
              Grupos
            </Button>
            <Button variant="outline" size="sm" onClick={vm.exportarTodos} className="gap-1.5">
              <Download className="h-4 w-4" />
              Exportar
            </Button>
            <Button variant="outline" size="sm" onClick={() => vm.setDialogImportar(true)} className="gap-1.5">
              <Upload className="h-4 w-4" />
              Importar
            </Button>
            <Button onClick={vm.abrirDialogNovo} disabled={vm.grupoSelecionado === null} className="gap-1.5" style={{ background: C.navy950, color: 'white' }}>
              <Plus className="h-4 w-4" />
              Novo Modulo
            </Button>
          </div>
        }
      />

      <ContentArea className="space-y-6">
      <AdminSubNav />

      {/* Filtros */}
      <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: `1px solid ${C.gray200}` }}>
        <div className="flex flex-wrap gap-3 items-center">
          {/* Busca */}
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: C.text400 }} />
            <Input
              placeholder="Buscar por título ou conteúdo..."
              value={vm.busca}
              onChange={(e) => vm.setBusca(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Tipo de prompt */}
          <select
            className="flex-shrink-0 w-[150px] px-3 py-2 rounded-lg text-sm bg-white"
            style={{ border: `1px solid ${C.gray300}` }}
            value={vm.tipoFiltro || ''}
            onChange={(e) => vm.setTipoFiltro((e.target.value || null) as TipoFiltro)}
          >
            <option value="">Todos os tipos</option>
            <option value="base">Base (Sistema)</option>
            <option value="peca">Peça</option>
            <option value="conteudo">Conteúdo</option>
          </select>

          {/* Modo de ativacao */}
          <select
            className="flex-shrink-0 w-[170px] px-3 py-2 rounded-lg text-sm bg-white"
            style={{ border: `1px solid ${C.gray300}` }}
            value={vm.modoFiltro || ''}
            onChange={(e) => vm.setModoFiltro((e.target.value || null) as ModoFiltro)}
          >
            <option value="">Tipo de Ativação</option>
            <option value="llm">LLM</option>
            <option value="deterministic">Regra Determinística</option>
          </select>

          {/* Grupo */}
          <select
            className="flex-shrink-0 w-[160px] px-3 py-2 rounded-lg text-sm bg-white"
            style={{ border: `1px solid ${C.gray300}` }}
            value={vm.grupoSelecionado?.toString() || ''}
            onChange={(e) => vm.setGrupoSelecionado(e.target.value ? Number(e.target.value) : null)}
          >
            <option value="">Todos os grupos</option>
            {vm.grupos.map(grupo => (
              <option key={grupo.id} value={grupo.id}>
                {grupo.nome}
              </option>
            ))}
          </select>

          {/* Subgrupo */}
          <select
            className="flex-shrink-0 w-[160px] px-3 py-2 rounded-lg text-sm bg-white disabled:opacity-50"
            style={{ border: `1px solid ${C.gray300}` }}
            value={vm.subgrupoFiltro?.toString() || ''}
            onChange={(e) => vm.setSubgrupoFiltro(e.target.value ? Number(e.target.value) : null)}
            disabled={vm.grupoSelecionado === null || vm.filterSubgrupos.length === 0}
          >
            <option value="">Todos os subgrupos</option>
            {vm.filterSubgrupos.map(sg => (
              <option key={sg.id} value={sg.id}>
                {sg.nome}
              </option>
            ))}
          </select>

          {/* Categoria */}
          <select
            className="flex-shrink-0 w-[160px] px-3 py-2 rounded-lg text-sm bg-white disabled:opacity-50"
            style={{ border: `1px solid ${C.gray300}` }}
            value={vm.categoriaFiltro || ''}
            onChange={(e) => vm.setCategoriaFiltro(e.target.value || null)}
            disabled={vm.categoriasDisponiveis.length === 0}
          >
            <option value="">Todas as categorias</option>
            {vm.categoriasDisponiveis.map(cat => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Assuntos (multi-select) */}
          {vm.subcategorias.length > 0 && (
            <AssuntoMultiSelect
              subcategorias={vm.subcategorias}
              selected={vm.assuntosFiltro}
              onChange={vm.setAssuntosFiltro}
            />
          )}

          {/* Apenas ativos */}
          <label className="flex-shrink-0 flex items-center gap-2 text-sm whitespace-nowrap" style={{ color: C.text500 }}>
            <input
              type="checkbox"
              checked={vm.apenasAtivos}
              onChange={(e) => vm.setApenasAtivos(e.target.checked)}
              className="rounded text-primary-600"
            />
            Apenas ativos
          </label>

          {/* Limpar filtros */}
          {vm.filtrosAtivos && (
            <button
              type="button"
              onClick={vm.limparFiltros}
              className="flex-shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
              style={{ color: C.text500 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.gray100; e.currentTarget.style.color = C.text700 }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text500 }}
              title="Limpar todos os filtros"
            >
              <X className="h-3 w-3" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Lista de modulos organizada por tipo */}
      {vm.loading ? (
        <div className="text-center py-12" style={{ color: C.text400 }}>Carregando modulos...</div>
      ) : !vm.temResultados ? (
        <div className="text-center py-12" style={{ color: C.text400 }}>Nenhum modulo encontrado</div>
      ) : (
        <div className="space-y-6">
          {/* ---- Base (Prompt do Sistema) ---- */}
          {vm.modulosPorTipo.base.length > 0 && (
            <TipoSection
              tipo="base"
              modulos={vm.modulosPorTipo.base}
              onEdit={vm.abrirDialogEditar}
              onDelete={vm.abrirDialogExcluir}
              onToggle={vm.toggleAtivo}
              onHistory={vm.abrirHistorico}
              onMoveUp={vm.handleMoveUp}
              onMoveDown={vm.handleMoveDown}
              onDragReorder={vm.handleDragReorder}
            />
          )}

          {/* ---- Pecas (Estrutura/Template) ---- */}
          {vm.modulosPorTipo.peca.length > 0 && (
            <TipoSection
              tipo="peca"
              modulos={vm.modulosPorTipo.peca}
              onEdit={vm.abrirDialogEditar}
              onDelete={vm.abrirDialogExcluir}
              onToggle={vm.toggleAtivo}
              onHistory={vm.abrirHistorico}
              onMoveUp={vm.handleMoveUp}
              onMoveDown={vm.handleMoveDown}
              onDragReorder={vm.handleDragReorder}
            />
          )}

          {/* ---- Conteudo (Teses e Argumentos) ---- */}
          {vm.modulosPorTipo.conteudo.length > 0 && (
            <div>
              {/* Header do tipo Conteudo */}
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-t-xl"
                style={{ background: conteudoConfig.bgHeader, border: `1px solid ${conteudoConfig.borderHeader}`, borderBottom: 'none' }}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: conteudoConfig.iconBg }}>
                  <Lightbulb className="h-4 w-4" style={{ color: conteudoConfig.iconColor }} />
                </div>
                <h3 className="font-semibold" style={{ color: conteudoConfig.titleColor }}>{conteudoConfig.label}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: conteudoConfig.countBg, color: conteudoConfig.countColor }}>
                  {vm.modulosPorTipo.conteudo.length}
                </span>
              </div>

              {/* Categorias colapsaveis */}
              <div className="space-y-3 mt-3">
                {vm.categoriasConteudo.map(categoria => (
                  <CategoriaGroup
                    key={categoria}
                    categoria={categoria}
                    modulos={vm.conteudoPorCategoria[categoria]}
                    subcategoriasNomes={vm.getSubcategoriasUnicas(vm.conteudoPorCategoria[categoria])}
                    onEdit={vm.abrirDialogEditar}
                    onDelete={vm.abrirDialogExcluir}
                    onToggle={vm.toggleAtivo}
                    onHistory={vm.abrirHistorico}
                    onMoveUp={vm.handleMoveUp}
                    onMoveDown={vm.handleMoveDown}
                    onDragReorder={vm.handleDragReorder}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <ModuloFormDialog
        open={vm.dialogAberto}
        onOpenChange={vm.setDialogAberto}
        moduloEditando={vm.moduloEditando}
        formData={vm.formData}
        setFormData={vm.setFormData}
        grupos={vm.grupos}
        formSubgrupos={vm.formSubgrupos}
        onSalvar={vm.salvarModulo}
      />

      <DeleteDialog
        open={vm.dialogExclusao}
        onOpenChange={vm.setDialogExclusao}
        moduloEditando={vm.moduloEditando}
        onExcluir={vm.excluirModulo}
      />

      <HistoricoDialog
        open={vm.dialogHistorico}
        onOpenChange={vm.setDialogHistorico}
        moduloHistorico={vm.moduloHistorico}
        versoes={vm.versoes}
        loadingHistorico={vm.loadingHistorico}
        onRestaurar={vm.restaurarVersao}
      />

      <ImportDialog
        open={vm.dialogImportar}
        onOpenChange={vm.setDialogImportar}
        importData={vm.importData}
        setImportData={vm.setImportData}
        importando={vm.importando}
        onImportar={vm.importarModulos}
      />

      <GruposDialog
        open={vm.dialogGrupos}
        onOpenChange={vm.setDialogGrupos}
        grupos={vm.grupos}
        novoGrupoNome={vm.novoGrupoNome}
        setNovoGrupoNome={vm.setNovoGrupoNome}
        novoGrupoDescricao={vm.novoGrupoDescricao}
        setNovoGrupoDescricao={vm.setNovoGrupoDescricao}
        onCriarGrupo={vm.criarGrupo}
      />
    </ContentArea>
    </>
  )
}
