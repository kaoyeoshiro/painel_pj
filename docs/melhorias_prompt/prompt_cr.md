# PROMPT: GERADOR DE CONTRARRAZÕES (v3)

## REGRA HIERÁRQUICA

Este prompt **complementa** o prompt de sistema. Todas as regras do prompt de sistema permanecem válidas.

---

## OBJETIVO

Elaborar **CONTRARRAZÕES** ao recurso interposto, utilizando **exclusivamente** os fundamentos autorizados via módulos [VALIDADO].

---

## REGRA FUNDAMENTAL

Contrarrazões respondem ao **RECURSO**, não à inicial nem à sentença.

### Teste Obrigatório (aplicar a CADA argumento)

| Pergunta | Resposta | Ação |
|----------|----------|------|
| O recorrente atacou este ponto? | NÃO | **DESCARTAR** |
| O recorrente fez este pedido? | NÃO | **NÃO FORMULAR CONTRAPEDIDO** |

### Vedações Gerais

- Argumentar sobre pontos **não recorridos**
- Usar módulos [VALIDADO] sem correspondência no recurso
- Pleitear majoração de honorários em favor do Estado

---

## PRELIMINARES EM RECURSOS EXCEPCIONAIS (REsp/RE)

### Verificação Automática Obrigatória

Quando as contrarrazões responderem a **Recurso Especial** ou **Recurso Extraordinário**, verificar **DE OFÍCIO** a aplicabilidade das preliminares abaixo, **independentemente de existir módulo [VALIDADO]**.

### Preliminares de Recurso Especial (STJ)

| Preliminar | Fundamento | Quando Alegar |
|------------|------------|---------------|
| **Súmula 7/STJ** | "A pretensão de simples reexame de prova não enseja recurso especial" | Recorrente pede reanálise de fatos ou provas (ex: "a prova demonstra que...", "o laudo comprova que...", "restou evidenciado...") |
| **Súmula 211/STJ** | "Inadmissível recurso especial quanto à questão que, a despeito da oposição de embargos declaratórios, não foi apreciada pelo Tribunal a quo" | Matéria não foi prequestionada, mesmo após ED |
| **Súmula 282/STF** | "É inadmissível o recurso extraordinário, quando não ventilada, na decisão recorrida, a questão federal suscitada" | Ausência total de prequestionamento (questão sequer foi suscitada) |
| **Súmula 283/STF** | "É inadmissível o recurso extraordinário, quando a decisão recorrida assenta em mais de um fundamento suficiente e o recurso não abrange todos eles" | Acórdão possui fundamento autônomo e suficiente que não foi impugnado |
| **Deficiência de fundamentação** | Art. 1.029, CPC | Recorrente não indica qual dispositivo foi violado ou não demonstra como ocorreu a violação |
| **Ausência de cotejo analítico** | Art. 1.029, §1º, CPC | Em recurso fundado em divergência jurisprudencial: não demonstra similitude fática entre os casos |

### Preliminares de Recurso Extraordinário (STF)

| Preliminar | Fundamento | Quando Alegar |
|------------|------------|---------------|
| **Súmula 279/STF** | "Para simples reexame de prova não cabe recurso extraordinário" | Recorrente busca revisão de matéria fática (equivalente à Súmula 7 para o STF) |
| **Súmula 282/STF** | Ausência de prequestionamento | Questão constitucional não foi debatida na instância de origem |
| **Súmula 283/STF** | Fundamento autônomo não impugnado | Decisão possui base suficiente que não foi atacada pelo recurso |
| **Súmula 636/STF** | "Não cabe recurso extraordinário por contrariedade ao princípio constitucional da legalidade, quando a sua verificação pressuponha rever a interpretação dada a normas infraconstitucionais pela decisão recorrida" | Alegação de ofensa reflexa à Constituição (o recurso questiona interpretação de lei ordinária, não da CF diretamente) |
| **Ausência de repercussão geral** | Art. 1.035, CPC | Recorrente não demonstrou a transcendência da questão (econômica, política, social ou jurídica) |
| **Tema já julgado em RG** | Art. 1.030, I, CPC | A matéria já foi decidida pelo STF em regime de repercussão geral — aplicar o paradigma |

### ⚠️ CONTRAINDICAÇÕES — Quando NÃO Alegar

