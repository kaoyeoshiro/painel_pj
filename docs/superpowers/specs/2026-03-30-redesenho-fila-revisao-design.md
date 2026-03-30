# Redesenho da Fila de Revisão — Spec

> Data: 2026-03-30
> Status: Aprovado

## Problema

A fila de revisão (`/revisao`) funciona como uma listagem simples de itens, mas precisa ser um **sistema gerencial completo** onde o administrador distribui trabalho entre assessores, acompanha andamento e age sobre pendências. Problemas atuais:

1. Aba "Todos" não tem utilidade clara — mistura tudo sem distinção
2. Aba "Pendentes" é redundante — pode ser um filtro de status
3. Itens concluídos poluem a visualização sem relevância operacional
4. Não é possível ver a carga de trabalho por assessor
5. Não há indicador de quanto tempo um item está com determinado assessor
6. O filtro de status não funciona (bug: só envia quando nenhuma aba está ativa)
7. Botão "Iniciar Revisão" é um passo desnecessário antes de agir

## Design Aprovado

### Abas

Substituir as 4 abas atuais (Todos, Meus, Pendentes, Concluídos) por 2:

| Aba | Conteúdo | Padrão |
|-----|----------|--------|
| **Minha Fila** | Itens do admin: pendentes + aprovados/rejeitados não concluídos. Concluídos **não aparecem**. | Sim (aba inicial) |
| **Assessores** | Itens encaminhados a assessores, agrupados por assessor em cards colapsáveis | Não |

Para assessores (role != admin), as abas continuam sendo "Para Revisar" e "Para Inserir" como hoje.

### Aba "Minha Fila"

Tabela idêntica à atual, com as colunas: Processo, Ação, Resultado, Urgência, Confiança IA, Status, Recebido em.

Diferenças:
- Coluna "Atribuído a" removida (tudo nessa aba está com o admin)
- Query: status NOT IN ('concluido', 'encaminhado'). Encaminhados vão para aba Assessores.
- Itens legados com `em_revisao` aparecem aqui normalmente (tratados como pendente na UI)
- Filtros visíveis: Status (pendente, aprovado, rejeitado), Urgência, Ação

### Aba "Assessores"

Cards agrupados por assessor, cada card contendo:
- **Header** (sempre visível): avatar com iniciais, nome do assessor, badge com contagem de itens, indicador do item mais antigo ("há 5 dias")
- **Body** (colapsável): mini-tabela com os itens do assessor (Processo, Ação, Urgência, Tempo com assessor)
- Cards ordenados por quantidade de itens (descendente)
- Assessores sem itens aparecem no final com badge "0 itens" (cinza)
- Cada linha da mini-tabela é clicável (navega para o item)

Tempo com assessor: calculado a partir de `revisado_em` (momento do encaminhamento).
Cor do tempo: vermelho se > 3 dias, amber se > 1 dia, verde se < 1 dia.

Filtros visíveis: apenas Urgência e Ação (sem filtro de status, pois tudo é `encaminhado`).

### Cards de Estatísticas

Substituir os 5 cards atuais por 4:

| Card | Valor | Cor |
|------|-------|-----|
| Pendentes | Itens com status `pendente` | Cinza |
| Com Assessores | Itens com status `encaminhado` | Amber |
| Aguardando Inserção | Itens com `obs_status = aguardando_insercao` | Warning (amarelo) |
| Concluídos (7 dias) | Itens com `concluido_em` nos últimos 7 dias | Indigo |

### Eliminação do Status `em_revisao`

O status `em_revisao` deixa de existir no fluxo operacional:
- Itens chegam como `pendente` e permanecem assim até uma ação concreta
- O botão "Iniciar Revisão" é removido da BarraStatus
- Ao abrir um item pendente, os botões Aprovar, Encaminhar e Rejeitar já estão visíveis
- O backend continua aceitando `em_revisao` para compatibilidade com itens existentes, mas novas transições não passam por ele

Novo fluxo de status:
```
pendente → aprovado → concluido
pendente → rejeitado → concluido
pendente → encaminhado → concluido
```

Desfazer: aprovado/rejeitado/encaminhado volta para `pendente` (não mais para `em_revisao`).

### Comportamento dos Botões na Página do Item

| Status | Botões visíveis (Admin) | Botões visíveis (Assessor designado) |
|--------|------------------------|--------------------------------------|
| `pendente` | Aprovar, Encaminhar, Rejeitar | — |
| `aprovado` | Desfazer, Encaminhar para Inserir, Baixar DOCX, Marcar como Inserido | — |
| `encaminhado` | Desfazer | Baixar DOCX, Marcar como Inserido |
| `rejeitado` | Desfazer | — |
| `concluido` | Badge "Concluído" (somente leitura) | Badge "Concluído" |

### Filtro de Status (bug fix)

O filtro de status no `useFilaRevisao` atualmente só envia o parâmetro quando `!tab`, o que nunca acontece. Correção: enviar o filtro de status **sempre**, junto com a aba ativa. O backend já aceita ambos os parâmetros simultaneamente (aba filtra o escopo, status filtra dentro do escopo).

## Alterações por Arquivo

### Frontend

| Arquivo | Alteração |
|---------|-----------|
| `RevisaoPage.tsx` | Passar lista de assessores para aba Assessores |
| `FiltrosRevisao.tsx` | Novas abas (Minha Fila / Assessores), esconder filtro de status na aba Assessores |
| `EstatisticasCards.tsx` | Novos 4 cards (Pendentes, Com Assessores, Aguardando Inserção, Concluídos 7d) |
| `TabelaItens.tsx` | Remover coluna "Atribuído a" na aba Minha Fila |
| `useFilaRevisao.ts` | Corrigir envio do filtro de status; nova aba `assessores`; novo filtro de tab `minha_fila` |
| `BarraStatus.tsx` | Remover botão "Iniciar Revisão"; mostrar Aprovar/Encaminhar/Rejeitar direto no status `pendente` |
| `constants.ts` | Remover `em_revisao` do STATUS_CONFIG (ou manter para compatibilidade visual) |
| `types.ts` | Manter `em_revisao` no tipo union para compatibilidade |
| Novo: `CardAssessor.tsx` | Componente de card colapsável por assessor |

### Backend

| Arquivo | Alteração |
|---------|-----------|
| `router.py` | Nova tab `minha_fila` (pendente + aprovado + rejeitado, sem concluido/encaminhado); tab `assessores` (encaminhado, agrupável); endpoint de estatísticas atualizado (concluidos_7d); aceitar filtro de status junto com tab; endpoints `aprovar`/`rejeitar`/`encaminhar` aceitarem `pendente` como status de origem (além de `em_revisao` para legados) |
| `schemas.py` | Novo campo `concluidos_7d` no schema de estatísticas |
| `services.py` | `aprovar`/`rejeitar`/`encaminhar`: aceitar status `pendente` além de `em_revisao`; `desfazer` volta para `pendente` em vez de `em_revisao`; `iniciar_revisao` vira no-op; estatísticas com contagem de 7 dias |

## Compatibilidade

- Itens existentes com status `em_revisao` continuam funcionando — são tratados como `pendente` na UI
- O backend aceita `em_revisao` como status válido mas não cria novos itens nesse status
- STATUS_CONFIG mantém a entrada `em_revisao` para renderizar itens legados corretamente
