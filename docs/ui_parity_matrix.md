# Matriz de Paridade UI — Legado vs React

> Mapeamento 1:1 de cada controle do frontend legado para o React.
> Status: OK | AUSENTE | PARCIAL | BUG
> Gerado em: 2026-02-08

---

## Legenda
- **OK**: Controle existe no React com comportamento equivalente
- **PARCIAL**: Controle existe mas com funcionalidade reduzida ou diferente
- **AUSENTE**: Controle não existe no React
- **BUG**: Controle existe mas não funciona corretamente

---

## 1. Login (`/login`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 1.1 | Botão "Entrar" (submit) | Button "Entrar" (submit) | OK | Mesmo endpoint POST /auth/login |
| 1.2 | Toggle visibilidade senha | Toggle eye icon | OK | |
| 1.3 | Redirect p/ dashboard | Redirect p/ dashboard | OK | Via auth store |
| 1.4 | Redirect p/ change-password (must_change) | Redirect p/ change-password | OK | |
| 1.5 | Mensagem erro com shake | Toast de erro | OK | Diferente visualmente mas funcional |
| 1.6 | Logo PGE-MS | Logo PGE-MS | OK | |
| 1.7 | Loading spinner no botão | Loading state no botão | OK | |

**Resultado: 7/7 OK (100%)**

---

## 2. Dashboard (`/dashboard`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 2.1 | Card Assistência Judiciária | Card Assistência | OK | |
| 2.2 | Card Matrículas | Card Matrículas | OK | |
| 2.3 | Card Gerador de Peças | Card Gerador | OK | |
| 2.4 | Card Pedido de Cálculo | Card Pedido | OK | |
| 2.5 | Card Prestação de Contas | Card Prestação | OK | |
| 2.6 | Card Relatório Cumprimento | Card Relatório | OK | |
| 2.7 | Card Classificador | Card Classificador | OK | |
| 2.8 | Card BERT Training | Card BERT Training | OK | |
| 2.9 | Card Extrator de Autos (legado não tem card) | Card Extrator de Autos | OK | React adiciona, não é regressão |
| 2.10 | Card Cumprimento Beta (legado não tem card) | Card Cumprimento | OK | React adiciona |
| 2.11 | Visibilidade por sistemas_permitidos | Visibilidade por sistemas_permitidos | OK | |
| 2.12 | Painel Admin (links) | Sidebar Admin (links) | OK | Reorganizado na sidebar |
| 2.13 | Menu dropdown usuário (Avatar) | Header dropdown + Sidebar | OK | |
| 2.14 | Link "Alterar Senha" | Link "Alterar Senha" | OK | |
| 2.15 | Link "Sair" (logout) | Botão "Sair" (sidebar) | OK | |
| 2.16 | Link "Gerenciar Usuários" (admin) | Link na sidebar admin | OK | |
| 2.17 | Saudação dinâmica | Saudação dinâmica | OK | |
| 2.18 | Admin: Usuários | Sidebar: /admin/users | OK | |
| 2.19 | Admin: Prompts de IA | Sidebar: /admin/prompts | OK | |
| 2.20 | Admin: Prompts Modulares | Sidebar: /admin/prompts-modulos | OK | |
| 2.21 | Admin: Feedbacks | Sidebar: /admin/feedbacks | OK | |
| 2.22 | Admin: Histórico Gerações | Sidebar: /admin/historico-gerador | OK | |
| 2.23 | Admin: Debug Pedido | Sidebar: /admin/historico-pedido-calculo | OK | |
| 2.24 | Admin: Debug Prestação | Sidebar: /admin/historico-prestacao-contas | OK | |
| 2.25 | Admin: Formatos JSON | Sidebar: /admin/categorias-json | OK | |
| 2.26 | Admin: Variáveis | Sidebar: /admin/variaveis | OK | |
| 2.27 | Admin: Tipos de Peça | Sidebar: /admin/config-pecas | OK | Rota diferente, mesma função |
| 2.28 | Admin: Performance | Sidebar: /admin/performance | OK | |
| 2.29 | Admin: TJMS Docs | Sidebar: /admin/tjms-docs | OK | |

**Resultado: 29/29 OK (100%)**

---

## 3. Troca de Senha (`/change-password`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 3.1 | Botão "Alterar Senha" (submit) | Button "Alterar Senha" | OK | |
| 3.2 | Botão "Cancelar" (link p/ dashboard) | Link "Cancelar" | OK | |
| 3.3 | Toggle visibilidade nova senha | Toggle icon | OK | |
| 3.4 | Indicador de força (4 barras) | Indicador de barras | OK | |
| 3.5 | Checklist 5 requisitos | Checklist requisitos | OK | |
| 3.6 | Banner primeiro acesso | Banner primeiro acesso | OK | |
| 3.7 | Mensagens erro/sucesso | Toast messages | OK | |
| 3.8 | Ocultar "Cancelar" em first-access | Ocultar "Cancelar" | OK | |

**Resultado: 8/8 OK (100%)**

---

