import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { PageContainer } from '@/components/layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
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
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface SystemCard {
  to: string
  icon: LucideIcon
  title: string
  description: string
  adminOnly?: boolean
}

// Cards dos sistemas principais
const systemCards: SystemCard[] = [
  {
    to: '/gerador-pecas',
    icon: FileText,
    title: 'Gerador de Peças',
    description: 'Gere peças jurídicas automaticamente com IA',
  },
  {
    to: '/extrator-autos',
    icon: FolderSearch,
    title: 'Extrator de Autos',
    description: 'Extraia e organize documentos processuais',
  },
  {
    to: '/classificador',
    icon: Tags,
    title: 'Classificador',
    description: 'Classifique documentos por categoria',
  },
  {
    to: '/pedido-calculo',
    icon: Calculator,
    title: 'Pedido de Cálculo',
    description: 'Gere pedidos de cálculo pericial',
  },
  {
    to: '/prestacao-contas',
    icon: ClipboardList,
    title: 'Prestação de Contas',
    description: 'Elabore prestações de contas judiciais',
  },
  {
    to: '/relatorio-cumprimento',
    icon: FileCheck,
    title: 'Relatório de Cumprimento',
    description: 'Gere relatórios de cumprimento de decisão',
  },
  {
    to: '/cumprimento-beta',
    icon: FlaskConical,
    title: 'Cumprimento Beta',
    description: 'Versão experimental do relatório',
  },
  {
    to: '/assistencia',
    icon: Scale,
    title: 'Assistência Judiciária',
    description: 'Análise de pedidos de assistência',
  },
  {
    to: '/matriculas',
    icon: Map,
    title: 'Matrículas Confrontantes',
    description: 'Análise de matrículas e confrontações',
  },
  {
    to: '/bert-training',
    icon: Brain,
    title: 'BERT Training',
    description: 'Treinamento do modelo de classificação',
  },
]

// Cards administrativos
const adminCards: SystemCard[] = [
  {
    to: '/admin/users',
    icon: Users,
    title: 'Usuários',
    description: 'Gerenciar usuários do sistema',
    adminOnly: true,
  },
  {
    to: '/admin/prompts',
    icon: FileEdit,
    title: 'Prompts',
    description: 'Configurar prompts de IA',
    adminOnly: true,
  },
  {
    to: '/admin/prompts-modulos',
    icon: FileJson,
    title: 'Módulos',
    description: 'Gerenciar módulos de argumentação',
    adminOnly: true,
  },
  {
    to: '/admin/feedbacks',
    icon: MessageSquare,
    title: 'Feedbacks',
    description: 'Visualizar feedbacks dos usuários',
    adminOnly: true,
  },
  {
    to: '/admin/performance',
    icon: BarChart3,
    title: 'Performance',
    description: 'Métricas e análise de performance',
    adminOnly: true,
  },
  {
    to: '/admin/variaveis',
    icon: Variable,
    title: 'Variáveis',
    description: 'Configurar variáveis do sistema',
    adminOnly: true,
  },
  {
    to: '/admin/categorias-json',
    icon: FileJson,
    title: 'Categorias JSON',
    description: 'Gerenciar categorias de classificação',
    adminOnly: true,
  },
  {
    to: '/admin/historico-gerador',
    icon: History,
    title: 'Histórico Gerador',
    description: 'Histórico de gerações de peças',
    adminOnly: true,
  },
  {
    to: '/admin/config-pecas',
    icon: Settings,
    title: 'Config Peças',
    description: 'Configurações do gerador de peças',
    adminOnly: true,
  },
  {
    to: '/admin/tjms-docs',
    icon: BookOpen,
    title: 'TJ-MS Docs',
    description: 'Documentação da integração TJ-MS',
    adminOnly: true,
  },
]

/**
 * Página inicial (Dashboard)
 * Grid de cards com todos os sistemas disponíveis
 */
export function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const handleCardClick = (to: string) => {
    navigate({ to })
  }

  return (
    <PageContainer className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Bem-vindo(a), {user?.full_name}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Selecione um sistema para começar
        </p>
      </div>

      {/* Grid de sistemas */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sistemas</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemCards.map((card) => (
            <Card
              key={card.to}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => handleCardClick(card.to)}
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary-100 rounded-lg">
                    <card.icon className="h-6 w-6 text-primary-600" />
                  </div>
                  <CardTitle className="text-lg">{card.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription>{card.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Grid administrativo (apenas se admin) */}
      {user?.is_admin && (
        <div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Administração
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminCards.map((card) => (
              <Card
                key={card.to}
                className="cursor-pointer hover:shadow-lg transition-shadow border-amber-200"
                onClick={() => handleCardClick(card.to)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <card.icon className="h-6 w-6 text-amber-600" />
                    </div>
                    <CardTitle className="text-lg">{card.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{card.description}</CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  )
}
