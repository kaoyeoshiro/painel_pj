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
  Shield,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'

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
  { to: '/admin/tjms-docs', icon: BookOpen, label: 'TJ-MS Docs', adminOnly: true },
]

function SidebarContent() {
  const { user } = useAuthStore()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  const isActive = (path: string) => {
    if (path === '/dashboard') {
      return currentPath === '/dashboard'
    }
    return currentPath.startsWith(path)
  }

  return (
    <nav className="flex-1 overflow-y-auto py-4">
      {/* Sistemas */}
      <div className="px-3">
        <h2 className="mb-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Sistemas
        </h2>
        <ul className="space-y-1">
          {systemItems.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className={cn(
                  'flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                  isActive(item.to)
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Admin (apenas se usuário é admin) */}
      {user?.is_admin && (
        <div className="px-3 mt-6">
          <h2 className="mb-2 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Administração
          </h2>
          <ul className="space-y-1">
            {adminItems.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={cn(
                    'flex items-center gap-3 px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive(item.to)
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
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
 * Desktop: fixa na lateral esquerda
 * Mobile: abre/fecha com Sheet (drawer)
 */
export function Sidebar() {
  const { sidebarOpen, closeSidebar } = useUiStore()

  return (
    <>
      {/* Desktop: sidebar fixa */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r lg:border-gray-200 lg:bg-white">
        <SidebarContent />
      </aside>

      {/* Mobile: sidebar em Sheet */}
      <Sheet open={sidebarOpen} onOpenChange={closeSidebar}>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex flex-col h-full">
            <div className="p-4 border-b border-gray-200">
              <img src="/logo/logo-pge.png" alt="PGE-MS" className="h-10 w-auto" />
            </div>
            <SidebarContent />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