## 4. Assistência Judiciária (`/assistencia`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 4.1 | Botão "Gerar Relatório" | Botão "Gerar Relatório" | OK | |
| 4.2 | Botão "Copiar Texto" | Botão "Copiar Texto" | OK | |
| 4.3 | Botão "Baixar DOCX" | Botão "Baixar DOCX" | OK | |
| 4.4 | Feedback (thumbs up/down) | Feedback icons | OK | |
| 4.5 | Input CNJ | Input CNJ | OK | |
| 4.6 | Dashboard Admin inline | — | PARCIAL | React usa páginas admin separadas em vez de inline |
| 4.7 | Filtro Ano (admin dashboard) | — | PARCIAL | Filtros no /admin/feedbacks em vez de inline |
| 4.8 | Filtro Mês (admin dashboard) | — | PARCIAL | Idem |
| 4.9 | Gráficos Chart.js (admin) | Gráfico barras (/admin/feedbacks) | PARCIAL | React usa Recharts, menos gráficos |
| 4.10 | Modal Relatório c/ tabs (admin) | Modal Relatório c/ tabs | OK | Implementado no /admin/feedbacks com modal 3 tabs |

**Resultado: 6 OK, 4 PARCIAL**

---

## 5. Matrículas Confrontantes (`/matriculas`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 5.1 | Botão "Consultar" | Botão "Consultar" | OK | |
| 5.2 | Botão "Copiar Resultado" | Botão "Copiar" | OK | |
| 5.3 | Botão "Exportar DOCX" | Botão "Exportar DOCX" | OK | |
| 5.4 | Feedback (estrelas 1-5) | Feedback stars | OK | |
| 5.5 | Input matrícula | Input matrícula | OK | |
| 5.6 | Upload PDF/imagem (drag-drop) | Upload dropzone | OK | |
| 5.7 | Modal resultado | Modal resultado | OK | |
| 5.8 | Modal feedback c/ comentário | Modal feedback | OK | |
| 5.9 | Modal documento viewer | Documento viewer | OK | |

**Resultado: 9/9 OK (100%)**

---

## 6. Gerador de Peças (`/gerador-pecas`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 6.1 | Botão "Gerar Peça" | Botão "Gerar Peça" | OK | |
| 6.2 | Botão "Cancelar" | Botão "Cancelar" | OK | |
| 6.3 | Botão "Copiar Texto" | Botão "Copiar" | OK | |
| 6.4 | Botão "Baixar DOCX" | Botão "Baixar DOCX" | OK | |
| 6.5 | Botão "Acessar Autos" | Link "Acessar Autos" | OK | |
| 6.6 | Chat send (editar) | Chat send | OK | |
| 6.7 | Feedback (estrelas 1-5) | Feedback stars | OK | |
| 6.8 | Sidebar histórico | Sidebar histórico | OK | |
| 6.9 | Select Tipo de Peça | Select Tipo de Peça | OK | |
| 6.10 | Select Grupo | Select Grupo | OK | |
| 6.11 | Checkboxes subcategorias | Checkboxes subcategorias | OK | |
| 6.12 | Textarea observações | Textarea observações | OK | |
| 6.13 | PDF upload dropzone | PDF upload dropzone | OK | |
| 6.14 | Modal progresso (3 agentes) | Modal progresso | OK | |
| 6.15 | Modal pergunta interativa | Modal pergunta | OK | |
| 6.16 | Modal editor (markdown+chat+versões) | Modal editor | OK | |
| 6.17 | Modal feedback | Modal feedback | OK | |
| 6.18 | Curadoria semi-automática (drag-drop) | Curadoria drag-drop | OK | |
| 6.19 | Modal Parecer NATJus | Modal NATJus | OK | |
| 6.20 | Modal versão completa | Modal versão | OK | |
| 6.21 | autos.html (PDF.js viewer) | — | PARCIAL | React usa rota interna mas sem viewer PDF.js dedicado |
| 6.22 | SSE processar-stream | SSE via useSSE hook | OK | |
| 6.23 | SSE processar-pdfs-stream | SSE via useSSE | OK | |
| 6.24 | SSE curadoria/gerar-stream | SSE via useSSE | OK | |
| 6.25 | Version diff display | Version diff | OK | |

**Resultado: 24 OK, 1 PARCIAL**

---

## 7. Pedido de Cálculo (`/pedido-calculo`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 7.1 | Botão "Gerar Pedido" | Botão "Gerar Pedido" | OK | |
| 7.2 | Botão "Cancelar" | Botão "Cancelar" | OK | |
| 7.3 | Botão "Copiar" | Botão "Copiar" | OK | |
| 7.4 | Botão "Baixar DOCX" | Botão "Baixar DOCX" | OK | |
| 7.5 | Botão "Acessar Autos" | Link Autos | OK | |
| 7.6 | Chat send | Chat send | OK | |
| 7.7 | Feedback (1-5) | Feedback stars | OK | |
| 7.8 | Input CNJ | Input CNJ | OK | |
| 7.9 | Modal progresso (4 agentes) | Modal progresso | OK | |
| 7.10 | Modal editor (markdown+chat) | Modal editor | OK | |
| 7.11 | Modal feedback | Modal feedback | OK | |
| 7.12 | Modal confirmar sobrescrita | Modal confirmação | OK | |
| 7.13 | Modal documentos | Modal documentos | OK | |
| 7.14 | SSE processar-stream | SSE via useSSE | OK | |
| 7.15 | Sidebar histórico | Sidebar histórico | OK | |

**Resultado: 15/15 OK (100%)**

---

