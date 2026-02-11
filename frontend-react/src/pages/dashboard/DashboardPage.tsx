import { useAuthStore } from '@/stores/auth-store'
import { PageContainer } from '@/components/layout'
import { systemCards, adminCards } from './constants'
import { SystemCard } from './SystemCard'
import { AdminCard } from './AdminCard'

/**
 * Página inicial (Dashboard) — réplica pixel-perfect do legado.
 * Grid de system cards + painel admin (apenas para admins).
 */
export function DashboardPage() {
  const { user } = useAuthStore()

  return (
    <PageContainer className="space-y-8">
      {/* Boas-vindas */}
      <div>
        <h2 className="text-2xl font-bold text-gray-800">
          Bem-vindo ao Portal
        </h2>
        <p className="text-gray-500 mt-1">
          Selecione um sistema para começar
        </p>
      </div>

      {/* Grid de sistemas */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {systemCards.map((card) => (
          <SystemCard key={card.to} card={card} />
        ))}
      </div>

      {/* Painel Admin */}
      {user?.is_admin && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            Administração
          </h3>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {adminCards.map((card) => (
                <AdminCard key={card.to} card={card} />
              ))}
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
