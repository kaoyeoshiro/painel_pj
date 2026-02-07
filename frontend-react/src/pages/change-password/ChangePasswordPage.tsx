import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Loader2, AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'

/**
 * Página de troca de senha
 * Permite ao usuário alterar sua senha após autenticado
 */
export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()
  const { toast } = useToast()

  const validateForm = (): boolean => {
    setError('')

    if (!currentPassword) {
      setError('Digite a senha atual')
      return false
    }

    if (!newPassword) {
      setError('Digite a nova senha')
      return false
    }

    if (newPassword.length < 6) {
      setError('A nova senha deve ter no mínimo 6 caracteres')
      return false
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não conferem')
      return false
    }

    if (currentPassword === newPassword) {
      setError('A nova senha deve ser diferente da atual')
      return false
    }

    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsLoading(true)

    try {
      await authApi.post('/auth/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })

      toast({
        title: 'Senha alterada com sucesso',
        description: 'Sua senha foi atualizada.',
        variant: 'default',
      })

      // Limpa o formulário
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      // Volta para o dashboard após 1.5s
      setTimeout(() => {
        navigate({ to: '/dashboard' })
      }, 1500)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erro ao alterar senha'
      setError(errorMessage)
      toast({
        title: 'Erro ao alterar senha',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Botão voltar */}
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => navigate({ to: '/dashboard' })}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      {/* Card principal */}
      <Card>
        <CardHeader>
          <CardTitle>Trocar Senha</CardTitle>
          <CardDescription>
            Altere sua senha de acesso ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Erro */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Senha atual */}
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                required
                disabled={isLoading}
              />
            </div>

            {/* Nova senha */}
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Digite a nova senha"
                required
                disabled={isLoading}
              />
              <p className="text-xs text-gray-500">
                Mínimo de 6 caracteres
              </p>
            </div>

            {/* Confirmar senha */}
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a nova senha novamente"
                required
                disabled={isLoading}
              />
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Alterando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Alterar Senha
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: '/dashboard' })}
                disabled={isLoading}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