| Preliminar | **NÃO** alegar quando: |
|------------|------------------------|
| **Súmula 7/279** | O cerne do recurso é **interpretação jurídica**, mesmo que mencione fatos acessoriamente. Se o recorrente discute *distinguishing*, aplicação de precedente ou interpretação de norma, não é reexame de prova. |
| **Súmula 636** | O recurso discute **aplicação ou interpretação de Tema de Repercussão Geral do próprio STF**. O STF é o intérprete de seus próprios precedentes — isso é matéria constitucional direta. |
| **Súmula 636** | A alegação de violação constitucional é **direta e autônoma** (arts. 5º, 37, 196, 199, etc.), sem necessidade de reinterpretar lei infraconstitucional. |
| **Súmula 282/211** | A matéria foi **efetivamente debatida** no acórdão, mesmo que de forma implícita ou com fundamentação sucinta. |
| **Súmula 283** | O recurso **impugna todos os fundamentos** do acórdão, ainda que de forma sucinta ou com argumentos fracos. |
| **Deficiência** | O recorrente indica dispositivos e apresenta argumentação minimamente estruturada, mesmo que discordemos dela. |

### Teste de Segurança (aplicar ANTES de incluir qualquer preliminar)

```
PARA CADA preliminar cogitada, responder:

1. A preliminar é OBJETIVAMENTE demonstrável no caso concreto?
   NÃO → ❌ NÃO INCLUIR

2. A preliminar NÃO vai parecer que o Estado está fugindo do mérito?
   PARECE FUGA → ❌ NÃO INCLUIR

3. Se o tribunal rejeitar a preliminar, isso NÃO enfraquece a posição do Estado?
   ENFRAQUECE → ❌ NÃO INCLUIR

4. A preliminar NÃO impede o tribunal de analisar questão que ele próprio criou (Tema de RG)?
   IMPEDE → ❌ NÃO INCLUIR

Passou nos 4 testes → ✅ Pode incluir
```

### Modelos de Redação

**Súmula 7/STJ (quando cabível):**
> Em sede preliminar, requer-se o não conhecimento do recurso especial. O recorrente, a pretexto de violação ao art. [X], busca na verdade o reexame do conjunto fático-probatório dos autos, o que é vedado em sede de recurso especial, conforme Súmula 7/STJ. A insurgência quanto a [descrever o ponto] demandaria revisão de [provas/fatos específicos], e não mera reinterpretação de norma federal.

**Ausência de prequestionamento:**
> Preliminarmente, o recurso especial não merece conhecimento por ausência de prequestionamento. A questão relativa ao art. [X] não foi objeto de debate no acórdão recorrido, nem mesmo após a oposição de embargos de declaração, incidindo a Súmula 211/STJ.

**Súmula 283/STF (fundamento autônomo):**
> O recurso não merece conhecimento. O acórdão recorrido está assentado em duplo fundamento: [fundamento 1] e [fundamento 2]. O recorrente impugnou apenas [um deles], deixando incólume fundamento suficiente para manter a decisão, o que atrai a incidência da Súmula 283/STF.

**Ofensa reflexa — Súmula 636/STF (quando cabível):**
> A alegada violação ao art. [dispositivo constitucional] configura, em verdade, ofensa reflexa à Constituição. O acolhimento da tese recursal demandaria prévia revisão da interpretação conferida à legislação infraconstitucional, o que não se admite em recurso extraordinário (Súmula 636/STF).

---

## RECURSO DE MUNICÍPIO (LITISCONSÓRCIO PASSIVO)

Quando o **Município** interpõe o recurso, o Estado figura como **litisconsorte passivo**. Isso significa que argumentos que reduzem ou afastam a condenação **beneficiam também o Estado**.

### Classificação Obrigatória de TODAS as Teses

**ATENÇÃO:** Classificar **cada tese** do recurso do Município, incluindo preliminares, antes de decidir o que impugnar.

| Classificação | Descrição | Tratamento |
|---------------|-----------|------------|
| **PREJUDICIAL** | Transfere responsabilidade ao Estado, exclui o Município, agrava a posição do Estado | ✅ **IMPUGNAR** |
| **FAVORÁVEL** | Extingue o processo, afasta ou reduz a condenação, beneficia ambos os réus | ❌ **NÃO IMPUGNAR** |
| **NEUTRO** | Não afeta o Estado de nenhuma forma | ❌ **NÃO IMPUGNAR** |

### Exemplos de Classificação

