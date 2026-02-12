import { useState, useEffect, useMemo } from 'react'
import { usersApi } from '@/lib/api'
import { BreadcrumbBar } from '@/components/layout/BreadcrumbBar'
import { ContentArea } from '@/components/layout/ContentArea'
import { C } from '@/lib/designTokens'
import { Users as UsersIcon, UserPlus, Users } from 'lucide-react'
import { DataTable } from '@/components/shared/DataTable'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { Card } from '@/components/ui/card'

// ---------------------------------------------------------------------------
// Tipos de dados
// ---------------------------------------------------------------------------

interface User {
  id: number
  username: string
  full_name: string
  email: string | null
  setor: string | null
  role: 'user' | 'admin'
  is_active: boolean
  created_at: string
  sistemas_permitidos: string[] | null
  content_group_ids?: number[] | null
  pode_curar?: boolean
  pode_exportar?: boolean
  pode_ver_debug?: boolean
  pode_gerenciar_prompts?: boolean
}

interface UserCreate {
  username: string
  full_name: string
  email?: string
  setor?: string
  role: 'user' | 'admin'
  password?: string
  sistemas_permitidos?: string[] | null
  content_group_ids?: number[] | null
  pode_curar?: boolean
  pode_exportar?: boolean
  pode_ver_debug?: boolean
  pode_gerenciar_prompts?: boolean
}

interface UserUpdate {
  full_name?: string
  email?: string
  setor?: string
  role?: 'user' | 'admin'
  is_active?: boolean
  sistemas_permitidos?: string[] | null
  content_group_ids?: number[] | null
  pode_curar?: boolean
  pode_exportar?: boolean
  pode_ver_debug?: boolean
  pode_gerenciar_prompts?: boolean
}

/** Grupo de conteudo retornado pela API */
interface ContentGroup {
  id: number
  nome: string
  descricao: string
}

/** Opcoes de agrupamento da tabela */
type GroupByOption = 'none' | 'sistema' | 'setor'

// Opcoes de sistemas
const SISTEMAS = [
  { id: 'matriculas', label: 'Matriculas Confrontantes' },
  { id: 'assistencia_judiciaria', label: 'Assistencia Judiciaria' },
  { id: 'gerador_pecas', label: 'Gerador de Pecas' },
  { id: 'pedido_calculo', label: 'Pedido de Calculo' },
  { id: 'prestacao_contas', label: 'Prestacao de Contas' },
  { id: 'relatorio_cumprimento', label: 'Relatorio de Cumprimento' },
]

// Definicao das permissoes especiais
const SPECIAL_PERMISSIONS = [
  { key: 'pode_curar', label: 'Pode curar pecas' },
  { key: 'pode_exportar', label: 'Pode exportar dados' },
  { key: 'pode_ver_debug', label: 'Pode ver debug' },
  { key: 'pode_gerenciar_prompts', label: 'Pode gerenciar prompts' },
] as const

