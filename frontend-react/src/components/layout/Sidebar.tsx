import { Link, useRouterState } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { useUiStore } from '@/stores/ui-store'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  FileText,
  FolderSearch,
  Tags,
  Calculator,
  ClipboardList,
  FileCheck,
  FlaskConical,
  Scale,
  Map,
  Brain,
  Users,
  Settings,
  MessageSquare,
  BarChart3,
  Variable,
  FileJson,
  History,
  FileEdit,
  BookOpen,
  PanelLeftClose,
  PanelLeftOpen,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  adminOnly?: boolean
}

// Sistemas principais
const systemItems: NavItem[] = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/gerador-pecas', icon: FileText, label: 'Gerador de Peças' },
  { to: '/extrator-autos', icon: FolderSearch, label: 'Extrator de Autos' },
  { to: '/classificador', icon: Tags, label: 'Classificador' },
  { to: '/pedido-calculo', icon: Calculator, label: 'Pedido de Cálculo' },
  { to: '/prestacao-contas', icon: ClipboardList, label: 'Prestação de Contas' },
  { to: '/relatorio-cumprimento', icon: FileCheck, label: 'Relatório de Cumprimento' },
  { to: '/cumprimento-beta', icon: FlaskConical, label: 'Cumprimento Beta' },
  { to: '/assistencia', icon: Scale, label: 'Assistência Judiciária' },
  { to: '/matriculas', icon: Map, label: 'Matrículas Confrontantes' },
  { to: '/bert-training', icon: Brain, label: 'BERT Training' },
]

// Links administrativos
const adminItems: NavItem[] = [
  { to: '/admin/users', icon: Users, label: 'Usuários', adminOnly: true },
  { to: '/admin/prompts', icon: FileEdit, label: 'Prompts', adminOnly: true },
  { to: '/admin/prompts-modulos', icon: FileJson, label: 'Módulos', adminOnly: true },
  { to: '/admin/feedbacks', icon: MessageSquare, label: 'Feedbacks', adminOnly: true },
  { to: '/admin/performance', icon: BarChart3, label: 'Performance', adminOnly: true },
  { to: '/admin/variaveis', icon: Variable, label: 'Variáveis', adminOnly: true },
  { to: '/admin/categorias-json', icon: FileJson, label: 'Categorias JSON', adminOnly: true },
  { to: '/admin/historico-gerador', icon: History, label: 'Histórico Gerador', adminOnly: true },
  { to: '/admin/config-pecas', icon: Settings, label: 'Config Peças', adminOnly: true },
  { to: '/admin/teste-ativacao', icon: Zap, label: 'Teste Ativação', adminOnly: true },
  { to: '/admin/teste-categorias', icon: FlaskConical, label: 'Teste Categorias', adminOnly: true },
  { to: '/admin/tjms-docs', icon: BookOpen, label: 'TJ-MS Docs', adminOnly: true },
]

function NavLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const currentPath = useRouterState({ select: (s) => s.location.pathname })

  const isActive = (path: string) => {
    if (path === '/dashboard') return currentPath === '/dashboard'
    return currentPath.startsWith(path)
  }

  const active = isActive(item.to)

  const linkContent = (
    <Link
      to={item.to}
      className={cn(
        'flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
        collapsed && 'justify-center px-2',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      <item.icon className="h-5 w-5 flex-shrink-0" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {item.label}
        </TooltipContent>
      </Tooltip>
    )
  }

  return linkContent
}

function SidebarContent({ collapsed = false }: { collapsed?: boolean }) {
  const user = useAuthStore(s => s.user)

  return (
    <nav className="flex-1 overflow-y-auto py-4">
      {/* Sistemas */}
      <div className={cn('px-3', collapsed && 'px-2')}>
        {!collapsed && (
          <h2 className="mb-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Sistemas
          </h2>
        )}
        <ul className="space-y-0.5">
          {systemItems.map((item) => (
            <li key={item.to}>
              <NavLink item={item} collapsed={collapsed} />
            </li>
          ))}
        </ul>
      </div>

      {/* Admin (apenas se usuário é admin) */}
      {user?.is_admin && (
        <div className={cn('px-3 mt-6', collapsed && 'px-2')}>
          {!collapsed && (
            <h2 className="mb-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Administração
            </h2>
          )}
          {collapsed && <div className="my-3 mx-2 border-t border-gray-200" />}
          <ul className="space-y-0.5">
            {adminItems.map((item) => (
              <li key={item.to}>
                <NavLink item={item} collapsed={collapsed} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  )
}

/**
 * Sidebar da aplicação
 * Desktop: colapsada por padrão (icon-only), com toggle para expandir
 * Mobile: abre/fecha com Sheet (drawer)
 */
export function Sidebar() {
  const sidebarOpen = useUiStore(s => s.sidebarOpen)
  const setSidebarOpen = useUiStore(s => s.setSidebarOpen)
  const sidebarCollapsed = useUiStore(s => s.sidebarCollapsed)
  const toggleSidebarCollapsed = useUiStore(s => s.toggleSidebarCollapsed)

  return (
    <TooltipProvider>
      {/* Desktop: sidebar fixa com collapse */}
      <aside
        className={cn(
          'hidden lg:flex lg:flex-col lg:border-r lg:border-gray-200 lg:bg-white transition-[width] duration-200 ease-in-out',
          sidebarCollapsed ? 'lg:w-16' : 'lg:w-60',
        )}
      >
        {/* Toggle button */}
        <div className={cn(
          'flex items-center h-14 border-b border-gray-200 px-3',
          sidebarCollapsed ? 'justify-center' : 'justify-end',
        )}>
          <button
            onClick={toggleSidebarCollapsed}
            className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            title={sidebarCollapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-5 w-5" />
            ) : (
              <PanelLeftClose className="h-5 w-5" />
            )}
          </button>
        </div>

        <SidebarContent collapsed={sidebarCollapsed} />
      </aside>

      {/* Mobile: sidebar em Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-200">
              <img src="/logo/logo-pge.png" alt="PGE-MS" className="h-10 w-auto" />
            </div>
            <SidebarContent collapsed={false} />
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  )
}
