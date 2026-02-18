# Relatorio de Analise — Gerador de Pecas (Producao)

**Data**: 2026-02-13
**Base de dados**: 544 geracoes | 146 com feedback (30.7%) | Periodo: 09 Jan - 13 Fev 2026
**Banco**: Railway (yamanote) — tabelas `geracoes_pecas`, `feedbacks_pecas`

---

## 1. Visao Geral

| Metrica | Valor |
|---------|-------|
| Total de geracoes | 544 |
| Modo fast_path (automatico) | 398 (73%) |
| Modo semi_automatico (curadoria) | 50 (9%) |
| Modo misto/llm/antigo | 96 (18%) |
| Taxa de feedback | 30.7% (ultimos 30 dias) |

### Distribuicao por tipo de peca

| Tipo | Quantidade |
|------|-----------|
| Contestacao | 392 |
| Contrarrazoes | 95 |
| Recurso de Apelacao | 39 |
| Alegacoes Finais | 7 |
| Agravo de Instrumento | 7 |
| Agravo | 1 |

### Distribuicao de notas (167 feedbacks)

| Nota | Total | % | Semi-auto | Fast-path |
|------|-------|---|-----------|-----------|
| 5 (excelente) | 80 | 48% | 23 | 46 |
| 4 (bom) | 42 | 25% | 3 | 28 |
| 3 (parcial) | 22 | 13% | 0 | 13 |
| 2 (ruim) | 13 | 8% | 0 | 8 |
| 1 (incorreto) | 10 | 6% | 0 | 8 |

**Insight importante**: Semi-automatico tem 0 notas abaixo de 4. O fast_path concentra 100% dos problemas graves.

---

## 2. O que os usuarios pedem para mudar (via chat) — TOP problemas

Foram identificados **~200 pedidos de alteracao via chat** em ~80 geracoes.

### 2.1. Perda do Objeto / Transferencia Hospitalar (problema #1 — ~25 ocorrencias)

**O que acontece**: O paciente ja foi transferido para outro hospital, mas o sistema NAO gera a preliminar de perda do objeto automaticamente.

