# Matriz QA Admin: Testes Destrutivos

> Gerada em 2026-02-11. Cobre TODAS as 16 rotas admin + alias.

## Legendas

- **R** = Teste de Render (heading ou anchor visivel)
- **I** = Teste de Interacao (abrir/fechar dialogs, tabs, filtros)
- **D** = Teste Destrutivo (acao que modifica estado: criar, editar, excluir, resetar)
- **E** = Evidencia coletada (screenshot, trace, video)

---

## 1. /admin/users

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Gerenciamento de Usuarios" | R | Validar visibilidade | Nao | screenshot |
| DataTable de usuarios | R | Validar colunas e linhas | Nao | screenshot |
| Botao "Novo Usuario" | I | Abrir dialog de criacao | Nao | screenshot |
| Dialog Criar/Editar | I | Fechar no X e no Cancelar | Nao | screenshot |
| Select "Agrupar por" | I | Trocar para Sistema/Setor | Nao | screenshot |
| Botao "Editar" (por usuario) | I | Abrir dialog de edicao | Nao | screenshot |
| Botao "Resetar Senha" | D | Resetar senha de usuario | Sim | trace + screenshot |
| Botao "Excluir" | D | Excluir usuario (com confirmacao) | Sim | trace + screenshot |
| Dialog Confirmacao Exclusao | I | Cancelar / Confirmar | Sim | screenshot |
| Dialog Nova Senha | I | Fechar | Nao | screenshot |

---

## 2. /admin/prompts

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Gerenciamento de Prompts e IA" | R | Validar visibilidade | Nao | screenshot |
| Tabs de Configuracao IA (por sistema) | I | Clicar em cada tab | Nao | screenshot |
| Inputs de config IA | I | Alterar valor | Nao | screenshot |
| Botao "Salvar" (config IA) | D | Salvar configuracoes | Sim | trace |
| Select "Filtrar por sistema" | I | Trocar filtro | Nao | screenshot |
| Cards de prompts (expand/collapse) | I | Expandir/colapsar | Nao | screenshot |
| Botao "Editar" (prompt) | I | Abrir dialog edicao | Nao | screenshot |
| Dialog Editar Prompt | I | Fechar X, Cancelar, Salvar | Sim (salvar) | trace |
| Botao "Restaurar" (prompt) | D | Restaurar padrao (com confirmacao) | Sim | trace + screenshot |
| Botao "Criar Prompts Padrao" | D | Criar prompts iniciais | Sim | trace |

---

## 3. /admin/prompts-modulos

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Modulos de Prompts" | R | Validar visibilidade | Nao | screenshot |
| Filtros (busca, tipo, modo, grupo, subgrupo, categoria, assuntos) | I | Aplicar filtros | Nao | screenshot |
| Botao "Novo Modulo" | I | Abrir dialog criacao | Nao | screenshot |
| Dialog Criar/Editar Modulo | I | Fechar X, Cancelar, Salvar | Sim (salvar) | trace |
| Botao Toggle (ativar/desativar) | D | Alternar status do modulo | Sim | trace |
| Botao "Excluir" (icone lixeira) | D | Excluir modulo (com confirmacao) | Sim | trace + screenshot |
| Botao "Historico" (icone relogio) | I | Abrir dialog historico | Nao | screenshot |
| Dialog Historico | I | Fechar, visualizar versoes | Nao | screenshot |
| Botao "Restaurar" (versao) | D | Restaurar versao anterior | Sim | trace |
| Botao "Exportar" | I | Download JSON | Nao | screenshot |
| Botao "Importar" | D | Importar modulos de JSON | Sim | trace |
| Botao "Grupos" | I | Abrir dialog de gestao | Nao | screenshot |
| Dialog Grupos: Criar Grupo | D | Criar novo grupo | Sim | trace |
| Categorias colapsaveis (conteudo) | I | Expandir/colapsar | Nao | screenshot |

---

## 4. /admin/feedbacks

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Dashboard de Feedbacks" | R | Validar visibilidade | Nao | screenshot |
| Cards de metricas (4) | R | Validar valores | Nao | screenshot |
| Graficos Recharts (Pie + Line) | R | Validar render | Nao | screenshot |
| Selects de filtro (mes, ano, sistema) | I | Trocar valores | Nao | screenshot |
| Botao "Limpar filtros" | I | Resetar filtros | Nao | screenshot |
| Botao "Exportar" | I | Download CSV | Nao | screenshot |

---

