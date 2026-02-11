import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { C } from '@/lib/designTokens'
import { systemCards, adminCards } from './constants'
import { ChevronRight, ChevronDown, Settings } from 'lucide-react'
import type { SystemCardConfig, AdminCardConfig } from './types'

// ============================================================
// Helpers
// ============================================================

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

// ============================================================
// Module Card — PGE Design System
// Navy at rest, orange on hover
// ============================================================

function ModuleCard({ card }: { card: SystemCardConfig }) {
  const [hovered, setHovered] = useState(false)
  const Icon = card.icon

  return (
    <Link
      to={card.to}
      className="group relative flex h-full flex-col overflow-hidden rounded-2xl border"
      style={{
        background: '#fff',
        borderColor: hovered ? C.orange400 : C.gray200,
        boxShadow: hovered
          ? `0 8px 32px rgba(245,134,52,0.12), 0 0 0 1px ${C.orange400}`
          : '0 1px 3px rgba(0,0,0,0.03)',
        transition: 'all 0.25s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Top accent bar — navy at rest, orange on hover */}
      <div
        className="h-1"
        style={{
          background: hovered
            ? `linear-gradient(90deg, ${C.orange500}, ${C.orange400})`
            : `linear-gradient(90deg, ${C.navy950}, ${C.navy500})`,
          opacity: hovered ? 1 : 0.4,
          transition: 'all 0.25s ease',
        }}
      />

      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Icon + Title */}
        <div className="flex items-center" style={{ gap: 16, marginBottom: 16 }}>
          <div
            className="flex flex-shrink-0 items-center justify-center rounded-xl"
            style={{
              width: 52,
              height: 52,
              background: hovered ? C.orange500 : C.navy100,
              color: hovered ? '#fff' : C.navy700,
              transition: 'all 0.25s ease',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <Icon style={{ width: 26, height: 26 }} />
          </div>
          <h3
            className="font-bold leading-snug"
            style={{ color: C.text900, fontSize: 17 }}
          >
            {card.title}
          </h3>
        </div>

        {/* Description */}
        <p
          className="flex-1 leading-relaxed"
          style={{ color: C.text500, fontSize: 15 }}
        >
          {card.description}
        </p>

        {/* CTA — navy at rest, orange on hover */}
        <div className="flex items-center" style={{ gap: 6, marginTop: 16 }}>
          <span
            className="font-bold"
            style={{
              fontSize: 15,
              color: hovered ? C.orange500 : C.navy600,
              transition: 'color 0.2s',
            }}
          >
            Acessar
          </span>
          <div
            style={{
              color: hovered ? C.orange500 : C.navy600,
              transition: 'all 0.2s',
              transform: hovered ? 'translateX(4px)' : 'translateX(0)',
            }}
          >
            <ChevronRight style={{ width: 16, height: 16 }} />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ============================================================
// Admin Card — PGE Design System
// Gray at rest, navy on hover
// ============================================================

function AdminItem({ card }: { card: AdminCardConfig }) {
  const [hovered, setHovered] = useState(false)
  const Icon = card.icon

  return (
    <Link
      to={card.to}
      className="flex items-center rounded-xl"
      style={{
        gap: 16,
        padding: '12px 16px',
        background: hovered ? C.navy50 : 'transparent',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="flex flex-shrink-0 items-center justify-center rounded-lg"
        style={{
          width: 40,
          height: 40,
          background: hovered ? C.navy100 : C.gray100,
          color: hovered ? C.navy900 : C.gray500,
          transition: 'all 0.15s ease',
        }}
      >
        <Icon style={{ width: 20, height: 20 }} />
      </div>
      <div className="min-w-0">
        <p
          className="truncate font-semibold"
          style={{ color: C.text900, fontSize: 16 }}
        >
          {card.title}
        </p>
        <p className="truncate" style={{ color: C.text400, fontSize: 14 }}>
          {card.subtitle}
        </p>
      </div>
    </Link>
  )
}

// ============================================================
// Main Dashboard — PGE Design System
// ============================================================

export function DashboardPageV2() {
  const { user } = useAuthStore()
  const [adminOpen, setAdminOpen] = useState(true)
  const firstName =
    user?.full_name?.split(' ')[0] ?? user?.username ?? 'Usuario'

  return (
    <div className="mx-auto max-w-pge px-4 py-8 sm:px-6 lg:px-10">
        {/* Greeting */}
        <div style={{ paddingBottom: 32 }}>
          <p
            className="font-medium"
            style={{ color: C.text400, fontSize: 16, marginBottom: 6 }}
          >
            {formatDate()}
          </p>
          <h1
            className="font-bold"
            style={{
              color: C.text900,
              fontSize: 32,
              letterSpacing: '-0.02em',
            }}
          >
            {getGreeting()}, {firstName}
          </h1>
        </div>

        {/* Module Grid */}
        <div
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          style={{ gap: 20, alignItems: 'stretch' }}
        >
          {systemCards.map((card, i) => (
            <div
              key={card.to}
              className="fade-up flex"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <ModuleCard card={card} />
            </div>
          ))}
        </div>

        {/* Admin section */}
        {user?.is_admin && (
          <section
            className="fade-up"
            style={{ animationDelay: '450ms', marginTop: 56 }}
          >
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className="flex cursor-pointer items-center"
              style={{ gap: 10, marginBottom: 20, background: 'none', border: 'none', padding: 0 }}
            >
              <div
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 34,
                  height: 34,
                  background: C.gray200,
                  color: C.gray500,
                }}
              >
                <Settings style={{ width: 18, height: 18 }} />
              </div>
              <span
                className="font-bold uppercase"
                style={{
                  fontSize: 14,
                  letterSpacing: '0.08em',
                  color: C.text400,
                }}
              >
                Administracao
              </span>
              <ChevronDown
                style={{
                  width: 18,
                  height: 18,
                  color: C.text400,
                  transform: adminOpen ? 'rotate(0)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {adminOpen && (
              <div
                className="grid rounded-2xl border"
                style={{
                  background: '#fff',
                  borderColor: C.gray200,
                  padding: 10,
                  gap: 4,
                  gridTemplateColumns: 'repeat(4, 1fr)',
                }}
              >
                {adminCards.map((card) => (
                  <AdminItem key={card.to} card={card} />
                ))}
              </div>
            )}
          </section>
        )}
    </div>
  )
}
