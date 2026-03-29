/**
 * Página de configuração de assessores do Sistema de Revisão de Peças.
 * Permite adicionar, ativar/desativar e remover assessores da fila.
 */

import { useState, useEffect, useMemo } from 'react'
import { UserCog, UserPlus, Trash2 } from 'lucide-react'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { C } from '@/lib/designTokens'
import { usersApi } from '@/lib/api'

import {
  fetchAssessores,
  adicionarAssessor,
  removerAssessor,
  toggleAssessor,
} from '../../api'
import type { Assessor } from '../../types'

// ---------------------------------------------------------------------------
// Tipos auxiliares
// ---------------------------------------------------------------------------

interface Usuario {
  id: number
  username: string
  full_name: string
  is_active: boolean
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function AssessoresConfig() {
  const { toast } = useToast()

  const [assessores, setAssessores] = useState<Assessor[]>([])
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loadingAssessores, setLoadingAssessores] = useState(true)
  const [loadingUsuarios, setLoadingUsuarios] = useState(true)

  // Estado para adicionar assessor
  const [novoUsuarioId, setNovoUsuarioId] = useState<string>('')
  const [adicionando, setAdicionando] = useState(false)

  // Estado para confirmar remoção
  const [removendoId, setRemovendoId] = useState<number | null>(null)
  const [confirmRemocaoOpen, setConfirmRemocaoOpen] = useState(false)
  const [assessorParaRemover, setAssessorParaRemover] = useState<Assessor | null>(null)

  // Estado dos toggles em andamento (previne duplo clique)
  const [toggling, setToggling] = useState<Set<number>>(new Set())

  // ---------------------------------------------------------------------------
  // Carregamento inicial
  // ---------------------------------------------------------------------------

  const carregarAssessores = async () => {
    try {
      setLoadingAssessores(true)
      const data = await fetchAssessores()
      setAssessores(data)
    } catch {
      toast({
        title: 'Erro ao carregar assessores',
        description: 'Não foi possível buscar a lista de assessores.',
        variant: 'destructive',
      })
    } finally {
      setLoadingAssessores(false)
    }
  }

  const carregarUsuarios = async () => {
    try {
      setLoadingUsuarios(true)
      const data = await usersApi.get<Usuario[]>('?skip=0&limit=500')
      setUsuarios(data.filter((u) => u.is_active))
    } catch {
      // Falha silenciosa — a lista de usuários é secundária
      setUsuarios([])
    } finally {
      setLoadingUsuarios(false)
    }
  }

