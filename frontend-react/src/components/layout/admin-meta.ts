export interface AdminRouteMeta {
  title: string
  subtitle?: string
}

const ADMIN_META_BY_PATH: Record<string, AdminRouteMeta> = {
  '/admin/users': {
    title: 'Gerenciamento de Usuarios',
    subtitle: 'Administracao de acessos',
  },
  '/admin/prompts': {
    title: 'Configuracao de Prompts e IA',
    subtitle: 'Gerenciamento de prompts e modelos',
  },
  '/admin/prompts-config': {
    title: 'Configuracao de Prompts e IA',
    subtitle: 'Gerenciamento de prompts e modelos',
  },
  '/admin/prompts-modulos': {
    title: 'Prompts',
    subtitle: 'Edicao de prompts modulares e regras',
  },
  '/admin/modulos-tipo-peca': {
    title: 'Modulos por Tipo de Peca',
    subtitle: 'Configure modulos por tipo de peca',
  },
  '/admin/historico-gerador': {
    title: 'Historico de Geracoes',
    subtitle: 'Visualize prompts enviados e resultados',
  },
  '/admin/gerador-pecas/historico': {
    title: 'Historico de Geracoes',
    subtitle: 'Visualize prompts enviados e resultados',
  },
  '/admin/historico-pedido-calculo': {
    title: 'Historico - Pedido de Calculo',
    subtitle: 'Visualize prompts enviados e resultados',
  },
  '/admin/pedido-calculo/debug': {
    title: 'Historico - Pedido de Calculo',
    subtitle: 'Visualize prompts enviados e resultados',
  },
  '/admin/historico-prestacao-contas': {
    title: 'Historico - Prestacao de Contas',
    subtitle: 'Visualize prompts enviados e resultados',
  },
  '/admin/prestacao-contas/debug': {
    title: 'Historico - Prestacao de Contas',
    subtitle: 'Visualize prompts enviados e resultados',
  },
  '/admin/feedbacks': {
    title: 'Dashboard de Feedbacks',
    subtitle: 'Avaliacoes das analises de IA',
  },
  '/admin/categorias-json': {
    title: 'Categorias de Formato de Resumo JSON',
    subtitle: 'Defina formatos JSON por categoria',
  },
  '/admin/categorias-resumo-json': {
    title: 'Categorias de Formato de Resumo JSON',
    subtitle: 'Defina formatos JSON por categoria',
  },
  '/admin/teste-categorias': {
    title: 'Ambiente de Teste de Categorias',
    subtitle: 'Teste e valide a extracao de JSON',
  },
  '/admin/categorias-resumo-json/teste': {
    title: 'Ambiente de Teste de Categorias',
    subtitle: 'Teste e valide a extracao de JSON',
  },
  '/admin/teste-ativacao': {
    title: 'Teste de Ativacao de Modulos',
    subtitle: 'Simule ativacao de prompts',
  },
  '/admin/prompts-modulos/teste': {
    title: 'Teste de Ativacao de Modulos',
    subtitle: 'Simule ativacao de prompts',
  },
  '/admin/variaveis': {
    title: 'Painel de Variaveis',
    subtitle: 'Variaveis de extracao do sistema',
  },
  '/admin/restaurar-slugs': {
    title: 'Restaurar Slugs de Variaveis',
    subtitle: 'Ferramenta administrativa',
  },
  '/admin/performance': {
    title: 'Performance & Logs',
    subtitle: 'Monitoramento de sistema e IA',
  },
  '/admin/tjms-docs': {
    title: 'Integracao TJMS',
    subtitle: 'Documentacao e sincronizacao',
  },
  '/admin/config-pecas': {
    title: 'Configuracao de Tipos de Peca',
    subtitle: 'Categorias por tipo de peca juridica',
  },
}

export function getAdminRouteMeta(pathname: string): AdminRouteMeta {
  return (
    ADMIN_META_BY_PATH[pathname] ?? {
      title: 'Administracao',
      subtitle: 'Portal PGE-MS',
    }
  )
}

