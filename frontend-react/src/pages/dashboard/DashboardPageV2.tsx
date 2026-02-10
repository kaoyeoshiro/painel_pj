import { useAuthStore } from '@/stores/auth-store'
import { systemCards, adminCards } from './constants'
import { WelcomeHeader } from './WelcomeHeader'
import { SystemCardV2 } from './SystemCardV2'
import { AdminCardV2 } from './AdminCardV2'
import { Settings } from 'lucide-react'

export function DashboardPageV2() {
  const { user } = useAuthStore()

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <WelcomeHeader />

      {/* Systems */}
      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-stone-400">
          Sistemas
        </h2>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {systemCards.map((card) => (
            <SystemCardV2 key={card.to} card={card} />
          ))}
        </div>
      </section>

      {/* Admin */}
      {user?.is_admin && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-2">
            <Settings className="h-3.5 w-3.5 text-stone-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Administracao
            </h2>
          </div>
          <div className="rounded-2xl border border-stone-200/60 bg-white">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {adminCards.map((card, i) => (
                <div
                  key={card.to}
                  className={
                    i < adminCards.length - (adminCards.length % 3 || 3)
                      ? 'border-b border-stone-100'
                      : ''
                  }
                >
                  <AdminCardV2 card={card} />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