export function UsersPage() {
  const { toast } = useToast()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showDialog, setShowDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeleteingUser] = useState<User | null>(null)
  const [newPassword, setNewPassword] = useState<string>('')

  // Estado do filtro "Agrupar por"
  const [groupBy, setGroupBy] = useState<GroupByOption>('none')
  // Secoes colapsadas (armazena nomes dos grupos fechados)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Grupos de conteudo vindos da API
  const [contentGroups, setContentGroups] = useState<ContentGroup[]>([])

  // Formulario de criacao/edicao
  const [formData, setFormData] = useState<UserCreate>({
    username: '',
    full_name: '',
    email: '',
    setor: '',
    role: 'user',
    password: '',
    sistemas_permitidos: [],
    content_group_ids: [],
    pode_curar: false,
    pode_exportar: false,
    pode_ver_debug: false,
    pode_gerenciar_prompts: false,
  })

  // Campo is_active para edicao (separado pois nao existe em UserCreate)
  const [formIsActive, setFormIsActive] = useState(true)

  // Carregar usuarios
  useEffect(() => {
    loadUsers()
    loadContentGroups()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Carrega apenas na montagem
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await usersApi.get<User[]>('?skip=0&limit=200')
      setUsers(data)
    } catch (error) {
      toast({
        title: 'Erro ao carregar usuarios',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  /** Carrega grupos de conteudo disponiveis da API */
  const loadContentGroups = async () => {
    try {
      const data = await usersApi.get<ContentGroup[]>('/content-groups')
      setContentGroups(data)
    } catch (error) {
      // Falha silenciosa — grupos de conteudo sao opcionais
      console.warn('Nao foi possivel carregar grupos de conteudo:', error)
    }
  }

  // Abrir dialog para criar usuario
  const handleCreate = () => {
    setEditingUser(null)
    setFormData({
      username: '',
      full_name: '',
      email: '',
      setor: '',
      role: 'user',
      password: '',
      sistemas_permitidos: [],
      content_group_ids: [],
      pode_curar: false,
      pode_exportar: false,
      pode_ver_debug: false,
      pode_gerenciar_prompts: false,
    })
    setFormIsActive(true)
    setShowDialog(true)
  }

  // Abrir dialog para editar usuario
  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      username: user.username,
      full_name: user.full_name,
      email: user.email || '',
      setor: user.setor || '',
      role: user.role,
      sistemas_permitidos: user.sistemas_permitidos || [],
      content_group_ids: user.content_group_ids || [],
      pode_curar: user.pode_curar ?? false,
      pode_exportar: user.pode_exportar ?? false,
      pode_ver_debug: user.pode_ver_debug ?? false,
      pode_gerenciar_prompts: user.pode_gerenciar_prompts ?? false,
    })
    setFormIsActive(user.is_active)
    setShowDialog(true)
  }

  // Salvar usuario (criar ou editar)
  const handleSave = async () => {
    try {
      if (editingUser) {
        // Editar usuario existente
        const updateData: UserUpdate = {
          full_name: formData.full_name,
          email: formData.email || undefined,
          setor: formData.setor || undefined,
          role: formData.role,
          is_active: formIsActive,
          sistemas_permitidos: formData.sistemas_permitidos,
          content_group_ids: formData.content_group_ids,
          pode_curar: formData.pode_curar,
          pode_exportar: formData.pode_exportar,
          pode_ver_debug: formData.pode_ver_debug,
          pode_gerenciar_prompts: formData.pode_gerenciar_prompts,
        }
        await usersApi.put(`/${editingUser.id}`, updateData)
        toast({
          title: 'Usuario atualizado',
          description: 'Usuario atualizado com sucesso',
        })
      } else {
        // Criar novo usuario
        await usersApi.post('', formData)
        toast({
          title: 'Usuario criado',
          description: 'Usuario criado com sucesso',
        })
      }
      setShowDialog(false)
      loadUsers()
    } catch (error) {
      toast({
        title: 'Erro ao salvar usuario',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  // Abrir dialog de confirmacao de exclusao
  const handleDeleteClick = (user: User) => {
    setDeleteingUser(user)
    setShowDeleteDialog(true)
  }

  // Confirmar exclusao
  const handleDeleteConfirm = async () => {
    if (!deletingUser) return

    // Nao permitir excluir usuario admin
    if (deletingUser.username === 'admin') {
      toast({
        title: 'Operacao nao permitida',
        description: 'Nao e possivel excluir o usuario admin',
        variant: 'destructive',
      })
      setShowDeleteDialog(false)
      return
    }

    try {
      await usersApi.delete(`/${deletingUser.id}`)
      toast({
        title: 'Usuario excluido',
        description: 'Usuario excluido com sucesso',
      })
      setShowDeleteDialog(false)
      loadUsers()
    } catch (error) {
      toast({
        title: 'Erro ao excluir usuario',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  // Resetar senha
  const handleResetPassword = async (user: User) => {
    try {
      const response = await usersApi.post<{ message: string; new_password: string }>(
        `/${user.id}/reset-password`,
        {}
      )
      setNewPassword(response.new_password)
      setShowPasswordDialog(true)
      toast({
        title: 'Senha resetada',
        description: 'Senha resetada com sucesso',
      })
    } catch (error) {
      toast({
        title: 'Erro ao resetar senha',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      })
    }
  }

  // Toggle sistema permitido
  const toggleSistema = (sistemaId: string) => {
    const current = formData.sistemas_permitidos || []
    const updated = current.includes(sistemaId)
      ? current.filter((s) => s !== sistemaId)
      : [...current, sistemaId]
    setFormData({ ...formData, sistemas_permitidos: updated })
  }

  /** Toggle grupo de conteudo selecionado no formulario */
  const toggleContentGroup = (groupId: number) => {
    const current = formData.content_group_ids || []
    const updated = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId]
    setFormData({ ...formData, content_group_ids: updated })
  }

  /** Toggle permissao especial no formulario */
  const togglePermission = (key: keyof Pick<UserCreate, 'pode_curar' | 'pode_exportar' | 'pode_ver_debug' | 'pode_gerenciar_prompts'>) => {
    setFormData({ ...formData, [key]: !formData[key] })
  }

  /** Alterna colapso de um grupo na tabela agrupada */
  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupName)) {
        next.delete(groupName)
      } else {
        next.add(groupName)
      }
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Agrupamento dos usuarios para exibicao
  // ---------------------------------------------------------------------------

  /** Retorna usuarios organizados em grupos conforme a opcao selecionada */
  const groupedUsers = useMemo(() => {
    if (groupBy === 'none') return null

    const groups: Record<string, User[]> = {}

    if (groupBy === 'sistema') {
      // Agrupa por cada sistema permitido (um usuario pode aparecer em varios)
      for (const user of users) {
        const sistemas = user.sistemas_permitidos || []
        if (sistemas.length === 0) {
          const key = 'Sem sistema'
          if (!groups[key]) groups[key] = []
          groups[key].push(user)
        } else {
          for (const sistemaId of sistemas) {
            const sistemaInfo = SISTEMAS.find((s) => s.id === sistemaId)
            const key = sistemaInfo?.label || sistemaId
            if (!groups[key]) groups[key] = []
            groups[key].push(user)
          }
        }
      }
    } else if (groupBy === 'setor') {
      for (const user of users) {
        const key = user.setor || 'Sem setor'
        if (!groups[key]) groups[key] = []
        groups[key].push(user)
      }
    }

    // Ordena nomes dos grupos alfabeticamente
    const sortedEntries = Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b, 'pt-BR')
    )

    return sortedEntries
  }, [users, groupBy])

  // Colunas da tabela
  const columns = [
    {
      accessor: 'username',
      header: 'Usuario',
      render: (_value: unknown, user: User) => user.username,
    },
    {
      accessor: 'full_name',
      header: 'Nome Completo',
      render: (_value: unknown, user: User) => user.full_name,
    },
    {
      accessor: 'setor',
      header: 'Setor',
      render: (_value: unknown, user: User) => user.setor || '-',
    },
    {
      accessor: 'role',
      header: 'Perfil',
      render: (_value: unknown, user: User) => (
        <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
          {user.role === 'admin' ? 'Admin' : 'Usuario'}
        </Badge>
      ),
    },
    {
      accessor: 'is_active',
      header: 'Status',
      render: (_value: unknown, user: User) => (
        <Badge variant={user.is_active ? 'default' : 'secondary'}>
          {user.is_active ? 'Ativo' : 'Inativo'}
        </Badge>
      ),
    },
    {
      accessor: 'created_at',
      header: 'Criado em',
      render: (_value: unknown, user: User) => new Date(user.created_at).toLocaleDateString('pt-BR'),
    },
    {
      accessor: 'id',
      header: 'Ações',
      render: (_value: unknown, user: User) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleEdit(user)}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleResetPassword(user)}
          >
            Resetar Senha
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => handleDeleteClick(user)}
            disabled={user.username === 'admin'}
          >
            Excluir
          </Button>
        </div>
      ),
    },
  ]

  return (
    <>
      <BreadcrumbBar
        title="Gerenciamento de Usuarios"
        icon={<UsersIcon style={{ width: 14, height: 14 }} />}
        actions={
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-2 py-2 rounded-lg border"
              style={{ background: 'white', borderColor: C.gray200 }}
              data-testid="group-by-filter"
            >
              <Label htmlFor="group-by-select" className="text-sm whitespace-nowrap" style={{ color: C.text500 }}>
                Agrupar por:
              </Label>
              <Select
                value={groupBy}
                onValueChange={(value: GroupByOption) => {
                  setGroupBy(value)
                  setCollapsedGroups(new Set())
                }}
              >
                <SelectTrigger
                  id="group-by-select"
                  className="h-8 w-[104px] min-w-0 px-2 py-1 text-sm"
                  style={{ borderColor: C.gray300 }}
                  data-testid="group-by-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  <SelectItem value="sistema">Sistema</SelectItem>
                  <SelectItem value="setor">Setor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleCreate} className="h-10 px-3" style={{ background: C.navy950, color: 'white' }}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Usuario
            </Button>
          </div>
        }
      />
      <ContentArea className="space-y-6">

      {/* Tabela de usuarios — exibicao agrupada ou normal */}
      {groupBy === 'none' || !groupedUsers ? (
        <DataTable
          data={users}
          columns={columns}
          isLoading={loading}
          emptyState={
            <div className="flex flex-col items-center gap-2" style={{ color: C.text400 }}>
              <Users className="h-12 w-12" />
              <span>Nenhum usuario encontrado</span>
            </div>
          }
        />
      ) : (
        <div className="space-y-4" data-testid="grouped-table">
          {groupedUsers.map(([groupName, groupUsers]) => {
            const isCollapsed = collapsedGroups.has(groupName)
            return (
              <Card key={groupName} className="overflow-hidden rounded-2xl" style={{ borderColor: C.gray200 }}>
                {/* Cabecalho do grupo — clicavel para colapsar/expandir */}
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => toggleGroupCollapse(groupName)}
                  data-testid={`group-header-${groupName}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium transition-transform duration-200"
                      style={{ display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                    >
                      ▼
                    </span>
                    <span className="font-semibold text-lg" style={{ color: C.text900 }}>{groupName}</span>
                    <Badge variant="secondary">{groupUsers.length}</Badge>
                  </div>
                </button>

                {/* Conteudo do grupo (colapsavel) */}
                {!isCollapsed && (
                  <div className="px-4 pb-4" data-testid={`group-content-${groupName}`}>
                    <DataTable
                      data={groupUsers}
                      columns={columns}
                      isLoading={loading}
                    />
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Dialog de criacao/edicao */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? 'Editar Usuario' : 'Novo Usuario'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                disabled={!!editingUser}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="full_name">Nome Completo *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="setor">Setor</Label>
              <Input
                id="setor"
                value={formData.setor}
                onChange={(e) => setFormData({ ...formData, setor: e.target.value })}
              />
            </div>

            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha {!editingUser && '*'}</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Perfil *</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'user' | 'admin') => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Toggle "Usuario ativo" — apenas no modo edicao */}
            {editingUser && (
              <div className="flex items-center space-x-2 rounded-md border p-3" data-testid="user-active-toggle">
                <Checkbox
                  id="is_active"
                  checked={formIsActive}
                  onCheckedChange={(checked) => setFormIsActive(checked === true)}
                  data-testid="is-active-checkbox"
                />
                <Label htmlFor="is_active" className="font-normal cursor-pointer">
                  Usuario ativo
                </Label>
                <Badge variant={formIsActive ? 'default' : 'secondary'} className="ml-auto">
                  {formIsActive ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
            )}

            <div className="space-y-2">
              <Label>Sistemas Permitidos</Label>
              <div className="space-y-2">
                {SISTEMAS.map((sistema) => (
                  <div key={sistema.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={sistema.id}
                      checked={(formData.sistemas_permitidos || []).includes(sistema.id)}
                      onCheckedChange={() => toggleSistema(sistema.id)}
                    />
                    <Label htmlFor={sistema.id} className="font-normal cursor-pointer">
                      {sistema.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Secao: Grupos de Conteudo */}
            {contentGroups.length > 0 && (
              <div className="space-y-2" data-testid="content-groups-section">
                <Label>Grupos de Conteudo</Label>
                <div className="space-y-2 rounded-md border p-3">
                  {contentGroups.map((group) => (
                    <div key={group.id} className="flex items-center space-x-2" data-testid={`content-group-${group.id}`}>
                      <Checkbox
                        id={`content-group-${group.id}`}
                        checked={(formData.content_group_ids || []).includes(group.id)}
                        onCheckedChange={() => toggleContentGroup(group.id)}
                        data-testid={`content-group-checkbox-${group.id}`}
                      />
                      <div className="flex flex-col">
                        <Label htmlFor={`content-group-${group.id}`} className="font-normal cursor-pointer">
                          {group.nome}
                        </Label>
                        {group.descricao && (
                          <span className="text-xs text-muted-foreground">{group.descricao}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Secao: Permissoes Especiais */}
            <div className="space-y-2" data-testid="special-permissions-section">
              <Label>Permissoes Especiais</Label>
              <div className="space-y-2 rounded-md border p-3">
                {SPECIAL_PERMISSIONS.map((perm) => (
                  <div key={perm.key} className="flex items-center space-x-2" data-testid={`permission-${perm.key}`}>
                    <Checkbox
                      id={perm.key}
                      checked={formData[perm.key] ?? false}
                      onCheckedChange={() => togglePermission(perm.key)}
                      data-testid={`permission-checkbox-${perm.key}`}
                    />
                    <Label htmlFor={perm.key} className="font-normal cursor-pointer">
                      {perm.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              {editingUser ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmacao de exclusao */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusao</DialogTitle>
          </DialogHeader>
          <p>
            Tem certeza que deseja excluir o usuario <strong>{deletingUser?.username}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de nova senha */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>A senha foi resetada com sucesso. A nova senha e:</p>
            <div className="p-4 bg-muted rounded-md font-mono text-lg">
              {newPassword}
            </div>
            <p className="text-sm text-muted-foreground">
              Anote esta senha, ela nao sera exibida novamente.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPasswordDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </ContentArea>
    </>
  )
}
