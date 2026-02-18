/**
 * Pagina de Categorias JSON — orquestrador principal.
 * Replica o comportamento do legado (admin_categorias_json.html):
 * - Blacklist de codigos separada no topo
 * - Grid 1 coluna de cards com badges, code pills, JSON preview
 * - Editor dialog que nao fecha apos salvar
 * - Desativar (soft delete) em vez de excluir
 */

import { useState, useEffect, useCallback } from 'react'
import { Tags, FlaskConical } from 'lucide-react'
import { Link } from '@tanstack/react-router'
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
import { GroupSelector } from '@/components/ui/GroupSelector'
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

  // Seletor de grupo
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)

  // Editor dialog
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Desativacao
  const [deactivateTarget, setDeactivateTarget] = useState<{ id: number; titulo: string } | null>(null)
  const [deactivating, setDeactivating] = useState(false)

  // Carregamento inicial (blacklist e global, categorias por grupo)
  const loadBlacklist = useCallback(async () => {
    try {
      const blacklist = await categoriasApi.getCodigosIgnorados()
      setCodigosIgnorados(blacklist.codigos)
    } catch {
      // silently fail
    } finally {
      setBlacklistLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBlacklist()
  }, [loadBlacklist])

  // Carrega categorias quando grupo muda
  const loadCategorias = useCallback(async (groupId: number | null) => {
    setLoading(true)
    try {
      const cats = await categoriasApi.listar(false, groupId)
      setCategorias(cats)
    } catch {
      toast({ title: 'Erro', description: 'Erro ao carregar categorias', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (selectedGroupId) {
      loadCategorias(selectedGroupId)
    }
  }, [selectedGroupId, loadCategorias])

  // Recarrega apenas categorias (apos salvar/desativar)
  const reloadCategorias = async () => {
    try {
      const cats = await categoriasApi.listar(false, selectedGroupId)
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
        icon={<Tags className="w-3.5 h-3.5" />}
        actions={
          <div className="flex items-center gap-2">
            <Link to="/admin/teste-categorias">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                style={{ borderColor: C.orange400, color: C.orange600 }}
              >
                <FlaskConical className="h-4 w-4" />
                Testar Categorias
              </Button>
            </Link>
            <Button
              onClick={handleCreate}
              style={{ background: C.navy950, color: 'white' }}
              data-testid="btn-nova-categoria"
            >
              Nova Categoria
            </Button>
          </div>
        }
      />

      <ContentArea className="space-y-6">
        <AdminSubNav />

        {/* Seletor de grupo */}
        <GroupSelector
          selectedGroupId={selectedGroupId}
          onGroupChange={setSelectedGroupId}
        />

        {/* Blacklist — secao separada no topo (GLOBAL, sem filtro por grupo) */}
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