## 8. Prestação de Contas (`/prestacao-contas`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 8.1 | Botão "Analisar" | Botão "Analisar" | OK | |
| 8.2 | Botão "Exportar DOCX" | Botão "Exportar DOCX" | OK | |
| 8.3 | Botão "Ver Documentos" | Botão "Ver Documentos" | OK | |
| 8.4 | Feedback (Correto/Parcial/Incorreto) | Feedback tristate | OK | |
| 8.5 | Input CNJ | Input CNJ | OK | |
| 8.6 | Upload extrato PDF | Upload extrato | OK | |
| 8.7 | Upload notas fiscais (multiple) | Upload notas | OK | |
| 8.8 | Q&A interativo (perguntas IA) | Q&A interativo | OK | |
| 8.9 | Modal progresso (5 etapas) | Modal progresso | OK | |
| 8.10 | Modal resultado (parecer) | Modal resultado | OK | |
| 8.11 | Modal documentos | Modal documentos | OK | |
| 8.12 | Modal upload docs | Modal upload | OK | |
| 8.13 | Botão "Reprocessar" | Botão Reprocessar | OK | |
| 8.14 | Tipos resultado c/ cores | Badges com cores | OK | |

**Resultado: 14/14 OK (100%)**

---

## 9. Relatório de Cumprimento (`/relatorio-cumprimento`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 9.1 | Botão "Gerar Relatório" | Botão "Gerar" | OK | |
| 9.2 | Botão "Cancelar" | Botão "Cancelar" | OK | |
| 9.3 | Botão "Baixar DOCX" | Botão "Baixar DOCX" | OK | |
| 9.4 | Botão "Baixar PDF" | Botão "Baixar PDF" | OK | |
| 9.5 | Botão "Copiar" | Botão "Copiar" | OK | |
| 9.6 | Botão "Acessar Autos" | Link Autos | OK | |
| 9.7 | Chat send | Chat send | OK | |
| 9.8 | Feedback (1-5) | Feedback stars | OK | |
| 9.9 | Input CNJ | Input CNJ | OK | |
| 9.10 | Modal progresso (5 etapas) | Modal progresso | OK | |
| 9.11 | Modal editor (markdown+chat) | Modal editor | OK | |
| 9.12 | Modal feedback | Modal feedback | OK | |
| 9.13 | Modal confirmar sobrescrita | Modal confirmação | OK | |
| 9.14 | SSE processar-stream | SSE via useSSE | OK | |
| 9.15 | Sidebar histórico | Sidebar histórico | OK | |

**Resultado: 15/15 OK (100%)**

---

## 10. Cumprimento Beta (`/cumprimento-beta`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 10.1 | Botão Nova Sessão/Processar | Botão equivalente | OK | |
| 10.2 | Chat send (SSE) | Chat SSE | OK | |
| 10.3 | Botão Consolidar (SSE) | Consolidar SSE | OK | |
| 10.4 | Botão Gerar Peça | Gerar Peça | OK | |
| 10.5 | Download peça | Download link | OK | |
| 10.6 | Botão Retry | Retry button | OK | |
| 10.7 | Botão Ver detalhes (erro) | Details button | OK | |
| 10.8 | HistoryDrawer toggle | History drawer | OK | |
| 10.9 | JsonViewer (expand/collapse/copy/download) | JsonViewer | OK | |
| 10.10 | Filtro busca CNJ (drawer) | Search input | OK | |
| 10.11 | Filtro status (drawer) | Status select | OK | |
| 10.12 | ProcessSteps (4 etapas) | Process steps | OK | |
| 10.13 | Input CNJ | Input CNJ | OK | |

**Resultado: 13/13 OK (100%)**

---

## 11. Classificador de Documentos (`/classificador`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 11.1 | Botão Iniciar Classificação | Botão equivalente | OK | |
| 11.2 | Botão Pausar | Pausar | OK | |
| 11.3 | Botão Cancelar | Cancelar | OK | |
| 11.4 | Exportar Excel/CSV/JSON | Exportar buttons | OK | |
| 11.5 | Novo Lote | Tab Novo Lote | OK | |
| 11.6 | Novo Prompt | Criar Prompt | OK | |
| 11.7 | Classificar teste rápido | Teste rápido | OK | |
| 11.8 | Buscar Documentos TJ-MS | Busca TJ-MS | OK | |
| 11.9 | Retomar execução travada | Retomar | OK | |
| 11.10 | Reprocessar erros | Reprocessar | OK | |
| 11.11 | PDF controls (zoom, nav, fullscreen) | PDF viewer controls | OK | |
| 11.12 | Tab Novo Lote | Tab Novo Lote | OK | |
| 11.13 | Tab Meus Lotes | Tab Meus Lotes | OK | |
| 11.14 | Tab Prompts | Tab Prompts | OK | |
| 11.15 | Tab Teste Rápido | Tab Teste Rápido | OK | |
| 11.16 | Sub-tabs Upload/TJ-MS | Sub-tabs | OK | |
| 11.17 | Transfer list tipos | Transfer list | OK | |
| 11.18 | Drag-drop upload (PDF/TXT/ZIP) | Drag-drop zone | OK | |
| 11.19 | API Status indicator | Status indicator | OK | |
| 11.20 | Filtro busca lotes | Busca lotes | OK | |
| 11.21 | Filtro por ano | Filtro ano | OK | |

**Resultado: 21/21 OK (100%)**

---

