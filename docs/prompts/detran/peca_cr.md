# PROMPT: GERADOR DE CONTRARRAZOES (DETRAN)

Este prompt complementa `sistema.md`. Regras de la permanecem validas.

---

## OBJETIVO

Elaborar **CONTRARRAZOES** ao recurso interposto em acao envolvendo atos do DETRAN/MS.

---

## REGRA FUNDAMENTAL

Contrarrazoes respondem ao **RECURSO**, nao a inicial.

### Teste Obrigatorio (aplicar a CADA argumento)

| Pergunta | Se NAO | Acao |
|----------|--------|------|
| O recorrente atacou este ponto? | **DESCARTAR** argumento |
| O recorrente fez este pedido? | **NAO FORMULAR** contrapedido |

### Vedacoes

- Reapresentar argumentos sobre pontos **nao recorridos**
- Usar argumentos so porque estao marcados como [VALIDADO]
- Incluir eventualidade sobre pontos nao recorridos
- Pleitear majoracao de honorarios em favor do Estado

---

## RECURSO DE MUNICIPIO OU AGETRAN (LITISCONSORCIO PASSIVO)

Quando **Municipio ou AGETRAN** interpoe o recurso, o Estado/DETRAN e litisconsorte passivo. Argumentos que reduzem ou afastam condenacao **beneficiam o Estado**.

### Classificacao Obrigatoria de CADA Tese (inclusive preliminares)

| Classificacao | Tratamento | Exemplos |
|---------------|------------|----------|
| **PREJUDICIAL** (transfere responsabilidade ao Estado, exclui Municipio) | **IMPUGNAR** | Exclusao do Municipio com transferencia ao DETRAN; responsabilidade exclusiva do Estado |
| **FAVORAVEL** (extingue processo, afasta/reduz condenacao) | **NAO IMPUGNAR** | Inepcia da inicial, improcedencia, prescricao, reducao de honorarios |
| **NEUTRO** (nao afeta o Estado) | **NAO IMPUGNAR** | — |

Sintese seletiva (so teses impugnadas), merito cirurgico (so pontos prejudiciais), silencio estrategico sobre teses favoraveis, pedido especifico. Vedado: expressoes genericas, desprovimento total quando so parte e prejudicial, defender manutencao integral da sentenca quando ha teses favoraveis.

---

## ANALISE PREVIA (nao incluir na peca)

1. **Recorrente** — Autor (impugnar normalmente) ou Municipio/AGETRAN (regras de litisconsorcio)
2. **Objeto** — O que o recorrente quer reformar? Quais capitulos atacados?
3. **Filtrar** — Argumento responde ao recurso? SIM → usar. NAO → descartar.

---

## ESTRUTURA DA PECA

### Cabecalho

**A EGREGIA CAMARA CIVEL DO TRIBUNAL DE JUSTICA DO ESTADO DE MATO GROSSO DO SUL**

[Tipo do Recurso]: [Apelacao Civel / Agravo de Instrumento]
Recorrente: [nome] | Recorrido: Estado de Mato Grosso do Sul
Origem: [Vara] da Comarca de [Cidade] - MS | Processo n.: [numero CNJ]

### Preambulo

O **ESTADO DE MATO GROSSO DO SUL**, pessoa juridica de direito publico interno, representado pela Procuradoria do Estado, vem apresentar **CONTRARRAZOES** ao recurso interposto pela parte adversa, pelos fatos e fundamentos a seguir expostos.

### Secoes

```
## 1. DA SINTESE DO RECURSO
## 2. DAS PRELIMINARES DE INADMISSIBILIDADE (se modulo [VALIDADO])
## 3. DO MERITO
## 4. DA EVENTUALIDADE (se modulo [VALIDADO] relacionado ao recurso)
## 5. DOS PEDIDOS
```

### Encerramento

Termos em que pede deferimento.
Campo Grande/MS, [DATA POR EXTENSO].
[NOME DO PROCURADOR] — Procurador do Estado — OAB/MS n. [NUMERO]

---

## REGRAS POR SECAO

### 1. Sintese do Recurso
Resumo objetivo, mencionando **apenas** pontos que serao impugnados.

### 2. Preliminares (se houver modulo [VALIDADO])
Se nao houver, **OMITIR secao inteiramente** e ajustar numeracao. Cada preliminar em subtopico proprio.

### 3. Merito
**ESPELHO DO RECURSO**: cada subsecao corresponde a um argumento **do recurso**, na mesma ordem. Modulos complementares sobre o mesmo tema podem ser fundidos. **PROIBIDO** criar subsecoes sobre temas nao objeto do recurso.

### 4. Eventualidade
So existe se: (1) houver modulo [VALIDADO] de eventualidade **E** (2) o ponto foi objeto do recurso. Pode ficar vazia ou nao existir se o direcionamento ja constar no merito.

### 5. Pedidos

**Recurso de Autor:** desprovimento e manutencao da decisao recorrida.
**Recurso de Municipio/AGETRAN:** desprovimento quanto a [teses prejudiciais especificas], mantendo-se [o que deve ser mantido].

---

## VALIDACAO FINAL

- [ ] Cada subsecao corresponde a tema do recurso?
- [ ] Nao ha argumentos sobre pontos nao recorridos?
- [ ] Teses do Municipio/AGETRAN classificadas e so prejudiciais impugnadas?
- [ ] **"O recorrente atacou este ponto?"** → Se NAO, **REMOVER**.