**Teses PREJUDICIAIS** (devem ser impugnadas):
- Ilegitimidade passiva do Município (quer sair e deixar só o Estado)
- Responsabilidade exclusiva do Estado
- Concentração da execução apenas no Estado
- Direcionamento de toda a obrigação ao Estado

**Teses FAVORÁVEIS** (NÃO impugnar — silêncio estratégico):
- Inépcia da inicial (se acolhida, extingue o processo para todos)
- Improcedência do pedido (afasta a condenação de ambos)
- Prescrição ou decadência
- Falta de prova do direito alegado
- Ausência de urgência para tutela antecipada
- Redução do valor da multa
- Redução dos honorários

### Estrutura das Contrarrazões em Litisconsórcio

1. **Síntese seletiva**: Mencionar apenas as teses que serão efetivamente impugnadas
2. **Mérito cirúrgico**: Rebater exclusivamente os pontos prejudiciais ao Estado
3. **Silêncio estratégico**: Não mencionar nem combater teses favoráveis
4. **Pedido específico**: Requerer desprovimento apenas quanto aos pontos impugnados

### Vedações Específicas em Litisconsórcio

- Usar expressões genéricas como "as razões recursais não merecem prosperar"
- Pedir desprovimento total quando apenas parte das teses prejudica o Estado
- Defender a manutenção integral da sentença quando há teses favoráveis
- Rebater tese de improcedência (isso prejudicaria o Estado!)

---

## FILTRO ANTI-CONTAMINAÇÃO POR MÓDULOS DE CONTESTAÇÃO

> **⚠️ PROBLEMA SISTÊMICO**: O sistema ativa módulos usando a mesma lógica da contestação. Por isso, módulos criados para responder ao **AUTOR** aparecem disponíveis mesmo quando a peça é contrarrazões ao recurso do **MUNICÍPIO**. Esses módulos são impertinentes e **JAMAIS** devem ser utilizados, salvo se o Município atacou expressamente aquele ponto no recurso.

### Conceito Fundamental: Contestação ≠ Contrarrazões de Município

| Peça | Responde a | Antagonista |
|------|------------|-------------|
| **Contestação** | Petição inicial do autor | AUTOR (pede a obrigação) |
| **Contrarrazões ao recurso do Município** | Recurso do Município | MUNICÍPIO (quer transferir/excluir responsabilidade) |

São peças que respondem a **questões completamente diferentes**. Módulos da contestação foram construídos para responder ao autor sobre se e como a obrigação deve existir — não para responder ao município sobre quem deve cumpri-la.

### Classificação de Módulos por Camada

Antes de incluir qualquer módulo, identifique qual camada da controvérsia ele endereça:

| Camada | Questão respondida | Exemplos de módulos |
|--------|--------------------|---------------------|
| **1 — Mérito do pedido** | A obrigação é devida? Existe direito? | Improcedência, requisitos médicos, não padronização |
| **2 — Responsabilidade/Legitimidade** | Quem deve cumprir? Qual ente? | Tema 793, competência municipal/estadual, solidariedade |
| **3 — Forma de Cumprimento** | Como cumprir? Com qual parâmetro? | Realização pela Rede Pública, Três Orçamentos, Tema 1.033, PMVG, Periodicidade |
| **4 — Sanções e Honorários** | Multa adequada? Honorários? | Astreintes, honorários advocatícios |

### Regra de Uso por Camada no Recurso Típico de Município

Quando o Município recorre questionando **apenas responsabilidade/legitimidade (Camada 2)**:

| Camada | Decisão |
|--------|---------|
| **Camada 2** (responsabilidade) | ✅ **USAR** — é exatamente o que foi atacado |
| **Camada 1** (mérito do pedido) | ❌ **DESCARTAR** — o Município não questionou se a obrigação existe |
| **Camada 3** (forma de cumprimento) | ❌ **DESCARTAR** — o Município não questionou como cumprir |
| **Camada 4** (sanções/honorários) | ❌ **DESCARTAR** ou **silêncio estratégico** se favorável ao Estado |

> **Atenção**: A única exceção ocorre quando o Município, no seu recurso, **expressamente** ataca um ponto de Camada 3 (ex: "o procedimento deveria ser realizado pela rede pública, não às expensas do erário"). Nesse caso específico, o módulo correspondente é pertinente. A exceção precisa estar **explícita no texto do recurso**.

### Módulos de Camada 3 — Proibidos por Padrão em Contrarrazões de Município

Estes módulos foram construídos para responder ao **AUTOR** na contestação. Quando o Município apela sobre **legitimidade/responsabilidade**, são **impertinentes**:

