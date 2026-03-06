# PROMPT: GERADOR DE ALEGACOES FINAIS (DETRAN)

## REGRA HIERARQUICA

Este prompt **SOBREPOE** `sistema.md` quanto a estrutura e logica da peca. Demais regras de `sistema.md` (repertorio, guardrail de jurisprudencia, estilo, formatacao, densidade) permanecem validas.

---

## PAPEL PROCESSUAL E PROIBICOES

Alegacoes finais **encerram a instrucao** — NAO sao contestacao. E **proibido**:
- Inaugurar defesa ou rebater a inicial do zero
- Criar preliminares ou merito tipico de contestacao
- Renarrar fatos da inicial
- Aplicar estrutura de contestacao/recursos

Se qualquer desses comportamentos ocorrer, o texto estara **INCORRETO**.

---

## OBJETIVO

Demonstrar que, **a luz da prova produzida**, a tese defensiva do Estado foi confirmada e que a parte autora **nao se desincumbiu do onus da prova** de desconstituir o ato administrativo do DETRAN/MS, impondo-se a improcedencia dos pedidos.

---

## FONTE TECNICA CENTRAL

Processo administrativo e documentos tecnicos dos autos (AITs, notificacoes, laudos, pareceres) sao **prova tecnica ja produzida**. Foco: verificar se a instrucao confirmou a regularidade do ato e demonstrar inexistencia de prova para desconstitui-lo. Sem prova contraria consistente, **registrar expressamente** a manutencao da presuncao de legitimidade.

**Vedacao:** extrair do processo administrativo teses novas. Processo administrativo serve para **reforcar** argumentos [VALIDADO], nao criar fundamentos autonomos.

---

## ARGUMENTOS [VALIDADO]

Usar modulos apenas se relacionados a prova produzida. Descartar ou reformular os que nao se conectam ao resultado da instrucao — contextualizar no ambito probatorio, nao reapresentar como tese inicial.

---

## ESTRUTURA DA PECA

### Enderecamento

**AO JUIZO DA [VARA] DA COMARCA DE [CIDADE] - MS**
(Adaptar ao caso concreto. Nunca usar o nome do Juiz.)

Processo n.: [numero CNJ]
Requerente: [nome completo] | Requerido(s): [Estado de MS e outros, se houver]

### Preambulo

O **ESTADO DE MATO GROSSO DO SUL**, pessoa juridica de direito publico interno, representado pela Procuradoria do Estado, vem apresentar **ALEGACOES FINAIS**, nos termos do art. 364 do CPC, pelos fatos e fundamentos a seguir expostos.

### Secoes (ESTRUTURA UNICA PERMITIDA)

```
## 1. SINTESE DA CONTROVERSIA APOS A INSTRUCAO
## 2. ANALISE DA PROVA PRODUZIDA
## 3. DO ONUS DA PROVA
## 4. DA TUTELA DE URGENCIA (somente se existente)
## 5. CONCLUSAO
```

### Encerramento

Termos em que pede deferimento.
Campo Grande/MS, [DATA POR EXTENSO].
[NOME DO PROCURADOR] — Procurador do Estado — OAB/MS n. [NUMERO]

---

## REGRAS POR SECAO

### 1. Sintese da Controversia
Delimitar o que restou controvertido e indicar pontos nao comprovados. **NAO** renarrar fatos da inicial.

### 2. Analise da Prova Produzida
Demonstrar que a instrucao: nao infirmou a regularidade do processo administrativo, nao afastou a presuncao de legitimidade, nao comprovou irregularidade. Elementos tipicos: regularidade das notificacoes, contraditorio no processo administrativo, equipamento/procedimento de fiscalizacao, compatibilidade do AIT com provas, ausencia de prova para desconstituir a presuncao.

### 3. Onus da Prova
Parte autora nao se desincumbiu do onus (art. 373, I, CPC), dada a presuncao de legitimidade dos atos administrativos.

### 4. Tutela de Urgencia (se existente)
Somente se houver tutela deferida ou pendente. Verificar requisitos do art. 300 do CPC a luz da instrucao.

### 5. Conclusao
Sustentar **improcedencia dos pedidos** e manutencao do ato administrativo.

---

## CHECK FINAL

- [ ] Estrutura de contestacao **ignorada**?
- [ ] Foco **exclusivamente** na prova produzida?
- [ ] Nao ha preliminares nem narrativa inicial?
- [ ] Argumentos [VALIDADO] contextualizados a instrucao?
- [ ] Analise foca na presuncao de legitimidade e onus de desconstituicao?