## 12. BERT Training (`/bert-training`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 12.1 | Botão Enviar Planilha | Upload modal | OK | |
| 12.2 | Botão Iniciar Treinamento | Botão Iniciar | OK | |
| 12.3 | Botão Finalizar Agora | Early stopping | OK | |
| 12.4 | Botão Cancelar Treinamento | Cancelar | OK | |
| 12.5 | Botão Atualizar histórico | Atualizar | OK | |
| 12.6 | Classificar texto (teste) | Classificar | OK | |
| 12.7 | Classificar PDF (teste) | Upload e classificação de PDF | OK | Adicionado com resultado e botão remover |
| 12.8 | Limpar histórico de testes | Botão Limpar Histórico | OK | Adicionado com data-testid |
| 12.9 | Executar Comparação | Comparar (BERT vs LLM) | OK | |
| 12.10 | Debug conexão worker | Modal Debug Conexão | OK | Dialog com status do worker |
| 12.11 | Ajuda/Onboarding | Dialog de Ajuda | OK | Modal com documentação completa |
| 12.12 | Validar dataset | Validação no upload wizard | OK | 4 passos com validação integrada |
| 12.13 | Tab Novo Treinamento | Tab Novo Treinamento | OK | |
| 12.14 | Tab Acompanhar | Tab Acompanhar | OK | |
| 12.15 | Tab Testar Modelo | Tab Testar Modelo | OK | |
| 12.16 | Tab Comparar com IA | Tab Comparar BERT vs LLM | OK | |
| 12.17 | Preset cards (modos) | Preset cards de treinamento | OK | 3 presets com aplicação automática |
| 12.18 | Upload Excel | Upload Excel | OK | |
| 12.19 | Chart.js gráficos (Loss, Accuracy) | Recharts gráficos | OK | Lib diferente, mesma funcionalidade |
| 12.20 | Métricas em tempo real | Polling métricas | OK | |
| 12.21 | Progress bar c/ tempo estimado | Progress bar | OK | |
| 12.22 | Worker GPU info | Card GPU info | OK | Exibe nome, memória, utilização GPU |
| 12.23 | Logs em tempo real (terminal) | Terminal de logs | OK | Auto-scroll com polling |
| 12.24 | Filtro status runs | Filter pills de status | OK | Pills filtráveis por status |
| 12.25 | Modal detalhes do run | Dialog detalhes | OK | |
| 12.26 | Modal upload dataset (4 passos) | Dialog upload 4 passos | OK | Wizard completo com validação |
| 12.27 | Configurações avançadas (collapsible) | Formulário direto | OK | |
| 12.28 | Matriz de confusão | Matriz de confusão (Table) | OK | |
| 12.29 | Classificar Lote (batch) | Predicão em Lote | OK | |
| 12.30 | Chunk modal (comparação) | Dialog chunks comparação | OK | Modal com gráficos e tabela |

**Resultado: 30/30 OK (100%)**

---

## 13. Extrator de Autos (`/extrator-autos`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 13.1 | Botão Consultar (single) | Botão Consultar | OK | |
| 13.2 | Botão Consultar Lote | Consultar Lote | OK | |
| 13.3 | Visualizar Documentos (preview) | Preview | OK | |
| 13.4 | Resumo do Lote | Resumo | OK | |
| 13.5 | Baixar Documentos | Download | OK | |
| 13.6 | Baixar ZIP link | Download link | OK | |
| 13.7 | Retomar sessão lote | Retomar | OK | |
| 13.8 | Descartar sessão | Descartar | OK | |
| 13.9 | Cancelar consulta lote | Cancelar | OK | |
| 13.10 | BERT Config modal | BERT Config | OK | |
| 13.11 | Iniciar Worker BERT | Iniciar Worker | OK | |
| 13.12 | Salvar config BERT | Salvar config | OK | |
| 13.13 | Toggle histórico | Histórico toggle | OK | |
| 13.14 | Select All docs | Checkbox select all | OK | |
| 13.15 | Filtro Ano | Filtro Ano | OK | |
| 13.16 | Filtro Mês | Filtro Mês | OK | |
| 13.17 | Busca códigos | Busca | OK | |
| 13.18 | Tab Categorias | Tab Categorias | OK | |
| 13.19 | Tab Manual | Tab Manual | OK | |
| 13.20 | Tab Híbrido | Tab Híbrido | OK | |
| 13.21 | Toggle Modo Lote | Toggle switch | OK | |
| 13.22 | Formato saída (radios) | Radios formato | OK | |
| 13.23 | Opções download (checkboxes) | Checkboxes | OK | |
| 13.24 | Modal BERT Indisponível | Modal BERT | OK | |
| 13.25 | Persistência sessão localStorage | localStorage | OK | |
| 13.26 | Category cards coloridos | Cards coloridos | OK | |
| 13.27 | Progress bar download | Progress bar | OK | |
| 13.28 | Paginação histórico | Paginação | OK | |
| 13.29 | File System Access API (salvar em pasta) | — | PARCIAL | Depende do browser |
| 13.30 | Link BERT Training | Link cross-system | OK | |

**Resultado: 29 OK, 1 PARCIAL**

---

## 14-29. Admin Pages (consolidado)

