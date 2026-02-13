/**
 * Header da aplicacao — PGE Design System
 * Fundo navy.950, logo PGE branco direto sobre fundo escuro,
 * Memoizado para evitar re-render em mudanca de rota (AppLayout re-renderiza via useRouterState)
 */

import { memo } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { useNavigate } from '@tanstack/react-router'
import { Menu, Home, KeyRound, LogOut } from 'lucide-react'
import logo from '@/assets/logo-pge-branco.png'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

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
    <header className="w-full flex flex-col bg-[#22314B] border-b border-white/10 shadow-md">

      {/* BLOCO INSTITUCIONAL */}
      <div className="h-20 flex items-center justify-between px-4 sm:px-8">

        {/* ESQUERDA: LOGO + IDENTIDADE */}
        <div className="flex items-center gap-6">

          {/* BOTÃO MENU — MOBILE */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="text-white hover:bg-white/10 rounded-full lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </Button>

          {/* HOME — volta ao dashboard */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate({ to: '/dashboard' })}
            className="text-white hover:bg-white/10 rounded-full hidden lg:flex"
            title="Ir para o Dashboard"
          >
            <Home className="h-5 w-5" />
          </Button>

          {/* LOGO */}
          <img
            src={logo}
            alt="PGE-MS"
            className="h-12 sm:h-14 w-auto object-contain"
          />

          {/* DIVISOR */}
          <div className="h-8 w-[1px] bg-white/20 hidden lg:block" />

          {/* NOME DO SISTEMA */}
          <div className="hidden lg:flex flex-col">
            <span className="text-white font-bold text-lg leading-none">
              Procuradoria-Geral do Estado
            </span>
            <span className="text-white/50 text-xs">
              Mato Grosso do Sul
            </span>
          </div>
        </div>

        {/* DIREITA: USUÁRIO */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 px-3 text-white/90 hover:bg-white/10 gap-3">

              <Avatar className="h-8 w-8 border border-white/20">
                <AvatarFallback className="bg-[#F58634] text-[11px] font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              <div className="hidden sm:flex flex-col items-start leading-tight">
                <span className="text-sm font-semibold">
                  {user?.full_name?.split(' ')[0]}
                </span>
                <span className="text-[11px] text-white/50">
                  Usuário autenticado
                </span>
              </div>

            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: '/change-password' })}>
              <KeyRound className="mr-2 h-4 w-4" /> Alterar Senha
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* FAIXA INSTITUCIONAL */}
      <div className="h-[4px] w-full bg-[#F58634]" />
    </header>
  )
})
