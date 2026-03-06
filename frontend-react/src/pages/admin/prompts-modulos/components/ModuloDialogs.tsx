import { useCallback, useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { C } from '@/lib/designTokens'
import { RotateCcw, Plus, Upload } from 'lucide-react'
import { RuleEditorPanel, PieceTypeRulesSection } from './rules'
import type { RuleNode } from './rules'
import type {
  PromptModulo,
  PromptGroup,
  PromptSubgroup,
  HistoricoVersao,
  TipoPrompt,
  ModuloFormData,
} from '../types'

// ---- Dialog de Criacao/Edicao ----

interface ModuloFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  moduloEditando: PromptModulo | null
  formData: ModuloFormData
  setFormData: (fn: ModuloFormData | ((prev: ModuloFormData) => ModuloFormData)) => void
  grupos: PromptGroup[]
  formSubgrupos: PromptSubgroup[]
  onSalvar: () => void
}

export function ModuloFormDialog({
  open,
  onOpenChange,
  moduloEditando,
  formData,
  setFormData,
  grupos,
  formSubgrupos,
  onSalvar,
}: ModuloFormDialogProps) {
  const conteudoRef = useRef<HTMLTextAreaElement>(null)

  const autoResize = useCallback(() => {
    const el = conteudoRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [])

  useEffect(() => {
    if (open) {
      // Aguarda o DOM renderizar o textarea antes de redimensionar
      requestAnimationFrame(autoResize)
    }
  }, [open, formData.conteudo, autoResize])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-pge max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {moduloEditando ? 'Editar Módulo' : 'Novo Módulo'}
          </DialogTitle>
          <DialogDescription>
            {moduloEditando ? `Editando: ${moduloEditando.titulo}` : 'Preencha os campos para criar um novo módulo de prompt'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Titulo */}
          <div>
            <Label htmlFor="titulo">Título</Label>
            <Input
              id="titulo"
              value={formData.titulo}
              onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
            />
          </div>

          {/* Nome (codigo) */}
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

          {/* Conteudo */}
          <div>
            <Label htmlFor="conteudo">Conteúdo</Label>
            <Textarea
              ref={conteudoRef}
              id="conteudo"
              value={formData.conteudo}
              onChange={(e) => {
                setFormData({ ...formData, conteudo: e.target.value })
                autoResize()
              }}
              className="font-mono min-h-[400px] overflow-hidden resize-none"
            />
          </div>

          {/* Tipo */}
          <div>
            <Label htmlFor="tipo">Tipo</Label>
            <select
              id="tipo"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={formData.tipo}
              onChange={(e) =>
                setFormData({ ...formData, tipo: e.target.value as TipoPrompt })
              }
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
              onChange={(e) =>
                setFormData({
                  ...formData,
                  group_id: e.target.value ? Number(e.target.value) : null,
                  subgroup_id: null,
                })
              }
            >
              <option value="">Nenhum</option>
              {grupos.map((grupo) => (
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
              onChange={(e) =>
                setFormData({
                  ...formData,
                  subgroup_id: e.target.value ? Number(e.target.value) : null,
                })
              }
              disabled={!formData.group_id}
            >
              <option value="">Nenhum</option>
              {formSubgrupos.map((subgrupo) => (
                <option key={subgrupo.id} value={subgrupo.id}>
                  {subgrupo.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Modo de ativacao — apenas para tipo 'conteudo' (teses/argumentos).
              Base (Prompt do Sistema) ativa automaticamente por grupo.
              Peca (Estrutura/Template) ativa via selecao manual do usuario. */}
          {formData.tipo === 'conteudo' && (
            <>
              <div>
                <Label htmlFor="modo_ativacao">Modo de Ativação</Label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors border"
                    style={{
                      background: formData.modo_ativacao === 'llm' ? C.navy950 : 'transparent',
                      color: formData.modo_ativacao === 'llm' ? 'white' : C.text500,
                      borderColor: formData.modo_ativacao === 'llm' ? C.navy950 : C.gray300,
                    }}
                    onClick={() =>
                      setFormData({ ...formData, modo_ativacao: 'llm' })
                    }
                  >
                    LLM (Inteligência Artificial)
                  </button>
                  <button
                    type="button"
                    className="flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors border"
                    style={{
                      background: formData.modo_ativacao === 'deterministic' ? C.navy950 : 'transparent',
                      color: formData.modo_ativacao === 'deterministic' ? 'white' : C.text500,
                      borderColor: formData.modo_ativacao === 'deterministic' ? C.navy950 : C.gray300,
                    }}
                    onClick={() =>
                      setFormData({ ...formData, modo_ativacao: 'deterministic' })
                    }
                  >
                    Regra Determinística
                  </button>
                </div>
              </div>

              {/* Editor de regras deterministicas */}
              {formData.modo_ativacao === 'deterministic' && (
                <>
                  <RuleEditorPanel
                    regraPrimaria={formData.regra_deterministica as RuleNode | null}
                    regraTextoOriginal={formData.regra_texto_original}
                    onRegraPrimariaChange={(regra) =>
                      setFormData((prev) => ({
                        ...prev,
                        regra_deterministica: regra as Record<string, unknown> | null,
                      }))
                    }
                    onRegraTextoOriginalChange={(texto) =>
                      setFormData((prev) => ({ ...prev, regra_texto_original: texto }))
                    }
                    regraSecundaria={formData.regra_deterministica_secundaria as RuleNode | null}
                    regraSecundariaTexto={formData.regra_secundaria_texto_original}
                    fallbackHabilitado={formData.fallback_habilitado}
                    onRegraSecundariaChange={(regra) =>
                      setFormData((prev) => ({
                        ...prev,
                        regra_deterministica_secundaria: regra as Record<string, unknown> | null,
                      }))
                    }
                    onRegraSecundariaTextoChange={(texto) =>
                      setFormData((prev) => ({ ...prev, regra_secundaria_texto_original: texto }))
                    }
                    onFallbackHabilitadoChange={(habilitado) =>
                      setFormData((prev) => ({ ...prev, fallback_habilitado: habilitado }))
                    }
                  />

                  {/* Regras por tipo de peca (apenas em edicao) */}
                  {moduloEditando && (
                    <PieceTypeRulesSection
                      moduloId={moduloEditando.id}
                      regraPrimariaGlobal={formData.regra_deterministica as RuleNode | null}
                    />
                  )}
                </>
              )}
            </>
          )}

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
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={onSalvar} style={{ background: C.navy950, color: 'white' }}>
            {moduloEditando ? 'Salvar' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- Dialog de Exclusao ----

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  moduloEditando: PromptModulo | null
  onExcluir: () => void
}

export function DeleteDialog({ open, onOpenChange, moduloEditando, onExcluir }: DeleteDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirmar Exclusão</DialogTitle>
          <DialogDescription>
            Tem certeza que deseja excluir o módulo &quot;{moduloEditando?.titulo}&quot;?
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onExcluir}>
            Excluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- Dialog de Historico ----

interface HistoricoDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  moduloHistorico: PromptModulo | null
  versoes: HistoricoVersao[]
  loadingHistorico: boolean
  onRestaurar: (versao: number) => void
}

export function HistoricoDialog({
  open,
  onOpenChange,
  moduloHistorico,
  versoes,
  loadingHistorico,
  onRestaurar,
}: HistoricoDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Histórico — {moduloHistorico?.titulo}</DialogTitle>
          <DialogDescription>Versões anteriores deste módulo</DialogDescription>
        </DialogHeader>
        {loadingHistorico ? (
          <div className="text-center py-8" style={{ color: C.text400 }}>
            Carregando historico...
          </div>
        ) : versoes.length === 0 ? (
          <div className="text-center py-8" style={{ color: C.text400 }}>
            Nenhuma versao anterior encontrada
          </div>
        ) : (
          <div className="space-y-3">
            {versoes.map((versao) => (
              <div
                key={versao.versao}
                className="rounded-lg p-4"
                style={{ border: `1px solid ${C.gray200}` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">v{versao.versao}</Badge>
                    <span className="text-sm" style={{ color: C.text500 }}>
                      {new Date(versao.atualizado_em).toLocaleString('pt-BR')}
                    </span>
                    {versao.atualizado_por && (
                      <span className="text-xs" style={{ color: C.text400 }}>
                        por {versao.atualizado_por}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onRestaurar(versao.versao)}
                    className="gap-1.5"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Restaurar
                  </Button>
                </div>
                <div className="text-sm">
                  <span className="font-medium">{versao.titulo}</span>
                  <span className="ml-2" style={{ color: C.text400 }}>
                    ({versao.categoria})
                  </span>
                </div>
                <pre
                  className="mt-2 text-xs p-2 rounded max-h-32 overflow-y-auto whitespace-pre-wrap"
                  style={{ color: C.text500, background: C.gray50 }}
                >
                  {versao.conteudo.slice(0, 500)}
                  {versao.conteudo.length > 500 ? '...' : ''}
                </pre>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ---- Dialog de Importacao ----

interface ImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  importData: string
  setImportData: (value: string) => void
  importando: boolean
  onImportar: (sobrescrever: boolean) => void
}

export function ImportDialog({
  open,
  onOpenChange,
  importData,
  setImportData,
  importando,
  onImportar,
}: ImportDialogProps) {
  const [sobrescrever, setSobrescrever] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setImportData(ev.target?.result as string)
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setSobrescrever(false) }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Módulos</DialogTitle>
          <DialogDescription>
            Cole o JSON abaixo ou carregue um arquivo .json
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5">
            <Upload className="h-4 w-4" />
            Carregar arquivo .json
          </Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleFile} />
        </div>
        <Textarea
          value={importData}
          onChange={(e) => setImportData(e.target.value)}
          className="font-mono text-xs min-h-[300px]"
          placeholder='{"version": "2.0", "modulos": [...]}'
        />
        <div className="flex items-center gap-2">
          <Checkbox
            id="sobrescrever"
            checked={sobrescrever}
            onCheckedChange={(v) => setSobrescrever(v === true)}
          />
          <Label htmlFor="sobrescrever" className="text-sm cursor-pointer">
            Sobrescrever módulos existentes (atualiza título, conteúdo e regras)
          </Label>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false)
              setImportData('')
              setSobrescrever(false)
            }}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => onImportar(sobrescrever)}
            disabled={importando || !importData.trim()}
            style={{ background: C.navy950, color: 'white' }}
          >
            {importando ? 'Importando...' : 'Importar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---- Dialog de Gestao de Grupos ----

interface GruposDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  grupos: PromptGroup[]
  novoGrupoNome: string
  setNovoGrupoNome: (value: string) => void
  novoGrupoDescricao: string
  setNovoGrupoDescricao: (value: string) => void
  onCriarGrupo: () => void
}

export function GruposDialog({
  open,
  onOpenChange,
  grupos,
  novoGrupoNome,
  setNovoGrupoNome,
  novoGrupoDescricao,
  setNovoGrupoDescricao,
  onCriarGrupo,
}: GruposDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Grupos</DialogTitle>
          <DialogDescription>Gerencie os grupos de módulos de prompts</DialogDescription>
        </DialogHeader>

        {/* Lista de grupos existentes */}
        <div className="space-y-2">
          {grupos.map((grupo) => (
            <div
              key={grupo.id}
              className="flex items-center justify-between p-3 rounded-lg"
              style={{ border: `1px solid ${C.gray200}` }}
            >
              <div>
                <span className="font-medium" style={{ color: C.text900 }}>
                  {grupo.nome}
                </span>
                {grupo.descricao && (
                  <p className="text-xs mt-0.5" style={{ color: C.text500 }}>
                    {grupo.descricao}
                  </p>
                )}
              </div>
              <Badge variant={grupo.ativo ? 'default' : 'secondary'}>
                {grupo.ativo ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          ))}
        </div>

        {/* Formulario de novo grupo */}
        <div
          className="pt-4 mt-4 space-y-3"
          style={{ borderTop: `1px solid ${C.gray200}` }}
        >
          <h4 className="font-medium text-sm" style={{ color: C.text900 }}>
            Novo Grupo
          </h4>
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
          <Button
            onClick={onCriarGrupo}
            disabled={!novoGrupoNome.trim()}
            className="gap-1.5"
            style={{ background: C.navy950, color: 'white' }}
          >
            <Plus className="h-4 w-4" />
            Criar Grupo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
