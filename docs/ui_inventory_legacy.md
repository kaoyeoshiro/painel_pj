# Inventário UI — Frontend Legado (Jinja2 + SPAs)

> Fonte de verdade para paridade funcional com o React.
> Gerado em: 2026-02-08

---

## Índice

1. [Login](#1-login)
2. [Dashboard](#2-dashboard)
3. [Troca de Senha](#3-troca-de-senha)
4. [Assistência Judiciária](#4-assistência-judiciária)
5. [Matrículas Confrontantes](#5-matrículas-confrontantes)
6. [Gerador de Peças](#6-gerador-de-peças)
7. [Pedido de Cálculo](#7-pedido-de-cálculo)
8. [Prestação de Contas](#8-prestação-de-contas)
9. [Relatório de Cumprimento](#9-relatório-de-cumprimento)
10. [Cumprimento Beta](#10-cumprimento-beta)
11. [Classificador de Documentos](#11-classificador-de-documentos)
12. [BERT Training](#12-bert-training)
13. [Extrator de Autos](#13-extrator-de-autos)
14. [Admin: Prompts Config](#14-admin-prompts-config)
15. [Admin: Prompts Modulares](#15-admin-prompts-modulares)
16. [Admin: Módulos por Tipo de Peça](#16-admin-módulos-por-tipo-de-peça)
17. [Admin: Histórico Gerador](#17-admin-histórico-gerador)
18. [Admin: Debug Pedido de Cálculo](#18-admin-debug-pedido-de-cálculo)
19. [Admin: Debug Prestação de Contas](#19-admin-debug-prestação-de-contas)
20. [Admin: Usuários](#20-admin-usuários)
21. [Admin: Feedbacks](#21-admin-feedbacks)
22. [Admin: Categorias JSON](#22-admin-categorias-json)
23. [Admin: Teste Categorias JSON](#23-admin-teste-categorias-json)
24. [Admin: Teste Ativação Módulos](#24-admin-teste-ativação-módulos)
25. [Admin: Variáveis](#25-admin-variáveis)
26. [Admin: Restaurar Slugs](#26-admin-restaurar-slugs)
27. [Admin: Performance](#27-admin-performance)
28. [Admin: TJMS Docs](#28-admin-tjms-docs)
29. [Admin: Config Peças](#29-admin-config-peças)

---

## 1. Login

**Rota:** `/login`
**Template:** `frontend/templates/login.html`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Entrar | primary (submit) | Submete login | `POST /auth/login` |
| Toggle senha (olho) | icon | Alterna visibilidade do campo senha | — |

### Formulários
- **Login form** (`#login-form`): campos `username` (text), `password` (password)
- Submit chama `POST /auth/login` com JSON body
- Redireciona para `/dashboard` em sucesso
- Redireciona para `/change-password` se `must_change_password`

### Outros Controles
- Mensagem de erro (`#error-message`) com animação shake
- Loading spinner no botão durante request
- Logo PGE-MS
- Footer com copyright

---

## 2. Dashboard

**Rota:** `/dashboard`
**Template:** `frontend/templates/dashboard.html`

### Navegação — Cards de Sistemas
| Label | ID | Destino |
|-------|----|---------|
| Assistência Judiciária | `#card-assistencia` | `/assistencia/` |
| Matrículas Confrontantes | `#card-matriculas` | `/matriculas/` |
| Gerador de Peças | `#card-gerador` | `/gerador-pecas/` |
| Pedido de Cálculo | `#card-pedido-calculo` | `/pedido-calculo/` |
| Prestação de Contas | `#card-prestacao-contas` | `/prestacao-contas/` |
| Relatório de Cumprimento | `#card-relatorio-cumprimento` | `/relatorio-cumprimento/` |
| Classificador de Documentos | `#card-classificador` | `/classificador/` |
| BERT Training | `#card-bert-training` | `/bert-training/` |

### Navegação — Painel Admin (somente admin, `#admin-panel`)
| Label | Destino |
|-------|---------|
| Usuários | `/admin/users` |
| Prompts de IA | `/admin/prompts-config` |
| Prompts Modulares | `/admin/prompts-modulos` |
| Dashboard Feedbacks | `/admin/feedbacks` |
| Histórico Gerações | `/admin/gerador-pecas/historico` |
| Debug Pedido Cálculo | `/admin/pedido-calculo/debug` |
| Debug Prestação Contas | `/admin/prestacao-contas/debug` |
| Formatos JSON | `/admin/categorias-resumo-json` |
| Variáveis de Extração | `/admin/variaveis` |
| Tipos de Peça | `/api/gerador-pecas/config/admin` |
| Logs de Performance | `/admin/performance` |
| Integração TJ-MS | `/admin/tjms-docs` |

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Avatar/Dropdown | icon | Abre menu do usuário |
| Alterar Senha | menu item | Navega para `/change-password` |
| Gerenciar Usuários (admin) | menu item | Navega para `/admin/users` |
| Sair | menu item (danger) | `POST /auth/logout`, limpa token, redireciona para `/login` |

### Outros Controles
- Visibilidade de cards controlada por `user.sistemas_permitidos`
- Painel admin visível apenas para `user.role === 'admin'`
- Saudação dinâmica ("Olá, [nome]")
- Verificação de auth via `GET /auth/me`

---

## 3. Troca de Senha

**Rota:** `/change-password`
**Template:** `frontend/templates/change_password.html`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Alterar Senha | primary (submit) | Submete troca de senha | `POST /auth/change-password` |
| Cancelar | secondary (link) | Navega para `/dashboard` (oculto em first-access) | — |
| Toggle nova senha (olho) | icon | Alterna visibilidade da nova senha | — |

### Formulários
- **Change password form** (`#change-password-form`):
  - `current-password` (password, required)
  - `new-password` (password, required, minlength=8) — com indicador de força em tempo real
  - `confirm-password` (password, required)

### Outros Controles
- **Indicador de força da senha**: 4 barras visuais + texto (Muito fraca / Fraca / Razoável / Boa / Forte)
- **Checklist de requisitos**: 5 itens com ícones (comprimento, maiúscula, minúscula, número, especial)
- **Banner de primeiro acesso** (`#first-time-warning`): quando `must_change_password = true`
- Mensagens de erro/sucesso

---

## 4. Assistência Judiciária

**Rota:** `/assistencia/`
**Templates:** `sistemas/assistencia_judiciaria/templates/index.html`
**API:** `/assistencia/api`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Gerar Relatório | primary | Inicia geração | `POST /gerar` (SSE) |
| Copiar Texto | secondary | Copia resultado | clipboard API |
| Baixar DOCX | secondary | Exporta DOCX | `POST /exportar-docx` |
| Feedback (thumbs up/down) | icon pair | Envia avaliação | `POST /feedback` |
| Ver Dashboard (admin) | admin link | Abre dashboard admin inline | `GET /dashboard-admin` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Ano | select (`#filtro-ano`) | Filtra por ano, populado dinamicamente |
| Mês | select (`#filtro-mes`) | Filtra por mês (Jan-Dez) |
| Comarca | text input | Busca por comarca |

### Formulários
- **CNJ input**: campo de número do processo (texto)
- **Dashboard Admin**: filtros de ano, mês; gráficos Chart.js (pizza avaliações, linha timeline, evolução)

### Modais
| Trigger | Conteúdo |
|---------|----------|
| Ver Relatório (admin) | Modal com relatório renderizado, tabs: Relatório, Edições Chat, Versões |

### Outros Controles
- Formatação de data com timezone MS (UTC-04:00)
- Paginação no dashboard admin
- Gráficos Chart.js: Distribuição de Avaliações (pizza), Feedbacks do Período (linha), Evolução (linha)

---

## 5. Matrículas Confrontantes

**Rota:** `/matriculas/`
**Templates:** `sistemas/matriculas_confrontantes/templates/` (index.html, security.js, app.js, styles.css)
**API:** `/matriculas/api`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Consultar | primary | Inicia consulta | `POST /consultar` |
| Copiar Resultado | secondary | Copia texto | clipboard API |
| Exportar DOCX | secondary | Baixa documento | `POST /exportar-docx` |
| Feedback (estrelas 1-5) | icon | Avaliação com estrelas | `POST /feedback` |
| Enviar Feedback | submit | Envia comentário | `POST /feedback` |

### Formulários
- **Matrícula form**: input de número de matrícula (texto)
- **Feedback modal**: rating 1-5 estrelas + textarea de comentário

### Upload/Arquivos
- Upload de PDF/imagem de matrícula (drag-and-drop zone)

### Modais
| Trigger | Conteúdo |
|---------|----------|
| Resultado | Modal com relatório de confrontação |
| Feedback | Rating estrelas + comentário |
| Documento | Viewer do PDF/imagem enviado |

### Outros Controles
- Polling para verificar status de processamento
- Toast notifications
- Security.js com escapeHtml

---

## 6. Gerador de Peças

**Rota:** `/gerador-pecas/`
**Templates:** `sistemas/gerador_pecas/templates/` (index.html, app.js, curadoria.js, autos.html)
**API:** `/gerador-pecas/api`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Gerar Peça | primary | Inicia geração SSE | `POST /processar-stream` |
| Cancelar | secondary | Aborta geração | AbortController |
| Copiar Texto | icon | Copia markdown | clipboard API |
| Baixar DOCX | primary | Exporta DOCX | `POST /exportar-docx` |
| Acessar Autos | secondary | Abre viewer de autos | `/gerador-pecas/autos.html?cnj=...` |
| Chat send | icon | Edita via chat | `POST /editar` |
| Feedback (estrelas 1-5) | icon | Avaliação com estrelas | `POST /feedback` |
| Histórico items (sidebar) | clickable | Carrega geração anterior | `GET /historico/{id}` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Tipo de Peça | select | Dinâmico via `GET /tipos-peca` |
| Grupo | select | Dinâmico via `GET /grupos-disponiveis` |
| Subcategorias | checkboxes | Feature flag `SUBCATEGORIAS_ENABLED` |

### Formulários
| Campo | Tipo | ID |
|-------|------|-----|
| CNJ | text input | `input-cnj` |
| Tipo de Peça | select | `select-tipo-peca` |
| Grupo | select | `select-grupo` |
| Subcategorias | checkboxes | dinâmico |
| Observações | textarea | `input-observacoes` |
| PDF Upload | file (dropzone) | `input-pdf` |
| Chat input | text | `chat-input` |

### Modais
| Modal | ID | Descrição |
|-------|----|-----------|
| Progresso | `modal-progresso` | 3 agentes: Consulta TJ-MS, Download, Geração IA |
| Pergunta | `modal-pergunta` | Q&A interativo durante geração |
| Editor | `modal-editor` | Editor markdown + chat + versões + diff |
| Feedback | `modal-feedback` | Star rating 1-5 |
| Curadoria | curadoria.js | Semi-automático: drag-drop módulos/argumentos |
| Parecer NATJus | `modal-natjus` | Documento faltante |
| Versão Completa | `modal-versao-completa` | Viewer de versão anterior |

### SSE/Streaming
- `POST /processar-stream`: 3 agentes + chunks de geração
- `POST /processar-pdfs-stream`: PDFs uploadados
- `POST /curadoria/gerar-stream`: Geração curada

### Upload/Arquivos
- PDF drag-and-drop zone (modo alternativo ao CNJ)

### Outros Controles
- Sidebar esquerda com histórico de gerações
- Curadoria: drag-and-drop de módulos (SortableJS)
- `autos.html`: PDF.js canvas com zoom, navegação de páginas, atalhos de teclado
- Version history com diff display
- Feature flag: `SUBCATEGORIAS_ENABLED: false`

---

## 7. Pedido de Cálculo

**Rota:** `/pedido-calculo/`
**Templates:** `sistemas/pedido_calculo/templates/` (index.html, app.js)
**API:** `/pedido-calculo/api`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Gerar Pedido | primary | Inicia geração SSE | `POST /processar-stream` |
| Cancelar | secondary | Aborta geração | AbortController |
| Copiar Texto | icon | Copia markdown | clipboard API |
| Baixar DOCX | primary | Exporta DOCX | `POST /exportar-docx` |
| Acessar Autos | secondary | Abre viewer | `/gerador-pecas/autos.html?cnj=...` |
| Chat send | icon | Edita via chat | `POST /editar-pedido` |
| Feedback (estrelas 1-5) | icon | Avaliação | `POST /feedback` |
| Confirmar sobrescrita | dialog | Confirma quando já existe | `GET /verificar-existente` |

### Formulários
| Campo | Tipo | ID |
|-------|------|-----|
| CNJ | text input | `input-cnj` |
| Chat input | text | `chat-input` |

### Modais
| Modal | ID | Descrição |
|-------|----|-----------|
| Progresso | `modal-progresso` | 4 agentes: Análise XML, Download Docs, Extração Info, Geração Pedido |
| Editor | `modal-editor` | Editor markdown + chat |
| Feedback | `modal-feedback` | Star rating 1-5 |
| Confirmar Sobrescrita | `modal-confirmar` | Verifica existente antes de processar |
| Documentos | `modal-documentos` | Viewer de documentos do processo |

### SSE/Streaming
- `POST /processar-stream`: 4 agentes + `geracao_chunk`

### Outros Controles
- Sidebar esquerda com histórico
- Header temático
- Toast notifications

---

## 8. Prestação de Contas

**Rota:** `/prestacao-contas/`
**Templates:** `sistemas/prestacao_contas/templates/index.html`
**API:** (inferido) `/prestacao-contas/api`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Analisar | primary | Inicia pipeline 5 etapas | `POST /processar` |
| Exportar DOCX | secondary | Baixa documento | download |
| Ver Documentos | secondary | Abre modal docs | modal |
| Avaliar Resultado | link | Abre form feedback | modal |
| Enviar Respostas | primary | Responde perguntas da IA | `POST` com respostas |
| Enviar Documentos | primary | Upload extrato/notas | upload |
| Reprocessar | secondary | Reinicia análise | re-POST |
| Feedback (Correto/Parcial/Incorreto) | tristate | Avaliação | `POST /feedback` |

### Formulários
| Campo | Tipo |
|-------|------|
| CNJ | text input |
| Extrato PDF | file input (accept=`.pdf`) |
| Notas fiscais/comprovantes | file input (accept=`.pdf`, multiple) |
| Perguntas/Respostas | textarea (quando IA solicita) |

### Modais
| Modal | Descrição |
|-------|-----------|
| Progresso | 5 etapas: Subconta, XML TJ-MS, Identificar Prestação, Documentos, Análise IA |
| Resultado | Parecer (favorável/desfavorável/dúvida/aguardando_documentos), irregularidades |
| Documentos | Viewer dos documentos do processo |
| Feedback | Correto / Parcial / Incorreto |
| Upload docs | Envio de extrato + notas |

### Upload/Arquivos
- Upload de extrato bancário (PDF single)
- Upload de notas fiscais/comprovantes (PDF multiple)

### SSE/Streaming
- Pipeline de 5 etapas com atualização de progresso

### Outros Controles
- Tipos de resultado com cores: favorável (verde), desfavorável (vermelho), dúvida (amarelo)
- Seção de irregularidades encontradas
- Q&A interativo quando IA precisa de informações

---

## 9. Relatório de Cumprimento

**Rota:** `/relatorio-cumprimento/`
**Templates:** `sistemas/relatorio_cumprimento/templates/` (index.html, app.js)
**API:** `/relatorio-cumprimento/api`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Gerar Relatório | primary | Inicia geração SSE | `POST /processar-stream` |
| Cancelar | secondary | Aborta | AbortController |
| Baixar DOCX | primary | Exporta DOCX | `POST /exportar-docx` |
| Baixar PDF | secondary | Exporta PDF | `POST /exportar-pdf` |
| Copiar Texto | icon | Copia markdown | clipboard API |
| Acessar Autos | secondary | Abre viewer | `/gerador-pecas/autos.html?cnj=...` |
| Chat send | icon | Edita via chat | `POST /editar-relatorio` |
| Feedback (estrelas 1-5) | icon | Avaliação | `POST /feedback` |

### Formulários
| Campo | Tipo | ID |
|-------|------|-----|
| CNJ | text input | `input-cnj` |
| Chat input | text | `chat-input` |

### Modais
| Modal | Descrição |
|-------|-----------|
| Progresso | 5 etapas: Consulta TJ-MS, Processo Principal, Download, Trânsito em Julgado, Geração IA |
| Editor | Editor markdown + chat |
| Feedback | Star rating 1-5 |
| Confirmar sobrescrita | Verifica existente |

### SSE/Streaming
- `POST /processar-stream`: 5 etapas + `geracao_chunk`

### Outros Controles
- Sidebar com histórico
- Header verde temático
- Toast notifications

---

## 10. Cumprimento Beta

**Rota:** `/cumprimento-beta/`
**Templates:** `sistemas/cumprimento_beta/templates/` (index.html, app.js bundle)
**API:** `/api/cumprimento-beta`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Nova Sessão / Processar | primary | Cria e processa | `POST /sessoes`, `POST /sessoes/{id}/processar` |
| Chat send | icon | Chat SSE | `POST /sessoes/{id}/chat?streaming=true` |
| Consolidar | primary | Consolidação SSE | `POST /sessoes/{id}/consolidar?streaming=true` |
| Gerar Peça | primary | Gera peça jurídica | `POST /sessoes/{id}/gerar-peca` |
| Download peça | link | Baixa arquivo | `GET /sessoes/{id}/pecas/{pecaId}/download` |
| Retry | icon | Tenta novamente | callback |
| Ver detalhes (erro) | icon | Detalhes do erro | callback |
| Histórico toggle | icon | Abre/fecha drawer | `HistoryDrawer.toggle()` |
| JSON: Expand All | icon | Expande JSON | `JsonViewer.expandAll()` |
| JSON: Collapse All | icon | Recolhe JSON | `JsonViewer.collapseAll()` |
| JSON: Copy | icon | Copia JSON | clipboard |
| JSON: Download | icon | Baixa JSON | download |

### Filtros (no HistoryDrawer)
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Busca por CNJ | search input | Filtra sessões |
| Status | select | Todos/Concluídos/Em Progresso/Com Erro |

### SSE/Streaming
- `POST /sessoes/{id}/consolidar?streaming=true`
- `POST /sessoes/{id}/chat?streaming=true`

### Outros Controles
- **JsonViewer**: viewer interativo com expand/collapse, search, highlight, copy, download
- **HistoryDrawer**: drawer lateral com busca, filtros, badges de status
- **ProcessSteps**: 4 etapas com progress bar, timer, retry
- SPA completa renderizada via JS

---

## 11. Classificador de Documentos

**Rota:** `/classificador/`
**Templates:** `sistemas/classificador_documentos/templates/index.html`
**API:** `/classificador/api`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Iniciar Classificação | primary | Inicia lote | `iniciarClassificacaoLote()` |
| Pausar | secondary | Pausa lote | `pausarLote()` |
| Cancelar | danger | Cancela lote | `cancelarLote()` |
| Exportar Excel | secondary | Exporta resultados | `exportarResultadosLote('excel')` |
| Exportar CSV | secondary | Exporta CSV | `exportarResultadosLote('csv')` |
| Exportar JSON | secondary | Exporta JSON | `exportarResultadosLote('json')` |
| Novo Lote | primary | Abre tab novo lote | `showTab('novoLote')` |
| Novo Prompt | primary | Abre modal criar prompt | `showModalCriarPrompt()` |
| Classificar (teste) | primary | Teste rápido | `classificarTesteRapido()` |
| Buscar Documentos TJ-MS | primary | Busca TJ-MS | `buscarDocumentosTJMSTeste()` |
| Retomar (execução travada) | secondary | Retoma execução | `retomarExecucaoCard(id)` |
| Reprocessar erros | secondary | Reprocessa | `reprocessarErrosMeusLotes()` |
| PDF controls (zoom, nav) | icons | Controles PDF | PDF.js |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Busca lotes | text input | Filtra lista de lotes |
| Filtrar por ano | checkbox + text | Ano/mês |

### Tabs
- **Novo Lote** (sub-tabs: Upload de Arquivos / Importar do TJ-MS)
- **Meus Lotes**
- **Prompts**
- **Teste Rápido** (sub-tabs: Upload / TJ-MS)

### Formulários
| Campo | Tipo | ID |
|-------|------|-----|
| Nome do Lote | text | `nomeLote` |
| Arquivos | file (dropzone) | `arquivosLote` |
| Processos TJ-MS | textarea | `processosLote` |
| Tipos de documento | transfer list | `tiposDisponiveis`/`tiposSelecionados` |
| Prompt | select | `promptLote` |
| Modelo | text | `modeloLote` |
| Modo processamento | radio | `modoLote` |
| Tamanho chunk | number | `tamanhoChunkLote` |

### Modais
| Modal | Descrição |
|-------|-----------|
| Criar/Editar Projeto | Nome, descrição, prompt, modelo, modo, tokens |
| Criar/Editar Prompt | Nome, descrição, conteúdo, códigos documento |
| PDF Fullscreen | Viewer em tela cheia com controles |
| Adicionar Códigos | Busca TJ-MS + códigos manuais |

### Upload/Arquivos
- Drag-and-drop zone para PDFs, TXTs e ZIPs (max 2000 arquivos, 50MB cada)
- Upload avulso de PDF para teste rápido

### Outros Controles
- PDF.js viewer integrado com zoom, navegação, fullscreen
- Transfer list (dual-list) para tipos de documentos
- API Status indicator (Online/Offline)
- Polling a cada 3s para execuções em andamento

---

## 12. BERT Training

**Rota:** `/bert-training/`
**Templates:** `sistemas/bert_training/templates/` (index.html, app.js)
**API:** `/bert-training`
**Worker:** `http://127.0.0.1:8765`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Enviar Planilha | secondary | Abre modal upload | `showUploadModal()` |
| Iniciar Treinamento | primary | Cria run | `POST /api/runs` |
| Finalizar Agora | secondary | Early stopping | `POST /api/runs/{id}/stop` |
| Cancelar Treinamento | danger | Cancela | `POST /api/runs/{id}/cancel` |
| Atualizar | icon | Recarrega histórico | `GET /api/runs` |
| Classificar (texto) | primary | Teste texto | `POST worker:/predict` |
| Classificar PDF | primary | Teste PDF | `POST worker:/predict` |
| Executar Comparação | primary | Compara BERT vs IA | `POST /api/comparar-cnj` |
| Debug conexão | icon | Testa worker | health check |
| Ajuda | icon | Abre onboarding | modal |
| Validar dataset | secondary | Valida dados | `POST /api/datasets/validate` |
| Enviar (upload) | primary | Envia dataset | `POST /api/datasets/upload` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Status runs | buttons (pill) | Todos, Na Fila, Treinando, Concluídos, Falharam, Cancelados |

### Tabs
- **Novo Treinamento**
- **Acompanhar** (badge de contagem)
- **Testar Modelo**
- **Comparar com IA**

### Formulários
| Campo | Tipo | ID |
|-------|------|-----|
| Nome treinamento | text | `run-name` |
| Planilha de dados | select | `run-dataset` |
| Modo (presets) | preset cards | `selected-preset` |
| Modelo Base | select | `run-model` |
| Épocas | number | `run-epochs` |
| Learning Rate | number | `run-lr` |
| Batch Size | number | `run-batch` |
| Max Length | number | `run-maxlen` |
| Train Split | number | `run-split` |
| Early Stopping | number | `run-patience` |
| Seed | number | `run-seed` |
| Balancear | checkbox | `run-class-weights` |
| CNJ (comparar) | text | `compare-cnj` |
| Categoria documento | select | `compare-categoria` |

### Modais
| Modal | ID | Descrição |
|-------|----|-----------|
| Detalhes do Run | `run-detail-modal` | Métricas, config, gráfico |
| Upload Dataset | `upload-modal` | 4 passos: arquivo, tipo, colunas, preview |
| Onboarding | `onboarding-modal` | 3 etapas de introdução |
| Chunk (comparação) | JS-created | Exibe chunk enviado à IA |

### Upload/Arquivos
- Upload de planilha Excel (.xlsx/.xls)
- Upload de PDF para classificação

### Outros Controles
- Chart.js: gráficos de evolução (Loss, Accuracy)
- Métricas em tempo real via polling
- Progress bar com tempo estimado
- Worker GPU info
- Logs em tempo real (terminal dark)
- Preset cards visuais para configuração

---

## 13. Extrator de Autos

**Rota:** `/extrator-autos/`
**Templates:** `sistemas/extrator_autos/templates/index.html`
**API:** `/extrator-autos/api`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Consultar | primary | Consulta single | `POST /consultar` |
| Consultar Lote | primary | Consulta múltiplos | `POST /consultar-lote` |
| Visualizar Documentos | secondary | Preview docs | `carregarPreview()` |
| Resumo do Lote | secondary | Resumo para lote | `mostrarResumoLote()` |
| Baixar Documentos | primary | Download principal | `iniciarDownload()` |
| Baixar ZIP (link) | link | Download ZIP | link direto |
| Retomar sessão | secondary | Retoma interrompida | `retomarSessaoLote()` |
| Descartar sessão | danger | Descarta | `descartarSessaoLote()` |
| Cancelar consulta lote | inline | Cancela consulta | `cancelarConsultaLote()` |
| BERT Config | icon | Abre config | `abrirBertConfig()` |
| Iniciar Worker BERT | secondary | Inicia worker | `POST /bert-training/api/workers/start-inference` |
| Salvar config BERT | primary | Salva config | `PUT /bert/config` |
| Toggle histórico | icon | Expande/recolhe | `toggleHistorico()` |
| Select All docs | checkbox | Seleciona todos | `toggleSelectAll()` |
| Abrir BERT Training | link | Cross-system | `/bert-training/` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Filtrar por Ano | text | Múltiplos anos separados por vírgula |
| Filtrar por Mês | select | Dropdown de meses |
| Buscar códigos | text | Filtro na tab Manual |

### Tabs (seleção de documentos)
- **Categorias** (cards clicáveis)
- **Manual** (busca de códigos)
- **Híbrido** (mix)

### Formulários
| Campo | Tipo | ID |
|-------|------|-----|
| CNJ (single) | text | `input-cnj` |
| CNJs (lote) | textarea | `input-cnj-lote` |
| Buscar instâncias | checkbox | `check-instancias` |
| Modo Lote | toggle switch | `toggle-lote` |
| Formato saída | radios | `modo-saida` (PDF+TXT, PDF, TXT, XML) |
| Mesclar PDFs | checkbox | `check-mesclar` |
| Salvar XML | checkbox | `check-salvar-xml` |
| Pasta única | checkbox | `check-pasta-unica` |
| Processos simultâneos | select | `select-paralelos` |
| Destino | radios | `tipo-destino` (ZIP / Salvar em pasta) |

### Modais
| Modal | ID | Descrição |
|-------|----|-----------|
| BERT Indisponível | `modal-bert` | Alerta + opção continuar sem BERT |
| BERT Config | `modal-bert-config` | Endpoint, status, modelos por categoria |

### Outros Controles
- **Persistência de sessão lote** via localStorage
- Categorias com cards coloridos e badges
- Modo híbrido: categorias + códigos manuais
- Progress bar durante download com log em tempo real
- File System Access API para salvar em pasta local
- Paginação no histórico

---

## 14. Admin: Prompts Config

**Rota:** `/admin/prompts-config`
**Template:** `frontend/templates/admin_prompts.html`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Salvar Configurações (por sistema) | primary | Salva config | API admin |
| Restaurar padrão (chat prompt) | text link | Restaura prompt | `restaurarPromptChatPadrao()` |
| Criar Prompts por Sistema | primary | Cria prompts | `criarPromptsSistema()` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Sistema | select (`#filter-sistema`) | Todos, Matrículas, Assistência, Pedido, Prestação, Relatório |

### Tabs (configuração de IA)
- Matrículas, Assistência Judiciária, Gerador de Peças, Pedido de Cálculo, Prestação de Contas, Relatório Cumprimento, Sistemas Acessórios, Global

### Modais
| Modal | Descrição |
|-------|-----------|
| Editar Prompt (`#edit-modal`) | Campos: sistema, tipo, nome, descrição, conteúdo (textarea mono), ativo |

### Navegação
- Link para Prompts Modulares, Formatos JSON
- Seta voltar para `/dashboard`

---

## 15. Admin: Prompts Modulares

**Rota:** `/admin/prompts-modulos`
**Template:** `frontend/templates/admin_prompts_modulos.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Glossário | text | `abrirGlossario()` |
| Importar | text | `abrirModalImportar()` |
| Exportar | text | `abrirModalExportar()` |
| Novo Módulo | primary | `criarModulo()` |
| Integridade | text | `verificarIntegridadeTodos()` |

### Navegação (barra secundária)
| Label | Destino/Ação |
|-------|-------------|
| Módulos (ativo) | `/admin/prompts-modulos` |
| Categorias | `/admin/categorias-resumo-json` |
| Variáveis | `/admin/variaveis` |
| Tipos de Peça | `/admin/modulos-tipo-peca` |
| Grupos | `abrirModalGrupos()` |
| Assuntos | `abrirGerenciarSubcategoriasPrincipal()` |
| Ordem | `abrirModalOrdemCategorias()` |
| Testar | `/admin/prompts-modulos/teste` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Busca | text (`#busca`) | `filtrarModulos()` |
| Tipo | select (`#filtro-tipo`) | Base/Peça/Conteúdo |
| Tipo de Ativação | select (`#filtro-ativacao`) | LLM/Regra Determinística |
| Grupo | select (`#filtro-grupo`) | `onGrupoChange()` |
| Subgrupo | select (`#filtro-subgrupo`) | `filtrarModulos()` |
| Categoria | select (`#filtro-categoria`) | `carregarModulos()` |
| Assunto | combobox multi-select | Pesquisável, com checkboxes e "Aplicar" |
| Apenas ativos | checkbox (`#apenas-ativos`) | `filtrarModulos()` |

### Modais
| Modal | Descrição |
|-------|-----------|
| Grupos (`#modal-grupos`) | CRUD de grupos e subgrupos (nome, slug, ordem, ativo) |
| Editor (`#modal-editor`) | Editor completo de módulo: título, conteúdo, tipo, regras de ativação, variáveis, drag-and-drop |

### Outros Controles
- Drag & drop (SortableJS) para reordenação
- Combobox pesquisável para variáveis
- Categorias colapsáveis
- Toast notifications

---

## 16. Admin: Módulos por Tipo de Peça

**Rota:** `/admin/modulos-tipo-peca`
**Template:** `frontend/templates/admin_modulos_tipo_peca.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Salvar Alterações | primary (dark) | `salvarTodas()` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Grupo | select (`#select-grupo`) | `onGrupoChange()` |

### Outros Controles
- Checkboxes customizados por módulo por tipo de peça
- Seções colapsáveis com chevron
- Cards de estatísticas: Tipos de Peça, Módulos, Configurações, Alterações Pendentes

---

## 17. Admin: Histórico Gerador

**Rota:** `/admin/gerador-pecas/historico`
**Template:** `frontend/templates/admin_gerador_historico.html`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Baixar DOCX | primary | Baixa documento | download |
| Fechar (modal) | secondary | Fecha modal | — |

### Row Actions
| Ação | Endpoint |
|------|----------|
| Ver Detalhes (click na row) | `GET /admin/api/gerador-pecas-admin/geracoes/{id}` |
| Curadoria Humana (badge) | `GET /admin/api/gerador-pecas-admin/geracoes/{id}/curadoria` |

### Tabs (dentro do modal)
- Prompt Enviado, Resumo Consolidado, Minuta (Markdown), Edições Chat, Versões, Resultado (Raw)

### Modais
| Modal | Descrição |
|-------|-----------|
| Detalhes (`#modal-detalhes`) | 6 tabs, info footer, Download DOCX |
| Curadoria (`#modal-curadoria-detalhes`) | Auditoria de curadoria humana com seções expansíveis |

---

## 18. Admin: Debug Pedido de Cálculo

**Rota:** `/admin/pedido-calculo/debug`
**Template:** `frontend/templates/admin_pedido_calculo_historico.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Copiar (modal expand) | text | Copia para clipboard |
| Fechar (modais) | secondary | Fecha |

### Row Actions
| Ação | Endpoint |
|------|----------|
| Ver Detalhes (click na row) | `GET /pedido-calculo-admin/geracoes/{id}` |

### Tabs (dentro do modal)
- Pedido (Markdown), Dados Extraídos, Logs IA, Resultado (Raw)

### Modais
| Modal | Descrição |
|-------|-----------|
| Detalhes | 4 tabs |
| Expand | Viewer full-screen com Copy |

---

## 19. Admin: Debug Prestação de Contas

**Rota:** `/admin/prestacao-contas/debug`
**Template:** `frontend/templates/admin_prestacao_contas_historico.html`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Copiar | text | Copia para clipboard | — |
| Enviar e Reprocessar | primary (teal) | Envia documentos | `enviarDocumentos()` |
| Cancelar (upload) | secondary | Fecha modal upload | — |
| Anexar Documentos | primary | Abre modal upload | (quando aguardando docs) |

### Row Actions
| Ação | Endpoint |
|------|----------|
| Ver Detalhes | `GET /admin/api/prestacao-admin/geracoes/{id}` |

### Tabs (dentro do modal)
- Parecer, Dados Coletados, Logs IA, Resposta Bruta

### Modais
| Modal | Descrição |
|-------|-----------|
| Detalhes | 4 tabs com parecer badge |
| Expand | Viewer full-screen |
| Upload | Drag-and-drop para PDF/JPG/PNG |

---

## 20. Admin: Usuários

**Rota:** `/admin/users`
**Template:** `frontend/templates/admin_users.html`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Novo Usuário | primary | Abre modal criação | — |
| Salvar (modal) | primary | Salva usuário | `POST /users` ou `PUT /users/{id}` |
| Cancelar (modal) | secondary | Fecha modal | — |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Agrupar por | select (`#group-by`) | Nenhum/Sistema/Setor |

### Row Actions
| Ação | Endpoint |
|------|----------|
| Editar (lápis) | `GET /users/{id}` -> abre modal |
| Resetar Senha (chave) | API reset |
| Excluir (lixeira) | `DELETE /users/{id}` |

### Modais
| Modal | Descrição |
|-------|-----------|
| Criar/Editar (`#user-modal`) | username, fullname, email, setor, role, password, sistemas permitidos (checkboxes), grupos de conteúdo, permissões especiais, ativo |

---

## 21. Admin: Feedbacks

**Rota:** `/admin/feedbacks`
**Template:** `frontend/templates/admin_feedbacks.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Exportar | primary (green) | `exportarDados()` |
| Limpar filtros | text link | `limparFiltros()` |
| Anterior/Próximo | secondary | Paginação |
| Ver Auditoria Completa | primary (amber) | `verDetalhesCuradoria()` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Mês | select (`#filtro-mes`) | `aplicarFiltros()` |
| Ano | select (`#filtro-ano`) | `aplicarFiltros()` |
| Sistema | select (`#filtro-sistema`) | `aplicarFiltros()` |
| Avaliação | select (`#filtro-avaliacao`) | `carregarFeedbacks()` |
| Evolução Sistema | select (`#evolucao-sistema`) | `atualizarGraficoEvolucao()` |
| Evolução Período | select (`#evolucao-semanas`) | Semanas: 8/12/16/24/52 |
| Evolução Métrica | select (`#evolucao-tipo`) | Taxa de Acerto/Total/Corretos |

### Tabs (dentro do modal relatório)
- Relatório, Edições Chat, Versões

### Outros Controles
- Cards estatísticos: Total, Feedbacks, Taxa de Acerto, Sem Avaliação
- Gráficos Chart.js: Distribuição (pizza), Timeline (linha), Evolução por Sistema (linha)
- Modelos de IA em Uso
- Top 10 por Usuário
- Pendentes de Avaliação

---

## 22. Admin: Categorias JSON

**Rota:** `/admin/categorias-resumo-json`
**Template:** `frontend/templates/admin_categorias_json.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Nova Categoria | primary | `criarCategoria()` |
| Editar blacklist | text link | `toggleBlacklistEditor()` |
| Adicionar (código blacklist) | secondary | `adicionarCodigoBlacklist()` |
| Salvar blacklist | primary (red) | `salvarBlacklist()` |
| Testar | secondary | `/admin/categorias-resumo-json/teste` |
| Help (?) | icon | `abrirModalAjudaGeral()` |

### Navegação
- Links para Variáveis, Prompts

### Modais
| Modal | Descrição |
|-------|-----------|
| Editor (`#modal-editor`) | Editor completo de categoria: nome, título, descrição, fonte, códigos de documento, campos JSON schema, combobox de variáveis, drag-and-drop |

### Outros Controles
- Blacklist pills removíveis
- Drag & drop para campos JSON schema
- Combobox pesquisável para variáveis

---

## 23. Admin: Teste Categorias JSON

**Rota:** `/admin/categorias-resumo-json/teste`
**Template:** `frontend/templates/admin_teste_categorias_json.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Adicionar | primary | `adicionarProcessos()` |
| Limpar | secondary | `limparPendentes()` |
| Baixar Todos | primary (blue) | `baixarTodosDocumentos()` |
| Classificar Pendentes | primary (green) | `classificarTodos()` |
| Resetar Erros | secondary (amber) | `resetarErros()` |
| Baixar Expirados | secondary | `baixarPdfsExpirados()` |
| Reclassificar Erros | secondary (orange) | `reclassificarComErro()` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Categoria | select (`#select-categoria`) | `trocarCategoria()` |
| Status | select (`#filtro-status`) | Todos/Baixados/Classificados/Revisados/Não Revisados/Com Erro |

### Tabs
- Resultados, Visualização, Progresso

### Toggles
- Comparar 2 modelos | checkbox `#toggle-comparacao`

### Formulários
- Input de processos (textarea)
- Observações (textarea, auto-save)

---

## 24. Admin: Teste Ativação Módulos

**Rota:** `/admin/prompts-modulos/teste`
**Template:** `frontend/templates/admin_teste_ativacao_modulos.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Gerar Variáveis via IA | primary (purple) | `gerarVariaveis()` |
| SIMULAR ATIVAÇÃO | primary (gradient, full-width) | `simularAtivacao()` |
| Exportar JSON | secondary | `exportarResultados()` |
| Salvar cenário | icon | `salvarCenario()` |
| Pré-definidos | secondary | `carregarCenarioPredefinido()` |
| Excluir cenário | danger | `excluirCenario()` |

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Tipo de Peça | select (`#select-tipo-peca`) | `trocarTipoPeca()` |
| Cenário | select (`#select-cenario`) | `carregarCenario()` |

### Tabs
- Variáveis Extração, Variáveis Processo, Resultados

### Formulários
- Descrição da Situação (textarea)
- Formulários dinâmicos por variável de extração

### Outros Controles
- Cards coloridos de resultado (ativado=verde, não=vermelho, indeterminado=âmbar)
- Accordion expansível para detalhes de módulo
- Contadores: ativados, não ativados, indeterminados
- Categorias com checkboxes (sidebar)

---

## 25. Admin: Variáveis

**Rota:** `/admin/variaveis`
**Template:** `frontend/templates/admin_variaveis.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Nova Variável | primary | `criarVariavel()` |
| Glossário | text (indigo) | `abrirGlossario()` |
| Ajuda (?) | icon | `abrirModalAjuda()` |
| Expandir todas | text | `expandirTodosGrupos()` |
| Recolher todas | text | `recolherTodosGrupos()` |
| Anterior/Próxima | secondary | Paginação |

### Navegação
- Links: Categorias JSON, Prompts Modulares

### Filtros
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Busca | text (`#busca-variavel`) | Por slug ou label |
| Tipo | select (`#filtro-tipo`) | Texto/Número/Data/Sim-Não/Escolha/Lista/Monetário |
| Categoria | select (`#filtro-categoria`) | Dinâmico |
| Mostrar inativas | checkbox (`#mostrar-inativas`) | Toggle |

### Modais
- Detalhe da variável (`#modal-detalhe`)
- Glossário
- Ajuda

### Outros Controles
- Cards: Total, Em Uso, Sem Uso, Tipos
- Grupos colapsáveis com animação
- Slug tooltip on hover
- Paginação

---

## 26. Admin: Restaurar Slugs

**Rota:** `/admin/restaurar-slugs`
**Template:** `frontend/templates/admin_restaurar_slugs.html`

### Botões
| Label | Tipo | Ação | Endpoint |
|-------|------|------|----------|
| Restaurar Slugs | primary | Restaura | `POST /admin/api/extraction/restaurar-slugs` |

### Formulários
- Categoria ID (number, default 5)

### Outros Controles
- Resultado em bloco JSON
- Loading spinner
- Banner de aviso

---

## 27. Admin: Performance

**Rota:** `/admin/performance`
**Template:** `frontend/templates/admin_performance.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Filtrar | primary | `loadSystemLogs()` |
| Limpar filtros | icon | `clearSystemFilters()` |
| Limpar antigos | danger text | `cleanupSystemLogs()` |
| Expandir (route map) | text link | `toggleRouteMapSection()` |
| Adicionar (mapeamento) | primary | `createRouteMap()` |

### Tabs
- Performance Sistema, Logs Gemini API, Logs Avançados

### Filtros (tab Performance)
| Label | Tipo | Comportamento |
|-------|------|---------------|
| Sistema | select (`#filterSystem`) | Dinâmico |
| Rota | text (`#filterRoute`) | Texto livre |
| Action | select (`#filterAction`) | Dinâmico |
| Gargalo | select (`#filterBottleneck`) | Todos/LLM/DB/Parse/Outro |
| Status | select (`#filterStatus`) | Todos/OK/Erro |
| Período | select (`#filterHours`) | 1h/6h/24h/3dias |

### Outros Controles
- Cards clicáveis: Gargalo LLM/DB/Parse/Outro (filtram ao clicar)
- Chart.js: Distribuição de Gargalos (pizza)
- Top 3 Mais Lentas por Gargalo
- Mapeamento de rotas: criar/deletar
- Tabela de logs com 10 colunas

---

## 28. Admin: TJMS Docs

**Rota:** `/admin/tjms-docs`
**Template:** `frontend/templates/admin_tjms_docs.html`

### Navegação
| Label | Destino |
|-------|---------|
| Voltar | `/dashboard` |
| Ver Plano Completo | `/docs/PLANO_UNIFICACAO_TJMS.md` (nova aba) |

### Outros Controles
- Página de documentação/referência (somente leitura)
- Tabelas de códigos de documentos
- Cards de detalhes de sistemas
- Badges: frontend (blue), backend (green), sync (amber)

---

## 29. Admin: Config Peças

**Rota:** `/api/gerador-pecas/config/admin` (legacy) ou `/admin/config-pecas` (React)
**Template:** `frontend/templates/admin_config_pecas.html`

### Botões
| Label | Tipo | Ação |
|-------|------|------|
| Carregar Dados Iniciais | secondary (green) | `seedDados()` |
| Nova Categoria | primary (blue) | `abrirModalCategoria()` |
| Sincronizar com Prompts | primary | `sincronizarTipos()` |
| Salvar categoria | primary | `salvarCategoria()` |
| Salvar tipo | primary | `salvarTipo()` |

### Tabs
- Categorias de Documentos, Tipos de Peça

### Formulários
- **Categoria**: nome, título, descrição, seleção de documentos (search + checkboxes), códigos (readonly), cor (color picker), ordem, ativo
- **Tipo de Peça**: nome, título, descrição, ícone (Font Awesome), ordem, categorias (checkboxes), ativo, padrão

### Modais
| Modal | Descrição |
|-------|-----------|
| Categoria (`#modal-categoria`) | Criar/editar com árvore de documentos |
| Tipo (`#modal-tipo`) | Criar/editar com checkboxes de categorias |

### Filtros
- Busca de documentos (`#filtro-docs`) no modal de categoria

### Outros Controles
- Árvore de seleção de documentos com checkboxes
- Color picker para cor da categoria
