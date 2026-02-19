/**
 * Pagina de Filtro de Documentos.
 *
 * Migra o conteudo das tabs "Categorias de Documentos" e "Tipos de Peca"
 * do antigo ConfigPecasPage. Exibe categorias de documento (CategoriaDocumento)
 * e suas associacoes com tipos de peca (TipoPeca) usados na filtragem do Agente 1.
 */

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { AdminSubNav } from '@/components/layout'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import { createApiClient } from '@/lib/api'
import { Filter, FileText, RefreshCw, Database, Pencil, Settings2 } from 'lucide-react'

// ============================================================
// Tipos
// ============================================================

interface CategoriaDocumento {
  id: number
  nome: string
  titulo: string
  descricao: string | null
  codigos_documento: number[]
  cor: string | null
  ordem: number
  ativo: boolean
  is_primeiro_documento: boolean
}

interface TipoPeca {
  id: number
  nome: string
  titulo: string
  descricao: string | null
  icone: string
  ordem: number
  ativo: boolean
  is_padrao: boolean
  categorias_documento: CategoriaDocumento[]
}

interface CategoriaFormData {
  nome: string
  titulo: string
  descricao: string
  codigos_documento: string // campo texto, convertido para int[] ao salvar
  cor: string
  ordem: number
  ativo: boolean
  is_primeiro_documento: boolean
}

const api = createApiClient('/admin/api/filtro-documentos')

// ============================================================
// Dialog: Editar Categoria
// ============================================================

