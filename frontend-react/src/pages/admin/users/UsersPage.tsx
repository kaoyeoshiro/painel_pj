import { useState, useEffect } from 'react'
import { adminApi } from '@/lib/api'
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

// Tipos de dados
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
}

interface UserCreate {
  username: string
  full_name: string
  email?: string
  setor?: string
  role: 'user' | 'admin'
  password?: string
  sistemas_permitidos?: string[] | null
}

interface UserUpdate {
  full_name?: string
  email?: string
  setor?: string
  role?: 'user' | 'admin'
  is_active?: boolean
  sistemas_permitidos?: string[] | null
}

// Opcoes de sistemas
const SISTEMAS = [
  { id: 'matriculas', label: 'Matriculas Confrontantes' },
  { id: 'assistencia_judiciaria', label: 'Assistencia Judiciaria' },
  { id: 'gerador_pecas', label: 'Gerador de Pecas' },
  { id: 'pedido_calculo', label: 'Pedido de Calculo' },
  { id: 'prestacao_contas', label: 'Prestacao de Contas' },
  { id: 'relatorio_cumprimento', label: 'Relatorio de Cumprimento' },
]

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
  const [formData, setFormData] = useState<UserCreate>({
    username: '',
    full_name: '',
    email: '',
    setor: '',
    role: 'user',
    password: '',
    sistemas_permitidos: [],
  })

  // Carregar usuarios
  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      setLoading(true)
      const data = await adminApi.get<User[]>('/users?skip=0&limit=200')
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
    })
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
    })
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
          sistemas_permitidos: formData.sistemas_permitidos,
        }
        await adminApi.put(`/users/${editingUser.id}`, updateData)
        toast({
          title: 'Usuario atualizado',
          description: 'Usuario atualizado com sucesso',
        })
      } else {
        // Criar novo usuario
        await adminApi.post('/users', formData)
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
      await adminApi.delete(`/users/${deletingUser.id}`)
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
      const response = await adminApi.post<{ message: string; new_password: string }>(
        `/users/${user.id}/reset-password`,
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

  // Colunas da tabela
  const columns = [
    {
      accessor: 'username',
      header: 'Username',
      render: (_value: unknown, user: User) => user.username,
    },
    {
      accessor: 'full_name',
      header: 'Nome',
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
      header: 'Data',
      render: (_value: unknown, user: User) => new Date(user.created_at).toLocaleDateString('pt-BR'),
    },
    {
      accessor: 'id',
      header: 'Acoes',
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Gerenciar Usuarios</h1>
        <Button onClick={handleCreate}>Novo Usuario</Button>
      </div>

      <Card className="p-6">
        <DataTable
          data={users}
          columns={columns}
          isLoading={loading}
        />
      </Card>

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
    </div>
  )
}
