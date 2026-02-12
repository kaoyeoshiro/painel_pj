import { memo } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { useNavigate } from '@tanstack/react-router'
import { Menu, ChevronDown, KeyRound, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { C, FONT_UI } from '@/lib/designTokens'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Header da aplicacao — PGE Design System
 * Fundo navy.950, logo PGE branco direto sobre fundo escuro, avatar laranja a direita
 * Memoizado para evitar re-render em mudanca de rota (AppLayout re-renderiza via useRouterState)
 */
export const Header = memo(function Header() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const toggleSidebar = useUiStore(s => s.toggleSidebar)
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate({ to: '/login' })
  }

  const initials = user?.full_name
    ? user.full_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase()
    : 'U'

  return (
    <header style={{ background: C.navy950, fontFamily: FONT_UI }}>
      <div className="flex h-20 items-center justify-between px-5 sm:px-7">
        {/* Esquerda: hamburger (mobile) + logo PGE */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-white/70 hover:text-white hover:bg-white/10"
            onClick={toggleSidebar}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex items-center gap-1">
            {/* Logo PGE branco — direto sobre fundo escuro */}
            <img
              src="/logo/logo-pge-branco.png"
              alt="PGE-MS"
              className="h-[78px] w-auto object-contain"
            />
            {/* Divider + org name */}
            <div
              className="hidden sm:block mx-4 h-10 w-px bg-white/[0.18]"
            />
            <div className="hidden sm:block">
              <p className="font-semibold text-[17px] leading-tight text-white/95">
                Procuradoria-Geral do Estado
              </p>
              <p className="text-sm text-white/50">
                Mato Grosso do Sul
              </p>
            </div>
          </div>
        </div>

        {/* Direita: nome + avatar/dropdown */}
        <div className="flex items-center gap-3">
          <span
            className="hidden sm:block font-medium text-[15px] text-white/70"
          >
            {user?.full_name}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-white/10">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold text-white"
                  style={{ background: C.orange500 }}
                >
                  {initials}
                </div>
                <ChevronDown className="h-4 w-4 text-white/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => navigate({ to: '/change-password' })}>
                <KeyRound className="mr-2 h-4 w-4" />
                Trocar Senha
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Transition to content area */}
      <div className="h-5" style={{ background: C.gray50 }} />
    </header>
  )
})