- **Realização pela Rede Pública** (cirurgia, internação, procedimento pelo SUS) — o Município não questionou a forma de realização
- **Três Orçamentos** (exigência de orçamentos para aquisição privada) — o Município não questionou o modo de aquisição
- **Tema 1.033/STF** (tabela SUS para reembolso de privado) — o Município não questionou os parâmetros de reembolso
- **PMVG/CMED** (preço máximo de medicamentos) — o Município não questionou parâmetros de aquisição
- **Periodicidade** (frequência de renovação) — o Município não questionou a periodicidade

### Mapeamento Obrigatório: Módulo → Tese Recursal

Para **cada** módulo [VALIDADO] disponível, execute mentalmente antes de incluir:

```
MÓDULO: [nome do módulo]
CAMADA: [1, 2, 3 ou 4]
QUAL ARGUMENTO DO RECURSO ELE RESPONDE? [transcrever o trecho do recurso]
O MUNICÍPIO ATACOU ESPECIFICAMENTE ESTE PONTO? [SIM / NÃO]
    NÃO → ❌ DESCARTAR (mesmo que seja [VALIDADO])
    SIM → ✅ PODE USAR
```

Se não conseguir identificar **qual trecho do recurso** o módulo responde, ele deve ser descartado.

### ❌ Anti-Padrão Real — O Que Nunca Fazer

> **Recurso do Município** (apelação típica de saúde): ataca apenas a responsabilidade solidária e pede que a execução seja direcionada exclusivamente ao Estado.
>
> **Módulos [VALIDADO] disponíveis**: Tema 793 (direcionamento), Realização pela Rede Pública, Tema 1.033, Três Orçamentos
>
> **ERRO**: incluir todos os 4 módulos, gerando seções sobre "realização do procedimento pela rede pública", "reembolso pelo Tema 1.033" e "exigência de três orçamentos"
>
> **POR QUÊ É ERRO**: Os 3 últimos módulos são da contestação ao autor. Eles respondem a "como a obrigação deve ser cumprida", não a "quem deve cumprir". O Município não questionou esses pontos. Incluí-los (a) extrapola o objeto do recurso, (b) confunde contrarrazões com contestação, e (c) apresenta argumentos que o Estado usa contra o autor, não contra o município.
>
> **CORRETO**: incluir **apenas** o módulo Tema 793, estruturando as contrarrazões em torno da responsabilidade solidária municipal e do direcionamento executivo.

---

## TEMA 793/STF (OBRIGATÓRIO EM AÇÕES DE SAÚDE)

O Tema 793 do STF estabelece um **binômio indissociável**:

| Componente | Significado |
|------------|-------------|
| **Solidariedade jurídica** | Qualquer ente pode ser demandado (legitimidade passiva) |
| **Direcionamento executivo** | O cumprimento deve ser exigido do ente com competência administrativa primária |

### Posicionamento do Direcionamento (MUTUAMENTE EXCLUSIVO)

**⚠️ REGRA CRÍTICA:** O pedido de direcionamento aparece **OU** no mérito **OU** na eventualidade. **NUNCA EM AMBOS.**

| Estratégia do Estado | Onde colocar o direcionamento |
|---------------------|-------------------------------|
| Estado **IMPUGNA** recurso do Município (quer manter condenação) | **APENAS NO MÉRITO** |
| Estado **CONCORDA** com a improcedência pretendida pelo Município | **APENAS NA EVENTUALIDADE** |

### Modelos de Aplicação

**Se o Estado IMPUGNA** (defende manutenção da condenação solidária):
> No mérito, ainda que reconhecida a responsabilidade solidária dos entes federativos em matéria de saúde (Tema 793/STF), o próprio precedente vinculante impõe que a execução seja direcionada ao ente com competência administrativa primária para o fornecimento. Tratando-se de medicamento/procedimento de [atenção básica/média complexidade], a execução deve ser direcionada ao Município.

**Se o Estado CONCORDA com improcedência** (não impugna o mérito do recurso):
> Em caráter eventual, caso seja mantida a procedência do pedido, requer-se que a execução seja direcionada ao Município, ente com competência administrativa para o fornecimento, nos termos do Tema 793/STF.

### Vedações sobre Tema 793

- Invocar o Tema 793 apenas para "manter a solidariedade" sem pedir direcionamento
- Colocar direcionamento na eventualidade quando o Estado **impugna** o mérito
- **Duplicar** o pedido de direcionamento (uma vez no mérito, outra na eventualidade)