function EditarCategoriaDialog({
  categoria,
  open,
  onOpenChange,
  onSaved,
}: {
  categoria: CategoriaDocumento | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CategoriaFormData>({
    nome: '',
    titulo: '',
    descricao: '',
    codigos_documento: '',
    cor: '#3498db',
    ordem: 0,
    ativo: true,
    is_primeiro_documento: false,
  })

  useEffect(() => {
    if (categoria) {
      setForm({
        nome: categoria.nome,
        titulo: categoria.titulo,
        descricao: categoria.descricao || '',
        codigos_documento: (categoria.codigos_documento || []).join(', '),
        cor: categoria.cor || '#3498db',
        ordem: categoria.ordem,
        ativo: categoria.ativo,
        is_primeiro_documento: categoria.is_primeiro_documento,
      })
    }
  }, [categoria])

  const handleSave = async () => {
    if (!categoria) return

    const codigos = form.codigos_documento
      .split(/[,;\s]+/)
      .map(s => s.trim())
      .filter(s => s && /^\d+$/.test(s))
      .map(Number)

    setSaving(true)
    try {
      await api.put(`/categorias/${categoria.id}`, {
        nome: form.nome,
        titulo: form.titulo,
        descricao: form.descricao || null,
        codigos_documento: codigos,
        cor: form.cor || null,
        ordem: form.ordem,
        ativo: form.ativo,
        is_primeiro_documento: form.is_primeiro_documento,
      })
      toast({ title: 'Salvo', description: `Categoria "${form.titulo}" atualizada` })
      onOpenChange(false)
      onSaved()
    } catch {
      toast({ title: 'Erro', description: 'Erro ao salvar categoria', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '6px 10px',
    border: `1px solid ${C.gray300}`,
    borderRadius: '6px',
    fontSize: '14px',
    background: C.white,
    color: C.text700,
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar Categoria</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.text600 }}>
              Nome (identificador)
            </label>
            <input
              style={inputStyle}
              value={form.nome}
              onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.text600 }}>
              Titulo
            </label>
            <input
              style={inputStyle}
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.text600 }}>
              Descricao
            </label>
            <textarea
              style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
              value={form.descricao}
              onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: C.text600 }}>
              Codigos de Documento (separados por virgula)
            </label>
            <input
              style={{ ...inputStyle, fontFamily: 'monospace' }}
              value={form.codigos_documento}
              onChange={e => setForm(f => ({ ...f, codigos_documento: e.target.value }))}
              placeholder="500, 510, 9500"
            />
            <span className="text-xs" style={{ color: C.text400 }}>
              Codigos TJ-MS que pertencem a esta categoria
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: C.text600 }}>
                Cor
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={form.cor}
                  onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                  style={{ width: '36px', height: '30px', border: 'none', cursor: 'pointer' }}
                />
                <input
                  style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }}
                  value={form.cor}
                  onChange={e => setForm(f => ({ ...f, cor: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: C.text600 }}>
                Ordem
              </label>
              <input
                type="number"
                style={inputStyle}
                value={form.ordem}
                onChange={e => setForm(f => ({ ...f, ordem: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
              />
              Ativo
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_primeiro_documento}
                onChange={e => setForm(f => ({ ...f, is_primeiro_documento: e.target.checked }))}
              />
              Apenas 1o documento
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Dialog: Editar Associacoes de Tipo de Peca
// ============================================================

function EditarTipoPecaDialog({
  tipoPeca,
  todasCategorias,
  open,
  onOpenChange,
  onSaved,
}: {
  tipoPeca: TipoPeca | null
  todasCategorias: CategoriaDocumento[]
  open: boolean
  onOpenChange: (v: boolean) => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (tipoPeca) {
      setSelectedIds(new Set(tipoPeca.categorias_documento.map(c => c.id)))
    }
  }, [tipoPeca])

  const toggleCategoria = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSave = async () => {
    if (!tipoPeca) return
    setSaving(true)
    try {
      await api.put(`/tipos-peca/${tipoPeca.id}/categorias`, {
        categorias_ids: Array.from(selectedIds),
      })
      toast({
        title: 'Salvo',
        description: `Categorias de "${tipoPeca.titulo}" atualizadas (${selectedIds.size})`,
      })
      onOpenChange(false)
      onSaved()
    } catch {
      toast({ title: 'Erro', description: 'Erro ao salvar associacoes', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const ativas = todasCategorias.filter(c => c.ativo)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Categorias para "{tipoPeca?.titulo}"
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs mb-3" style={{ color: C.text500 }}>
          Selecione quais categorias de documento o Agente 1 deve analisar para este tipo de peca.
        </p>

        <div className="max-h-[350px] overflow-y-auto space-y-1 pr-1">
          {ativas.map(cat => (
            <label
              key={cat.id}
              className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-50"
              style={{ borderBottom: `1px solid ${C.gray100}` }}
            >
              <input
                type="checkbox"
                checked={selectedIds.has(cat.id)}
                onChange={() => toggleCategoria(cat.id)}
                className="w-4 h-4"
              />
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ background: cat.cor || C.gray400 }}
              />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium" style={{ color: C.text700 }}>
                  {cat.titulo}
                </span>
                <span className="text-xs ml-2 font-mono" style={{ color: C.text400 }}>
                  ({(cat.codigos_documento || []).length} codigos)
                </span>
              </div>
              {cat.is_primeiro_documento && (
                <Badge className="text-xs bg-amber-100 text-amber-800 flex-shrink-0">
                  1o doc
                </Badge>
              )}
            </label>
          ))}
        </div>

        <div className="text-xs mt-2" style={{ color: C.text400 }}>
          {selectedIds.size} de {ativas.length} categorias selecionadas
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ============================================================
// Pagina Principal
// ============================================================

export function FiltroDocumentosPage() {
  const { toast } = useToast()
  const [categorias, setCategorias] = useState<CategoriaDocumento[]>([])
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)

  // Dialogs
  const [editCat, setEditCat] = useState<CategoriaDocumento | null>(null)
  const [editCatOpen, setEditCatOpen] = useState(false)
  const [editTipo, setEditTipo] = useState<TipoPeca | null>(null)
  const [editTipoOpen, setEditTipoOpen] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cats, tipos] = await Promise.all([
        api.get<CategoriaDocumento[]>('/categorias'),
        api.get<TipoPeca[]>('/tipos-peca'),
      ])
      setCategorias(cats)
      setTiposPeca(tipos)
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar dados', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const seedDados = useCallback(async () => {
    setSeeding(true)
    try {
      const result = await api.post<{
        message: string
        categorias_criadas: number
        tipos_criados: number
      }>('/seed', {})
      toast({
        title: 'Dados carregados',
        description: `${result.categorias_criadas} categorias e ${result.tipos_criados} tipos criados`,
      })
      await loadData()
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar dados iniciais', variant: 'destructive' })
    } finally {
      setSeeding(false)
    }
  }, [toast, loadData])

  useEffect(() => {
    loadData()
  }, [loadData])

  const openEditCategoria = (cat: CategoriaDocumento) => {
    setEditCat(cat)
    setEditCatOpen(true)
  }

  const openEditTipoPeca = (tipo: TipoPeca) => {
    setEditTipo(tipo)
    setEditTipoOpen(true)
  }

  return (
    <>
      <BreadcrumbBar
        items={[
          { label: 'Admin', to: '/admin' },
          { label: 'Filtro de Documentos' },
        ]}
        title="Filtro de Documentos"
        subtitle="Categorias de documento e tipos de peca usados na filtragem do Agente 1"
        icon={<Filter className="h-5 w-5" />}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Recarregar
            </Button>
            {categorias.length === 0 && !loading && (
              <Button size="sm" onClick={seedDados} disabled={seeding}>
                <Database className={`h-4 w-4 mr-1 ${seeding ? 'animate-spin' : ''}`} />
                {seeding ? 'Carregando...' : 'Carregar Dados Iniciais'}
              </Button>
            )}
          </div>
        }
      />

      <ContentArea className="space-y-6">
        <AdminSubNav />

        {loading ? (
          <div className="text-center py-8" style={{ color: C.text500 }}>
            Carregando...
          </div>
        ) : (
          <>
            {/* Estado vazio — seed necessario */}
            {categorias.length === 0 && tiposPeca.length === 0 && (
              <Card className="border-dashed" style={{ borderColor: C.gray300 }}>
                <CardContent className="py-8 text-center">
                  <Database className="h-10 w-10 mx-auto mb-3" style={{ color: C.text400 }} />
                  <h3 className="text-lg font-semibold mb-2" style={{ color: C.text700 }}>
                    Nenhuma categoria ou tipo de peca configurado
                  </h3>
                  <p className="text-sm mb-4 max-w-lg mx-auto" style={{ color: C.text500 }}>
                    As categorias de documento definem quais documentos do TJ-MS o Agente 1
                    deve analisar. Clique abaixo para carregar as categorias padrao a partir
                    do arquivo de referencia.
                  </p>
                  <Button onClick={seedDados} disabled={seeding}>
                    <Database className={`h-4 w-4 mr-2 ${seeding ? 'animate-spin' : ''}`} />
                    {seeding ? 'Carregando...' : 'Carregar Dados Iniciais'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Categorias de Documento */}
            {categorias.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3" style={{ color: C.text700 }}>
                  Categorias de Documento ({categorias.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {categorias.map(cat => (
                    <Card
                      key={cat.id}
                      className="border cursor-pointer hover:shadow-md transition-shadow"
                      style={{ borderColor: C.gray200 }}
                      onClick={() => openEditCategoria(cat)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText
                            className="h-4 w-4 flex-shrink-0"
                            style={{ color: cat.cor || C.navy700 }}
                          />
                          <span className="flex-1 truncate">{cat.titulo}</span>
                          {!cat.ativo && (
                            <Badge variant="secondary" className="text-xs flex-shrink-0">
                              Inativo
                            </Badge>
                          )}
                          {cat.is_primeiro_documento && (
                            <Badge className="text-xs bg-amber-100 text-amber-800 flex-shrink-0">
                              1o doc
                            </Badge>
                          )}
                          <Pencil
                            className="h-3.5 w-3.5 flex-shrink-0 opacity-40 hover:opacity-100"
                            style={{ color: C.text500 }}
                          />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs mb-2" style={{ color: C.text400 }}>
                          {cat.descricao || cat.nome}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {(cat.codigos_documento || []).map(cod => (
                            <span
                              key={cod}
                              className="px-1.5 py-0.5 text-xs rounded font-mono"
                              style={{ background: C.gray100, color: C.text600 }}
                            >
                              {cod}
                            </span>
                          ))}
                          {(!cat.codigos_documento || cat.codigos_documento.length === 0) && (
                            <span className="text-xs" style={{ color: C.text400 }}>
                              Sem codigos
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Tipos de Peca */}
            {tiposPeca.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3" style={{ color: C.text700 }}>
                  Tipos de Peca ({tiposPeca.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tiposPeca.map(tipo => (
                    <Card
                      key={tipo.id}
                      className="border cursor-pointer hover:shadow-md transition-shadow"
                      style={{ borderColor: C.gray200 }}
                      onClick={() => openEditTipoPeca(tipo)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <span className="flex-1">{tipo.titulo}</span>
                          {!tipo.ativo && (
                            <Badge variant="secondary" className="text-xs">Inativo</Badge>
                          )}
                          {tipo.is_padrao && (
                            <Badge className="text-xs bg-blue-100 text-blue-800">Padrao</Badge>
                          )}
                          <Settings2
                            className="h-3.5 w-3.5 flex-shrink-0 opacity-40 hover:opacity-100"
                            style={{ color: C.text500 }}
                          />
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xs mb-2" style={{ color: C.text400 }}>
                          {tipo.descricao || tipo.nome}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {(tipo.categorias_documento || []).map(cat => (
                            <Badge key={cat.id} variant="outline" className="text-xs">
                              {cat.titulo}
                            </Badge>
                          ))}
                          {(!tipo.categorias_documento ||
                            tipo.categorias_documento.length === 0) && (
                            <span className="text-xs" style={{ color: C.text400 }}>
                              Sem categorias — clique para associar
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </ContentArea>

      {/* Dialogs */}
      <EditarCategoriaDialog
        categoria={editCat}
        open={editCatOpen}
        onOpenChange={setEditCatOpen}
        onSaved={loadData}
      />
      <EditarTipoPecaDialog
        tipoPeca={editTipo}
        todasCategorias={categorias}
        open={editTipoOpen}
        onOpenChange={setEditTipoOpen}
        onSaved={loadData}
      />
    </>
  )
}