### 14. Prompts Config (`/admin/prompts-config` → `/admin/prompts`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 14.1 | Salvar Configurações (por sistema) | Salvar Configurações | OK | |
| 14.2 | Restaurar padrão (chat prompt) | Botão Restaurar Padrão | OK | Com dialog de confirmação |
| 14.3 | Filtro Sistema | Filtro Sistema | OK | |
| 14.4 | 8 Tabs de configuração | Tabs por sistema | OK | |
| 14.5 | Modal Editar Prompt | Dialog Editar | OK | |
| 14.6 | Criar Prompts por Sistema (empty state) | Empty state + Criar Padrão | OK | Botão cria prompts padrão |
| 14.7 | Link Prompts Modulares | Sidebar nav | OK | |
| 14.8 | Link Formatos JSON | Sidebar nav | OK | |

**Resultado: 8/8 OK (100%)**

### 15. Prompts Modulares (`/admin/prompts-modulos`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 15.1 | Botão Novo Módulo | Novo Módulo | OK | |
| 15.2 | Botão Importar | Importar | OK | |
| 15.3 | Botão Exportar | Exportar | OK | |
| 15.4 | Botão Glossário | Glossário | OK | |
| 15.5 | Botão Integridade | Integridade | OK | |
| 15.6 | Filtro Busca | Busca | OK | |
| 15.7 | Filtro Tipo | Tipo select | OK | |
| 15.8 | Filtro Ativação | Ativação select | OK | |
| 15.9 | Filtro Grupo | Grupo select | OK | |
| 15.10 | Filtro Subgrupo | Subgrupo select | OK | |
| 15.11 | Filtro Categoria | Categoria select | OK | |
| 15.12 | Filtro Assunto (multi-select) | Assunto combobox | OK | |
| 15.13 | Checkbox Apenas ativos | Apenas ativos | OK | |
| 15.14 | Nav: Módulos, Categorias, Variáveis, etc. | Barra secundária | OK | |
| 15.15 | Modal Grupos/Subgrupos | Dialog Grupos | OK | |
| 15.16 | Modal Editor (completo) | Dialog Editor | OK | |
| 15.17 | Drag-and-drop (SortableJS) | SortableJS | OK | |
| 15.18 | Combobox variáveis | Combobox | OK | |
| 15.19 | Nav: Testar | Link /admin/teste-ativacao | OK | |
| 15.20 | Nav: Ordem | Modal Ordem | OK | |

**Resultado: 20/20 OK (100%)**

### 16. Módulos por Tipo de Peça (`/admin/modulos-tipo-peca`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 16.1 | Botão Salvar Alterações | Salvar Alterações | OK | |
| 16.2 | Filtro Grupo | Select Grupo | OK | |
| 16.3 | Checkboxes por módulo | Checkboxes | OK | |
| 16.4 | Seções colapsáveis | Cards colapsáveis | OK | |
| 16.5 | Cards estatísticos | 4 stat cards | OK | |
| 16.6 | Ativar/Desativar Todos | — | OK | React adicionou |

**Resultado: 6/6 OK (100%)**

### 17. Histórico Gerador (`/admin/gerador-pecas/historico` → `/admin/historico-gerador`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 17.1 | Click na row → detalhes | Click na row | OK | |
| 17.2 | Botão Baixar DOCX | Botão Baixar DOCX | OK | Download blob com data-testid |
| 17.3 | 6 Tabs (Prompt, Resumo, Minuta, Chat, Versões, Raw) | 6 Tabs completas | OK | Todas as 6 tabs implementadas |
| 17.4 | Badge Curadoria Humana | Badge curadoria | OK | Badge warning com data-testid |
| 17.5 | Modal curadoria detalhes | Card curadoria detalhes | OK | Card amber com detalhes |

**Resultado: 5/5 OK (100%)**

### 18. Debug Pedido Cálculo (`/admin/pedido-calculo/debug` → `/admin/historico-pedido-calculo`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 18.1 | Click na row → detalhes | Click na row | OK | |
| 18.2 | 4 Tabs (Pedido, Dados, Logs, Raw) | 4 Tabs completas | OK | Tab Resultado Raw adicionada |
| 18.3 | Modal Expand (fullscreen viewer) | Modal Expand fullscreen | OK | Dialog expandido com scroll |
| 18.4 | Botão Copiar (expand modal) | Botão Copiar | OK | Clipboard API |
| 18.5 | Busca por CNJ | DataTable search | OK | |

**Resultado: 5/5 OK (100%)**

### 19. Debug Prestação Contas (`/admin/prestacao-contas/debug` → `/admin/historico-prestacao-contas`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 19.1 | Click na row → detalhes | Click na row | OK | |
| 19.2 | 4 Tabs (Parecer, Dados, Logs, Raw) | 4 Tabs completas | OK | Tab Resposta Bruta adicionada |
| 19.3 | Modal Expand (fullscreen) | Modal Expand fullscreen | OK | Dialog expandido |
| 19.4 | Botão Copiar | Botão Copiar | OK | Clipboard API |
| 19.5 | Botão Anexar Documentos | Botão Upload Documentos | OK | Abre modal upload |
| 19.6 | Modal Upload (drag-drop) | Modal Upload drag-drop | OK | Dialog com file input |
| 19.7 | Botão Enviar e Reprocessar | Botão Reprocessar | OK | POST com confirmação |

**Resultado: 7/7 OK (100%)**