---

## EVENTUALIDADE — REGRAS ABSOLUTAS

### Princípio Cardeal

> **A eventualidade é um ESPELHO SUBSIDIÁRIO do recurso.**
> Se o tema não está no recurso, ele **NÃO PODE** estar na eventualidade.

---

### ⚠️ EVENTUALIDADE EM REsp/RE — QUASE NUNCA CABÍVEL

**REGRA ESPECIAL:** Em contrarrazões de **Recurso Especial** ou **Recurso Extraordinário**, a eventualidade é **EXCEPCIONALÍSSIMA** e quase nunca deve existir.

#### Por quê?

1. **Devolutividade restrita**: O tribunal superior só pode analisar o que foi efetivamente devolvido pelo recorrente
2. **Vedação de ampliação**: Contrarrazões não podem ampliar o objeto do recurso
3. **Vedação de inovação**: Não se pode suscitar matérias não prequestionadas
4. **Cognição limitada**: Recursos excepcionais não admitem discussão de fatos ou condicionantes processuais novas

#### O que é VEDADO em eventualidade de REsp/RE

| Tipo de pedido | Por que é vedado |
|----------------|------------------|
| Direcionamento ao Município (Tema 793) | Legitimidade passiva não foi objeto do recurso |
| Três orçamentos | Forma de cumprimento não foi objeto do recurso |
| Observância do PMVG/CMED | Parâmetros de aquisição não foram objeto do recurso |
| Aplicação de outro Tema de RG | Amplia indevidamente o objeto do recurso |
| Qualquer condicionante não atacada | Extrapola a devolutividade |

#### Quando EXCEPCIONALMENTE cabe eventualidade em REsp/RE

**ÚNICA HIPÓTESE:** Quando o pedido eventual for **consequência lógica, direta e inevitável** do provimento do recurso, E estiver **dentro do exato perímetro da matéria devolvida**.

**Exemplo (raro):**
> Recurso discute exclusivamente o valor de indenização. Eventual: "Caso majorada a indenização, requer-se a observância do limite do pedido inicial para evitar julgamento *ultra petita*."

Isso é consequência direta do provimento, dentro do mesmo tema.

#### Teste Específico para REsp/RE

```
ANTES de incluir QUALQUER eventualidade em REsp/RE:

1. O pedido eventual decorre AUTOMATICAMENTE do provimento do recurso?
   NÃO → ❌ PROIBIDO

2. O pedido está DENTRO do exato perímetro da matéria devolvida?
   NÃO → ❌ PROIBIDO

3. O pedido NÃO exige cognição de fatos ou questões não prequestionadas?
   EXIGE → ❌ PROIBIDO

4. O pedido NÃO invoca Tema de RG diferente do discutido no recurso?
   INVOCA OUTRO → ❌ PROIBIDO

Passou nos 4 → ✅ Pode incluir (situação excepcional)
Falhou em qualquer um → ❌ NÃO INCLUIR
```

#### Regra Prática

> **Na dúvida, NÃO inclua eventualidade em REsp/RE.**
> É preferível uma peça sem eventualidade do que uma peça com pedidos que extrapolam a competência do tribunal.

---

### Eventualidade em Recursos Ordinários (Apelação/Agravo)

Para recursos ordinários, aplicar o teste eliminatório padrão:

#### Teste Eliminatório

```
PARA CADA possível argumento de eventualidade:

PERGUNTA 1: "O recorrente pediu a reforma DESTE ponto específico?"
├── NÃO → ❌ PROIBIDO incluir. PARAR AQUI.
└── SIM → Ir para Pergunta 2

PERGUNTA 2: "Existe módulo [VALIDADO] de eventualidade sobre este tema?"
├── NÃO → ❌ PROIBIDO incluir. PARAR AQUI.
└── SIM → Ir para Pergunta 3

PERGUNTA 3: "Faz sentido lógico aplicar isso SE o recurso for provido?"
├── NÃO → ❌ PROIBIDO incluir. PARAR AQUI.
└── SIM → ✅ PODE incluir na eventualidade.
```

### Regra de Coerência Temática

A eventualidade deve ter **conexão lógica** com o objeto do recurso:

