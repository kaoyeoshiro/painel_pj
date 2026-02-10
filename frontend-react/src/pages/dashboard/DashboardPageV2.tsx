import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'
import { systemCards, adminCards } from './constants'
import { ChevronRight, ChevronDown, Settings } from 'lucide-react'
import type { SystemCardConfig, AdminCardConfig } from './types'

// ============================================================
// PGE Design System — Color Tokens
// ============================================================

const C = {
  teal900: '#294964',
  teal700: '#2d5a7b',
  teal600: '#356a8e',
  teal500: '#51A8B1',
  teal100: '#e0f0f2',
  teal50: '#f2f9fa',
  orange500: '#F58634',
  orange400: '#f79a54',
  gray200: '#e5e7eb',
  gray100: '#f3f4f6',
  gray500: '#9ca3af',
  text900: '#1a2332',
  text500: '#64748b',
  text400: '#94a3b8',
}

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
// Teal at rest, orange on hover
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
      {/* Top accent bar — teal at rest, orange on hover */}
      <div
        className="h-1"
        style={{
          background: hovered
            ? `linear-gradient(90deg, ${C.orange500}, ${C.orange400})`
            : `linear-gradient(90deg, ${C.teal900}, ${C.teal500})`,
          opacity: hovered ? 1 : 0.4,
          transition: 'all 0.25s ease',
        }}
      />

      <div className="flex flex-1 flex-col p-4">
        {/* Icon + Title */}
        <div className="mb-3 flex items-center gap-3">
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
            style={{
              background: hovered ? C.orange500 : C.teal100,
              color: hovered ? '#fff' : C.teal700,
              transition: 'all 0.25s ease',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
            }}
          >
            <Icon className="h-5 w-5" />
          </div>
          <h3
            className="font-bold leading-snug"
            style={{ color: C.text900, fontSize: 15 }}
          >
            {card.title}
          </h3>
        </div>

        {/* Description */}
        <p
          className="flex-1 leading-relaxed"
          style={{ color: C.text500, fontSize: 13 }}
        >
          {card.description}
        </p>

        {/* CTA — teal at rest, orange on hover */}
        <div className="mt-3 flex items-center gap-1">
          <span
            className="font-bold"
            style={{
              fontSize: 13,
              color: hovered ? C.orange500 : C.teal600,
              transition: 'color 0.2s',
            }}
          >
            Acessar
          </span>
          <div
            style={{
              color: hovered ? C.orange500 : C.teal600,
              transition: 'all 0.2s',
              transform: hovered ? 'translateX(4px)' : 'translateX(0)',
            }}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ============================================================
// Admin Card — PGE Design System
// Gray at rest, teal on hover
// ============================================================

function AdminItem({ card }: { card: AdminCardConfig }) {
  const [hovered, setHovered] = useState(false)
  const Icon = card.icon

  return (
    <Link
      to={card.to}
      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5"
      style={{
        background: hovered ? C.teal50 : 'transparent',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{
          background: hovered ? C.teal100 : C.gray100,
          color: hovered ? C.teal700 : C.gray500,
          transition: 'all 0.15s ease',
        }}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p
          className="truncate font-semibold"
          style={{ color: C.text900, fontSize: 13 }}
        >
          {card.title}
        </p>
        <p className="truncate" style={{ color: C.text400, fontSize: 12 }}>
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
    <div style={{ fontFamily: "var(--font-ui, 'Plus Jakarta Sans', system-ui, sans-serif)" }}>
      <div
        className="mx-auto px-8 py-8"
        style={{ maxWidth: 1080 }}
      >
        {/* Greeting */}
        <div style={{ paddingBottom: 28 }}>
          <p
            className="font-medium"
            style={{ color: C.text400, fontSize: 15, marginBottom: 4 }}
          >
            {formatDate()}
          </p>
          <h1
            className="font-bold"
            style={{
              color: C.text900,
              fontSize: 28,
              letterSpacing: '-0.02em',
            }}
          >
            {getGreeting()}, {firstName}
          </h1>
        </div>

        {/* Module Grid */}
        <div
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          style={{ alignItems: 'stretch' }}
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
            style={{ animationDelay: '450ms', marginTop: 48 }}
          >
            <button
              onClick={() => setAdminOpen(!adminOpen)}
              className="mb-4 flex cursor-pointer items-center gap-2"
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <div
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 28,
                  height: 28,
                  background: C.gray200,
                  color: C.gray500,
                }}
              >
                <Settings className="h-3.5 w-3.5" />
              </div>
              <span
                className="font-bold uppercase"
                style={{
                  fontSize: 13,
                  letterSpacing: '0.08em',
                  color: C.text400,
                }}
              >
                Administracao
              </span>
              <ChevronDown
                className="h-4 w-4"
                style={{
                  color: C.text400,
                  transform: adminOpen ? 'rotate(0)' : 'rotate(-90deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>

            {adminOpen && (
              <div
                className="grid gap-0.5 rounded-2xl border"
                style={{
                  background: '#fff',
                  borderColor: C.gray200,
                  padding: 8,
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
    </div>
  )
}