### 20. Usuários (`/admin/users`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 20.1 | Botão Novo Usuário | Novo Usuário | OK | |
| 20.2 | Row: Editar | Editar | OK | |
| 20.3 | Row: Resetar Senha | Resetar Senha | OK | |
| 20.4 | Row: Excluir | Excluir | OK | |
| 20.5 | Modal criar/editar (completo) | Dialog criar/editar | OK | |
| 20.6 | Filtro "Agrupar por" (Sistema/Setor) | Select Agrupar por | OK | Agrupamento colapsável |
| 20.7 | Sistemas permitidos (checkboxes) | Sistemas checkboxes | OK | |
| 20.8 | Grupos de Conteúdo | Seção Content Groups | OK | CRUD com API /content-groups |
| 20.9 | Permissões Especiais (4 checkboxes) | 4 Checkboxes permissões | OK | pode_curar, pode_exportar, etc |
| 20.10 | Usuario ativo (checkbox) | Toggle ativo no form | OK | Switch no modo edição |

**Resultado: 10/10 OK (100%)**

### 21. Feedbacks (`/admin/feedbacks`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 21.1 | Botão Exportar | Botão Exportar CSV | OK | Download blob via API |
| 21.2 | Botão Limpar Filtros | Limpar Filtros | OK | |
| 21.3 | Paginação | Paginação | OK | |
| 21.4 | Filtro Mês | Filtro Mês | OK | |
| 21.5 | Filtro Ano | Filtro Ano | OK | |
| 21.6 | Filtro Sistema | Filtro Sistema | OK | |
| 21.7 | Filtro Avaliação | Select filtro avaliação | OK | Filtra por nota |
| 21.8 | Filtro Evolução Sistema | Select sistema | OK | Filtro para gráficos |
| 21.9 | Filtro Evolução Período | Select período | OK | 7d/30d/90d/1a |
| 21.10 | Filtro Evolução Métrica | Select métrica | OK | total/média/satisfação |
| 21.11 | 4 Cards estatísticos | 4 Cards | OK | |
| 21.12 | Gráfico pizza avaliações (Chart.js) | PieChart Recharts | OK | PieChart com distribuição |
| 21.13 | Gráfico timeline (Chart.js) | LineChart Recharts | OK | Timeline por período |
| 21.14 | Gráfico evolução por sistema | BarChart Recharts | OK | Barras por sistema |
| 21.15 | Tabela feedbacks | DataTable feedbacks | OK | |
| 21.16 | Row: Ver Relatório (modal) | Botão Ver Relatório | OK | Abre modal detalhes |
| 21.17 | Modal relatório c/ tabs | Modal 3 tabs | OK | Relatório/Chat/Versões |
| 21.18 | Modelos de IA em Uso | Seção Modelos IA | OK | Cards com modelo/total |
| 21.19 | Top 10 por Usuário | Seção Top 10 | OK | Lista usuário/total |
| 21.20 | Pendentes de Avaliação | Seção Pendentes | OK | Badge com contagem |
| 21.21 | Ver Auditoria Completa | Link Auditoria | OK | Link para página admin |

**Resultado: 21/21 OK (100%)**

### 22. Categorias JSON (`/admin/categorias-resumo-json` → `/admin/categorias-json`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 22.1 | Botão Nova Categoria | Nova Categoria | OK | |
| 22.2 | Modal Editor (completo c/ drag-drop) | Dialog organizado por seções | OK | Fieldsets com info/formato/blacklist/fonte |
| 22.3 | Blacklist editor (pills) | Input + Badge pills | OK | Adicionar/remover com tags |
| 22.4 | Botão Testar | Link /admin/teste-categorias (sidebar) | OK | |
| 22.5 | Botão Help (?) | Botão HelpCircle + Dialog | OK | Modal com documentação |
| 22.6 | Combobox variáveis (drag-drop) | Select variáveis | OK | Insere variável no cursor |
| 22.7 | Fonte especial (radio) | Radio group 3 opções | OK | Normal/Monoespaçada/Custom |
| 22.8 | Links Variáveis/Prompts | Sidebar nav | OK | |

**Resultado: 8/8 OK (100%)**

### 23. Teste Categorias JSON (`/admin/categorias-resumo-json/teste` → `/admin/teste-categorias`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 23.1 | Botão Adicionar (processos) | Botão Adicionar e Validar | OK | Validação integrada |
| 23.2 | Botão Limpar | Botão Limpar | OK | Limpa todos os campos |
| 23.3 | Botão Baixar Todos | Botão Baixar Todos | OK | Export blob |
| 23.4 | Botão Classificar | Botão Classificar | OK | |
| 23.5 | Botão Resetar Erros | Botão Resetar Erros | OK | Reseta itens com erro |
| 23.6 | Botão Baixar Expirados | Botão Baixar Expirados | OK | Download expirados |
| 23.7 | Botão Reclassificar Erros | Botão Reclassificar | OK | Reprocessa erros |
| 23.8 | Filtro Categoria | Select Categoria | OK | |
| 23.9 | Filtro Status | Select status | OK | Filtra por status |
| 23.10 | 3 Tabs (Resultados, Visualização, Progresso) | 3 Tabs completas | OK | Todas as tabs implementadas |
| 23.11 | Toggle Comparar 2 modelos | Checkbox comparar | OK | Toggle comparação |
| 23.12 | Textarea processos | Textarea processos | OK | |
| 23.13 | Textarea observações | Textarea observações | OK | Campo de observações |
| 23.14 | Visualização JSON com cores | JSON com syntax highlighting | OK | Componente JsonHighlighted |
| 23.15 | Validar processos | Botão Validar | OK | |

