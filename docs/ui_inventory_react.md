# Inventário UI — Frontend React

> Inventário dos controles UI do frontend React (SPA).
> Gerado em: 2026-02-08

---

## Componentes Compartilhados

### Sidebar (`components/layout/Sidebar.tsx`)
- Logo PGE-MS clicável → `/dashboard`
- Links de navegação por sistema (visíveis conforme `sistemas_permitidos`):
  - Assistência Judiciária → `/assistencia`
  - Matrículas → `/matriculas`
  - Gerador de Peças → `/gerador-pecas`
  - Pedido de Cálculo → `/pedido-calculo`
  - Prestação de Contas → `/prestacao-contas`
  - Relatório de Cumprimento → `/relatorio-cumprimento`
  - Cumprimento de Sentença → `/cumprimento-beta`
  - Classificador → `/classificador`
  - BERT Training → `/bert-training`
  - Extrator de Autos → `/extrator-autos`
- Seção Admin (role=admin):
  - Usuários → `/admin/users`
  - Prompts → `/admin/prompts`
  - Prompts Modulares → `/admin/prompts-modulos`
  - Categorias JSON → `/admin/categorias-json`
  - Variáveis → `/admin/variaveis`
  - Módulos/Tipo Peça → `/admin/modulos-tipo-peca`
  - Config Peças → `/admin/config-pecas`
  - Feedbacks → `/admin/feedbacks`
  - Histórico Gerador → `/admin/historico-gerador`
  - Histórico Pedido → `/admin/historico-pedido-calculo`
  - Histórico Prestação → `/admin/historico-prestacao-contas`
  - Teste Ativação → `/admin/teste-ativacao`
  - Teste Categorias → `/admin/teste-categorias`
  - Performance → `/admin/performance`
  - TJMS Docs → `/admin/tjms-docs`
  - Restaurar Slugs → `/admin/restaurar-slugs`
- Botão Sair (logout)
- Toggle collapse sidebar

### Header (`components/layout/Header.tsx`)
- Título dinâmico da página
- Breadcrumbs
- User avatar + dropdown: nome, role, Alterar Senha, Sair

### DataTable (`components/shared/DataTable.tsx`)
- Busca integrada (searchable prop)
- Ordenação por coluna (sortable)
- Paginação (pageSize prop)

---

## 1. Login — Rota: `/login`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Entrar | primary (submit) | Submete login | `POST /auth/login` |
| Toggle senha (olho) | icon | Alterna visibilidade | — |

### Formulários
- username (text), password (password)
- Submit via auth store (Zustand)
- Redireciona para `/dashboard` em sucesso
- Redireciona para `/change-password` se `must_change_password`

### Outros Controles
- Toast de erro via useToast
- Loading state no botão

---

## 2. Dashboard — Rota: `/dashboard`

### Navegação — Cards de Sistemas
| Label | Ícone | Destino |
|-------|-------|---------|
| Assistência Judiciária | Scale | `/assistencia` |
| Matrículas Confrontantes | FileSearch | `/matriculas` |
| Gerador de Peças | FileText | `/gerador-pecas` |
| Pedido de Cálculo | Calculator | `/pedido-calculo` |
| Prestação de Contas | ClipboardCheck | `/prestacao-contas` |
| Relatório de Cumprimento | FileBarChart | `/relatorio-cumprimento` |
| Cumprimento de Sentença | Gavel | `/cumprimento-beta` |
| Classificador de Documentos | FolderSearch | `/classificador` |
| BERT Training | Brain | `/bert-training` |
| Extrator de Autos | Download | `/extrator-autos` |

### Outros Controles
- Cards visíveis conforme `sistemas_permitidos`
- Saudação dinâmica com nome do usuário
- Seção admin com links (conforme Sidebar)

---

## 3. Troca de Senha — Rota: `/change-password`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Alterar Senha | primary (submit) | Submete troca | `POST /auth/change-password` |
| Cancelar | secondary (link) | Volta ao dashboard | — |
| Toggle nova senha | icon | Alterna visibilidade | — |

### Formulários
- current_password, new_password, confirm_password
- Validação de força em tempo real (5 critérios)
- Indicador de barras de força

### Outros Controles
- Banner de primeiro acesso
- Checklist de requisitos de senha

---