## 5. /admin/performance

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Performance & Logs" | R | Validar visibilidade | Nao | screenshot |
| Tabs (Performance, Gemini, Avancado) | I | Clicar em cada tab | Nao | screenshot |
| Cards de gargalo (4) | R | Validar render | Nao | screenshot |
| Grafico PieChart | R | Validar render | Nao | screenshot |
| DataTable de logs | R | Validar colunas | Nao | screenshot |
| Filtros (sistema, rota, gargalo, status, periodo) | I | Aplicar filtros | Nao | screenshot |
| Botao "Limpar antigos" | D | Limpar logs > 7 dias | Sim | trace + screenshot |
| Botao "Exportar" (tab Avancado) | I | Download CSV | Nao | screenshot |
| Mapeamento Rota-Sistema (expandir) | I | Expandir/colapsar | Nao | screenshot |

---

## 6. /admin/variaveis

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Painel de Variaveis" | R | Validar visibilidade | Nao | screenshot |
| Cards de resumo (4) | R | Validar render | Nao | screenshot |
| Tabela de variaveis | R | Validar colunas | Nao | screenshot |
| Busca por slug/label | I | Digitar busca | Nao | screenshot |
| Select Tipo | I | Trocar tipo | Nao | screenshot |
| Select Categoria | I | Trocar categoria | Nao | screenshot |
| Checkbox "Mostrar inativas" | I | Toggle | Nao | screenshot |
| Botao "Glossario" | I | Abrir dialog | Nao | screenshot |
| Botao "Ajuda" | I | Abrir dialog | Nao | screenshot |
| Botao "Nova Variavel" | I | Toast informativo | Nao | screenshot |

---

## 7. /admin/categorias-json

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Categorias JSON" | R | Validar visibilidade | Nao | screenshot |
| BlacklistCard | R | Validar render | Nao | screenshot |
| BlacklistCard: Editar | I | Entrar modo edicao | Nao | screenshot |
| BlacklistCard: Salvar blacklist | D | Salvar codigos ignorados | Sim | trace |
| Botao "Nova Categoria" | I | Abrir editor dialog | Nao | screenshot |
| CategoriaCard (grid) | R | Validar cards | Nao | screenshot |
| CategoriaCard: Editar | I | Abrir editor dialog | Nao | screenshot |
| CategoriaCard: Desativar | D | Desativar categoria (com confirmacao) | Sim | trace + screenshot |
| Dialog Desativacao: Cancelar/Confirmar | I/D | Cancelar ou confirmar | Sim (confirmar) | trace |
| EditorDialog: fechar X | I | Fechar dialog pelo X | Nao | screenshot |
| EditorDialog: fechar Cancelar | I | Fechar dialog pelo botao Fechar | Nao | screenshot |
| EditorDialog: campos basicos | I | Preencher nome, titulo, descricao | Nao | screenshot |
| EditorDialog: radio source_type | I | Trocar entre code/special | Nao | screenshot |
| EditorDialog: adicionar codigo | I | Adicionar codigo de documento | Nao | screenshot |
| EditorDialog: tab JSON Manual | I | Editar JSON, validar, formatar | Nao | screenshot |
| EditorDialog: tab Gerar com IA | I | Trocar para tab IA | Nao | screenshot |
| EditorDialog: checkbox residual/ativo | I | Toggle | Nao | screenshot |
| EditorDialog: Salvar | D | Criar/atualizar categoria | Sim | trace + screenshot |
| IA Tab: perguntas, gerar JSON, sincronizar | D | Multiplas acoes destrutivas | Sim | trace |

---

## 8. /admin/historico-gerador

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Historico - Gerador de Pecas" | R | Validar visibilidade | Nao | screenshot |
| DataTable de geracoes | R | Validar colunas | Nao | screenshot |
| Click em linha (detalhe) | I | Abrir dialog detalhe | Nao | screenshot |
| Tabs no detalhe (Prompt, Resumo, Minuta, Chat, Versoes, Raw) | I | Navegar tabs | Nao | screenshot |
| Botao Download DOCX | I | Download arquivo | Nao | screenshot |

---

## 9. /admin/historico-pedido-calculo

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Historico - Pedido de Calculo" | R | Validar visibilidade | Nao | screenshot |
| DataTable de geracoes | R | Validar colunas | Nao | screenshot |
| Click em linha (detalhe) | I | Abrir dialog detalhe | Nao | screenshot |
| Tabs no detalhe (Pedido, Dados, Logs IA, Raw) | I | Navegar tabs | Nao | screenshot |
| Botao copiar conteudo | I | Copiar para clipboard | Nao | screenshot |

---

## 10. /admin/historico-prestacao-contas

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Historico - Prestacao de Contas" | R | Validar visibilidade | Nao | screenshot |
| DataTable de geracoes | R | Validar colunas | Nao | screenshot |
| Click em linha (detalhe) | I | Abrir dialog detalhe | Nao | screenshot |
| Tabs no detalhe (Parecer, Dados, Logs IA, Raw) | I | Navegar tabs | Nao | screenshot |
| Botao "Reprocessar" | D | Reprocessar geracao | Sim | trace + screenshot |
| Botao "Anexar Documentos" | I | Abrir upload dialog | Nao | screenshot |