| Se o recurso trata de: | Eventualidade PERMITIDA | Eventualidade PROIBIDA |
|------------------------|------------------------|------------------------|
| **Apenas honorários** | Parâmetros de honorários, compensação | Medicamento, três orçamentos, PMVG, direcionamento, multa, legitimidade |
| **Apenas exclusão do Município** | Legitimidade, direcionamento | Honorários, medicamento, valor da multa, periodicidade |
| **Mérito do fornecimento** | Três orçamentos, PMVG, direcionamento, periodicidade | Honorários (se não recorrido), legitimidade (se não recorrida) |
| **Apenas valor da multa** | Parâmetros da multa, periodicidade | Medicamento, legitimidade, honorários, fornecimento |
| **Apenas tutela de urgência** | Requisitos da tutela | Mérito definitivo, honorários, multa |

### Exemplos Práticos

**❌ EXEMPLO DE ERRO GRAVE (recurso ordinário):**

> **Recurso da DPE:** "Os honorários fixados em R$ 2.000,00 são insuficientes, devendo ser majorados."
> 
> **Eventualidade (ERRADA) do Estado:** "Caso mantida a procedência, requer-se a apresentação de três orçamentos e a observância do PMVG na aquisição do medicamento."
> 
> **POR QUE ESTÁ ERRADO:** A DPE recorreu apenas dos honorários. O fornecimento do medicamento não foi objeto de recurso — está coberto pela coisa julgada parcial.

**❌ EXEMPLO DE ERRO GRAVE (REsp/RE):**

> **RE do Autor:** Discute apenas a aplicação do Tema 1.033 para limitação de valores.
> 
> **Eventualidade (ERRADA) do Estado:** "Caso provido, requer direcionamento ao Município (Tema 793), três orçamentos e vedação de pacote."
> 
> **POR QUE ESTÁ ERRADO:** O RE não discute legitimidade passiva nem forma de orçamento. Esses pedidos extrapolam completamente a devolutividade do recurso. O STF não pode analisar isso.

**✅ EXEMPLO CORRETO:**

> **Recurso da DPE:** "Os honorários fixados em R$ 2.000,00 são insuficientes."
> 
> **Eventualidade do Estado:** [SEÇÃO VAZIA OU INEXISTENTE]
> 
> **POR QUE ESTÁ CORRETO:** Não há eventualidade cabível. A seção não existe.

### Seção Vazia ou Inexistente é CORRETA

É **preferível** e **correto** que a seção de eventualidade:
- Fique completamente vazia
- Simplesmente não exista na peça
- Contenha apenas um único item pertinente

...do que incluir argumentos sobre temas que **não foram objeto do recurso** ou que **extrapolam a competência do tribunal**.

---

## ANÁLISE PRÉVIA (não incluir na peça final)

Antes de redigir, executar mentalmente:

### Passo 1: Identificar o Recorrente
- **AUTOR** → impugnar normalmente todos os pontos
- **MUNICÍPIO** → aplicar regras de litisconsórcio (classificar teses)
- **RÉU PARTICULAR** → impugnar normalmente

### Passo 2: Identificar o Tipo de Recurso
- **Apelação/Agravo** → preliminares apenas se houver módulo [VALIDADO]; eventualidade com teste padrão
- **REsp/RE** → verificar preliminares de ofício COM teste de segurança; eventualidade QUASE NUNCA

### Passo 3: Mapear o Objeto do Recurso
- Quais capítulos da decisão foram efetivamente atacados?
- O que exatamente o recorrente quer reformar?
- Listar cada tese/pedido do recorrente

### Passo 4: Filtrar Módulos [VALIDADO]

**Se o recorrente for MUNICÍPIO**, aplicar o filtro por camada (ver seção "FILTRO ANTI-CONTAMINAÇÃO"):

1. Classificar cada módulo por camada (1, 2, 3 ou 4)
2. Identificar quais camadas o Município efetivamente atacou no recurso
3. Descartar todos os módulos cujas camadas não foram atacadas
4. Para os demais: confirmar o trecho do recurso que o módulo responde

**Se o recorrente for AUTOR ou outro ente**:
- Para cada módulo disponível: ele responde a algum ponto do recurso?
- SIM → utilizar
- NÃO → descartar (mesmo que seja [VALIDADO])

### Passo 5: Verificar Eventualidade
- **REsp/RE**: Presumir que NÃO haverá eventualidade. Só incluir se passar no teste específico.
- **Recursos ordinários**: Aplicar teste eliminatório padrão. Na dúvida, NÃO incluir.

---

## ESTRUTURA DA PEÇA

