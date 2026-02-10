import { useAuthStore } from '@/stores/auth-store'
import { PageContainer } from '@/components/layout'
import { systemCards, adminCards } from './constants'
import { WelcomeHeader } from './WelcomeHeader'
import { SystemCardV2 } from './SystemCardV2'
import { AdminCardV2 } from './AdminCardV2'

/**
 * Dashboard V2 — TailAdmin visual style.
 * Contextual greeting, vertical system cards with gradient icons,
 * compact admin grid.
 */
export function DashboardPageV2() {
  const { user } = useAuthStore()

  return (
    <PageContainer className="space-y-8">
      <WelcomeHeader />

      {/* Systems grid */}
      <section>
        <h3 className="mb-4 text-lg font-semibold text-gray-800">
          Sistemas
        </h3>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {systemCards.map((card) => (
            <SystemCardV2 key={card.to} card={card} />
          ))}
        </div>
      </section>

      {/* Admin grid */}
      {user?.is_admin && (
        <section>
          <h3 className="mb-4 text-lg font-semibold text-gray-800">
            Administração
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {adminCards.map((card) => (
              <AdminCardV2 key={card.to} card={card} />
            ))}
          </div>
        </section>
      )}
    </PageContainer>
  )
}