**Exemplos reais**:
- *"meu anjo, a paciente ja foi transferida; Cade a perda do objeto?"* (#308)
- *"cade a preliminar? eu deixei a obs pra vc"* (#229, nota 1)
- *"Incluir preliminar de perda do objeto - paciente transferido para o Hospital Santa Casa em Campo Grande em 10/02/2026 as 08h08min"* (#511)
- *"meu amor, cade a perda do objeto? o paciente ja foi transferido."* (#440, nota 3)
- *"da perda do objeto meu querdo."* (#311)

**Raiz do problema**: O modulo `prel_transf_realizada` (Perda do Objeto - Transferencia Hospitalar) tem **0% de ativacao automatica** (0/30 nas semi-auto). A variavel `pareceres_paciente_transferido` quase nunca e preenchida pelo Agente 1 porque essa informacao geralmente esta em documentos internos do hospital (nao no parecer do NAT). O sistema depende que o usuario informe isso na observacao, mas mesmo quando informa, o fast_path nao captura.

**Ajuste sugerido**:
1. Criar regra que detecte no campo de observacoes do usuario palavras como "transferi", "transferencia", "transferido" e ative automaticamente o modulo
2. No Agente 1, buscar nos autos mencoes a transferencia hospitalar (guias, despachos, informacoes do hospital)
3. Considerar tornar esse modulo ativavel por LLM (fallback) quando o contexto menciona internacao hospitalar

---

### 2.2. Inepcia da Inicial / Pedido Generico (problema #2 — ~20 ocorrencias)

**O que acontece**: O modulo `prel_inepcia` (Inepcia da Peticao Inicial - Pedido Generico) so e ativado em 30% dos casos, mas os usuarios pedem em muitas mais situacoes.

**Exemplos**:
- *"acrescente a preliminar da inepcia da inicial"* (#549, nota 5)
- *"adicione a preliminar dos pedidos genericos"* (#536, nota 5)
- *"coloca como preliminar tbm o topico de pedido generico e indeterminado"* (#229)
- *"vamos la, tem pedido generico na preliminar"* (#424)
- *"cade o pedido generico, meu anjo?"* (#469)

**Raiz do problema**: O sistema so ativa a preliminar de inepcia quando detecta pedidos literalmente genericos na peticao. Mas "pedido generico" na pratica dos procuradores inclui expressoes como:
- "tudo mais o que se fizer necessario"
- "avaliacao e conduta"
- "custeio de todas as despesas medico-hospitalares"
- "servicos de saude de que necessita"

**Ajuste sugerido**:
1. Expandir a deteccao de pedidos genericos no Agente 1 para incluir essas expressoes vagas
2. Ativar o modulo como fallback LLM quando o petitorio contem termos vagos/abertos
3. Considerar ativar por padrao e deixar o usuario remover (melhor pecar por excesso nesse caso)

---

### 2.3. Topicos fora de lugar — Merito vs. Eventualidade (problema #3 — ~15 ocorrencias)

**O que acontece**: O sistema coloca topicos no **merito** quando deveriam estar na **eventualidade**, ou vice-versa.

**Exemplos**:
- *"Colocou todos os topicos no merito. Era interessante que a perda do objeto fosse preliminar e o restante eventualidade"* (#249, nota 2)
- *"o topico do direcionamento e Direito de ressarcimento ele colocou no MERITO, e o correto seria na EVENTUALIDADE"* (#35, nota 4)
- *"pode tirar todos topicos da eventualidade"* (#357)
- *"da eventualidade pode tirar tudo"* (#240, nota 2)
- *"o modelo da instituicao nao tem eventualidade nos casos de CR de APELO - MEDICAMENTO"* (#357)

**Raiz**: As regras de classificacao merito/eventualidade sao estaticas e nao consideram:
- **Tipo de peca**: Contrarrazoes geralmente NAO tem eventualidade
- **Modelo institucional**: Cada "modelo" da PS tem uma estrutura diferente
- **Contexto do caso**: Direcionamento 793 e eventualidade em contestacao, mas merito em recurso

**Ajuste sugerido**:
1. Criar regras por tipo de peca (contrarrazoes: sem eventualidade por padrao)
2. Mapear os "modelos institucionais" e criar templates de estrutura
3. Permitir que o usuario configure preferencia de estrutura na interface

---

### 2.4. Temas juridicos aplicados incorretamente (problema #4 — ~12 ocorrencias)

| Erro | Ocorrencias | Exemplo |
|------|-------------|---------|
| Usar Tema 793 quando deveria ser 1234 | 4x | *"o direcionamento decorre do tema 1234 e nao do tema 793"* (#545) |
| Usar Tema 106 quando procedimento tem no SUS | 3x | *"o sistema identificou que o procedimento e nao incorporado, mas o tratamento tem no SUS"* (#194, nota 4) |
| Colocar PMVG em canabidiol | 2x | *"em canabidiol nao usar PMVG, nao usar tema 6"* (#136, nota 3) |
| Usar Tema 1033 quando nao aplicavel | 2x | *"Tema 1033 so utilizamos para procedimentos disponiveis no SUS"* (#196, nota 3) |
| Colocar Tema 106 em caso de leito hospitalar | 1x | *"Colocou tema 106 no merito, tratando como nao incorporado. E caso de leito hospitalar"* (#207, nota 3) |

**Raiz**: O Agente 2 aplica temas por regras de variaveis do parecer, mas as regras de negocio sao complexas:
- Canabidiol tem regras especiais (com/sem autorizacao sanitaria da ANVISA)
- A distincao "incorporado vs nao incorporado" depende de analise clinica
- Leito hospitalar ≠ medicamento ≠ cirurgia (cada um tem temas diferentes)

**Ajuste sugerido**:
1. Criar "perfis de caso" (medicamento, cirurgia, leito, TEA, canabidiol) com templates de temas
2. Adicionar regras especificas para canabidiol: `pareceres_canabidiol_unico_med` -> sem PMVG, sem Tema 6
3. Melhorar a deteccao de "tipo de objeto" pelo Agente 1

---

### 2.5. Formatacao — Pedidos Finais, Grifos, Alineas (~15 ocorrencias)

**Pedidos recorrentes**:
- *"grife os pontos importantes"* — 10+ vezes, e a queixa mais constante
- *"coloca as alineas a) b) c)"* nos pedidos finais — 8+ vezes
- *"separar Preliminarmente / No merito / Subsidiariamente"* — 6+ vezes
- *"titulos em caixa alta"* — 3+ vezes
- *"pula uma linha p n fica td junto feio"* — 2+ vezes

**Ajuste sugerido**:
1. **Grifos**: Ativar por padrao o grifo (negrito) nos pontos relevantes. E pedido demais para ser opcional
2. **Alineas**: Sempre usar a) b) c) dentro de Preliminarmente/Subsidiariamente nos pedidos finais
3. **Estrutura dos pedidos**: Forcar o template: `Preliminarmente, pede-se: a)... No merito, requer-se... Subsidiariamente, pede-se: a)...`
4. **Espacamento**: Garantir quebra de linha entre secoes

---

### 2.6. Fatos — Informacoes faltantes (~10 ocorrencias)

**Pedidos recorrentes**:
- *"falar se o NAT foi favoravel ou desfavoravel"* — 7+ vezes
- *"colocar as folhas (fls.)"* — 5+ vezes
- *"informar sobre a tutela deferida/indeferida"* — 4+ vezes
- *"fatos muito longos, resumir mais"* — 3+ vezes

**Ajuste sugerido**:
1. Sempre incluir nos fatos: diagnostico + pedido + resultado do NAT (favoravel/desfavoravel) + tutela (deferida/indeferida)
2. Manter os fatos concisos (3-4 paragrafos no maximo)
3. Indicar `(fls. ___)` com espaco em branco para o procurador preencher

---

## 3. Curadoria Semi-Automatica — O que foi excluido e incluido

### 3.1. Modulos mais EXCLUIDOS pelos usuarios (16 geracoes com exclusoes)

| Modulo | Vezes excluido | Interpretacao |
|--------|---------------|---------------|
| Responsabilidade do Municipio - Procedimentos | 4x | Excesso: ativado quando nao ha municipio no caso |
| Realizacao da Cirurgia pela Rede Publica | 3x | Nao aplicavel quando nao e caso de cirurgia |
| Nao Ha Urgencia/Emergencia | 2x | Removido quando o NAT diz que ha urgencia |
| Direcionamento 793 | 2x | Nao aplicavel em todos os contextos |
| Responsabilidade Municipio - Insumos | 2x | Idem ao primeiro |
| Tema 1.033 | 2x | So para procedimentos disponiveis no SUS |
| Honorarios | 1x | Nao cabe em processos do Juizado |
| Dificuldade do Gestor | 1x | Nao cabe quando paciente esta em tratamento |
| Juizado Especial | 1x | Erro na deteccao de competencia |
| Medicamentos Incorporados - Tema 1234 | 1x | Classificacao errada do medicamento |
| Resp. Municipio - Gestao Plena | 1x | Nao aplicavel ao contexto |
| Orcamento Pacote | 1x | Nao ha orcamento nos autos |

### 3.2. Modulos mais ADICIONADOS manualmente (18 geracoes com adicoes)

| Modulo | Vezes adicionado | Interpretacao |
|--------|-----------------|---------------|
| Resp. Municipio - Procedimentos | 3x | Sistema nao ativa quando deveria |
| Perda do Objeto - Transferencia | 3x | 0% de ativacao automatica |
| Direcionamento 793 | 3x | Nao ativa em certos contextos |
| Inepcia - Pedido Generico | 2x | Deteccao fraca de pedidos genericos |
| Multa Cominatoria | 2x | Usuario quer mas sistema nao ativa |
| Honorarios | 2x | Nao ativa em Justica Comum (so Juizado) |
| Cirurgia sem Especialista SUS | 1x | Caso raro, sem regra |
| Orcamento Pacote | 1x | Falta deteccao |
| Dificuldade do Gestor | 1x | Variaveis faltantes |
| Gestao Plena | 1x | Contexto municipal |
| Litisconsorcio Municipio (793) | 1x | Caso especifico |
| Competencia Juizado Estadual | 1x | Deteccao falhou |
| Fornecimento Sem Marca | 1x | Regra nao ativou |
| Cirurgia Rede Publica | 1x | Contexto especifico |
| Tema 1.033 | 1x | Contexto especifico |

### 3.3. Modulos com 0% de ativacao automatica (problemas de configuracao)

Esses modulos **nunca** sao ativados automaticamente mas as vezes sao necessarios:

| Modulo | Variavel faltante | Motivo |
|--------|------------------|--------|
| `prel_transf_realizada` (Perda do Objeto) | `pareceres_paciente_transferido` | Informacao nao esta no NAT, vem do hospital |
| `prel_doc_essencial` (Falta de Documento) | Variavel de prescricao medica | Nao detectada pelo Agente 1 |
| `prel_ileg_educacional` (Ilegitimidade Educacional) | Variavel de pedido educacional | Nao detectada |
| `prel_ileg_dano_moral` (Ilegitimidade Dano Moral) | Variavel de dano moral | Nao detectada |

### 3.4. Taxas de ativacao de todos os modulos (ultimas 50 semi-auto)

| Modulo | Taxa | Modo |
|--------|------|------|
| Exigencia de Tres Orcamentos | 87% (26/30) | deterministic |
| Direcionamento 793 | 57% (17/30) | deterministic |
| Reembolso Agente Privado - Tema 1.033 | 57% (17/30) | deterministic |
| Orcamento Pacote | 53% (16/30) | deterministic |
| Cirurgia pela Rede Publica | 50% (15/30) | deterministic |
| Resp. Municipio - Procedimentos | 47% (14/30) | deterministic |
| Honorarios | 46% (13/28) | deterministic |
| Juizado Especial Estadual | 43% (12/28) | deterministic |
| Sem Urgencia/Emergencia | 40% (12/30) | deterministic |
| Inepcia - Pedido Generico | 30% (9/30) | deterministic |
| Dificuldade do Gestor | 30% (9/30) | deterministic |
| Sumulas 60 e 61 | 27% (8/30) | deterministic |
| Med. Nao Incorporados - Tema 1234 | 23% (7/30) | deterministic |
| Med. Nao Incorporados - Tema 6 | 23% (7/30) | deterministic |
| Resp. Municipio - Insumos | 23% (7/30) | deterministic |
| PMVG | 23% (7/30) | deterministic |
| Restituicao de Valores | 20% (6/30) | deterministic |
| Resp. Municipio - Gestao Plena | 20% (6/30) | deterministic |
| Fornecimento Sem Marca | 17% (5/30) | deterministic |
| Fila Eletivo | 10% (3/30) | deterministic |
| Cirurgia sem Especialista SUS | 10% (3/30) | deterministic |
| Tema 106 Geral | 10% (3/30) | deterministic |
| Litisconsorcio Municipio | 7% (2/30) | deterministic |
| Med. Incorporados - Tema 1234 | 7% (2/30) | deterministic |
| Multa Cominatoria | 7% (2/30) | deterministic |
| JF Canabidiol | 3% (1/30) | deterministic |
| JF Grupo 1A | 3% (1/30) | deterministic |
| Escolha de Profissional | 3% (1/30) | deterministic |
| Med. Patologia Diversa | 3% (1/30) | deterministic |
| Med. Off Label | 3% (1/30) | deterministic |
| Custo-Efetividade | 3% (1/30) | deterministic |
| Resp. Municipio - TEA | 3% (1/30) | deterministic |
| Itens Cosmeticos | 3% (1/29) | deterministic |
| Honorarios Distribuicao Litisconsortes | 3% (1/30) | deterministic |
| Perda do Objeto - Transferencia | 0% (0/30) | deterministic |
| Falta de Documento Essencial | 0% (0/30) | deterministic |
| Ilegitimidade Educacional | 0% (0/30) | deterministic |
| Ilegitimidade Dano Moral | 0% (0/30) | deterministic |
| JF Sem ANVISA | 0% (0/30) | deterministic |
| JF Nao Inc. >210 SM | 0% (0/30) | deterministic |
| JEF Federal | 0% (0/28) | deterministic |
| Med. Sem ANVISA - Tema 500 | 0% (0/30) | deterministic |
| Insulinas | 0% (0/30) | deterministic |
| Oncologico | 0% (0/30) | deterministic |
| Fraldas | 0% (0/30) | deterministic |
| Home Care | 0% (0/30) | deterministic |
| Enfermagem 24h | 0% (0/30) | deterministic |
| TEA - Metodo Especifico | 0% (0/30) | deterministic |
| Dano Moral | 0% (0/30) | deterministic |
| Nao Comparecimento Audiencia | 0% (0/28) | deterministic |
| Resp. Municipio - Dieta | 0% (0/30) | deterministic |
| Resp. Municipio - Fraldas | 0% (0/30) | deterministic |
| Resp. Municipio - Home Care | 0% (0/30) | deterministic |
| Resp. Pessoal Agente Publico | 0% (0/30) | deterministic |
| Honorarios Equidade 1.313 | 0% (0/30) | deterministic |
| Honorarios SV60 JF | 0% (0/30) | deterministic |
| TEA - Tema 106 | 0% (0/30) | deterministic |
| TEA - Profissionais | 0% (0/30) | deterministic |

---

## 4. Problemas criticos (notas 1 e 2)

### Nota 1 — 10 ocorrencias (6%)

| # | CNJ | Problema |
|---|-----|----------|
| #229 | 08015279420268120110 | Nao incluiu perda do objeto mesmo com observacao; merito errado para transferencia |
| #133 | 08021518720258120043 | Classificou rivaroxabana como incorporado quando era nao incorporado |
| #134 | 08021518720258120043 | Mesma geracao refeita, mesmo problema |
| #117 | 08001354920268120101 | Faltou Tema 1234 e Tema 6 |
| #118 | 08001354920268120101 | Mesma geracao refeita, mesmo problema |
| #98 | 08526585220238120001 | Erro em canabidiol (usou PMVG quando nao deveria); erro de fetch ao enviar instrucoes longas |
| #81 | 08689781220258120001 | Sem comentario (abandono) |
| #62 | 08000879620268120002 | Topicos trocados entre merito e eventualidade |
| #508 | 08002427220268120011 | Sem comentario (abandono) |
| #361 | 14137665720258120000 | Sem comentario (abandono) |

### Nota 2 — 13 ocorrencias (8%)

| # | CNJ | Problema |
|---|-----|----------|
| #249 | 08012723920268120110 | Tudo no merito, nada na eventualidade. Faltou topicos |
| #240 | 08060667320258120002 | Honorarios incorretos em contrarrazoes |
| #135 | 08073081920258120018 | Topicos faltantes |
| #106 | 08000443520268120011 | Estrutura completamente diferente do esperado |
| #105 | 08044560420258120800 | Merito errado, pedidos finais errados |
| #102 | 08334212520258120110 | Multiplos problemas: juizado, merito, eventualidade, honorarios |
| #101 | 00005988320258120028 | Pediu remessa a JF quando nao cabia (medicamento <210 SM) |
| #85 | 08706497020258120001 | Topicos de eventualidade desorganizados |
| #76 | 08707484020258120001 | Merito faltando muitos topicos |
| #60 | 08010177320258120027 | Falta de documento essencial nao detectada |
| #29 | 08000041420268120800 | Estrutura completamente diferente, muitas correcoes necessarias |
| #24 | 08014222720218120035 | Confundiu 793 com 1234, topicos desnecessarios |
| #477 | 00003232120258120001 | Sem comentario |

---

## 5. Sugestoes de ajustes priorizadas

### PRIORIDADE 1 — Alto impacto, correcao rapida

| # | Ajuste | Impacto estimado |
|---|--------|-----------------|
| 1 | **Perda do Objeto por Transferencia** — Buscar no campo de observacoes e nos autos mencao a transferencia. Criar fallback LLM para o modulo `prel_transf_realizada` | Elimina ~25 pedidos de chat recorrentes |
| 2 | **Inepcia/Pedido Generico** — Expandir deteccao para expressoes vagas como "tudo mais que se fizer necessario", "avaliacao e conduta", "servicos de saude de que necessita" | Elimina ~20 pedidos de chat |
| 3 | **Grifos (negrito)** — Ativar por padrao o grifo nos pontos relevantes dos topicos. Incluir instrucao no prompt do Agente 3 | Elimina 10+ pedidos de "grife os pontos" |
| 4 | **Pedidos Finais** — Forcar template com alineas: `Preliminarmente... a) b) / No merito... / Subsidiariamente... a) b) c)` | Elimina 8+ pedidos de formatacao |

### PRIORIDADE 2 — Alto impacto, requer logica

| # | Ajuste | Impacto estimado |
|---|--------|-----------------|
| 5 | **Merito vs. Eventualidade** — Criar regras por tipo de peca. Contrarrazoes geralmente sem eventualidade. Direcionamento 793 vai para eventualidade em contestacao | Corrige problema #3 |
| 6 | **Perfis de caso** — Separar logica por tipo de objeto (medicamento / cirurgia / leito / TEA / canabidiol). Cada perfil tem temas diferentes | Corrige problema #4 |
| 7 | **Fatos concisos** — Modelo fixo: diagnostico + pedido + NAT (favoravel/desfavoravel) + tutela (deferida/indeferida). Max 3-4 paragrafos | Melhora a secao de fatos |
| 8 | **Honorarios em Juizado** — Nunca incluir topico de honorarios quando o processo e no Juizado (ja ha variavel de competencia) | Evita exclusoes manuais |

### PRIORIDADE 3 — Refinamento

| # | Ajuste | Detalhes |
|---|--------|---------|
| 9 | **Canabidiol** | Regras especiais: com autorizacao sanitaria -> sem PMVG, sem Tema 6; sem autorizacao -> pode Tema 500 |
| 10 | **Tema 106 vs Tema 1234** | Tema 106 para procedimentos/tratamentos nao incorporados (exceto medicamentos). Tema 1234 para medicamentos. Nao misturar |
| 11 | **Tema 1033** | So para procedimentos disponiveis no SUS (nao aplicar em nao incorporados) |
| 12 | **Distribuicao do Onus da Prova** | Criar modulo dedicado (muito pedido mas nao existe no sistema) |
| 13 | **Prequestionamento** | Criar modulo para contrarrazoes e recursos (pedido em 5+ vezes) |
| 14 | **Requisitos de Admissibilidade** | Criar modulo para recursos de apelacao |

---

## 6. Metricas de sucesso da curadoria

A curadoria semi-automatica esta funcionando **muito bem**:
- **0 notas abaixo de 4** (vs 45 no fast_path)
- **Nota media ~4.9** (vs ~4.1 no fast_path)
- 65% das geracoes semi-auto nao precisaram de nenhuma alteracao manual
- Usuarios da curadoria dao notas consistentemente mais altas

O problema esta no **fast_path** (modo totalmente automatico), onde os modulos sao ativados sem revisao humana e ha mais erros.

---

## 7. Regras de negocio descobertas (a incorporar no sistema)

Essas regras foram extraidas dos pedidos dos usuarios e devem ser incorporadas nos prompts/regras:

### Transferencia hospitalar
- Preliminar: Perda do Objeto (sempre)
- Merito: Nao ha dano moral + Restituicao de valores (so se pedido)
- Eventualidade: Direcionamento 793 + Atendimento rede publica + 3 orcamentos + Orcamento pacote + Tema 1033 + Honorarios + Multa
- Fatos: NAT nunca emite parecer em transferencia -> "O NAT nao emitiu parecer tecnico."

### Canabidiol
- COM autorizacao sanitaria: NAO usar PMVG, NAO usar Tema 6, NAO usar Tema 500
- SEM autorizacao sanitaria e SEM registro ANVISA: NAO usar PMVG, NAO usar Tema 6, PODE usar Tema 500

### Procedimentos/cirurgias
- Disponivel no SUS: Dificuldade do Gestor + Fila Eletivo + Direcionamento 793 (eventualidade) + Tema 1033
- NAO disponivel no SUS: Tema 106/STJ (merito) + SEM direcionamento na eventualidade + SEM Tema 1033

### Contrarrazoes
- Geralmente SEM eventualidade (seguir modelo institucional)
- Sempre incluir Prequestionamento antes dos pedidos
- Pedidos: "Posto isto, o Estado requer o desprovimento do recurso. Em qualquer hipotese, requer seja emitido juizo de prequestionamento..."

### Recurso de Apelacao
- Incluir Requisitos de Admissibilidade antes dos fatos
- Incluir Prequestionamento antes dos pedidos
- Incluir Razoes para Reforma da Sentenca como titulo do merito

### Pedidos Finais (todos os tipos)
- Estrutura: Preliminarmente, pede-se: a)... / No merito, requer-se... / Subsidiariamente, pede-se: a)...
- Sempre usar alineas a) b) c) dentro de preliminar e subsidiariamente
- Reiniciar contagem das alineas em cada secao
- Manter frases curtas e diretas
- Sem "Ante o exposto" redundante

### Fatos (todos os tipos)
- Modelo: Diagnostico + Pedido + NAT (favoravel/desfavoravel) + Tutela (deferida/indeferida)
- Maximo 3-4 paragrafos
- Indicar `(fls. ___)` para folhas
- NAO inventar informacoes que nao estao nos autos

---

## 8. COMO RESOLVER — Plano tecnico detalhado

Esta secao descreve **exatamente** como resolver cada problema identificado, com os arquivos, linhas e mudancas necessarias.

### Arquitetura relevante (contexto)

O fluxo de geracao de pecas funciona em 3 agentes:

```
Agente 1 (Extracao)     -> Extrai variaveis dos documentos (NAT, peticao, etc.)
Agente 2 (Detector)     -> Avalia regras deterministicas para ativar modulos
Agente 3 (Geracao)      -> Monta o prompt final e gera a peca via IA
```

**Arquivos-chave**:
- `sistemas/gerador_pecas/orquestrador_agentes.py` — Orquestrador principal, monta prompts
- `sistemas/gerador_pecas/detector_modulos.py` — Avalia regras de ativacao de modulos
- `sistemas/gerador_pecas/services_rule_evaluator.py` — Motor de avaliacao de regras
- `sistemas/gerador_pecas/services_extraction.py` — Extracao de variaveis via IA
- `sistemas/gerador_pecas/router.py` — Endpoints, recebe `observacao_usuario`
- Configuracoes de regras ficam no **banco de dados** (admin `/admin/prompts-config`)

**Variavel de ativacao**: Cada modulo tem uma regra no banco tipo:
```json
{
  "type": "and",
  "conditions": [
    { "variable": "peticao_inicial_X", "operator": "equals", "value": true },
    { "variable": "pareceres_Y", "operator": "equals", "value": true }
  ]
}
```

O Agente 1 extrai as variaveis; o Agente 2 avalia as regras; se `true`, o modulo e ativado.

---

### 8.1. Perda do Objeto por Transferencia Hospitalar

**Situacao atual**: O modulo `prel_transf_realizada` requer DUAS variaveis:
1. `peticao_inicial_pedido_transferencia_hospitalar` = `true`
2. `pareceres_paciente_transferido` = `true`

A variavel `pareceres_paciente_transferido` **nunca** e preenchida porque a informacao de que o paciente ja foi transferido NAO esta no parecer do NAT — vem de documentos internos do hospital ou da observacao do usuario.

**Solucao proposta** (3 frentes):

#### Frente A — Detectar na observacao do usuario (rapida, alto impacto)

**Arquivo**: `sistemas/gerador_pecas/orquestrador_agentes.py`
**Funcao**: `consolidar_dados_extracao()` (linha ~175)

Adicionar pos-processamento que detecta palavras-chave na observacao do usuario e seta a variavel automaticamente:

```python
# Apos consolidar dados_extracao, checar observacao
def _detectar_variaveis_observacao(dados: dict, observacao: str) -> dict:
    """Detecta variaveis implicitas na observacao do usuario."""
    if not observacao:
        return dados

    obs_lower = observacao.lower()

    # Perda do objeto por transferencia
    termos_transferencia = [
        "transferi", "transferencia", "transferido", "transferida",
        "perda do objeto", "ja foi transferid"
    ]
    if any(t in obs_lower for t in termos_transferencia):
        dados["pareceres_paciente_transferido"] = True

    # Pedido generico / inepcia
    termos_generico = [
        "pedido generico", "pedido indeterminado", "inepcia",
        "inépcia", "genérico"
    ]
    if any(t in obs_lower for t in termos_generico):
        dados["peticao_inicial_generico"] = True

    return dados
```

**Onde chamar**: No `orquestrador_agentes.py`, apos a linha que consolida os dados e antes de chamar o detector de modulos. A observacao do usuario ja esta disponivel no fluxo via parametro `observacao_usuario`.

#### Frente B — Melhorar extracao do Agente 1 (media, complementar)

**Arquivo**: Admin panel `/admin/prompts-config` → Schema de extracao

Adicionar ao schema de extracao da categoria "Pareceres / Documentos Internos" uma pergunta mais abrangente:

```
Pergunta atual:  "O paciente foi transferido para outro hospital?"
Pergunta melhor: "Há alguma informação indicando que o paciente já foi transferido
                  para outra unidade hospitalar? Isso pode aparecer como guia de
                  transferência, despacho, informação hospitalar, ou menção nos autos.
                  Considere documentos como informações do hospital, ofícios, ou
                  documentos que mencionem transferência realizada."
```

#### Frente C — Fallback LLM para modulos com 0% de ativacao (media-longa)

**Arquivo**: `sistemas/gerador_pecas/detector_modulos.py`
**Funcao**: `_avaliar_todos_deterministicos()` (linha ~448)

Para modulos que dependem de variaveis raramente preenchidas, adicionar um fallback que consulta a IA quando a regra falha por `global_primaria_pendente` (variaveis faltantes):

```python
# Se a regra falhou porque variaveis estao faltando,
# e o modulo tem fallback_llm = True na config,
# perguntar a IA: "Com base nos documentos, o paciente foi transferido?"
if trace.get("regra_usada") == "global_primaria_pendente":
    if modulo.config.get("fallback_llm"):
        resultado_llm = await _avaliar_fallback_llm(modulo, resumo_consolidado)
        if resultado_llm:
            trace["ativar"] = True
            trace["modo_avaliacao"] = "llm_fallback"
```

**Configurar no banco**: Marcar `prel_transf_realizada` com `fallback_llm = true`.

---

### 8.2. Inepcia da Inicial / Pedido Generico

**Situacao atual**: O modulo `prel_inepcia` depende de `peticao_inicial_generico = true`. So e ativado em 30% dos casos.

**Problema**: O Agente 1 nao reconhece como "generico" expressoes que os procuradores consideram genericas:
- "tudo mais o que se fizer necessario"
- "avaliacao e conduta"
- "custeio de todas as despesas medico-hospitalares"
- "servicos de saude de que necessita"

**Solucao proposta** (2 frentes):

#### Frente A — Melhorar o schema de extracao (rapida)

**Arquivo**: Admin panel `/admin/prompts-config` → Schema de extracao da Peticao Inicial

Alterar a pergunta de extracao da variavel `peticao_inicial_generico`:

```
Pergunta atual:  "O pedido é genérico ou indeterminado?"
Pergunta melhor: "O pedido contém expressões genéricas, vagas ou indeterminadas?
                  Exemplos que configuram pedido genérico:
                  - 'tudo mais o que se fizer necessário'
                  - 'avaliação e conduta'
                  - 'custeio de todas as despesas médico-hospitalares'
                  - 'serviços de saúde de que necessita'
                  - 'demais providências necessárias'
                  - 'tratamentos futuros'
                  - pedidos sem especificação precisa do que se quer
                  Responda true se QUALQUER desses padrões estiver presente."
```

#### Frente B — Pos-processamento heuristico (complementar)

**Arquivo**: `sistemas/gerador_pecas/orquestrador_agentes.py`

Na funcao `_detectar_variaveis_observacao` (proposta na 8.1), adicionar tambem busca no texto da peticao inicial:

```python
# Dentro da funcao de consolidacao, apos extrair dados:
def _detectar_pedido_generico_heuristico(dados: dict) -> dict:
    """Detecta pedido generico por expressoes-chave nos pedidos da peticao."""
    pedidos = dados.get("peticao_inicial_pedidos", "")
    if isinstance(pedidos, str):
        pedidos_lower = pedidos.lower()
        expressoes_genericas = [
            "tudo mais o que se fizer necessario",
            "tudo mais que se fizer necessário",
            "avaliacao e conduta",
            "avaliação e conduta",
            "custeio de todas as despesas",
            "servicos de saude de que necessita",
            "serviços de saúde de que necessita",
            "demais providencias necessarias",
            "tratamentos futuros",
        ]
        if any(exp in pedidos_lower for exp in expressoes_genericas):
            dados["peticao_inicial_generico"] = True
    return dados
```

---

### 8.3. Grifos (negrito) por padrao

**Situacao atual**: O prompt do Agente 3 nao instrui a IA a grifar pontos relevantes. Usuarios pedem "grife os pontos importantes" em 10+ geracoes.

**Solucao proposta**:

**Arquivo**: Admin panel `/admin/prompts-config` → Modulo base (tipo = "base")

Adicionar ao prompt base do sistema a instrucao:

```
## FORMATAÇÃO OBRIGATÓRIA

- **Grifos**: Destaque em **negrito** os pontos jurídicos mais relevantes de cada
  tópico: nomes de temas do STF/STJ, súmulas vinculantes, enunciados do CNJ,
  conclusões jurídicas centrais e trechos de jurisprudência citados.
- Não exagere: grife apenas o que é verdadeiramente relevante (2-3 trechos por tópico).
- Citações de jurisprudência devem ter recuo (blockquote) para se diferenciar do texto.
```

**Alternativa programatica**: Se preferir nao depender do prompt, criar um pos-processamento no `orquestrador_agentes.py` que aplica negrito via regex nos padroes conhecidos:

```python
import re

def _aplicar_grifos(texto: str) -> str:
    """Aplica negrito em termos juridicos relevantes."""
    padroes = [
        r'(Tema \d+(?:\.\d+)?(?:/STF|/STJ)?)',
        r'(Sumula(?:s)? (?:Vinculante(?:s)? )?n[ºo]\.?\s*\d+(?:\s*e\s*\d+)?)',
        r'(Enunciado(?:s)? n[ºo]\.?\s*\d+(?:,?\s*\d+)*\s*(?:do CNJ|da Jornada)?)',
        r'(Art\.\s*\d+(?:,\s*(?:inciso|paragrafo|§|caput)\s*[\w,]+)?(?:\s*do\s*\w+)?)',
    ]
    for p in padroes:
        texto = re.sub(p, r'**\1**', texto)
    return texto
```

---

### 8.4. Pedidos Finais — Template com alineas

**Situacao atual**: O Agente 3 gera pedidos finais sem estrutura padronizada. Usuarios pedem alineas a) b) c) em 8+ geracoes.

**Solucao proposta**:

**Arquivo**: Admin panel `/admin/prompts-config` → Modulo base (tipo = "base") ou modulo especifico por tipo de peca

Adicionar ao prompt do sistema a instrucao obrigatoria:

```
## PEDIDOS FINAIS — FORMATO OBRIGATÓRIO

Os pedidos finais DEVEM seguir exatamente esta estrutura:

### Para CONTESTAÇÃO:
```
X. DOS PEDIDOS

Preliminarmente, pede-se:
a) [primeiro pedido preliminar];
b) [segundo pedido preliminar].

No mérito, requer-se a improcedência da ação.

Subsidiariamente, pede-se:
a) [primeiro pedido subsidiário];
b) [segundo pedido subsidiário];
c) [terceiro pedido subsidiário].
```

### Para CONTRARRAZÕES:
```
X. DOS PEDIDOS

Posto isto, o Estado requer o desprovimento do recurso.

Em qualquer hipótese, requer seja emitido juízo de prequestionamento expresso
e numérico dos dispositivos legais e constitucionais mencionados ao longo do processo.
```

### Para RECURSO DE APELAÇÃO:
```
X. DOS PEDIDOS

Ante o exposto, requer-se o provimento do recurso de apelação para reformar
a sentença, julgando [improcedente/procedente] o pedido.

Em qualquer hipótese, requer seja emitido juízo de prequestionamento expresso
e numérico dos dispositivos legais e constitucionais mencionados ao longo do processo.
```

REGRAS:
- Sempre usar alíneas a) b) c) dentro de "Preliminarmente" e "Subsidiariamente"
- Reiniciar a contagem das alíneas em cada seção
- Frases curtas e diretas nas alíneas
- Sem "Ante o exposto" redundante antes de cada seção
```

---

### 8.5. Merito vs. Eventualidade — Regras por tipo de peca

**Situacao atual**: Todos os tipos de peca usam a mesma logica para posicionar modulos entre merito e eventualidade. Isso causa erros porque:
- Contrarrazoes geralmente NAO tem eventualidade
- Direcionamento 793 e eventualidade em contestacao, mas merito em recurso
- O modelo institucional varia por tipo

**Solucao proposta**:

#### Frente A — Mapeamento por tipo de peca (no banco)

Adicionar um campo `posicao_por_tipo` na configuracao de cada modulo no banco:

```json
{
  "modulo": "evt_direcionamento_793",
  "posicao_padrao": "eventualidade",
  "posicao_por_tipo": {
    "contestacao": "eventualidade",
    "recurso_apelacao": "merito",
    "contrarrazoes": "merito",
    "agravo_instrumento": "merito"
  }
}
```

**Arquivo para alterar**: `sistemas/gerador_pecas/detector_modulos.py`

Na funcao que monta a lista de modulos ativados, consultar `posicao_por_tipo[tipo_peca]` ao inves de usar `posicao_padrao`.

#### Frente B — Regra global: contrarrazoes sem eventualidade

**Arquivo**: `sistemas/gerador_pecas/orquestrador_agentes.py`, funcao `_montar_prompt_conteudo()`

```python
if tipo_peca == "contrarrazoes":
    # Mover todos os modulos de eventualidade para merito
    modulos_reposicionados = []
    for m in modulos_ativados:
        if m.posicao == "eventualidade":
            m.posicao = "merito"
        modulos_reposicionados.append(m)
    modulos_ativados = modulos_reposicionados
```

#### Frente C — Modulos obrigatorios por tipo

Para contrarrazoes e recursos, adicionar modulos obrigatorios que hoje nao existem:

| Tipo | Modulo obrigatorio | Posicao |
|------|--------------------|---------|
| contrarrazoes | Prequestionamento | Antes dos pedidos |
| recurso_apelacao | Requisitos de Admissibilidade | Antes dos fatos |
| recurso_apelacao | Prequestionamento | Antes dos pedidos |

Criar estes modulos no banco via admin e marcar como `sempre_ativo_para_tipo = ["contrarrazoes"]`.

---

### 8.6. Perfis de caso (medicamento / cirurgia / leito / TEA / canabidiol)

**Situacao atual**: O sistema trata todos os casos da mesma forma, aplicando temas por regras de variavel individuais. Mas na pratica, o "tipo de objeto" determina QUAIS temas se aplicam.

**Solucao proposta**:

#### Criar variavel `perfil_caso` no Agente 1

**Arquivo**: Admin panel → Schema de extracao

Adicionar pergunta ao schema de extracao:

```
"Qual é o perfil do caso? Categorize com base no objeto principal da ação:
  - MEDICAMENTO_INCORPORADO: medicamento que está na RENAME/CEAF/CBAF
  - MEDICAMENTO_NAO_INCORPORADO: medicamento fora das listas do SUS
  - CANABIDIOL_COM_AUTORIZACAO: canabidiol com autorização sanitária ANVISA
  - CANABIDIOL_SEM_AUTORIZACAO: canabidiol sem registro e sem autorização
  - CIRURGIA_DISPONIVEL_SUS: cirurgia/procedimento ofertado no SUS
  - CIRURGIA_NAO_DISPONIVEL_SUS: cirurgia/procedimento não ofertado no SUS
  - LEITO_HOSPITALAR: transferência hospitalar / internação / vaga
  - TEA: transtorno do espectro autista (terapias, atendimento)
  - INSUMO_EQUIPAMENTO: fraldas, dietas, equipamentos médicos
  - HOME_CARE: atendimento domiciliar
  - OUTRO: não se encaixa nos anteriores"
```

#### Criar regras de exclusao por perfil

**Arquivo**: `sistemas/gerador_pecas/detector_modulos.py`

Apos avaliar as regras deterministicas, aplicar filtro por perfil:

```python
EXCLUSOES_POR_PERFIL = {
    "CANABIDIOL_COM_AUTORIZACAO": [
        "evt_pmvg",           # Sem PMVG
        "mer_med_nao_inc_tema6",  # Sem Tema 6
        "prel_jf_sem_anvisa", # Sem Tema 500
    ],
    "CANABIDIOL_SEM_AUTORIZACAO": [
        "evt_pmvg",           # Sem PMVG
        "mer_med_nao_inc_tema6",  # Sem Tema 6
        # MAS pode usar Tema 500
    ],
    "LEITO_HOSPITALAR": [
        "mer_sv_60_61",       # Sem sumulas de medicamento
        "mer_med_nao_inc_tema1234",
        "mer_med_nao_inc_tema6",
        "evt_pmvg",
        "tema_106_geral",
        # Merito: apenas dano moral + restituicao (se pedidos)
        # Eventualidade: 793 + rede publica + 3 orcamentos + pacote + 1033 + honorarios + multa
    ],
    "CIRURGIA_NAO_DISPONIVEL_SUS": [
        "evt_direcionamento_793",  # Sem direcionamento na eventualidade
        "evt_tema_1033",           # Sem tema 1033
        # USA: tema_106_geral no merito
    ],
}

def _filtrar_por_perfil(modulos_ativados, perfil_caso):
    exclusoes = EXCLUSOES_POR_PERFIL.get(perfil_caso, [])
    return [m for m in modulos_ativados if m.nome not in exclusoes]
```

---

### 8.7. Fatos concisos com modelo padrao

**Solucao proposta**:

**Arquivo**: Admin panel `/admin/prompts-config` → Modulo base ou modulo especifico de contestacao

Adicionar ao prompt:

```
## SEÇÃO DOS FATOS — FORMATO OBRIGATÓRIO

Os fatos devem ter NO MÁXIMO 3-4 parágrafos curtos, seguindo este modelo:

---
1. DOS FATOS

A parte autora alega o diagnóstico de [NOME DA PATOLOGIA] ([CID]).
Relata que [RESUMO DO PEDIDO], motivo pelo qual pede ao Judiciário
[O QUE PEDE — medicamento/cirurgia/transferência].

O NAT emitiu parecer técnico [favorável/desfavorável] ao pedido (fls. ___).

O pedido de tutela de urgência foi [deferido/indeferido] (fls. ___).
---

REGRAS:
- NÃO inventar informações que não estão nos autos
- NÃO detalhar o quadro clínico além do diagnóstico
- Quando o NAT não emitiu parecer (ex: transferência), escrever apenas:
  "O NAT não emitiu parecer técnico."
- Indicar (fls. ___) com espaço para o procurador preencher
- Medicamentos devem ser listados no texto corrido (não em itens separados),
  exceto quando são muitos pedidos (home care, múltiplos tratamentos)
```

---

### 8.8. Honorarios em Juizado

**Solucao proposta**:

**Arquivo**: Admin panel → Regra do modulo `evt_honorarios`

Adicionar condicao de exclusao na regra de ativacao:

```json
{
  "type": "and",
  "conditions": [
    {
      "variable": "peticao_inicial_juizado_justica_comum",
      "operator": "not_equals",
      "value": "Juizado"
    },
    // ... demais condicoes existentes
  ]
}
```

Assim, quando o processo e no Juizado, o modulo de honorarios NAO e ativado.

O mesmo vale para `evt_multa` e `orçamento_pacote` em certos contextos — revisar caso a caso.

---

### 8.9. Modulos novos a criar

| Modulo | Nome interno | Posicao | Tipo de peca | Conteudo |
|--------|-------------|---------|-------------|----------|
| Prequestionamento | `evt_prequestionamento` | Antes dos pedidos | contrarrazoes, recurso | "Qualquer que seja a solucao juridica..." |
| Requisitos de Admissibilidade | `prel_admissibilidade` | Antes dos fatos | recurso | Template padrao |
| Distribuicao do Onus da Prova | `req_onus_prova` | Apos eventualidade | contestacao | "O onus da prova deve ser estabelecido..." |
| Falta de Documento Essencial (melhorado) | `prel_doc_essencial` | Preliminar | contestacao | "Nao ha prescricao medica que indique..." |

Para cada modulo:
1. Criar no admin `/admin/prompts-config` com o conteudo textual
2. Configurar regra de ativacao no banco
3. Definir variaveis necessarias no schema de extracao
4. Testar com casos reais

---

### 8.10. Resumo de implementacao

| # | O que fazer | Onde | Complexidade | Impacto |
|---|-------------|------|-------------|---------|
| 1 | Detectar transferencia na observacao | `orquestrador_agentes.py` | Baixa | Alto |
| 2 | Melhorar schema de extracao (pedido generico) | Admin panel | Baixa | Alto |
| 3 | Adicionar grifos no prompt base | Admin panel | Baixa | Alto |
| 4 | Template de pedidos finais no prompt | Admin panel | Baixa | Alto |
| 5 | Template de fatos no prompt | Admin panel | Baixa | Medio |
| 6 | Excluir honorarios em Juizado | Admin panel (regra) | Baixa | Medio |
| 7 | Regras por tipo de peca (merito/eventualidade) | `detector_modulos.py` | Media | Alto |
| 8 | Perfis de caso (canabidiol, leito, etc.) | `detector_modulos.py` + admin | Media | Alto |
| 9 | Criar modulo Prequestionamento | Admin panel | Baixa | Medio |
| 10 | Criar modulo Onus da Prova | Admin panel | Baixa | Medio |
| 11 | Criar modulo Requisitos Admissibilidade | Admin panel | Baixa | Medio |
| 12 | Fallback LLM para modulos com 0% | `detector_modulos.py` | Alta | Medio |
| 13 | Heuristico de pedido generico no texto | `orquestrador_agentes.py` | Baixa | Medio |

**Ordem sugerida de implementacao**: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 9 → 10 → 11 → 8 → 13 → 12

Os itens 1-6 podem ser implementados em um dia (sao alteracoes de prompt/regra no admin ou poucas linhas de codigo). Os itens 7-13 requerem mais cuidado e testes.

---

*Relatorio gerado automaticamente via analise do banco de producao em 2026-02-13.*