### Cabeçalho

```
À EGRÉGIA [CÂMARA CÍVEL DO TRIBUNAL DE JUSTIÇA / TURMA DO STJ / TURMA DO STF]

Processo nº: [número CNJ completo]
Recorrente: [nome completo]
Recorrido: Estado de Mato Grosso do Sul

```

### Preâmbulo

> O **ESTADO DE MATO GROSSO DO SUL**, pessoa jurídica de direito público interno, representado pela Procuradoria-Geral do Estado, vem, respeitosamente, apresentar **CONTRARRAZÕES** ao recurso interposto, pelos fatos e fundamentos a seguir expostos.

### Seções da Peça

```
## 1. DA SÍNTESE DO RECURSO

## 2. DAS PRELIMINARES [se aplicável — em REsp/RE, aplicar teste de segurança]

## 3. DO MÉRITO

## 4. DA EVENTUALIDADE [RARA em REsp/RE; em ordinários, só se passar no teste]

## 5. DOS PEDIDOS
```

### Encerramento

```
Termos em que pede deferimento.

Campo Grande/MS, [DATA POR EXTENSO].

[NOME DO PROCURADOR]
Procurador do Estado
OAB/MS nº [NÚMERO]
```

---

## REGRAS ESPECÍFICAS POR SEÇÃO

### 1. Síntese do Recurso

- Resumo objetivo e neutro das razões recursais
- Mencionar **apenas** os pontos que serão efetivamente impugnados
- Em litisconsórcio: omitir teses favoráveis ao Estado

### 2. Preliminares

**Em Apelação/Agravo:**
- Incluir apenas se houver módulo [VALIDADO] específico

**Em REsp/RE:**
- Verificar de ofício as preliminares típicas
- Aplicar o **teste de segurança** (4 perguntas) antes de incluir
- Verificar as **contraindicações** — não alegar Súmula 7/279 para questões jurídicas, não alegar Súmula 636 quando se discute Tema de RG
- Cada preliminar em subtópico próprio com fundamentação

### 3. Mérito

- **ESTRUTURA ESPELHADA**: cada subseção corresponde a um argumento **do recurso**
- Seguir preferencialmente a mesma ordem dos argumentos recursais
- Utilizar apenas módulos [VALIDADO] que defendam pontos efetivamente recorridos
- **PROIBIDO** criar subseções sobre temas que não foram objeto do recurso

**Teste para cada subseção do mérito:**
> "O recorrente atacou especificamente este ponto?"
> - SIM → pode incluir
> - NÃO → **PROIBIDO**

### 4. Eventualidade

**Em REsp/RE:**
- **PRESUNÇÃO**: Não haverá eventualidade
- Só incluir se passar no teste específico de 4 perguntas
- Quase sempre a seção será **inexistente**

**Em Apelação/Agravo:**
- Aplicar teste eliminatório padrão (3 perguntas)
- Verificar coerência temática
- Na dúvida, não incluir

### 5. Pedidos

**Recurso de Autor (parte contrária ao Estado):**
> Ante o exposto, requer-se o conhecimento e o desprovimento do recurso, mantendo-se integralmente a decisão recorrida.

**Recurso de Município (litisconsorte passivo):**
> Ante o exposto, requer-se o desprovimento do recurso **quanto à pretensão de [descrever especificamente as teses prejudiciais impugnadas]**, mantendo-se [especificar o que deve ser mantido].

**Em REsp/RE com preliminar:**
> Ante o exposto, requer-se, preliminarmente, o não conhecimento do recurso [especial/extraordinário] por [fundamento]. No mérito, caso superada a preliminar, requer-se o seu desprovimento.

**Em REsp/RE SEM eventualidade (regra):**
> Ante o exposto, requer-se o desprovimento do recurso [especial/extraordinário], mantendo-se o acórdão recorrido.

---

## CHECKLIST DE VALIDAÇÃO FINAL

### Verificações Gerais
- [ ] O recorrente foi corretamente identificado (Autor, Município, outro)?
- [ ] O tipo de recurso foi identificado (Apelação, Agravo, REsp, RE)?
- [ ] Cada subseção do mérito corresponde a um tema efetivamente recorrido?
- [ ] Não há argumentos sobre pontos que não foram objeto do recurso?

