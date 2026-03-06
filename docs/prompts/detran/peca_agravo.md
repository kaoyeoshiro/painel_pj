# PROMPT: AGRAVO DE INSTRUMENTO (DETRAN)

> Complementa o `sistema.md`. Todas as regras do sistema permanecem validas.

## OBJETIVO

Elaborar **AGRAVO DE INSTRUMENTO** impugnando decisao interlocutoria desfavoravel ao Estado de MS em acao envolvendo atos do DETRAN/MS.

---

## REGRA DE IMPUGNACAO

Agravo impugna **APENAS** o que foi decidido **CONTRA** o Estado.

**Teste operacional** — antes de usar qualquer argumento [VALIDADO], pergunte:
- "A decisao decidiu CONTRA o Estado neste ponto?" → SIM: usar. NAO: **descartar**.

**Vedacoes**: agravar aspectos favoraveis, pedir afastamento de providencias nao aplicadas, reiterar teses ja acolhidas.

---

## ETAPA DE ANALISE (executar mentalmente — NAO incluir na peca)

1. **Mapear a decisao**: extrair cada comando (tutela, suspensao, multa, direcionamento, prazo, etc.) e classificar como FAVORAVEL / DESFAVORAVEL / OMISSO
2. **Filtrar modulos**: aplicar dupla filtragem — pertinencia ao caso E impugnacao de aspecto desfavoravel. Descartar o resto silenciosamente
3. **Avaliar tutela recursal**: so pedir efeito suspensivo/antecipacao se houver comando DESFAVORAVEL que gere dano concreto (periculum in mora + fumus boni iuris)

---

## TRANSMUTACAO E EVENTUALIDADE

### Transmutacao dos argumentos em sede recursal

| Situacao na Decisao | Tratamento no Agravo |
|---|---|
| Preliminar rejeitada | Razao de reforma (subsecao tematica) |
| Preliminar acolhida | **Nao agravar** |
| Tutela deferida contra o Estado | Demonstrar ausencia dos requisitos (art. 300 CPC) |
| Tutela indeferida ao autor | **Nao agravar** |
| Questao probatoria decidida contra o Estado | Razao de reforma |
| Argumento ignorado | Nulidade (preliminar) ou razao autonoma |
| Eventualidade atendida | **Nao agravar** |
| Eventualidade nao atendida | Ver regra abaixo |

### Regra unica de eventualidade no agravo

Eventualidade recursal **so existe** quando o agravo pede **CASSACAO** da tutela de urgencia. Nesse caso, pedidos **condicionados** a manutencao da tutela ("caso mantida a tutela: ...") sao subsidiarios — desde que tenham **relacao de subsidiariedade** com o pedido de cassacao.

**Fluxo decisorio:**

1. O Estado pede **cassacao** da tutela?
   - NAO → **Nao ha eventualidade.** Todos os pedidos sao merito autonomo (subsecoes tematicas).
   - SIM → Continuar para 2.
2. O pedido subsidiario tem **relacao de subsidiariedade** com a cassacao?
   - SIM → Eventualidade valida (ex.: cassacao + "se mantida: direcionamento ao orgao autuador")
   - NAO → Merito autonomo (ex.: substituicao de multa e independente da cassacao)

**Classificacao rapida:**

| Pedido | Classificacao |
|---|---|
| Cassacao da tutela | MERITO (pode gerar eventualidade) |
| Direcionamento ao orgao autuador | MERITO (aceita tutela, reforma quem cumpre) |
| Substituicao de multa cominatoria | MERITO (aceita tutela, reforma como cumpre) |
| Prazo maior para cumprimento | MERITO (aceita tutela, reforma prazo) |
| "Caso mantida a tutela: ..." vinculado a cassacao | EVENTUALIDADE |

**Exemplo (sem cassacao — mais comum em DETRAN):**
```
Razoes Recursais:
  6.1. DO DIRECIONAMENTO AO ORGAO AUTUADOR COMPETENTE
  6.2. DA SUBSTITUICAO DA MULTA COMINATORIA
  6.3. DO PRAZO PARA CUMPRIMENTO
(Sem secao de eventualidade — nenhum pedido e de cassacao)
```

**Exemplo (com cassacao + subsidiario):**
```
Razoes Recursais:
  6.1. DA CASSACAO DA TUTELA DE URGENCIA
Pedidos Subsidiarios:
  6.2. CASO MANTIDA A TUTELA: DIRECIONAMENTO AO ORGAO AUTUADOR
```

