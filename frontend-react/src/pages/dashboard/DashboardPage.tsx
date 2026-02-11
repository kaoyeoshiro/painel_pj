import { useAuthStore } from '@/stores/auth-store'
import { C, FONT_UI } from '@/lib/designTokens'
import { systemCards, adminCards } from './constants'
import { SystemCard } from './SystemCard'
import { AdminCard } from './AdminCard'

/**
 * Pagina inicial (Dashboard) — grid de sistemas + painel admin.
 */
export function DashboardPage() {
  const user = useAuthStore(s => s.user)

  return (
    <div style={{ fontFamily: FONT_UI, maxWidth: 1350, margin: '0 auto', padding: '32px 40px' }}>
      <div className="space-y-8">
        {/* Boas-vindas */}
        <div>
          <h2 className="text-2xl font-bold" style={{ color: C.text900 }}>
            Bem-vindo ao Portal
          </h2>
          <p className="mt-1" style={{ color: C.text500 }}>
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
            <h3 className="text-lg font-semibold mb-4" style={{ color: C.text900 }}>
              Administração
            </h3>
            <div className="bg-white rounded-2xl shadow-sm p-6" style={{ border: `1px solid ${C.gray200}` }}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {adminCards.map((card) => (
                  <AdminCard key={card.to} card={card} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
