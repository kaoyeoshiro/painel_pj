import { useAuthStore } from '@/stores/auth-store'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

function formatDate(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date())
}

export function WelcomeHeader() {
  const { user } = useAuthStore()
  const firstName = user?.full_name?.split(' ')[0] ?? user?.username ?? 'Usuário'
  const initials = getInitials(user?.full_name || user?.username || 'U')

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 text-sm font-semibold text-white shadow-md">
          {initials}
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-800 sm:text-2xl">
            {getGreeting()}, {firstName}!
          </h2>
          <p className="text-sm text-gray-500">
            Portal PGE &mdash; Selecione um sistema para começar
          </p>
        </div>
      </div>
      <span className="hidden text-sm text-gray-400 sm:block">
        {formatDate()}
      </span>
    </div>
  )
}