## 4. Assistência Judiciária — Rota: `/assistencia`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Gerar Relatório | primary | Inicia geração | `POST /assistencia/api/gerar` |
| Copiar Texto | secondary | Copia resultado | clipboard |
| Baixar DOCX | secondary | Exporta | `POST /assistencia/api/exportar-docx` |
| Feedback (thumbs up/down) | icon pair | Avaliação | `POST /assistencia/api/feedback` |

### Formulários
| Campo | Tipo |
|-------|------|
| CNJ | text input |

### Outros Controles
- Resultado renderizado em markdown
- Toast de notificação
- Loading states

---

## 5. Matrículas Confrontantes — Rota: `/matriculas`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Consultar | primary | Consulta | `POST /matriculas/api/consultar` |
| Copiar Resultado | secondary | Copia texto | clipboard |
| Exportar DOCX | secondary | Exporta | `POST /matriculas/api/exportar-docx` |
| Feedback (estrelas 1-5) | icon | Avaliação | `POST /matriculas/api/feedback` |

### Formulários
- Matrícula input (texto)
- Feedback: rating + comentário

### Upload
- Upload de PDF/imagem via dropzone

---

## 6. Gerador de Peças — Rota: `/gerador-pecas`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Gerar Peça | primary | SSE stream | `POST /gerador-pecas/api/processar-stream` |
| Cancelar | secondary | Aborta | AbortController |
| Copiar Texto | icon | Copia markdown | clipboard |
| Baixar DOCX | primary | Exporta | `POST /gerador-pecas/api/exportar-docx` |
| Acessar Autos | secondary | Viewer de autos | rota interna |
| Chat send | icon | Edita via chat | `POST /gerador-pecas/api/editar` |
| Feedback (estrelas 1-5) | icon | Avaliação | `POST /gerador-pecas/api/feedback` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Tipo de Peça | select | Dinâmico via API |
| Grupo | select | Dinâmico via API |
| Subcategorias | checkboxes | Condicional |

### Formulários
- CNJ, Tipo de Peça, Grupo, Subcategorias, Observações, PDF upload, Chat input

### SSE/Streaming
- `POST /processar-stream`: useSSE hook
- `POST /processar-pdfs-stream`
- `POST /curadoria/gerar-stream`

### Modais
- Progresso (3 agentes), Editor (markdown + chat + versões), Feedback, Curadoria

### Outros Controles
- Sidebar com histórico
- Drag-and-drop curadoria

---

## 7. Pedido de Cálculo — Rota: `/pedido-calculo`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Gerar Pedido | primary | SSE stream | `POST /pedido-calculo/api/processar-stream` |
| Cancelar | secondary | Aborta | AbortController |
| Copiar | icon | Clipboard | — |
| Baixar DOCX | primary | Exporta | `POST /pedido-calculo/api/exportar-docx` |
| Acessar Autos | secondary | Viewer | rota interna |
| Chat send | icon | Edita | `POST /pedido-calculo/api/editar-pedido` |
| Feedback (1-5) | icon | Avaliação | `POST /pedido-calculo/api/feedback` |

### Formulários
- CNJ, Chat input

### SSE/Streaming
- `POST /processar-stream`: 4 agentes

### Modais
- Progresso, Editor, Feedback, Confirmar sobrescrita, Documentos

---

## 8. Prestação de Contas — Rota: `/prestacao-contas`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Analisar | primary | Pipeline | `POST /prestacao-contas/api/processar` |
| Exportar DOCX | secondary | Exporta | download |
| Ver Documentos | secondary | Modal | — |
| Feedback (Correto/Parcial/Incorreto) | tristate | Avaliação | `POST /prestacao-contas/api/feedback` |
| Enviar Documentos | primary | Upload | upload endpoint |
| Reprocessar | secondary | Reinicia | re-POST |

### Formulários
- CNJ, Extrato PDF, Notas fiscais (multiple), Respostas a perguntas

### Upload
- Extrato bancário (PDF single)
- Notas fiscais (PDF multiple)

### Modais
- Progresso (5 etapas), Resultado, Documentos, Feedback, Upload

---

## 9. Relatório de Cumprimento — Rota: `/relatorio-cumprimento`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Gerar Relatório | primary | SSE stream | `POST /relatorio-cumprimento/api/processar-stream` |
| Cancelar | secondary | Aborta | AbortController |
| Baixar DOCX | primary | Exporta | `POST /relatorio-cumprimento/api/exportar-docx` |
| Baixar PDF | secondary | Exporta | `POST /relatorio-cumprimento/api/exportar-pdf` |
| Copiar | icon | Clipboard | — |
| Acessar Autos | secondary | Viewer | rota interna |
| Chat send | icon | Edita | `POST /relatorio-cumprimento/api/editar-relatorio` |
| Feedback (1-5) | icon | Avaliação | `POST /relatorio-cumprimento/api/feedback` |

