import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { authApi } from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Loader2, AlertCircle, Lock, KeyRound, Eye, EyeOff, CheckCircle2 } from 'lucide-react'

/**
 * Página de troca de senha — réplica pixel-perfect do legado.
 * Layout centralizado com card, ícones nos inputs, indicador de força.
 */
export function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const navigate = useNavigate()
  const { toast } = useToast()

  const checkPasswordStrength = (password: string) => {
    const checks = {
      length: password.length >= 8,
      upper: /[A-Z]/.test(password),
      lower: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/~`';]/.test(password),
    }
    const score = Object.values(checks).filter(Boolean).length
    return { checks, score }
  }

  const getStrengthInfo = (score: number) => {
    if (score <= 1) return { label: 'Muito fraca', color: 'bg-red-500', bars: 1 }
    if (score === 2) return { label: 'Fraca', color: 'bg-orange-500', bars: 2 }
    if (score === 3) return { label: 'Razoável', color: 'bg-yellow-500', bars: 3 }
    if (score === 4) return { label: 'Boa', color: 'bg-lime-500', bars: 4 }
    return { label: 'Forte', color: 'bg-green-500', bars: 4 }
  }

  const { checks, score } = checkPasswordStrength(newPassword)
  const strengthInfo = getStrengthInfo(score)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }
    if (!checks.length) {
      setError('A nova senha deve ter pelo menos 8 caracteres')
      return
    }
    if (!checks.upper) {
      setError('A nova senha deve conter pelo menos uma letra maiúscula')
      return
    }
    if (!checks.lower) {
      setError('A nova senha deve conter pelo menos uma letra minúscula')
      return
    }
    if (!checks.number) {
      setError('A nova senha deve conter pelo menos um número')
      return
    }
    if (!checks.special) {
      setError('A nova senha deve conter pelo menos um caractere especial (!@#$%^&*)')
      return
    }

    setIsLoading(true)

    try {
      await authApi.post('/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      })

      setSuccess('Senha alterada com sucesso! Redirecionando...')
      toast({
        title: 'Senha alterada com sucesso',
        description: 'Sua senha foi atualizada.',
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setTimeout(() => {
        navigate({ to: '/dashboard' })
      }, 2000)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Erro ao alterar senha'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const requirementItems = [
    { key: 'length', label: 'Mínimo de 8 caracteres', met: checks.length },
    { key: 'upper', label: 'Uma letra maiúscula', met: checks.upper },
    { key: 'lower', label: 'Uma letra minúscula', met: checks.lower },
    { key: 'number', label: 'Um número', met: checks.number },
    { key: 'special', label: 'Um caractere especial (!@#$%^&*)', met: checks.special },
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-gray-200 p-4">
      <div className="w-full max-w-md">
        {/* Logo e Título */}
        <div className="text-center mb-8">
          <img
            src="/logo/logo-pge.png"
            alt="PGE-MS"
            className="h-16 mx-auto mb-4"
          />
          <h1 className="text-2xl font-bold text-gray-800">Alterar Senha</h1>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {/* Mensagem de erro */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mensagem de sucesso */}
          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Senha Atual */}
            <div>
              <label
                htmlFor="current-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Senha Atual
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  id="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Digite sua senha atual"
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Nova Senha */}
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Nova Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                  <KeyRound className="h-4 w-4" />
                </span>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  id="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Indicador de força */}
              {newPassword.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4].map((bar) => (
                      <div
                        key={bar}
                        className={`h-1 flex-1 rounded ${
                          bar <= strengthInfo.bars
                            ? strengthInfo.color
                            : 'bg-gray-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-gray-500">
                    Força: {strengthInfo.label}
                  </p>
                </div>
              )}

              {/* Requisitos */}
              <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-xs font-medium text-gray-600 mb-2">
                  A senha deve conter:
                </p>
                <ul className="text-xs space-y-1">
                  {requirementItems.map((req) => (
                    <li
                      key={req.key}
                      className={`flex items-center gap-2 ${
                        req.met ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {req.met ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      )}
                      {req.label}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Confirmar Nova Senha */}
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-400 pointer-events-none">
                  <KeyRound className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  id="confirm-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme a nova senha"
                  required
                  disabled={isLoading}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors disabled:opacity-50"
                />
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3 pt-2">
              <a
                href="/dashboard"
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors text-center"
              >
                Cancelar
              </a>
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-primary-600 text-white py-3 rounded-lg font-semibold hover:bg-primary-700 focus:ring-4 focus:ring-primary-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Alterando...</span>
                  </>
                ) : (
                  <span>Alterar Senha</span>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-sm mt-6">
          &copy; 2025 PGE-MS &bull; Todos os direitos reservados
        </p>
      </div>
    </div>
  )
}