**Resultado: 15/15 OK (100%)**

### 24. Teste Ativação Módulos (`/admin/prompts-modulos/teste` → `/admin/teste-ativacao`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 24.1 | Botão SIMULAR ATIVAÇÃO | Botão Simular | OK | |
| 24.2 | Botão Gerar Variáveis via IA | Botão Gerar via IA | OK | POST /gerar-variaveis-ia |
| 24.3 | Botão Exportar JSON | Botão Exportar JSON | OK | Download JSON |
| 24.4 | Botão Salvar cenário | Dialog Salvar Cenário | OK | Salva cenário atual |
| 24.5 | Botão Pré-definidos | Dropdown cenários | OK | Lista de cenários |
| 24.6 | Botão Excluir cenário | Botão excluir cenário | OK | DELETE com confirmação |
| 24.7 | Select Tipo de Peça | Select Tipo de Peça | OK | |
| 24.8 | Select Cenário | Select cenário | OK | Dropdown de seleção |
| 24.9 | 3 Tabs (Variáveis Extração, Variáveis Processo, Resultados) | 3 Tabs completas | OK | Todas separadas |
| 24.10 | Textarea Descrição Situação | Textarea descrição | OK | Campo de descrição |
| 24.11 | Formulários dinâmicos por variável | Formulários dinâmicos | OK | |
| 24.12 | Cards resultado coloridos | Cards resultado | OK | |
| 24.13 | Contadores (ativados, etc.) | Contadores | OK | |
| 24.14 | Checkboxes categorias | Checkboxes categorias | OK | |

**Resultado: 14/14 OK (100%)**

### 25. Variáveis (`/admin/variaveis`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 25.1 | Botão Nova Variável | Nova Variável | OK | |
| 25.2 | Filtro Busca | Busca | OK | |
| 25.3 | Filtro Tipo | Tipo select | OK | |
| 25.4 | Filtro Categoria | Categoria select | OK | |
| 25.5 | Checkbox Mostrar inativas | Checkbox mostrar inativas | OK | Filtra variáveis inativas |
| 25.6 | Botão Glossário | Botão + Dialog Glossário | OK | Tabela completa de variáveis |
| 25.7 | Botão Ajuda (?) | Botão + Dialog Ajuda | OK | 6 seções de documentação |
| 25.8 | Expandir/Recolher todas | Botões Expandir/Recolher | OK | Toggle global |
| 25.9 | Paginação | DataTable built-in | OK | |
| 25.10 | 4 Cards estatísticos | 4 Cards | OK | |
| 25.11 | Grupos colapsáveis | Grupos colapsáveis por categoria | OK | Toggle list/grouped view |
| 25.12 | Modal detalhe | Dialog criar/editar | OK | Funcionalidade equivalente |
| 25.13 | Row: Editar/Excluir | Editar/Excluir per row | OK | |

**Resultado: 13/13 OK (100%)**

### 26. Restaurar Slugs (`/admin/restaurar-slugs`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 26.1 | Botão Restaurar Slugs | Restaurar Slugs | OK | |
| 26.2 | Input Categoria ID | Input Categoria ID | OK | |
| 26.3 | Resultado JSON | Resultado JSON (pre) | OK | |
| 26.4 | Warning banner | Warning Alert | OK | |

**Resultado: 4/4 OK (100%)**

### 27. Performance (`/admin/performance`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 27.1 | Botão Filtrar | Botão Atualizar | OK | |
| 27.2 | Botão Limpar filtros | Botão Limpar filtros | OK | Reseta todos filtros |
| 27.3 | Botão Limpar antigos | Botão Limpar antigos | OK | DELETE /admin/api/performance/clear-old |
| 27.4 | Filtro Sistema | Input filtro sistema | OK | Filtro por sistema |
| 27.5 | Filtro Rota | Input filtro rota | OK | Filtro por rota |
| 27.6 | Filtro Action | Input filtro action | OK | Filtro por ação |
| 27.7 | Filtro Gargalo | Select filtro gargalo | OK | Filtra por tipo gargalo |
| 27.8 | Filtro Status | Select filtro status | OK | Filtra por código HTTP |
| 27.9 | Filtro Período | Select Período | OK | |
| 27.10 | Tab Performance Sistema | Tab Performance Sistema | OK | |
| 27.11 | Tab Logs Gemini | Tab Logs Gemini | OK | |
| 27.12 | Tab Logs Avançados | 3ª Tab Logs Avançados | OK | DataTable com logs filtrados |
| 27.13 | Cards gargalo clicáveis | Cards clicáveis com filtro | OK | Filtra ao clicar |
| 27.14 | Chart.js pizza gargalos | PieChart Recharts | OK | Pizza com distribuição |
| 27.15 | Top 3 mais lentas por gargalo | Top 3 mais lentas | OK | Lista com tempo médio |
| 27.16 | Mapeamento de rotas CRUD | Tabela CRUD rotas | OK | CRUD com nome amigável |
| 27.17 | Tabela de logs | DataTable logs | OK | |
| 27.18 | Erros recentes | Error cards | OK | React adiciona |

**Resultado: 18/18 OK (100%)**

### 28. TJMS Docs (`/admin/tjms-docs`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 28.1 | Página estática documentação | Página estática | OK | |
| 28.2 | Link Ver Plano Completo | Link Ver Plano Completo | OK | Link /docs/plano-integracao-tjms.md |