### Formulários
- CNJ, Chat input

### SSE/Streaming
- `POST /processar-stream`: 5 etapas

---

## 10. Cumprimento Beta — Rota: `/cumprimento-beta`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Nova Sessão / Processar | primary | Cria e processa | `POST /api/cumprimento-beta/sessoes` |
| Chat send | icon | Chat SSE | `POST /sessoes/{id}/chat?streaming=true` |
| Consolidar | primary | SSE | `POST /sessoes/{id}/consolidar?streaming=true` |
| Gerar Peça | primary | Gera peça | `POST /sessoes/{id}/gerar-peca` |
| Download peça | link | Download | `GET /sessoes/{id}/pecas/{id}/download` |
| JSON Expand/Collapse/Copy/Download | icons | Controles JSON | — |

### Filtros (HistoryDrawer)
- Busca por CNJ (search), Status (select)

### SSE/Streaming
- Chat streaming, Consolidação streaming

### Outros Controles
- JsonViewer interativo
- HistoryDrawer lateral
- ProcessSteps (4 etapas)

---

## 11. Classificador de Documentos — Rota: `/classificador`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Iniciar Classificação | primary | Inicia lote | API |
| Pausar / Cancelar | secondary/danger | Controle de lote | API |
| Exportar Excel/CSV/JSON | secondary | Exporta | API |
| Novo Lote | primary | Nova aba | — |
| Novo Prompt | primary | Cria prompt | API |
| Classificar (teste) | primary | Teste rápido | API |

### Tabs
- Novo Lote (Upload / TJ-MS), Meus Lotes, Prompts, Teste Rápido (Upload / TJ-MS)

### Upload
- Drag-and-drop PDFs/TXTs/ZIPs (max 2000)

### Outros Controles
- PDF.js viewer integrado
- Transfer list para tipos
- Polling para execuções

---

## 12. BERT Training — Rota: `/bert-training`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Iniciar Treinamento | primary | Cria run | `POST /bert-training/api/runs` |
| Finalizar Agora | secondary | Early stop | `POST /api/runs/{id}/stop` |
| Cancelar | danger | Cancela | `POST /api/runs/{id}/cancel` |
| Classificar | primary | Teste modelo | `POST worker:/predict` |
| Classificar Lote | primary | Lote | `POST worker:/predict-batch` |
| Comparar | primary | BERT vs LLM | `POST /bert-training/api/comparar-cnj` |

### Tabs
- Novo Treinamento, Acompanhar, Testar Modelo, Comparar BERT vs LLM

### Formulários
- Nome, Dataset, Preset, Modelo, Épocas, LR, Batch, Max Length, etc.
- Texto para classificar, PDF upload

### Upload
- Excel (.xlsx/.xls) para dataset
- PDF para teste

### Outros Controles
- Recharts: gráficos de Loss e Accuracy
- Matriz de confusão
- Polling para métricas em tempo real

---

## 13. Extrator de Autos — Rota: `/extrator-autos`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Consultar | primary | Single | `POST /extrator-autos/api/consultar` |
| Consultar Lote | primary | Múltiplos | `POST /extrator-autos/api/consultar-lote` |
| Visualizar Documentos | secondary | Preview | load |
| Baixar Documentos | primary | Download | API |
| BERT Config | icon | Config | modal |
| Select All | checkbox | Seleciona todos | — |

### Filtros
- Ano (text), Mês (select), Busca códigos (text)

### Tabs (seleção)
- Categorias, Manual, Híbrido

### Formulários
- CNJ (single), CNJs (lote, textarea), formato, opções de download

### Toggle
- Modo Lote (switch)

### Modais
- BERT Indisponível, BERT Config

### Outros Controles
- Persistência de sessão via localStorage
- Category cards com cores
- Progress bar de download
- Paginação no histórico

---

## 14. Admin: Prompts — Rota: `/admin/prompts`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Salvar Configurações | primary | Salva config por sistema | API admin |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Sistema | select | Filtra prompts por sistema |

### Tabs
- Matrículas, Assistência, Gerador, Pedido, Prestação, Relatório, Sistemas Acessórios, Global

### Modais
- Editar Prompt: sistema, tipo, nome, descrição, conteúdo (textarea mono), ativo