  useEffect(() => {
    void carregarAssessores()
    void carregarUsuarios()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Usuários disponíveis para adicionar (não são assessores ainda)
  // ---------------------------------------------------------------------------

  const idsAssessores = useMemo(
    () => new Set(assessores.map((a) => a.usuario_id)),
    [assessores]
  )

  const usuariosDisponiveis = useMemo(
    () => usuarios.filter((u) => !idsAssessores.has(u.id)),
    [usuarios, idsAssessores]
  )

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleAdicionar = async () => {
    const usuarioId = Number(novoUsuarioId)
    if (!usuarioId) return

    setAdicionando(true)
    try {
      await adicionarAssessor(usuarioId)
      toast({
        title: 'Assessor adicionado',
        description: 'O usuário foi cadastrado como assessor.',
      })
      setNovoUsuarioId('')
      await carregarAssessores()
    } catch (error) {
      toast({
        title: 'Erro ao adicionar assessor',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
        variant: 'destructive',
      })
    } finally {
      setAdicionando(false)
    }
  }

  const handleToggle = async (assessor: Assessor) => {
    if (toggling.has(assessor.id)) return

    setToggling((prev) => new Set(prev).add(assessor.id))
    try {
      await toggleAssessor(assessor.id, !assessor.ativo)
      setAssessores((prev) =>
        prev.map((a) => (a.id === assessor.id ? { ...a, ativo: !assessor.ativo } : a))
      )
    } catch (error) {
      toast({
        title: 'Erro ao alterar status',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
        variant: 'destructive',
      })
    } finally {
      setToggling((prev) => {
        const next = new Set(prev)
        next.delete(assessor.id)
        return next
      })
    }
  }

  const handleRemoverClick = (assessor: Assessor) => {
    setAssessorParaRemover(assessor)
    setConfirmRemocaoOpen(true)
  }

  const handleRemoverConfirmar = async () => {
    if (!assessorParaRemover) return

    setRemovendoId(assessorParaRemover.id)
    try {
      await removerAssessor(assessorParaRemover.id)
      toast({
        title: 'Assessor removido',
        description: `${assessorParaRemover.nome} foi removido da lista de assessores.`,
      })
      setAssessores((prev) => prev.filter((a) => a.id !== assessorParaRemover.id))
      setConfirmRemocaoOpen(false)
      setAssessorParaRemover(null)
    } catch (error) {
      toast({
        title: 'Erro ao remover assessor',
        description: error instanceof Error ? error.message : 'Erro desconhecido.',
        variant: 'destructive',
      })
    } finally {
      setRemovendoId(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const loading = loadingAssessores

  return (
    <>
      <BreadcrumbBar
        title="Configuração de Assessores"
        icon={<UserCog className="w-3.5 h-3.5" />}
        backTo="/revisao"
      />

      <ContentArea className="space-y-8">
        {/* Seção: Adicionar assessor */}
        <div
          className="rounded-2xl border p-6 shadow-sm bg-white space-y-4"
          style={{ borderColor: C.gray200 }}
        >
          <div>
            <h2 className="text-base font-semibold" style={{ color: C.text900 }}>
              Adicionar Assessor
            </h2>
            <p className="text-sm mt-0.5" style={{ color: C.text400 }}>
              Selecione um usuário ativo do sistema para cadastrá-lo como assessor da fila de revisão.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Select
              value={novoUsuarioId}
              onValueChange={setNovoUsuarioId}
              disabled={loadingUsuarios || adicionando}
            >
              <SelectTrigger className="w-72 h-9">
                <SelectValue
                  placeholder={
                    loadingUsuarios
                      ? 'Carregando usuários...'
                      : usuariosDisponiveis.length === 0
                        ? 'Todos os usuários já são assessores'
                        : 'Selecione um usuário...'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {usuariosDisponiveis.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.full_name}
                    <span className="ml-1 text-xs" style={{ color: C.text400 }}>
                      ({u.username})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => void handleAdicionar()}
              disabled={!novoUsuarioId || adicionando}
              style={{ background: C.navy950, color: 'white' }}
              className="h-9 px-4"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              {adicionando ? 'Adicionando...' : 'Adicionar'}
            </Button>
          </div>
        </div>

        {/* Seção: Tabela de assessores */}
        <div
          className="rounded-2xl border overflow-hidden shadow-sm bg-white"
          style={{ borderColor: C.gray200 }}
        >
          {/* Cabeçalho da seção */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: C.gray100 }}
          >
            <div>
              <h2 className="text-base font-semibold" style={{ color: C.text900 }}>
                Assessores Cadastrados
              </h2>
              <p className="text-sm mt-0.5" style={{ color: C.text400 }}>
                {assessores.length > 0
                  ? `${assessores.filter((a) => a.ativo).length} ativo(s) · ${assessores.filter((a) => !a.ativo).length} inativo(s)`
                  : 'Nenhum assessor cadastrado'}
              </p>
            </div>
            <Badge
              variant="secondary"
              style={{ background: C.navy50, color: C.navy700 }}
            >
              {assessores.length} total
            </Badge>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Cadastrado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-sm"
                    style={{ color: C.text400 }}
                  >
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : assessores.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-center py-12 text-sm"
                    style={{ color: C.text400 }}
                  >
                    Nenhum assessor cadastrado. Adicione um acima.
                  </TableCell>
                </TableRow>
              ) : (
                assessores.map((assessor) => (
                  <TableRow key={assessor.id}>
                    {/* Nome */}
                    <TableCell>
                      <span className="font-medium text-sm" style={{ color: C.text900 }}>
                        {assessor.nome}
                      </span>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <Badge
                        variant={assessor.ativo ? 'default' : 'secondary'}
                        style={
                          assessor.ativo
                            ? { background: '#dcfce7', color: '#166534' }
                            : { background: C.gray100, color: C.gray600 }
                        }
                      >
                        {assessor.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>

                    {/* Cadastrado em */}
                    <TableCell>
                      <span className="text-xs" style={{ color: C.text400 }}>
                        {new Date(assessor.criado_em).toLocaleDateString('pt-BR')}
                      </span>
                    </TableCell>

                    {/* Ações */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* Toggle ativo/inativo */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void handleToggle(assessor)}
                          disabled={toggling.has(assessor.id)}
                          className="text-xs h-7 px-2.5"
                        >
                          {toggling.has(assessor.id)
                            ? '...'
                            : assessor.ativo
                              ? 'Desativar'
                              : 'Ativar'}
                        </Button>

                        {/* Remover */}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleRemoverClick(assessor)}
                          disabled={removendoId === assessor.id}
                          className="text-xs h-7 px-2.5"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remover
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ContentArea>

      {/* Dialog de confirmação de remoção */}
      <Dialog open={confirmRemocaoOpen} onOpenChange={setConfirmRemocaoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Remoção</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover{' '}
              <span className="font-semibold">{assessorParaRemover?.nome}</span> da lista de
              assessores? Os itens já encaminhados a ele não serão afetados.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmRemocaoOpen(false)}
              disabled={removendoId !== null}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleRemoverConfirmar()}
              disabled={removendoId !== null}
            >
              {removendoId !== null ? 'Removendo...' : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
