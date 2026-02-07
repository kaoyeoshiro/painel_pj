// Constantes do Portal PGE-MS

/** Sistemas disponiveis no portal */
export const SISTEMAS = [
  { id: 'dashboard', nome: 'Dashboard', rota: '/dashboard', icone: 'LayoutDashboard', descricao: 'Visao geral do portal' },
  { id: 'gerador-pecas', nome: 'Gerador de Pecas', rota: '/gerador-pecas', icone: 'FileText', descricao: 'Geracao automatica de pecas juridicas' },
  { id: 'extrator-autos', nome: 'Extrator de Autos', rota: '/extrator-autos', icone: 'FolderSearch', descricao: 'Download e classificacao de documentos processuais' },
  { id: 'classificador', nome: 'Classificador', rota: '/classificador', icone: 'Tags', descricao: 'Classificacao automatica de documentos' },
  { id: 'pedido-calculo', nome: 'Pedido de Calculo', rota: '/pedido-calculo', icone: 'Calculator', descricao: 'Geracao de pedidos de calculo' },
  { id: 'prestacao-contas', nome: 'Prestacao de Contas', rota: '/prestacao-contas', icone: 'ClipboardList', descricao: 'Analise de prestacao de contas' },
  { id: 'relatorio-cumprimento', nome: 'Relatorio de Cumprimento', rota: '/relatorio-cumprimento', icone: 'FileCheck', descricao: 'Geracao de relatorios de cumprimento' },
  { id: 'cumprimento-beta', nome: 'Cumprimento Beta', rota: '/cumprimento-beta', icone: 'FlaskConical', descricao: 'Nova versao do relatorio de cumprimento' },
  { id: 'assistencia', nome: 'Assistencia Judiciaria', rota: '/assistencia', icone: 'Scale', descricao: 'Assistencia judiciaria gratuita' },
  { id: 'matriculas', nome: 'Matriculas Confrontantes', rota: '/matriculas', icone: 'Map', descricao: 'Analise de matriculas confrontantes' },
  { id: 'bert-training', nome: 'BERT Training', rota: '/bert-training', icone: 'Brain', descricao: 'Treinamento de modelos BERT' },
] as const

/** Paginas admin */
export const ADMIN_PAGES = [
  { id: 'users', nome: 'Usuarios', rota: '/admin/users' },
  { id: 'prompts', nome: 'Prompts', rota: '/admin/prompts' },
  { id: 'prompts-modulos', nome: 'Modulos de Prompts', rota: '/admin/prompts-modulos' },
  { id: 'feedbacks', nome: 'Feedbacks', rota: '/admin/feedbacks' },
  { id: 'performance', nome: 'Performance', rota: '/admin/performance' },
  { id: 'variaveis', nome: 'Variaveis', rota: '/admin/variaveis' },
  { id: 'categorias-json', nome: 'Categorias JSON', rota: '/admin/categorias-json' },
  { id: 'historico-gerador', nome: 'Historico Gerador', rota: '/admin/historico-gerador' },
  { id: 'historico-pedido-calculo', nome: 'Historico Pedido Calculo', rota: '/admin/historico-pedido-calculo' },
  { id: 'historico-prestacao-contas', nome: 'Historico Prestacao Contas', rota: '/admin/historico-prestacao-contas' },
  { id: 'modulos-tipo-peca', nome: 'Modulos por Tipo de Peca', rota: '/admin/modulos-tipo-peca' },
  { id: 'config-pecas', nome: 'Config Pecas', rota: '/admin/config-pecas' },
  { id: 'teste-ativacao', nome: 'Teste de Ativacao', rota: '/admin/teste-ativacao' },
  { id: 'teste-categorias', nome: 'Teste de Categorias', rota: '/admin/teste-categorias' },
  { id: 'tjms-docs', nome: 'TJ-MS Docs', rota: '/admin/tjms-docs' },
  { id: 'restaurar-slugs', nome: 'Restaurar Slugs', rota: '/admin/restaurar-slugs' },
] as const
