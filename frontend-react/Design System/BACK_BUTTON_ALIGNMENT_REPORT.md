# Relatorio: Correcao do Alinhamento do Botao Voltar

**Data**: 2026-02-11
**Branch**: feat/tailadmin-dashboard

---

## Causa Raiz

O desalinhamento do botao voltar tinha **duas origens**:

### 1. Conteudo centralizado em largura menor que o BreadcrumbBar

Paginas como PrestacaoContas, Assistencia e RestaurarSlugs usavam um wrapper interno `<div className="max-w-4xl mx-auto">` dentro do `<ContentArea>`. Isso criava um bloco de 896px **centralizado** dentro do container de 1350px (`max-w-pge`).

O botao voltar, dentro do `BreadcrumbBar`, ficava alinhado ao container de 1350px (borda esquerda). Em telas largas, o conteudo ficava centralizado em 896px, gerando um gap visual de ate ~190px entre o botao voltar e o inicio do conteudo.

```
BreadcrumbBar (max-w-pge = 1350px, left-aligned)
[<- Voltar > Icone > Titulo]

ContentArea (max-w-pge = 1350px)
  [      <-- max-w-4xl mx-auto = 896px centralizado -->      ]
  [gap]  [======== conteudo da pagina ========]  [gap]
```

### 2. Breadcrumb inline duplicado em 2 paginas

GeradorPecasPage e PedidoCalculoPage tinham o HTML do breadcrumb bar duplicado inline ao inves de usar o componente `BreadcrumbBar`. Isso criava risco de inconsistencia visual e dificultava manutencao.

---

## Solucao Aplicada

### Correcao 1: Remover `mx-auto` dos wrappers internos

Removido `mx-auto` dos wrappers `max-w-4xl` em 3 paginas. O conteudo agora fica **left-aligned** dentro do `ContentArea`, alinhado com o botao voltar do `BreadcrumbBar`.

```
BreadcrumbBar (max-w-pge, left-aligned)
[<- Voltar > Icone > Titulo]

ContentArea (max-w-pge)
[======== conteudo (max-w-4xl, left-aligned) ========]
```

### Correcao 2: Migrar paginas para usar BreadcrumbBar

GeradorPecasPage e PedidoCalculoPage migraram para o componente `BreadcrumbBar`, passando as acoes condicionais (Nova Geracao, Historico) via prop `actions`.

### Correcao 3: Adicionar prop `className` ao BreadcrumbBar

Adicionada prop `className` no div externo do BreadcrumbBar para suportar paginas com layout flex que precisam de `flex-shrink-0` (caso do GeradorPecas).

---

## Arquivos Alterados

| Arquivo | Alteracao |
|---------|-----------|
| `src/components/layout/BreadcrumbBar.tsx` | Adicionada prop `className` e import de `cn` |
| `src/pages/prestacao-contas/PrestacaoContasPage.tsx` | Removido `mx-auto` do wrapper interno |
| `src/pages/assistencia/AssistenciaPage.tsx` | Removido `mx-auto` do wrapper interno |
| `src/pages/admin/restaurar-slugs/RestaurarSlugsPage.tsx` | Removido `mx-auto` do wrapper interno |
| `src/pages/gerador-pecas/GeradorPecasPage.tsx` | Migrado para `BreadcrumbBar`, removidos imports orfaos (`ArrowLeft`, `Link`) |
| `src/pages/pedido-calculo/PedidoCalculoPage.tsx` | Migrado para `BreadcrumbBar`, removidos imports orfaos (`ArrowLeft`, `ChevronRight`, `Link`, `Separator`, `AlertCircle`, `MessageSquare`) |

---

## Rotas Verificadas (26 paginas com BreadcrumbBar)

### Modulos principais
- `/gerador-pecas` (GeradorPecasPage)
- `/pedido-calculo` (PedidoCalculoPage)
- `/prestacao-contas` (PrestacaoContasPage)
- `/assistencia` (AssistenciaPage)
- `/relatorio-cumprimento` (RelatorioCumprimentoPage)
- `/cumprimento-beta` (CumprimentoBetaPage)
- `/classificador` (ClassificadorPage)
- `/extrator-autos` (ExtratorAutosPage)
- `/matriculas` (MatriculasPage)
- `/bert-training` (BertTrainingPage)

### Admin
- `/admin/users` (UsersPage)
- `/admin/feedbacks` (FeedbacksPage)
- `/admin/prompts` (PromptsPage)
- `/admin/prompts-modulos` (PromptsModulosPage)
- `/admin/variaveis` (VariaveisPage)
- `/admin/config-pecas` (ConfigPecasPage)
- `/admin/modulos-tipo-peca` (ModulosTipoPecaPage)
- `/admin/historico-gerador` (HistoricoGeradorPage)
- `/admin/historico-pedido-calculo` (HistoricoPedidoCalculoPage)
- `/admin/historico-prestacao-contas` (HistoricoPrestacaoContasPage)
- `/admin/performance` (PerformancePage)
- `/admin/teste-ativacao` (TesteAtivacaoPage)
- `/admin/teste-categorias` (TesteCategoriasPage)
- `/admin/categorias-json` (CategoriasJsonPage)
- `/admin/tjms-docs` (TjmsDocsPage)
- `/admin/restaurar-slugs` (RestaurarSlugsPage)

---

## Verificacoes Realizadas

| Verificacao | Resultado |
|-------------|-----------|
| `npx tsc --noEmit` | 0 erros |
| `npm run build` | Build ok (10s) |
| `npm run test:portal-smoke` | 8/8 passando |
| `ArrowLeft` em pages | 0 ocorrencias (migrado para BreadcrumbBar) |
| `max-w-4xl mx-auto` em pages | 0 ocorrencias (removido mx-auto) |
| BreadcrumbBar em pages | 26 paginas usando o componente padrao |

---

## Padrao Vigente

Toda pagina interna deve seguir a estrutura:

```tsx
<BreadcrumbBar
  title="Nome do Modulo"
  icon={<Icone style={{ width: 14, height: 14 }} />}
  actions={/* botoes opcionais */}
/>
<ContentArea>
  {/* conteudo da pagina, sem mx-auto em wrappers internos */}
</ContentArea>
```

O botao voltar e responsabilidade **exclusiva** do `BreadcrumbBar`. Nenhuma pagina deve renderizar seu proprio botao voltar.