---

## 15. Admin: Prompts Modulares — Rota: `/admin/prompts-modulos`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Novo Módulo | primary | Abre editor | — |
| Importar | secondary | Import | API |
| Exportar | secondary | Export | API |
| Glossário | text | Modal glossário | — |
| Integridade | text | Verifica | API |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Busca | text | Filtra por título/conteúdo |
| Tipo | select | Base/Peça/Conteúdo |
| Tipo de Ativação | select | LLM/Determinística |
| Grupo | select | Dinâmico |
| Subgrupo | select | Dinâmico |
| Categoria | select | Dinâmico |
| Assunto | combobox multi-select | Pesquisável |
| Apenas ativos | checkbox | Toggle |

### Navegação (barra secundária)
- Módulos, Categorias, Variáveis, Tipos de Peça, Grupos, Assuntos, Ordem, Testar

### Modais
- Editor de módulo, Modal de Grupos/Subgrupos

### Outros Controles
- Drag-and-drop (SortableJS)
- Combobox de variáveis
- Categorias colapsáveis

---

## 16. Admin: Categorias JSON — Rota: `/admin/categorias-json`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Nova Categoria | primary | Abre dialog | — |
| Editar | outline (per card) | Edita | `GET /admin/api/categorias-resumo-json/{id}` |
| Excluir | destructive | Exclui | `DELETE /admin/api/categorias-resumo-json/{id}` |
| Atualizar/Criar | primary (dialog) | Salva | `POST/PUT /admin/api/categorias-resumo-json` |

### Modais
- Criar/Editar: nome, descrição, códigos_documento, formato_json (com validação JSON em tempo real), ativo
- Confirmação de exclusão

### Outros Controles
- Grid de cards responsivo
- Badges: Ativo/Inativo, "IA"
- Códigos como outline badges

---

## 17. Admin: Variáveis — Rota: `/admin/variaveis`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Nova Variável | primary | Abre dialog | — |
| Editar | outline (per row) | Edita | — |
| Excluir | destructive (per row) | Exclui | `DELETE /admin/api/extraction/variaveis/{id}` |
| Salvar | primary (dialog) | Salva | `POST/PUT /admin/api/extraction/variaveis` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Busca | text | Slug ou label |
| Tipo | select | text/number/boolean/date/choice/list |
| Categoria | select | Dinâmico |

### Modais
- Criar/Editar: slug, label, tipo, descrição, opções (choice/list), categoria_id, ativo
- Confirmação de exclusão

### Outros Controles
- 4 cards: Total, Em Uso, Sem Uso, Tipos
- DataTable com badges coloridos por tipo

---

## 18. Admin: Módulos por Tipo de Peça — Rota: `/admin/modulos-tipo-peca`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Salvar Alterações | primary | Salva batch | `POST /admin/api/prompts-modulos/configurar-modulos-tipo-peca` |
| Ativar/Desativar Todos | outline | Local state | — |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Grupo | select | Carrega tipos e config |

### Outros Controles
- 4 cards estatísticos
- Cards colapsáveis por tipo de peça
- Checkboxes por módulo
- Badges de contagem

---

## 19. Admin: Usuários — Rota: `/admin/users`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Novo Usuário | primary | Abre dialog | — |
| Editar | outline (per row) | Edita | — |
| Resetar Senha | outline (per row) | Reset | `POST /{id}/reset-password` |
| Excluir | destructive (per row) | Exclui | `DELETE /{id}` |

### Modais
- Criar/Editar: username, full_name, email, setor, password (novo), role, sistemas_permitidos (checkboxes)
- Confirmação de exclusão
- Nova senha gerada (monospace, aviso)

### Outros Controles
- DataTable: Username, Nome, Setor, Perfil (badge), Status (badge), Data, Ações
- Proteção contra excluir admin

---

## 20. Admin: Feedbacks — Rota: `/admin/feedbacks`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Limpar Filtros | outline | Reset filtros |
| Anterior/Próxima | outline | Paginação |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Sistema | select | Gerador, Relatório, Pedido, Prestação |
| Mês | select | Jan-Dez |
| Ano | select | Dinâmico |

### Outros Controles
- 4 cards: Total, Feedbacks, Taxa de Acerto, Sem Feedback
- Gráfico de barras (distribuição de avaliações)
- DataTable: Sistema, Usuário, Avaliação (badge), Comentário, Data
- Paginação (20 por página)

---

## 21. Admin: Histórico Gerador — Rota: `/admin/historico-gerador`