---

## ESTRUTURA DO RECURSO

### Enderecamento

**A EGREGIA [NUMERO] CAMARA CIVEL DO TRIBUNAL DE JUSTICA DO ESTADO DE MATO GROSSO DO SUL**

(Adaptar ao caso concreto. Nunca usar nome do Desembargador.)

Agravo de Instrumento
Agravante: Estado de Mato Grosso do Sul
Agravado(a): [nome completo]
Origem: [Vara] da Comarca de [Cidade] - MS
Processo n.: [numero CNJ]
Decisao agravada: [data e sintese]

### Preambulo

O **ESTADO DE MATO GROSSO DO SUL**, pessoa juridica de direito publico interno, representado pela Procuradoria do Estado, interpoe o presente **AGRAVO DE INSTRUMENTO**, com fundamento no art. 1.015 do CPC, contra a decisao proferida pelo MM. Juizo da [Vara] da Comarca de [Cidade], pelos fatos e fundamentos a seguir expostos.

### Secoes

```
## 1. DO CABIMENTO
## 2. DOS REQUISITOS DE ADMISSIBILIDADE
## 3. DA SINTESE DA DEMANDA E DA DECISAO AGRAVADA
## 4. DA TUTELA RECURSAL (somente se cabivel)
## 5. DAS PRELIMINARES (somente se houver nulidades a arguir)
## 6. DAS RAZOES RECURSAIS
### 6.1. [TEMA 1]
### 6.2. [TEMA 2]
### 6.3. DOS PEDIDOS SUBSIDIARIOS (somente se ha cassacao + subsidiariedade)
#### 6.3.1. CASO MANTIDA A TUTELA: [TEMA]
## 7. DOS PEDIDOS
```

**Nota:** A secao de pedidos subsidiarios so existe quando ha pedido de cassacao E eventualidade com relacao de subsidiariedade (ver regra acima). Na maioria dos casos, usar apenas subsecoes tematicas.

### Encerramento

Termos em que pede deferimento.
Campo Grande/MS, [DATA POR EXTENSO].
[NOME DO PROCURADOR] — Procurador do Estado — OAB/MS n. [NUMERO]

---

## REGRAS POR SECAO

**1. Cabimento** — Enquadrar no art. 1.015 CPC (ou Tema 988/STJ). Desenvolver apenas se cabimento for questionavel.

**2. Admissibilidade** — Tempestividade, preparo (isencao da Fazenda), legitimidade, interesse recursal, regularidade formal, formacao do instrumento.

**3. Sintese** — Resumo do processo e descricao objetiva da decisao. Mencionar **apenas aspectos desfavoraveis**.

**4. Tutela recursal** — Somente se comando desfavoravel gerar dano concreto. Demonstrar risco + probabilidade de provimento. Indicar especificamente o que suspender/antecipar.

**5. Preliminares** — Somente se houver modulo [VALIDADO] correspondente (nulidade, cerceamento, etc.). Se nao houver, omitir secao inteiramente e ajustar numeracao.

**6. Razoes recursais** — Impugnar cada fundamento desfavoravel: citar trecho da decisao, demonstrar o erro, apresentar fundamento correto usando modulos [VALIDADO]. Organizar por **temas**. Argumentos conexos ficam na **mesma subsecao** (ex.: ausencia de urgencia + ausencia de probabilidade; ilegitimidade + direcionamento).

**7. Pedidos** — Apenas sobre o que se busca reformar: recebimento, tutela recursal (se requerida), provimento para reformar/cassar/anular, resultado especifico. **Proibido** formular pedidos sobre aspectos favoraveis.

---

## CHECKLIST (especifico do agravo)

- [ ] Cada argumento impugna aspecto **DESFAVORAVEL** da decisao?
- [ ] Nao ha pedidos sobre aspectos favoraveis ou nao aplicados?
- [ ] Tutela recursal (se pedida) corresponde a dano de comando desfavoravel?
- [ ] A etapa de analise/filtragem **NAO** aparece na peca?
- [ ] Argumentos conexos estao juntos na mesma subsecao?
- [ ] Se NAO ha pedido de cassacao, a secao de eventualidade foi OMITIDA?
- [ ] Se ha eventualidade, ela tem relacao de subsidiariedade com o pedido de cassacao?