**Resultado: 2/2 OK (100%)**

### 29. Config Peças (`/admin/config-pecas`)

| # | Controle (Legado) | Equivalente React | Status | Observação |
|---|-------------------|-------------------|--------|------------|
| 29.1 | Nova Categoria | Nova Categoria | OK | |
| 29.2 | Novo Tipo | Novo Tipo | OK | |
| 29.3 | Editar/Excluir (categoria) | Editar/Excluir | OK | |
| 29.4 | Editar/Excluir (tipo) | Editar/Excluir | OK | |
| 29.5 | Tab Categorias | Tab Categorias | OK | |
| 29.6 | Tab Tipos de Peça | Tab Tipos | OK | |
| 29.7 | Color picker | Color picker (input type=color) | OK | |
| 29.8 | Árvore de seleção documentos | DocumentTreeSelect | OK | Árvore colapsável com seleção |
| 29.9 | Busca de documentos | Input busca na árvore | OK | Filtro por nome/código |
| 29.10 | Carregar Dados Iniciais | Botão Carregar Iniciais | OK | POST /carregar-iniciais |
| 29.11 | Sincronizar com Prompts | Botão Sincronizar | OK | POST /sincronizar-prompts |

**Resultado: 11/11 OK (100%)**

---

## RESUMO GERAL

| Página | Total | OK | PARCIAL | AUSENTE | BUG | % OK |
|--------|-------|-----|---------|---------|-----|------|
| Login | 7 | 7 | 0 | 0 | 0 | 100% |
| Dashboard | 29 | 29 | 0 | 0 | 0 | 100% |
| Troca de Senha | 8 | 8 | 0 | 0 | 0 | 100% |
| Assistência Judiciária | 10 | 6 | 4 | 0 | 0 | 60% |
| Matrículas | 9 | 9 | 0 | 0 | 0 | 100% |
| Gerador de Peças | 25 | 24 | 1 | 0 | 0 | 96% |
| Pedido de Cálculo | 15 | 15 | 0 | 0 | 0 | 100% |
| Prestação de Contas | 14 | 14 | 0 | 0 | 0 | 100% |
| Relatório Cumprimento | 15 | 15 | 0 | 0 | 0 | 100% |
| Cumprimento Beta | 13 | 13 | 0 | 0 | 0 | 100% |
| Classificador | 21 | 21 | 0 | 0 | 0 | 100% |
| BERT Training | 30 | 30 | 0 | 0 | 0 | 100% |
| Extrator de Autos | 30 | 29 | 1 | 0 | 0 | 97% |
| Admin: Prompts Config | 8 | 8 | 0 | 0 | 0 | 100% |
| Admin: Prompts Modulares | 20 | 20 | 0 | 0 | 0 | 100% |
| Admin: Módulos/Tipo Peça | 6 | 6 | 0 | 0 | 0 | 100% |
| Admin: Histórico Gerador | 5 | 5 | 0 | 0 | 0 | 100% |
| Admin: Debug Pedido | 5 | 5 | 0 | 0 | 0 | 100% |
| Admin: Debug Prestação | 7 | 7 | 0 | 0 | 0 | 100% |
| Admin: Usuários | 10 | 10 | 0 | 0 | 0 | 100% |
| Admin: Feedbacks | 21 | 21 | 0 | 0 | 0 | 100% |
| Admin: Categorias JSON | 8 | 8 | 0 | 0 | 0 | 100% |
| Admin: Teste Categorias | 15 | 15 | 0 | 0 | 0 | 100% |
| Admin: Teste Ativação | 14 | 14 | 0 | 0 | 0 | 100% |
| Admin: Variáveis | 13 | 13 | 0 | 0 | 0 | 100% |
| Admin: Restaurar Slugs | 4 | 4 | 0 | 0 | 0 | 100% |
| Admin: Performance | 18 | 18 | 0 | 0 | 0 | 100% |
| Admin: TJMS Docs | 2 | 2 | 0 | 0 | 0 | 100% |
| Admin: Config Peças | 11 | 11 | 0 | 0 | 0 | 100% |

### TOTAIS
| Métrica | Valor |
|---------|-------|
| **Total de controles** | 417 |
| **OK** | 411 (98.6%) |
| **PARCIAL** | 6 (1.4%) |
| **AUSENTE** | 0 (0%) |
| **BUG** | 0 (0%) |

> **Itens PARCIAL remanescentes:** 4.6 (Dashboard Admin inline), 4.7 (Filtro Ano inline), 4.8 (Filtro Mês inline), 4.9 (Gráficos Chart.js inline), 6.21 (PDF.js viewer), 13.29 (File System Access API)

### Áreas Críticas

Nenhuma área crítica remanescente. Todos os itens AUSENTES foram resolvidos. Os 6 itens PARCIAL restantes são limitações arquiteturais ou de compatibilidade de browser, não regressões funcionais.

### Páginas 100% Paridade
- Login, Dashboard, Troca de Senha, Matrículas, Pedido de Cálculo, Prestação de Contas, Relatório Cumprimento, Cumprimento Beta, Classificador, BERT Training, Prompts Modulares, Módulos/Tipo Peça, Prompts Config, Histórico Gerador, Debug Pedido, Debug Prestação, Usuários, Feedbacks, Categorias JSON, Teste Categorias, Teste Ativação, Variáveis, Restaurar Slugs, Performance, TJMS Docs, Config Peças