### Verificações de Litisconsórcio (se Município recorreu)
- [ ] Todas as teses foram classificadas (prejudicial/favorável/neutro)?
- [ ] Apenas teses prejudiciais foram impugnadas?
- [ ] O pedido é específico (não genérico)?
- [ ] Teses favoráveis foram omitidas (silêncio estratégico)?

### Verificações Anti-Contaminação por Módulos de Contestação (Recurso de Município)
- [ ] Todos os módulos [VALIDADO] foram classificados por camada (1, 2, 3 ou 4)?
- [ ] O Município atacou **especificamente** cada ponto correspondente aos módulos incluídos?
- [ ] Nenhum módulo de Camada 3 foi incluído sem que o Município tenha atacado aquele ponto?
- [ ] Em especial: "Realização pela Rede Pública" está ausente (salvo impugnação expressa do Município)?
- [ ] Em especial: "Três Orçamentos" está ausente (salvo impugnação expressa do Município)?
- [ ] Em especial: "Tema 1.033" está ausente (salvo impugnação expressa do Município)?
- [ ] Em especial: "PMVG/CMED" está ausente (salvo impugnação expressa do Município)?
- [ ] Para cada módulo incluído: foi possível identificar o trecho do recurso que ele responde?

### Verificações de REsp/RE — PRELIMINARES
- [ ] Cada preliminar passou no teste de segurança (4 perguntas)?
- [ ] Nenhuma preliminar incide em contraindicação?
- [ ] Súmula 7/279 só foi alegada para verdadeiro reexame de prova (não para questão jurídica)?
- [ ] Súmula 636 NÃO foi alegada quando o recurso discute Tema de RG do próprio STF?

### Verificações de REsp/RE — EVENTUALIDADE
- [ ] A eventualidade é realmente necessária? (presunção: NÃO)
- [ ] Se incluída, passou no teste específico de 4 perguntas?
- [ ] Não há pedido de direcionamento se o recurso não discute legitimidade?
- [ ] Não há pedido sobre três orçamentos, PMVG ou condicionantes não atacadas?
- [ ] Não há invocação de Tema de RG diferente do discutido no recurso?

### Verificações do Tema 793 (se ação de saúde em recurso ORDINÁRIO)
- [ ] O direcionamento foi incluído?
- [ ] O direcionamento está na posição correta (mérito OU eventualidade, nunca ambos)?
- [ ] A posição corresponde à estratégia (impugna = mérito; concorda = eventualidade)?

### Verificações de Eventualidade em Recursos ORDINÁRIOS
- [ ] Cada item passou no teste eliminatório de 3 perguntas?
- [ ] Todos os itens têm conexão lógica com o objeto do recurso?
- [ ] Não há eventualidade sobre temas não recorridos?
- [ ] O direcionamento não está duplicado (mérito + eventualidade)?

### Teste Final Absoluto

Para **CADA seção e subseção** da peça, perguntar:

> **"O recorrente atacou especificamente este ponto?"**

- Se a resposta for **NÃO** para qualquer seção → **REMOVER IMEDIATAMENTE**
- Se a resposta for **SIM** → manter

---

## RESUMO DAS REGRAS CRÍTICAS

1. **Contrarrazões respondem ao RECURSO**, não à inicial nem à sentença
2. **Em REsp/RE**, verificar preliminares DE OFÍCIO, mas aplicar teste de segurança e contraindicações
3. **Súmula 7/279** não se aplica quando o cerne é questão jurídica (interpretação, *distinguishing*)
4. **Súmula 636** não se aplica quando o recurso discute Tema de RG do próprio STF
5. **Em REsp/RE, eventualidade QUASE NUNCA existe** — presunção é de que não haverá
6. **Em litisconsórcio**, impugnar APENAS teses prejudiciais ao Estado
7. **Tema 793**: direcionamento no mérito OU na eventualidade, NUNCA EM AMBOS
8. **Eventualidade em ordinários**: só existe se o tema foi objeto do recurso
9. **Na dúvida**: NÃO INCLUIR preliminar forçada nem eventualidade descabida
10. **Seção vazia é preferível** a seção com conteúdo impertinente ou que extrapola competência
11. **Módulos de Camada 3 (Forma de Cumprimento) são da contestação ao AUTOR** — em contrarrazões ao recurso do Município que só ataca legitimidade/responsabilidade, esses módulos são impertinentes e devem ser descartados mesmo que marcados [VALIDADO]
12. **Mapeamento obrigatório**: para cada módulo, identifique qual trecho do recurso ele responde — se não há trecho correspondente, o módulo deve ser descartado