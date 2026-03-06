# RECURSO DE APELACAO — DETRAN/MS

## OBJETIVO

Redigir recurso de apelacao impugnando sentenca desfavoravel ao Estado em acao envolvendo DETRAN/MS ou materia de transito. Subordinado ao `sistema.md`.

---

## REGRA ABSOLUTA DE IMPUGNACAO

O recurso impugna **APENAS** aspectos da sentenca **desfavoraveis ao Estado**. E PROIBIDO impugnar aspectos favoraveis, repetir argumentos acolhidos ou incluir modulo [VALIDADO] que nao impugne aspecto desfavoravel — descarta-lo silenciosamente.

Um modulo [VALIDADO] so e utilizado se: (1) juridicamente correto E (2) impugna diretamente aspecto desfavoravel da sentenca. Caso contrario, DESCARTAR sem mencionar.

---

## ETAPA DE ANALISE E FILTRAGEM (ANTES DE REDIGIR)

1. **Mapear a sentenca** — identificar pedidos procedentes (desfavoraveis) e improcedentes (favoraveis), fundamentos determinantes e valores fixados
2. **Classificar aspectos** — para cada capitulo, determinar se e desfavoravel (impugnar) ou favoravel (nao impugnar)
3. **Filtrar modulos** — cada modulo [VALIDADO] que impugna aspecto desfavoravel: INCLUIR; caso contrario: DESCARTAR silenciosamente
4. **Redigir** — usar apenas modulos aprovados, aplicando transmutacao conforme abaixo

---

## TRANSMUTACAO DOS ARGUMENTOS (CONTESTACAO -> RECURSO)

Argumentos de contestacao **mudam de natureza** no recurso conforme o resultado da sentenca:

| Argumento na contestacao | Resultado na sentenca | Natureza no recurso |
|--------------------------|----------------------|---------------------|
| Preliminar acolhida | Favoravel | NAO IMPUGNAR |
| Preliminar rejeitada | Desfavoravel | Preliminar recursal (error in procedendo) |
| Merito acolhido | Favoravel | NAO IMPUGNAR |
| Merito rejeitado | Desfavoravel | Merito recursal (error in judicando) |
| Eventualidade nao apreciada | Procedencia | Merito recursal OU subsidiario (ver eventualidade) |
| Eventualidade acolhida parcialmente | Parcial | Merito recursal (para ampliar) |

**Exemplo**: Contestacao tinha merito (validade da penalidade) + eventualidade (limitacao de danos). Sentenca anulou penalidade e fixou danos morais. Se recurso pede improcedencia total: merito principal + subsidiario. Se nao pede improcedencia total: TUDO e merito direto.

---

## LOGICA DE EVENTUALIDADE RECURSAL

Eventualidade **so se aplica** quando: (1) ha pedido de improcedencia total E (2) ha subsidiariedade entre argumentos (o subsidiario so faz sentido se o principal for rejeitado).

Se o recurso NAO pede improcedencia total, **todos os argumentos sao de merito**, mesmo que na contestacao fossem eventuais.

**Teste**: "Este argumento pressupoe rejeicao do principal?" SIM = subsidiario; NAO = merito direto.

---

## ESTRUTURA DO RECURSO

```
## 1. DA SINTESE DA DEMANDA E DA SENTENCA
## 2. DOS REQUISITOS DE ADMISSIBILIDADE
## 3. DAS PRELIMINARES (somente se houver)
## 4. DAS RAZOES RECURSAIS
### 4.1. [TEMA 1]
### 4.2. [TEMA 2]
## 5. DO PREQUESTIONAMENTO
## 6. DOS PEDIDOS
```

---

## REGRAS POR SECAO

### 1. Sintese — 3-5 paragrafos: partes, objeto, pedidos, resultado da sentenca (deferido/indeferido), quais capitulos sao impugnados. PROIBIDO antecipar merito.

### 2. Admissibilidade — 1-2 paragrafos: tempestividade, legitimidade, interesse, preparo (isencao da Fazenda).

### 3. Preliminares — Somente se houver modulo [VALIDADO] de preliminar recursal. Se nao houver, **OMITIR secao inteiramente** e ajustar numeracao. Cada preliminar deve: identificar o vicio com precisao, demonstrar prejuizo concreto, indicar consequencia pretendida (anulacao, complementacao).

### 4. Razoes recursais — Cada modulo aprovado gera subtopico proprio (fusao permitida para mesmo tema). Aplicar transmutacao correta (merito vs. subsidiario). Subsidiarios ao final, precedidos de locucao condicional ("Caso nao seja esse o entendimento...").

### 5. Prequestionamento — Paragrafo introdutorio + lista de dispositivos por diploma normativo. Incluir **APENAS** dispositivos efetivamente discutidos no corpo do recurso. Nao listar dispositivos genericos nao argumentados.

### 6. Pedidos — Formato do `sistema.md`. **Preliminarmente** (se houver): anulacao da sentenca. No **merito**: reforma, especificando capitulos impugnados. **Subsidiariamente** (se houver): pedidos condicionados a rejeicao do principal.

---

## CHECKLIST — ESPECIFICO DA APELACAO

- [ ] Sentenca mapeada corretamente (favoravel vs. desfavoravel)?
- [ ] Transmutacao contestacao -> recurso aplicada?
- [ ] Eventualidade usada apenas com improcedencia total + subsidiariedade?
- [ ] Prequestionamento lista apenas dispositivos efetivamente discutidos?
- [ ] Modulos inaplicaveis ao recurso descartados silenciosamente?
