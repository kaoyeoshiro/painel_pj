import { useAuthStore } from '@/stores/auth-store'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 6 && hour < 12) return 'Bom dia'
  if (hour >= 12 && hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

function formatDate(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
}

export function WelcomeHeader() {
  const { user } = useAuthStore()
  const firstName = user?.full_name?.split(' ')[0] ?? user?.username ?? 'Usuario'

  return (
    <div className="pb-1">
      <p className="text-xs font-medium uppercase tracking-wider text-stone-400">
        {formatDate()}
      </p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
        {getGreeting()}, {firstName}
      </h1>
    </div>
  )
}