### Row Actions
| Ação | Endpoint |
|------|----------|
| Click na row | `GET /admin/api/gerador-pecas-admin/geracoes/{id}` |

### Modais
- Detalhes: 4 tabs (Prompt, Resumo, Minuta, Chat)

### Outros Controles
- DataTable: CNJ, Tipo, Modo (badge), Modelo, Tempo, Data
- Markdown rendering via useMarkdown

---

## 22. Admin: Debug Pedido de Cálculo — Rota: `/admin/historico-pedido-calculo`

### Row Actions
| Ação | Endpoint |
|------|----------|
| Click na row | `GET /admin/api/pedido-calculo-admin/geracoes/{id}` |

### Filtros
- Busca por CNJ (DataTable searchable)

### Modais
- Detalhes: 3 tabs (Pedido, Dados, Logs IA)
- LogItem colapsáveis com prompt/response

### Outros Controles
- DataTable: CNJ, Status (badge), Modelo, Tempo, Data, Logs (count)
- JsonViewer para dados

---

## 23. Admin: Debug Prestação de Contas — Rota: `/admin/historico-prestacao-contas`

### Row Actions
| Ação | Endpoint |
|------|----------|
| Click na row | `GET /admin/api/prestacao-admin/geracoes/{id}` |

### Modais
- Detalhes: 3 tabs (Parecer, Dados, Logs IA)
- Parecer badge (favorável/desfavorável/dúvida)

### Outros Controles
- DataTable: CNJ, Parecer (badge), Status, Modelo, Tempo, Data
- LogItem colapsáveis com markdown rendering

---

## 24. Admin: Config Peças — Rota: `/admin/config-pecas`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Nova Categoria | primary | Cria | `POST /api/gerador-pecas/config/categorias` |
| Novo Tipo | primary | Cria | `POST /api/gerador-pecas/config/tipos-peca` |
| Editar/Excluir | outline/destructive | Per card | PUT/DELETE |

### Tabs
- Categorias de Documentos, Tipos de Peça

### Modais
- Categoria: nome, título, descrição, códigos, cor (color picker), ordem, ativo
- Tipo: nome, título, descrição, ícone (emoji), ordem, ativo, padrão

---

## 25. Admin: Teste Ativação — Rota: `/admin/teste-ativacao`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Simular | primary (full-width) | Simula ativação | `POST /teste-ativacao/simular` |
| Sim/Não (por variável boolean) | toggle buttons | Toggle | local state |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Tipo de Peça | select | Seleciona tipo |
| Categorias de Extração | checkboxes | Seleciona categorias |

### Tabs
- Variáveis, Resultados

### Formulários
- Tipo de peça, categorias, variáveis dinâmicas (text/number/boolean)

### Outros Controles
- Layout 3 colunas: sidebar (config) + área principal (tabs)
- Cards de resultado: ativados (verde), não ativados (vermelho)

---

## 26. Admin: Teste Categorias — Rota: `/admin/teste-categorias`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Validar | primary | Valida CNJs | `POST /admin/api/categorias-resumo-json/teste-categorias/validar-processos` |
| Classificar | primary | Classifica | `POST /admin/api/categorias-resumo-json/teste-categorias/classificar` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Categoria | select | Seleciona categoria alvo |

### Formulários
- Processos (textarea, 1 por linha)

### Outros Controles
- Workflow em 2 passos: validar → classificar
- Cards de resultado com JSON extraído, modelo, tempo, tokens

---

## 27. Admin: Performance — Rota: `/admin/performance`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Atualizar | primary | Recarrega dados |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Período | select | 1h/6h/24h/3dias |

### Tabs
- Performance Sistema, Logs Gemini

### Outros Controles
- 4 cards: LLM Médio, DB Médio, Parse Médio, Total Médio
- Distribuição de gargalos (barras coloridas)
- Erros recentes (cards vermelhos)
- DataTable de logs

---

## 28. Admin: TJMS Docs — Rota: `/admin/tjms-docs`

Página estática de documentação. Sem controles interativos.
- Cards de módulos, tabela de códigos, best practices, specs técnicas.

---

## 29. Admin: Restaurar Slugs — Rota: `/admin/restaurar-slugs`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Restaurar Slugs | primary | Restaura | `POST /admin/api/extraction/restaurar-slugs` |

### Formulários
- categoria_id (number, default 5)

### Outros Controles
- Warning alert
- Resultado JSON em bloco `<pre>`
