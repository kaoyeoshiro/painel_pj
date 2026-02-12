/**
 * Pagina de Categorias JSON — orquestrador principal.
 * Replica o comportamento do legado (admin_categorias_json.html):
 * - Blacklist de codigos separada no topo
 * - Grid 1 coluna de cards com badges, code pills, JSON preview
 * - Editor dialog que nao fecha apos salvar
 * - Desativar (soft delete) em vez de excluir
 */

import { useState, useEffect, useCallback } from 'react'
import { Tags } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { AdminSubNav } from '@/components/layout'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import type { CategoriaJSON } from './types'
import * as categoriasApi from './api'
import { BlacklistCard } from './BlacklistCard'
import { CategoriaCard } from './CategoriaCard'
import { CategoriaEditorDialog } from './CategoriaEditorDialog'

export function CategoriasJsonPage() {
  const { toast } = useToast()
  const [categorias, setCategorias] = useState<CategoriaJSON[]>([])
  const [codigosIgnorados, setCodigosIgnorados] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [blacklistLoading, setBlacklistLoading] = useState(true)

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Desativacao
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: number; titulo: string } | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Carregamento inicial em paralelo
  const loadAll = useCallback(async () => {
    try {
      const [cats, blacklist] = await Promise.all([
        categoriasApi.listar(false),
        categoriasApi.getCodigosIgnorados(),
      ])
      setCategorias(cats)
      setCodigosIgnorados(blacklist.codigos)
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar dados', variant: 'destructive' })
    } finally {
      setLoading(false)
      setBlacklistLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  // Recarrega apenas categorias (apos salvar/desativar)
  const reloadCategorias = async () => {
    try {
      const cats = await categoriasApi.listar(false)
      setCategorias(cats)
    } catch {
      toast({ title: 'Erro', description: 'Erro ao recarregar categorias', variant: 'destructive' })
    }
  }

  // Abrir editor para criar
  const handleCreate = () => {
    setEditingId(null)
    setEditorOpen(true)
  }

  // Abrir editor para editar
  const handleEdit = (id: number) => {
    setEditingId(id)
    setEditorOpen(true)
  }

  // Fechar editor
  const handleEditorClose = () => {
    setEditorOpen(false)
    setEditingId(null)
  }

  // Callback apos salvar (nao fecha o editor — recarrega a lista)
  const handleSaved = () => {
    reloadCategorias()
  }

  // Iniciar desativacao
  const handleDeactivateClick = (id: number, titulo: string) => {
    setDeactivateTarget({ id, titulo })
  }

  // Confirmar desativacao
  const handleDeactivateConfirm = async () => {
    if (!deactivateTarget) return
    setDeactivating(true)
    try {
      await categoriasApi.desativar(deactivateTarget.id)
      toast({ title: 'Sucesso', description: 'Categoria desativada com sucesso' })
      setDeactivateTarget(null)
      reloadCategorias()
    } catch {
      toast({ title: 'Erro', description: 'Erro ao desativar categoria', variant: 'destructive' })
    } finally {
      setDeactivating(false)
    }
  }

  // Salvar blacklist
  const handleBlacklistSave = async (codigos: number[]) => {
    await categoriasApi.setCodigosIgnorados(codigos)
    setCodigosIgnorados(codigos)
  }

  return (
    <>
      <BreadcrumbBar
        title="Categorias JSON"
        icon={<Tags style={{ width: 14, height: 14 }} />}
        actions={
          <Button
            onClick={handleCreate}
            style={{ background: C.navy950, color: 'white' }}
            data-testid="btn-nova-categoria"
          >
            Nova Categoria
          </Button>
        }
      />

      <ContentArea className="space-y-6">
        <AdminSubNav />

        {/* Blacklist — secao separada no topo */}
        <BlacklistCard
          codigos={codigosIgnorados}
          onSave={handleBlacklistSave}
          loading={blacklistLoading}
        />

        {/* Loading */}
        {loading && (
          <div className="text-center py-8" style={{ color: C.text500 }}>
            Carregando categorias...
          </div>
        )}

        {/* Vazio */}
        {!loading && categorias.length === 0 && (
          <div className="text-center py-8" style={{ color: C.text500 }}>
            Nenhuma categoria cadastrada
          </div>
        )}

        {/* Grid de cards responsivo */}
        {!loading && categorias.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="categorias-grid">
            {categorias.map(categoria => (
              <CategoriaCard
                key={categoria.id}
                categoria={categoria}
                onEdit={handleEdit}
                onDeactivate={handleDeactivateClick}
              />
            ))}
          </div>
        )}
      </ContentArea>

      {/* Editor dialog */}
      <CategoriaEditorDialog
        open={editorOpen}
        editingId={editingId}
        onClose={handleEditorClose}
        onSaved={handleSaved}
      />

      {/* Dialog de confirmacao de desativacao */}
      <Dialog
        open={deactivateTarget !== null}
        onOpenChange={() => setDeactivateTarget(null)}
      >
        <DialogContent data-testid="deactivate-dialog">
          <DialogHeader>
            <DialogTitle>Confirmar Desativacao</DialogTitle>
            <DialogDescription>
              Deseja desativar a categoria <strong>"{deactivateTarget?.titulo}"</strong>?
              A categoria sera marcada como inativa e nao sera mais utilizada na extracao.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeactivateConfirm}
              disabled={deactivating}
              data-testid="btn-confirm-deactivate"
            >
              {deactivating ? 'Desativando...' : 'Desativar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