---

## 11. /admin/modulos-tipo-peca

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Modulos por Tipo de Peca" | R | Validar visibilidade | Nao | screenshot |
| Cards de estatisticas (4) | R | Validar render | Nao | screenshot |
| Select grupo | I | Trocar grupo | Nao | screenshot |
| Cards expandiveis por tipo | I | Expandir/colapsar | Nao | screenshot |
| Checkboxes de modulos | I | Toggle individual | Nao | screenshot |
| Botao "Ativar Todos" | I | Marcar todos | Nao | screenshot |
| Botao "Desativar Todos" | I | Desmarcar todos | Nao | screenshot |
| Botao "Salvar Alteracoes" | D | Persistir configuracao | Sim | trace + screenshot |
| Botao "Salvar" (por tipo) | D | Persistir por tipo | Sim | trace |

---

## 12. /admin/config-pecas

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Configuracao de Pecas" | R | Validar visibilidade | Nao | screenshot |
| Tabs (Categorias, Tipos de Peca) | I | Trocar tab | Nao | screenshot |
| Cards de categorias | R | Validar render | Nao | screenshot |
| Cards de tipos | R | Validar render | Nao | screenshot |
| Botao "Editar" (categoria) | I | Abrir dialog edicao | Nao | screenshot |
| Botao "Excluir" (categoria) | D | Excluir categoria (com confirmacao) | Sim | trace + screenshot |
| Botao "Editar" (tipo) | I | Abrir dialog edicao | Nao | screenshot |
| Botao "Excluir" (tipo) | D | Excluir tipo (com confirmacao) | Sim | trace + screenshot |
| Botao "Carregar Dados Iniciais" | D | Carregar dados (com confirmacao) | Sim | trace + screenshot |
| Botao "Sincronizar Prompts" | D | Sincronizar com prompts | Sim | trace |

---

## 13. /admin/teste-ativacao

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Select tipo de peca | R | Validar render | Nao | screenshot |
| Textarea descricao | I | Digitar texto | Nao | screenshot |
| Checkboxes de categorias | I | Toggle | Nao | screenshot |
| Tabs (Variaveis Extracao, Processo, Resultados) | I | Navegar tabs | Nao | screenshot |
| Inputs de variaveis | I | Preencher valores | Nao | screenshot |
| Botao "Simular Ativacao" | D | Executar simulacao | Sim (estado) | trace + screenshot |
| Botao "Gerar Variaveis via IA" | I | Gerar valores | Nao | screenshot |
| Botao "Salvar Cenario" | D | Persistir cenario | Sim | trace |

---

## 14. /admin/teste-categorias

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Select categoria | R | Validar render | Nao | screenshot |
| Textarea processos | I | Digitar numeros | Nao | screenshot |
| Tabs (Resultados, Visualizacao, Progresso) | I | Navegar tabs | Nao | screenshot |
| Botao "Adicionar" | I | Validar processos | Nao | screenshot |
| Botao "Limpar" | I | Limpar campos | Nao | screenshot |
| Botao "Classificar Pendentes" | D | Classificar processos | Sim | trace + screenshot |
| Botao "Resetar Erros" | D | Resetar estados de erro | Sim | trace |
| Botao "Baixar Todos" | I | Exportar JSON | Nao | screenshot |

---

## 15. /admin/tjms-docs

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading contendo "TJMS" ou "Documentacao" | R | Validar visibilidade | Nao | screenshot |
| Conteudo estatico (alerts, code blocks) | R | Validar render | Nao | screenshot |
| Link "Ver Plano Completo" | I | Navegacao | Nao | screenshot |

---

## 16. /admin/restaurar-slugs

| Componente | Tipo | Acao | Destrutiva? | Evidencia |
|---|---|---|---|---|
| Heading "Restaurar Slugs" | R | Validar visibilidade | Nao | screenshot |
| Input categoria ID | I | Preencher ID | Nao | screenshot |
| Botao "Restaurar Slugs" | D | Restaurar slugs de variaveis | Sim | trace + screenshot |
| Area de resultado (pre) | R | Validar render apos execucao | Nao | screenshot |

---

## Resumo Quantitativo

| Metrica | Valor |
|---|---|
| Total de rotas | 16 |
| Total de componentes mapeados | 120+ |
| Testes de Render (R) | 40+ |
| Testes de Interacao (I) | 60+ |
| Testes Destrutivos (D) | 25+ |
| Dialogs mapeados | 18 |
| Botoes destrutivos identificados | 25 |
