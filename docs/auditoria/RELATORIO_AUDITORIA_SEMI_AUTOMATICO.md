# Relatorio de Auditoria - Modo Semi-Automatico do Gerador de Pecas

**Periodo**: 2026-01-30 a 2026-02-06 (7 dias)
**Gerado em**: 2026-02-06 02:06:15 UTC
**Banco**: Producao (Yamanote)

## 1. Resumo Executivo

- **Total de geracoes semi-automaticas**: 20
  - Com metadados validos: 16
  - Sem metadados (curadoria_metadata NULL): 4
- **Total de modulos sugeridos (preview)**: 142
- **Modulos confirmados pelo usuario**: 120 (84.5%)
- **Modulos adicionados manualmente**: 20
- **Modulos excluidos pelo usuario**: 22
- **Geracoes com inclusao manual**: 8 de 16
- **Geracoes com exclusao**: 7 de 16
- **Taxa de concordancia com sistema**: 84.5%

### Indicadores de Alerta

- Taxa de inclusao manual: 14.1% (modulos que o sistema falhou em detectar)
- Taxa de exclusao: 15.5% (falsos positivos do sistema)

## 2. Metodologia

- **Fonte de dados**: Banco de producao PostgreSQL (Yamanote/Railway)
- **Periodo**: Ultimos 7 dias (desde 2026-01-30)
- **Filtro**: `modo_ativacao_agente2 = 'semi_automatico'`
- **Re-avaliacao**: Regras deterministicas re-avaliadas com variaveis armazenadas em `dados_processo`
- **Logs de ativacao**: Cruzados via `prompt_activation_logs` para obter decisoes historicas
- **Caveat**: Regras atuais podem diferir das regras vigentes no momento da geracao

## 3. Mapeamento de Tabelas e Campos

| Tabela | Campos Utilizados | Finalidade |
|--------|-------------------|------------|
| `geracoes_pecas` | `curadoria_metadata`, `dados_processo`, `modo_ativacao_agente2`, `criado_em` | Geracoes e variaveis |
| `prompt_activation_logs` | `prompt_id`, `resultado`, `variaveis_usadas`, `justificativa_ia` | Decisoes historicas |
| `prompt_modulos` | `regra_deterministica`, `modo_ativacao`, `titulo`, `categoria` | Definicoes de modulos |
| `regra_deterministica_tipo_peca` | `regra_deterministica`, `tipo_peca` | Regras por tipo |
| `users` | `username`, `full_name` | Identificacao do usuario |

## 4. Estatisticas Gerais

### Por Tipo de Peca

| Tipo Peca | Geracoes | Sugeridos | Confirmados | Manuais | Excluidos | Concordancia |
|-----------|----------|-----------|-------------|---------|-----------|-------------|
| contestacao | 14 | 122 | 108 | 20 (1.4/ger) | 14 (1.0/ger) | 88.5% |
| contrarrazoes | 1 | 8 | 7 | 0 (0.0/ger) | 1 (1.0/ger) | 87.5% |
| recurso_apelacao | 1 | 12 | 5 | 0 (0.0/ger) | 7 (7.0/ger) | 41.7% |

### Por Metodo de Ativacao

| Metodo | Confirmados | Excluidos | Precisao |
|--------|-------------|-----------|----------|
| deterministic | 120 | 22 | 84.5% |
| llm | 0 | 0 | 0.0% |

### Causas de Inclusao Manual

| Causa | Ocorrencias | Descricao |
|-------|-------------|-----------|
| `falha_extracao` | 14 | Variavel necessaria ausente nos dados de extracao |
| `regra_legitima` | 6 | Regra avaliou FALSE corretamente (condicoes nao presentes) |

## 5. Analise Detalhada por Geracao

### Geracao #439 - 08030308820258120045 (contestacao)

- **Usuario**: Isaias Oliveira
- **Data**: 2026-02-05 21:18:55.687232
- **Preview**: 9 modulos | **Final**: 11 modulos
- **Confirmados**: 9 | **Manuais**: 2 | **Excluidos**: 0
- **Variaveis de extracao**: 174
- **Ordem categorias**: Preliminar > Mérito > Eventualidade > Requerimentos

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 20 | Inépcia da Petição Inicial - Pedido Genérico | Preliminar | deterministic |
| 2 | 22 | Litisconsórcio Necessário do Município (Tema 793) | Preliminar | deterministic |
| 3 | 32 | É Preciso Considerar a Dificuldade Real do Gestor Estadual | Mérito | deterministic |
| 4 | 50 | Responsabilidade do Município - Gestão Plena | Eventualidade | deterministic |
| 5 | 58 | Realização da Cirurgia pela Rede Pública | Eventualidade | deterministic |
| 6 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | deterministic |
| 7 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 8 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | deterministic |
| 9 | 77 |  | Requerimentos | deterministic |

#### Modulos Adicionados Manualmente

| # | ID | Modulo | Categoria | Causa | Detalhes |
|---|-----|--------|-----------|-------|----------|
| 1 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo |
| 2 | 57 | Não Condenação em Honorários de Sucumbência | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo, uniao_polo_passivo |

<details><summary>Detalhes: Direcionamento e Direito de Ressarcimento - Tema 793 (#49)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_home_care, peticao_inicial_pedido_transferencia_hospitalar, peticao_inicial_pedido_treatmento_autismo`
- **Variaveis FALTANTES**: `municipio_polo_passivo`
- Valores:
  - `peticao_inicial_pedido_cirurgia` = `True`
  - `peticao_inicial_pedido_transferencia_hospitalar` = `False`
  - `peticao_inicial_pedido_treatmento_autismo` = `False`
  - `peticao_inicial_pedido_dieta_suplemento` = `False`
  - `peticao_inicial_equipamentos_materiais` = `False`
  - `peticao_inicial_pedido_fraldas` = `False`
  - `peticao_inicial_pedido_exame` = `False`
  - `peticao_inicial_pedido_home_care` = `False`
  - `peticao_inicial_pedido_consulta` = `False`

</details>

<details><summary>Detalhes: Não Condenação em Honorários de Sucumbência (#57)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_internacao_involuntaria, peticao_inicial_juizado_justica_comum, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_medicamento, peticao_inicial_pedido_professor_apoio, peticao_inicial_pedido_transferencia_hospitalar, uniao_polo_passivo`
- **Variaveis FALTANTES**: `municipio_polo_passivo, uniao_polo_passivo`
- Valores:
  - `peticao_inicial_pedido_cirurgia` = `True`
  - `peticao_inicial_internacao_involuntaria` = `False`
  - `peticao_inicial_pedido_transferencia_hospitalar` = `False`
  - `peticao_inicial_pedido_professor_apoio` = `False`
  - `peticao_inicial_pedido_dieta_suplemento` = `False`
  - `peticao_inicial_pedido_fraldas` = `False`
  - `peticao_inicial_juizado_justica_comum` = `Justiça Comum`
  - `peticao_inicial_pedido_medicamento` = `False`
  - `peticao_inicial_pedido_exame` = `False`
  - `peticao_inicial_pedido_consulta` = `False`

</details>

---

### Geracao #437 - 08001112120268120101 (contestacao)

- **Usuario**: Isaias Oliveira
- **Data**: 2026-02-05 20:55:13.455467
- **Preview**: 11 modulos | **Final**: 11 modulos
- **Confirmados**: 11 | **Manuais**: 0 | **Excluidos**: 0
- **Variaveis de extracao**: 174
- **Ordem categorias**: Mérito > Eventualidade > Requerimentos

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 28 | Não Há Indicação Cirúrgica por Médico Especialista do SUS | Mérito | deterministic |
| 2 | 30 | Não Há Urgência ou Emergência para o Atendimento | Mérito | deterministic |
| 3 | 32 | É Preciso Considerar a Dificuldade Real do Gestor Estadual | Mérito | deterministic |
| 4 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | deterministic |
| 5 | 50 | Responsabilidade do Município - Gestão Plena | Eventualidade | deterministic |
| 6 | 51 | Responsabilidade do Município - Procedimentos | Eventualidade | deterministic |
| 7 | 58 | Realização da Cirurgia pela Rede Pública | Eventualidade | deterministic |
| 8 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | deterministic |
| 9 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 10 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | deterministic |
| 11 | 77 |  | Requerimentos | deterministic |

---

### Geracao #434 - 08053690720258120017 (contestacao)

- **Usuario**: Isaias Oliveira
- **Data**: 2026-02-05 19:44:29.214361
- **Preview**: 10 modulos | **Final**: 8 modulos
- **Confirmados**: 8 | **Manuais**: 0 | **Excluidos**: 2
- **Variaveis de extracao**: 146
- **Ordem categorias**: Preliminar > Mérito > Eventualidade

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 30 | Não Há Urgência ou Emergência para o Atendimento | Mérito | deterministic |
| 2 | 32 | É Preciso Considerar a Dificuldade Real do Gestor Estadual | Mérito | deterministic |
| 3 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | deterministic |
| 4 | 51 | Responsabilidade do Município - Procedimentos | Eventualidade | deterministic |
| 5 | 58 | Realização da Cirurgia pela Rede Pública | Eventualidade | deterministic |
| 6 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | deterministic |
| 7 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 8 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | deterministic |

#### Modulos Excluidos pelo Usuario

| # | ID | Modulo | Categoria | Motivo Sugestao | Detalhes |
|---|-----|--------|-----------|-----------------|----------|
| 1 | 14 | Competência do Juizado Especial da Fazenda Pública | Preliminar | `regra_mudou` | Regra ATUAL retorna FALSE, pode ter sido alterada desde a geracao |
| 2 | 57 | Não Condenação em Honorários de Sucumbência | Eventualidade | `regra_mudou` | Regra ATUAL retorna FALSE, pode ter sido alterada desde a geracao |

---

### Geracao #431 - 09002798620268120018 (contestacao)

- **Usuario**: Isaias Oliveira
- **Data**: 2026-02-05 18:00:19.694135
- **Preview**: 4 modulos | **Final**: 9 modulos
- **Confirmados**: 4 | **Manuais**: 6 | **Excluidos**: 0
- **Variaveis de extracao**: 117
- **Ordem categorias**: Mérito > Eventualidade

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 30 | Não Há Urgência ou Emergência para o Atendimento | Mérito | deterministic |
| 2 | 32 | É Preciso Considerar a Dificuldade Real do Gestor Estadual | Mérito | deterministic |
| 3 | 58 | Realização da Cirurgia pela Rede Pública | Eventualidade | deterministic |
| 4 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | deterministic |

#### Modulos Adicionados Manualmente

| # | ID | Modulo | Categoria | Causa | Detalhes |
|---|-----|--------|-----------|-------|----------|
| 1 | 14 | Competência do Juizado Especial da Fazenda Pública | Preliminar | `falha_extracao` | Variaveis faltantes: peticao_inicial_juizado_justica_comum, valor_causa_inferior_60sm |
| 2 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo, peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia,... |
| 3 | 51 | Responsabilidade do Município - Procedimentos | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, petica... |
| 4 | 57 | Não Condenação em Honorários de Sucumbência | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo, peticao_inicial_internacao_involuntaria, peticao_inicial_juizado_justica... |
| 5 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | `falha_extracao` | Variaveis faltantes: peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_transferencia_hospitalar, sentenca_afast... |
| 6 | 62 | Exigência de Três Orçamentos | Eventualidade | `falha_extracao` | Variaveis faltantes: peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_... |

<details><summary>Detalhes: Competência do Juizado Especial da Fazenda Pública (#14)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `peticao_inicial_juizado_justica_comum, valor_causa_inferior_60sm`
- **Variaveis FALTANTES**: `peticao_inicial_juizado_justica_comum, valor_causa_inferior_60sm`

</details>

<details><summary>Detalhes: Direcionamento e Direito de Ressarcimento - Tema 793 (#49)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_home_care, peticao_inicial_pedido_transferencia_hospitalar, peticao_inicial_pedido_treatmento_autismo`
- **Variaveis FALTANTES**: `municipio_polo_passivo, peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_home_care, peticao_inicial_pedido_transferencia_hospitalar, peticao_inicial_pedido_treatmento_autismo`

</details>

<details><summary>Detalhes: Responsabilidade do Município - Procedimentos (#51)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_exame, peticao_inicial_procedimentos`
- **Variaveis FALTANTES**: `municipio_polo_passivo, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_exame, peticao_inicial_procedimentos`

</details>

<details><summary>Detalhes: Não Condenação em Honorários de Sucumbência (#57)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_internacao_involuntaria, peticao_inicial_juizado_justica_comum, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_medicamento, peticao_inicial_pedido_professor_apoio, peticao_inicial_pedido_transferencia_hospitalar, uniao_polo_passivo`
- **Variaveis FALTANTES**: `municipio_polo_passivo, peticao_inicial_internacao_involuntaria, peticao_inicial_juizado_justica_comum, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_medicamento, peticao_inicial_pedido_professor_apoio, peticao_inicial_pedido_transferencia_hospitalar, uniao_polo_passivo`

</details>

<details><summary>Detalhes: Reembolso a Agente Privado - Tema 1.033 (#59)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `decisoes_afastamento_tema_1033_stf, pareceres_analisou_transferencia, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_transferencia_hospitalar, residual_transferencia_vaga_hospitalar, sentenca_afastamento_1033_stf`
- **Variaveis FALTANTES**: `peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_transferencia_hospitalar, sentenca_afastamento_1033_stf`
- Valores:
  - `pareceres_analisou_transferencia` = `False`
  - `residual_transferencia_vaga_hospitalar` = `False`
  - `decisoes_afastamento_tema_1033_stf` = `False`

</details>

<details><summary>Detalhes: Exigência de Três Orçamentos (#62)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_home_care, peticao_inicial_pedido_medicamento, peticao_inicial_pedido_transferencia_hospitalar, peticao_inicial_procedimentos, peticao_inicial_tratamentos`
- **Variaveis FALTANTES**: `peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_home_care, peticao_inicial_pedido_medicamento, peticao_inicial_pedido_transferencia_hospitalar, peticao_inicial_procedimentos, peticao_inicial_tratamentos`

</details>

---

### Geracao #423 - 08001120620268120101 (contestacao)

- **Usuario**: Lívia Marques de Mattos
- **Data**: 2026-02-05 16:36:32.599200
- **Preview**: 11 modulos | **Final**: 11 modulos
- **Confirmados**: 11 | **Manuais**: 0 | **Excluidos**: 0
- **Variaveis de extracao**: 174
- **Ordem categorias**: Mérito > Eventualidade > Requerimentos

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 30 | Não Há Urgência ou Emergência para o Atendimento | Mérito | deterministic |
| 2 | 31 | É Preciso Respeitar a Fila de Atendimento Eletivo | Mérito | deterministic |
| 3 | 32 | É Preciso Considerar a Dificuldade Real do Gestor Estadual | Mérito | deterministic |
| 4 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | deterministic |
| 5 | 50 | Responsabilidade do Município - Gestão Plena | Eventualidade | deterministic |
| 6 | 51 | Responsabilidade do Município - Procedimentos | Eventualidade | deterministic |
| 7 | 58 | Realização da Cirurgia pela Rede Pública | Eventualidade | deterministic |
| 8 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | deterministic |
| 9 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 10 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | deterministic |
| 11 | 77 |  | Requerimentos | deterministic |

---

### Geracao #421 - 08142830820258120002 (contestacao)

- **Usuario**: Lívia Marques de Mattos
- **Data**: 2026-02-05 16:07:55.227407
- **Preview**: 7 modulos | **Final**: 7 modulos
- **Confirmados**: 7 | **Manuais**: 0 | **Excluidos**: 0
- **Variaveis de extracao**: 179
- **Ordem categorias**: Preliminar > Mérito > Eventualidade > Requerimentos

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 14 | Competência do Juizado Especial da Fazenda Pública | Preliminar | deterministic |
| 2 | 33 | Súmulas Vinculantes nº 60 e 61 sobre Medicamentos | Mérito | deterministic |
| 3 | 35 | Análise de Medicamentos Incorporados ao SUS - Tema 1234 | Mérito | deterministic |
| 4 | 60 | Fornecimento Sem Vinculação a Nome Comercial (se a parte usou o princípio ativo e entre parênteses usou o nome comercial, não é pedido pelo nome comercial) | Eventualidade | deterministic |
| 5 | 61 | Preço Máximo de Venda ao Governo (PMVG) | Eventualidade | deterministic |
| 6 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 7 | 77 |  | Requerimentos | deterministic |

---

### Geracao #420 - 08010684120258120009 (contrarrazoes)

- **Usuario**: Isaias Oliveira
- **Data**: 2026-02-05 15:59:28.735699
- **Preview**: 8 modulos | **Final**: 7 modulos
- **Confirmados**: 7 | **Manuais**: 0 | **Excluidos**: 1
- **Variaveis de extracao**: 198
- **Ordem categorias**: Mérito > Eventualidade > honorarios

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 33 | Súmulas Vinculantes nº 60 e 61 sobre Medicamentos | Mérito | deterministic |
| 2 | 36 | Análise de Medicamentos Não Incorporados - Tema 1234 | Mérito | deterministic |
| 3 | 37 | Análise de Medicamentos Não Incorporados - Tema 6 | Mérito | deterministic |
| 4 | 60 | Fornecimento Sem Vinculação a Nome Comercial (se a parte usou o princípio ativo e entre parênteses usou o nome comercial, não é pedido pelo nome comercial) | Eventualidade | deterministic |
| 5 | 61 | Preço Máximo de Venda ao Governo (PMVG) | Eventualidade | deterministic |
| 6 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 7 | 65 | Honorários por Equidade em Demandas de Saúde (Tema 1.313/STJ) | honorarios | deterministic |

#### Modulos Excluidos pelo Usuario

| # | ID | Modulo | Categoria | Motivo Sugestao | Detalhes |
|---|-----|--------|-----------|-----------------|----------|
| 1 | 48 | Da Restituição de Eventuais Valores Despendidos | Mérito | `regra_deterministica_true` | Regra global TRUE com: peticao_inicial_pedido_restituicao_valores=True; peticao_inicial_ressarcimento=True |

---

### Geracao #419 - 08018687020258120041 (contestacao)

- **Usuario**: Lívia Marques de Mattos
- **Data**: 2026-02-05 15:26:45.720835
- **Preview**: 14 modulos | **Final**: 10 modulos
- **Confirmados**: 9 | **Manuais**: 1 | **Excluidos**: 5
- **Variaveis de extracao**: 174
- **Ordem categorias**: Preliminar > Mérito > Eventualidade

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 20 | Inépcia da Petição Inicial - Pedido Genérico | Preliminar | deterministic |
| 2 | 30 | Não Há Urgência ou Emergência para o Atendimento | Mérito | deterministic |
| 3 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | deterministic |
| 4 | 51 | Responsabilidade do Município - Procedimentos | Eventualidade | deterministic |
| 5 | 57 | Não Condenação em Honorários de Sucumbência | Eventualidade | deterministic |
| 6 | 58 | Realização da Cirurgia pela Rede Pública | Eventualidade | deterministic |
| 7 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | deterministic |
| 8 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 9 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | deterministic |

#### Modulos Adicionados Manualmente

| # | ID | Modulo | Categoria | Causa | Detalhes |
|---|-----|--------|-----------|-------|----------|
| 1 | 31 | É Preciso Respeitar a Fila de Atendimento Eletivo | Mérito | `falha_extracao` | Variaveis faltantes: pareceres_carater_exame |

<details><summary>Detalhes: É Preciso Respeitar a Fila de Atendimento Eletivo (#31)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `pareceres_carater_exame, pareceres_cirurgia_ofertada_sus, pareceres_exame_ofertado_sus, pareceres_inserido_sisreg, pareceres_natureza_cirurgia, pareceres_tempo_sisreg_dias`
- **Variaveis FALTANTES**: `pareceres_carater_exame`
- Valores:
  - `pareceres_natureza_cirurgia` = `eletiva`
  - `pareceres_tempo_sisreg_dias` = `204`
  - `pareceres_exame_ofertado_sus` = `False`
  - `pareceres_cirurgia_ofertada_sus` = `True`
  - `pareceres_inserido_sisreg` = `True`

</details>

#### Modulos Excluidos pelo Usuario

| # | ID | Modulo | Categoria | Motivo Sugestao | Detalhes |
|---|-----|--------|-----------|-----------------|----------|
| 1 | 28 | Não Há Indicação Cirúrgica por Médico Especialista do SUS | Mérito | `regra_deterministica_true` | Regra global TRUE com: pareceres_analisou_cirurgia=True; pareceres_laudo_medico_sus=False |
| 2 | 29 | Não Há Direito à Escolha do Profissional em Face do SUS | Mérito | `regra_deterministica_true` | Regra global TRUE com: peticao_inicial_pedido_procedimento_profissional_especifico=True |
| 3 | 33 | Súmulas Vinculantes nº 60 e 61 sobre Medicamentos | Mérito | `regra_deterministica_true` | Regra global TRUE com: pareceres_analisou_medicamento=False; peticao_inicial_pedido_medicamento=True |
| 4 | 54 | Responsabilidade do Município - Insumos e Equipamentos | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: peticao_inicial_equipamentos_materiais=True |
| 5 | 61 | Preço Máximo de Venda ao Governo (PMVG) | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: pareceres_canabidiol_unico_med=False; peticao_inicial_pedido_medicamento=True |

---

### Geracao #418 - 08016590420248120020 (recurso_apelacao)

- **Usuario**: Isaias Oliveira
- **Data**: 2026-02-05 15:06:57.896565
- **Preview**: 12 modulos | **Final**: 5 modulos
- **Confirmados**: 5 | **Manuais**: 0 | **Excluidos**: 7
- **Variaveis de extracao**: 198
- **Ordem categorias**: Mérito > Eventualidade > honorarios

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | deterministic |
| 2 | 51 | Responsabilidade do Município - Procedimentos | Eventualidade | deterministic |
| 3 | 57 | Não Condenação em Honorários de Sucumbência | Eventualidade | deterministic |
| 4 | 66 | Distribuição da Responsabilidade pelos Honorários entre Litisconsortes (Art. 87, § 1º, CPC) | honorarios | deterministic |
| 5 | 75 | Da aplicação da tese firmada pelo STJ no Tema 106 aos procedimentos, tratamentos e tecnologias em saúde não incorporados ao SUS (exceto medicamentos) | Mérito | deterministic |

#### Modulos Excluidos pelo Usuario

| # | ID | Modulo | Categoria | Motivo Sugestao | Detalhes |
|---|-----|--------|-----------|-----------------|----------|
| 1 | 28 | Não Há Indicação Cirúrgica por Médico Especialista do SUS | Mérito | `regra_deterministica_true` | Regra global TRUE com: pareceres_analisou_cirurgia=True; pareceres_laudo_medico_sus=False |
| 2 | 30 | Não Há Urgência ou Emergência para o Atendimento | Mérito | `regra_deterministica_true` | Regra global TRUE com: pareceres_carater_exame=None; pareceres_natureza_cirurgia=eletiva |
| 3 | 54 | Responsabilidade do Município - Insumos e Equipamentos | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: peticao_inicial_equipamentos_materiais=True |
| 4 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: decisoes_afastamento_tema_1033_stf=False; pareceres_analisou_transferencia=False; peticao_inic... |
| 5 | 62 | Exigência de Três Orçamentos | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: peticao_inicial_equipamentos_materiais=True; peticao_inicial_pedido_cirurgia=True; peticao_ini... |
| 6 | 63 | Multa Cominatória | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: decisoes_fixacao_multa_cominatoria=True; sentenca_fixacao_multa_cominatoria=True |
| 7 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: pareceres_analisou_cirurgia=True; peticao_inicial_pedido_cirurgia=True |

---

### Geracao #414 - 08014651220258120006 (contestacao)

- **Usuario**: Isaias Oliveira
- **Data**: 2026-02-05 14:34:21.700464
- **Preview**: 9 modulos | **Final**: 10 modulos
- **Confirmados**: 7 | **Manuais**: 3 | **Excluidos**: 2
- **Variaveis de extracao**: 179
- **Ordem categorias**: Preliminar > Mérito > Eventualidade

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 14 | Competência do Juizado Especial da Fazenda Pública | Preliminar | deterministic |
| 2 | 22 | Litisconsórcio Necessário do Município (Tema 793) | Preliminar | deterministic |
| 3 | 43 | Atendimento em Regime de Home Care | Mérito | deterministic |
| 4 | 48 | Da Restituição de Eventuais Valores Despendidos | Mérito | deterministic |
| 5 | 55 | Responsabilidade do Município - Atendimento Domiciliar | Eventualidade | deterministic |
| 6 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 7 | 75 | Da aplicação da tese firmada pelo STJ no Tema 106 aos procedimentos, tratamentos e tecnologias em saúde não incorporados ao SUS (exceto medicamentos) | Mérito | deterministic |

#### Modulos Adicionados Manualmente

| # | ID | Modulo | Categoria | Causa | Detalhes |
|---|-----|--------|-----------|-------|----------|
| 1 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo |
| 2 | 54 | Responsabilidade do Município - Insumos e Equipamentos | Eventualidade | `regra_legitima` | Regra global retornou FALSE com: peticao_inicial_equipamentos_materiais=False |
| 3 | 57 | Não Condenação em Honorários de Sucumbência | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo, uniao_polo_passivo |

<details><summary>Detalhes: Direcionamento e Direito de Ressarcimento - Tema 793 (#49)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_home_care, peticao_inicial_pedido_transferencia_hospitalar, peticao_inicial_pedido_treatmento_autismo`
- **Variaveis FALTANTES**: `municipio_polo_passivo`
- Valores:
  - `peticao_inicial_pedido_cirurgia` = `False`
  - `peticao_inicial_pedido_transferencia_hospitalar` = `False`
  - `peticao_inicial_pedido_treatmento_autismo` = `False`
  - `peticao_inicial_pedido_dieta_suplemento` = `False`
  - `peticao_inicial_equipamentos_materiais` = `False`
  - `peticao_inicial_pedido_fraldas` = `False`
  - `peticao_inicial_pedido_exame` = `False`
  - `peticao_inicial_pedido_home_care` = `True`
  - `peticao_inicial_pedido_consulta` = `False`

</details>

<details><summary>Detalhes: Responsabilidade do Município - Insumos e Equipamentos (#54)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `peticao_inicial_equipamentos_materiais`
- Valores:
  - `peticao_inicial_equipamentos_materiais` = `False`

</details>

<details><summary>Detalhes: Não Condenação em Honorários de Sucumbência (#57)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_internacao_involuntaria, peticao_inicial_juizado_justica_comum, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_medicamento, peticao_inicial_pedido_professor_apoio, peticao_inicial_pedido_transferencia_hospitalar, uniao_polo_passivo`
- **Variaveis FALTANTES**: `municipio_polo_passivo, uniao_polo_passivo`
- Valores:
  - `peticao_inicial_pedido_cirurgia` = `False`
  - `peticao_inicial_internacao_involuntaria` = `False`
  - `peticao_inicial_pedido_transferencia_hospitalar` = `False`
  - `peticao_inicial_pedido_professor_apoio` = `False`
  - `peticao_inicial_pedido_dieta_suplemento` = `False`
  - `peticao_inicial_pedido_fraldas` = `False`
  - `peticao_inicial_juizado_justica_comum` = `Justiça Comum`
  - `peticao_inicial_pedido_medicamento` = `False`
  - `peticao_inicial_pedido_exame` = `False`
  - `peticao_inicial_pedido_consulta` = `False`

</details>

#### Modulos Excluidos pelo Usuario

| # | ID | Modulo | Categoria | Motivo Sugestao | Detalhes |
|---|-----|--------|-----------|-----------------|----------|
| 1 | 32 | É Preciso Considerar a Dificuldade Real do Gestor Estadual | Mérito | `regra_deterministica_true` | Regra global TRUE com: pareceres_analisou_cirurgia=False; pareceres_analisou_consulta=True; pareceres_analisou_exame=... |
| 2 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: decisoes_afastamento_tema_1033_stf=False; pareceres_analisou_transferencia=False; peticao_inic... |

---

### Geracao #411 - 08014651220258120006 (contestacao)

- **Usuario**: Isaias Oliveira
- **Data**: 2026-02-05 13:47:02.440960
- **Preview**: 8 modulos | **Final**: 12 modulos
- **Confirmados**: 8 | **Manuais**: 5 | **Excluidos**: 0
- **Variaveis de extracao**: 179
- **Ordem categorias**: Preliminar > Mérito > Eventualidade

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 14 | Competência do Juizado Especial da Fazenda Pública | Preliminar | deterministic |
| 2 | 22 | Litisconsórcio Necessário do Município (Tema 793) | Preliminar | deterministic |
| 3 | 32 | É Preciso Considerar a Dificuldade Real do Gestor Estadual | Mérito | deterministic |
| 4 | 43 | Atendimento em Regime de Home Care | Mérito | deterministic |
| 5 | 48 | Da Restituição de Eventuais Valores Despendidos | Mérito | deterministic |
| 6 | 55 | Responsabilidade do Município - Atendimento Domiciliar | Eventualidade | deterministic |
| 7 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 8 | 75 | Da aplicação da tese firmada pelo STJ no Tema 106 aos procedimentos, tratamentos e tecnologias em saúde não incorporados ao SUS (exceto medicamentos) | Mérito | deterministic |

#### Modulos Adicionados Manualmente

| # | ID | Modulo | Categoria | Causa | Detalhes |
|---|-----|--------|-----------|-------|----------|
| 1 | 20 | Inépcia da Petição Inicial - Pedido Genérico | Preliminar | `regra_legitima` | Regra global retornou FALSE com: peticao_inicial_generico=False |
| 2 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo |
| 3 | 54 | Responsabilidade do Município - Insumos e Equipamentos | Eventualidade | `regra_legitima` | Regra global retornou FALSE com: peticao_inicial_equipamentos_materiais=False |
| 4 | 57 | Não Condenação em Honorários de Sucumbência | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo, uniao_polo_passivo |
| 5 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | `regra_legitima` | Regra global retornou FALSE com: pareceres_analisou_cirurgia=False; peticao_inicial_pedido_cirurgia=False |

<details><summary>Detalhes: Inépcia da Petição Inicial - Pedido Genérico (#20)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `peticao_inicial_generico`
- Valores:
  - `peticao_inicial_generico` = `False`

</details>

<details><summary>Detalhes: Direcionamento e Direito de Ressarcimento - Tema 793 (#49)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_home_care, peticao_inicial_pedido_transferencia_hospitalar, peticao_inicial_pedido_treatmento_autismo`
- **Variaveis FALTANTES**: `municipio_polo_passivo`
- Valores:
  - `peticao_inicial_pedido_cirurgia` = `False`
  - `peticao_inicial_pedido_transferencia_hospitalar` = `False`
  - `peticao_inicial_pedido_treatmento_autismo` = `False`
  - `peticao_inicial_pedido_dieta_suplemento` = `False`
  - `peticao_inicial_equipamentos_materiais` = `False`
  - `peticao_inicial_pedido_fraldas` = `False`
  - `peticao_inicial_pedido_exame` = `False`
  - `peticao_inicial_pedido_home_care` = `True`
  - `peticao_inicial_pedido_consulta` = `False`

</details>

<details><summary>Detalhes: Responsabilidade do Município - Insumos e Equipamentos (#54)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `peticao_inicial_equipamentos_materiais`
- Valores:
  - `peticao_inicial_equipamentos_materiais` = `False`

</details>

<details><summary>Detalhes: Não Condenação em Honorários de Sucumbência (#57)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_internacao_involuntaria, peticao_inicial_juizado_justica_comum, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_medicamento, peticao_inicial_pedido_professor_apoio, peticao_inicial_pedido_transferencia_hospitalar, uniao_polo_passivo`
- **Variaveis FALTANTES**: `municipio_polo_passivo, uniao_polo_passivo`
- Valores:
  - `peticao_inicial_pedido_cirurgia` = `False`
  - `peticao_inicial_internacao_involuntaria` = `False`
  - `peticao_inicial_pedido_transferencia_hospitalar` = `False`
  - `peticao_inicial_pedido_professor_apoio` = `False`
  - `peticao_inicial_pedido_dieta_suplemento` = `False`
  - `peticao_inicial_pedido_fraldas` = `False`
  - `peticao_inicial_juizado_justica_comum` = `Justiça Comum`
  - `peticao_inicial_pedido_medicamento` = `False`
  - `peticao_inicial_pedido_exame` = `False`
  - `peticao_inicial_pedido_consulta` = `False`

</details>

<details><summary>Detalhes: INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  (#71)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `pareceres_analisou_cirurgia, peticao_inicial_pedido_cirurgia`
- Valores:
  - `pareceres_analisou_cirurgia` = `False`
  - `peticao_inicial_pedido_cirurgia` = `False`

</details>

---

### Geracao #399 - 08000700920268120019 (contestacao)

- **Usuario**: Isaias Oliveira
- **Data**: 2026-02-04 21:14:18.185072
- **Preview**: 8 modulos | **Final**: 9 modulos
- **Confirmados**: 8 | **Manuais**: 1 | **Excluidos**: 0
- **Variaveis de extracao**: 179
- **Ordem categorias**: Preliminar > Mérito > Eventualidade

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 14 | Competência do Juizado Especial da Fazenda Pública | Preliminar | deterministic |
| 2 | 33 | Súmulas Vinculantes nº 60 e 61 sobre Medicamentos | Mérito | deterministic |
| 3 | 34 | Medicamento Não Incorporado para Situação Clínica da Parte Autora | Mérito | deterministic |
| 4 | 36 | Análise de Medicamentos Não Incorporados - Tema 1234 | Mérito | deterministic |
| 5 | 37 | Análise de Medicamentos Não Incorporados - Tema 6 | Mérito | deterministic |
| 6 | 39 | Medicamento para Uso Off Label - Tema 106 | Mérito | deterministic |
| 7 | 61 | Preço Máximo de Venda ao Governo (PMVG) | Eventualidade | deterministic |
| 8 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |

#### Modulos Adicionados Manualmente

| # | ID | Modulo | Categoria | Causa | Detalhes |
|---|-----|--------|-----------|-------|----------|
| 1 | 41 | A Parte Autora Não Buscou o Atendimento Oncológico do SUS | Mérito | `regra_legitima` | Regra global retornou FALSE com: pareceres_medicamento_oncologico=False; pareceres_onco_cacon_unacon=False |

<details><summary>Detalhes: A Parte Autora Não Buscou o Atendimento Oncológico do SUS (#41)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `pareceres_medicamento_oncologico, pareceres_onco_cacon_unacon`
- Valores:
  - `pareceres_onco_cacon_unacon` = `False`
  - `pareceres_medicamento_oncologico` = `False`

</details>

---

### Geracao #391 - 08000409820268120010 (contestacao)

- **Usuario**: Welligton Carlos da Costa Silva
- **Data**: 2026-02-04 18:22:30.144999
- **Preview**: 7 modulos | **Final**: 8 modulos
- **Confirmados**: 7 | **Manuais**: 1 | **Excluidos**: 0
- **Variaveis de extracao**: 174
- **Ordem categorias**: Preliminar > Mérito > Eventualidade

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 14 | Competência do Juizado Especial da Fazenda Pública | Preliminar | deterministic |
| 2 | 22 | Litisconsórcio Necessário do Município (Tema 793) | Preliminar | deterministic |
| 3 | 30 | Não Há Urgência ou Emergência para o Atendimento | Mérito | deterministic |
| 4 | 58 | Realização da Cirurgia pela Rede Pública | Eventualidade | deterministic |
| 5 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | deterministic |
| 6 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 7 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | deterministic |

#### Modulos Adicionados Manualmente

| # | ID | Modulo | Categoria | Causa | Detalhes |
|---|-----|--------|-----------|-------|----------|
| 1 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | `falha_extracao` | Variaveis faltantes: municipio_polo_passivo |

<details><summary>Detalhes: Direcionamento e Direito de Ressarcimento - Tema 793 (#49)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `municipio_polo_passivo, peticao_inicial_equipamentos_materiais, peticao_inicial_pedido_cirurgia, peticao_inicial_pedido_consulta, peticao_inicial_pedido_dieta_suplemento, peticao_inicial_pedido_exame, peticao_inicial_pedido_fraldas, peticao_inicial_pedido_home_care, peticao_inicial_pedido_transferencia_hospitalar, peticao_inicial_pedido_treatmento_autismo`
- **Variaveis FALTANTES**: `municipio_polo_passivo`
- Valores:
  - `peticao_inicial_pedido_cirurgia` = `True`
  - `peticao_inicial_pedido_transferencia_hospitalar` = `False`
  - `peticao_inicial_pedido_treatmento_autismo` = `False`
  - `peticao_inicial_pedido_dieta_suplemento` = `False`
  - `peticao_inicial_equipamentos_materiais` = `False`
  - `peticao_inicial_pedido_fraldas` = `False`
  - `peticao_inicial_pedido_exame` = `False`
  - `peticao_inicial_pedido_home_care` = `False`
  - `peticao_inicial_pedido_consulta` = `False`

</details>

---

### Geracao #375 - 08053502820258120008 (contestacao)

- **Usuario**: Paloma Coimbra
- **Data**: 2026-02-03 20:39:36.640487
- **Preview**: 10 modulos | **Final**: 8 modulos
- **Confirmados**: 8 | **Manuais**: 0 | **Excluidos**: 2
- **Variaveis de extracao**: 174
- **Ordem categorias**: Preliminar > Mérito > Eventualidade

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 22 | Litisconsórcio Necessário do Município (Tema 793) | Preliminar | deterministic |
| 2 | 28 | Não Há Indicação Cirúrgica por Médico Especialista do SUS | Mérito | deterministic |
| 3 | 32 | É Preciso Considerar a Dificuldade Real do Gestor Estadual | Mérito | deterministic |
| 4 | 54 | Responsabilidade do Município - Insumos e Equipamentos | Eventualidade | deterministic |
| 5 | 58 | Realização da Cirurgia pela Rede Pública | Eventualidade | deterministic |
| 6 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | deterministic |
| 7 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 8 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | deterministic |

#### Modulos Excluidos pelo Usuario

| # | ID | Modulo | Categoria | Motivo Sugestao | Detalhes |
|---|-----|--------|-----------|-----------------|----------|
| 1 | 33 | Súmulas Vinculantes nº 60 e 61 sobre Medicamentos | Mérito | `regra_deterministica_true` | Regra global TRUE com: pareceres_analisou_medicamento=False; peticao_inicial_pedido_medicamento=True |
| 2 | 61 | Preço Máximo de Venda ao Governo (PMVG) | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: pareceres_canabidiol_unico_med=False; peticao_inicial_pedido_medicamento=True |

---

### Geracao #369 - 08000454720268120002 (contestacao)

- **Usuario**: Lívia Marques de Mattos
- **Data**: 2026-02-03 16:52:42.759452
- **Preview**: 14 modulos | **Final**: 11 modulos
- **Confirmados**: 11 | **Manuais**: 0 | **Excluidos**: 3
- **Variaveis de extracao**: 174
- **Ordem categorias**: Mérito > Eventualidade > Requerimentos

#### Modulos Confirmados

| # | ID | Modulo | Categoria | Metodo |
|---|-----|--------|-----------|--------|
| 1 | 46 | Não É Aconselhável a Predefinição de Método Específico - TEA | Mérito | deterministic |
| 2 | 49 | Direcionamento e Direito de Ressarcimento - Tema 793 | Eventualidade | deterministic |
| 3 | 51 | Responsabilidade do Município - Procedimentos | Eventualidade | deterministic |
| 4 | 56 | Responsabilidade do Município - Terapias TEA | Eventualidade | deterministic |
| 5 | 57 | Não Condenação em Honorários de Sucumbência | Eventualidade | deterministic |
| 6 | 61 | Preço Máximo de Venda ao Governo (PMVG) | Eventualidade | deterministic |
| 7 | 62 | Exigência de Três Orçamentos | Eventualidade | deterministic |
| 8 | 72 | Aplicação do tema 106 para TEA | Mérito | deterministic |
| 9 | 73 | Insuficiência de Profissionais para TEA | Mérito | deterministic |
| 10 | 74 |  | Eventualidade | deterministic |
| 11 | 77 |  | Requerimentos | deterministic |

#### Modulos Excluidos pelo Usuario

| # | ID | Modulo | Categoria | Motivo Sugestao | Detalhes |
|---|-----|--------|-----------|-----------------|----------|
| 1 | 33 | Súmulas Vinculantes nº 60 e 61 sobre Medicamentos | Mérito | `regra_deterministica_true` | Regra global TRUE com: pareceres_analisou_medicamento=False; peticao_inicial_pedido_medicamento=True |
| 2 | 59 | Reembolso a Agente Privado - Tema 1.033 | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: decisoes_afastamento_tema_1033_stf=False; pareceres_analisou_transferencia=False; peticao_inic... |
| 3 | 71 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  | Eventualidade | `regra_deterministica_true` | Regra global TRUE com: pareceres_analisou_cirurgia=False; peticao_inicial_pedido_cirurgia=True |

---

### Geracao #348 - 08046033020258120800 (contestacao)

- **Usuario**: Welligton Carlos da Costa Silva
- **Data**: 2026-02-02 14:40:09.986166
- **Preview**: 0 modulos | **Final**: 15 modulos
- **Confirmados**: 0 | **Manuais**: 1 | **Excluidos**: 0
- **Variaveis de extracao**: 174
- **Ordem categorias**: Preliminar > Mérito > Eventualidade > Requerimentos

#### Modulos Adicionados Manualmente

| # | ID | Modulo | Categoria | Causa | Detalhes |
|---|-----|--------|-----------|-------|----------|
| 1 | 32 | É Preciso Considerar a Dificuldade Real do Gestor Estadual | Mérito | `regra_legitima` | Regra global retornou FALSE com: pareceres_analisou_cirurgia=True; pareceres_analisou_consulta=False; pareceres_anali... |

<details><summary>Detalhes: É Preciso Considerar a Dificuldade Real do Gestor Estadual (#32)</summary>

- Regra usada: `global`
- Resultado re-avaliacao: `False`
- Variaveis necessarias: `pareceres_analisou_cirurgia, pareceres_analisou_consulta, pareceres_analisou_exame, pareceres_cirurgia_ofertada_sus, pareceres_exame_ofertado_sus, pareceres_inserido_core`
- Valores:
  - `pareceres_inserido_core` = `True`
  - `pareceres_exame_ofertado_sus` = `False`
  - `pareceres_cirurgia_ofertada_sus` = `True`
  - `pareceres_analisou_consulta` = `False`
  - `pareceres_analisou_cirurgia` = `True`
  - `pareceres_analisou_exame` = `False`

</details>

---

### Geracao #341 - 08002094320268120800 (contestacao)

- **Usuario**: Regiane
- **Data**: 2026-02-02 13:43:36.903400
- **ERRO**: curadoria_metadata ausente

### Geracao #340 - 08002094320268120800 (contestacao)

- **Usuario**: Regiane
- **Data**: 2026-02-02 13:42:03.492749
- **ERRO**: curadoria_metadata ausente

### Geracao #338 - 08002094320268120800 (contestacao)

- **Usuario**: Regiane
- **Data**: 2026-02-02 13:33:21.433843
- **ERRO**: curadoria_metadata ausente

### Geracao #337 - 08002094320268120800 (contestacao)

- **Usuario**: Regiane
- **Data**: 2026-02-02 13:32:14.808989
- **ERRO**: curadoria_metadata ausente

## 6. Padroes Encontrados

### Top Modulos Adicionados Manualmente
*(Candidatos a criacao/ajuste de regra deterministica)*

| # | Modulo | Vezes Adicionado | % das Geracoes | Hipotese de Causa |
|---|--------|-----------------|----------------|-------------------|
| 1 | Direcionamento e Direito de Ressarcimento - Tema 793 (#49) | 5 | 31% | falha_extracao |
| 2 | Não Condenação em Honorários de Sucumbência (#57) | 4 | 25% | falha_extracao |
| 3 | Responsabilidade do Município - Insumos e Equipamentos (#54) | 2 | 12% | regra_legitima |
| 4 | Competência do Juizado Especial da Fazenda Pública (#14) | 1 | 6% | falha_extracao |
| 5 | Responsabilidade do Município - Procedimentos (#51) | 1 | 6% | falha_extracao |
| 6 | Reembolso a Agente Privado - Tema 1.033 (#59) | 1 | 6% | falha_extracao |
| 7 | Exigência de Três Orçamentos (#62) | 1 | 6% | falha_extracao |
| 8 | É Preciso Respeitar a Fila de Atendimento Eletivo (#31) | 1 | 6% | falha_extracao |
| 9 | Inépcia da Petição Inicial - Pedido Genérico (#20) | 1 | 6% | regra_legitima |
| 10 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  (#71) | 1 | 6% | regra_legitima |

### Top Modulos Excluidos (Possiveis Falsos Positivos)
*(Regras possivelmente agressivas demais)*

| # | Modulo | Vezes Excluido | % quando Sugerido | Hipotese |
|---|--------|---------------|-------------------|----------|
| 1 | Súmulas Vinculantes nº 60 e 61 sobre Medicamentos (#33) | 3 | - | regra_deterministica_true |
| 2 | Reembolso a Agente Privado - Tema 1.033 (#59) | 3 | - | regra_deterministica_true |
| 3 | Não Há Indicação Cirúrgica por Médico Especialista do SUS (#28) | 2 | - | regra_deterministica_true |
| 4 | Responsabilidade do Município - Insumos e Equipamentos (#54) | 2 | - | regra_deterministica_true |
| 5 | Preço Máximo de Venda ao Governo (PMVG) (#61) | 2 | - | regra_deterministica_true |
| 6 | INADMISSÃO DE ORÇAMENTO DO TIPO "PACOTE"  (#71) | 2 | - | regra_deterministica_true |
| 7 | Competência do Juizado Especial da Fazenda Pública (#14) | 1 | - | regra_mudou |
| 8 | Não Condenação em Honorários de Sucumbência (#57) | 1 | - | regra_mudou |
| 9 | Da Restituição de Eventuais Valores Despendidos (#48) | 1 | - | regra_deterministica_true |
| 10 | Não Há Direito à Escolha do Profissional em Face do SUS (#29) | 1 | - | regra_deterministica_true |

### Variaveis Frequentemente Ausentes
*(Indicam problemas na pipeline de extracao)*

| # | Variavel | Vezes Faltante | Impacto |
|---|----------|---------------|---------|
| 1 | `municipio_polo_passivo` | 10 | Modulos com regra dependente nao sao ativados |
| 2 | `peticao_inicial_pedido_cirurgia` | 5 | Modulos com regra dependente nao sao ativados |
| 3 | `uniao_polo_passivo` | 4 | Modulos com regra dependente nao sao ativados |
| 4 | `peticao_inicial_pedido_consulta` | 4 | Modulos com regra dependente nao sao ativados |
| 5 | `peticao_inicial_pedido_exame` | 4 | Modulos com regra dependente nao sao ativados |
| 6 | `peticao_inicial_pedido_transferencia_hospitalar` | 4 | Modulos com regra dependente nao sao ativados |
| 7 | `peticao_inicial_pedido_dieta_suplemento` | 3 | Modulos com regra dependente nao sao ativados |
| 8 | `peticao_inicial_juizado_justica_comum` | 2 | Modulos com regra dependente nao sao ativados |
| 9 | `peticao_inicial_equipamentos_materiais` | 2 | Modulos com regra dependente nao sao ativados |
| 10 | `peticao_inicial_pedido_fraldas` | 2 | Modulos com regra dependente nao sao ativados |

## 7. Falhas Confirmadas e Recomendacoes

---

### PROBLEMA 1 (CRITICO): `municipio_polo_passivo` ausente em 62% das geracoes

**O que acontece**: A variavel `municipio_polo_passivo` esta faltando em 10 de 16 geracoes. Isso impede que 2 modulos sejam ativados automaticamente:

- **Tema 793** (#49): adicionado manualmente em 31% das geracoes
- **Honorarios de Sucumbencia** (#57): adicionado manualmente em 25% das geracoes

**Por que acontece**: Essa variavel deveria vir de DUAS fontes, mas ambas estao falhando:

1. **Fonte primaria (XML do TJ-MS)**: O `ProcessVariableResolver` analisa os dados de partes do processo. Quando o XML do TJ-MS retorna a lista de partes vazia (o que acontece com frequencia), a variavel fica `None`.

2. **Fonte secundaria (fallback de extracao)**: O `detector_modulos.py` (linhas 175-183) tem um fallback: se `municipio_polo_passivo` for None, usa `peticao_inicial_municipio_polo_passivo` da extracao de PDFs. Porem, na maioria dos casos essa variavel de extracao tambem nao existe porque o modelo de extracao da "Peticao Inicial" pode nao incluir uma pergunta sobre presenca do municipio no polo passivo.

3. **Agravante**: O modulo #49 usa `value: 1` (inteiro) na regra, enquanto o ProcessVariableResolver retorna `True` (booleano). O `_comparar_igual` normaliza isso, mas quando a variavel e None, ela vira `False`, que e diferente de `1`. Resultado: a regra avalia como FALSE mesmo que o municipio esteja no polo passivo.

**Como corrigir (3 opcoes, da mais rapida para a mais robusta)**:

- **Opcao A (rapida, ~30min)**: Adicionar a pergunta "O municipio esta no polo passivo?" ao modelo de extracao da categoria "Peticao Inicial" no admin (`/admin/extraction-variables`). Isso popula `peticao_inicial_municipio_polo_passivo`, e o fallback no detector_modulos.py ja cobre o resto.

- **Opcao B (media, ~1h)**: Alterar as regras dos modulos #49 e #57 para aceitar AMBOS os formatos da variavel. Trocar:
  ```json
  {"variable": "municipio_polo_passivo", "operator": "equals", "value": 1}
  ```
  por:
  ```json
  {"type": "or", "conditions": [
    {"type": "condition", "variable": "municipio_polo_passivo", "operator": "equals", "value": true},
    {"type": "condition", "variable": "peticao_inicial_municipio_polo_passivo", "operator": "equals", "value": true}
  ]}
  ```
  Assim a regra funciona com qualquer uma das duas fontes.

- **Opcao C (robusta, ~2h)**: Persistir as variaveis de processo resolvidas junto com as variaveis de extracao no campo `dados_processo` da `geracoes_pecas`. Hoje, `dados_processo` so armazena `dados_extracao`. Se tambem incluir o output de `ProcessVariableResolver`, todas as variaveis derivadas ficam disponiveis para auditoria e re-avaliacao futura.

**Recomendacao**: Aplicar Opcao A imediatamente (rapida) e Opcao C como melhoria futura (robusta).

---

### PROBLEMA 2 (ALTO): Variaveis de extracao faltantes (`peticao_inicial_pedido_*`)

**O que acontece**: Varias variaveis do tipo `peticao_inicial_pedido_*` estao faltando em geracoes recentes:

| Variavel | Faltante em |
|----------|-------------|
| `peticao_inicial_pedido_cirurgia` | 5 geracoes |
| `peticao_inicial_pedido_consulta` | 4 geracoes |
| `peticao_inicial_pedido_exame` | 4 geracoes |
| `peticao_inicial_pedido_transferencia_hospitalar` | 4 geracoes |
| `peticao_inicial_pedido_dieta_suplemento` | 3 geracoes |

**Por que acontece**: Essas variaveis dependem do modelo de extracao da categoria "Peticao Inicial". Se o documento de peticao inicial nao foi identificado pelo Agente 1, ou se o modelo de extracao nao incluiu essas perguntas, as variaveis ficam ausentes.

**Impacto**: Os modulos #49 (Tema 793), #59 (Tema 1.033), #62 (Tres Orcamentos) e outros dependem dessas variaveis para a segunda parte da regra (alem de `municipio_polo_passivo`).

**Como corrigir**:

1. Verificar no admin (`/admin/extraction-models`) se o modelo de extracao da "Peticao Inicial" contem perguntas para TODAS as variaveis `peticao_inicial_pedido_*` listadas acima. Se alguma estiver faltando, adicionar.

2. Verificar se o Agente 1 esta corretamente identificando o documento "Peticao Inicial" nos PDFs do processo. Se o documento nao for identificado, nenhuma variavel e extraida. Checar os logs do Agente 1 para os processos afetados (ex: #431, #439).

3. Se o problema for que a LLM de extracao nao consegue responder a pergunta (ex: o PDF nao menciona o tipo de pedido), considerar tornar essas variaveis opcionais na regra ou adicionar um fallback que use o resumo consolidado.

---

### PROBLEMA 3 (MEDIO): Modulos excluidos com frequencia (falsos positivos)

**O que acontece**: Alguns modulos sao sugeridos pelo sistema mas o usuario os remove consistentemente.

#### 3a. Sumulas Vinculantes 60/61 (#33) - excluido 3x

**Regra atual**: Ativa quando `peticao_inicial_pedido_medicamento == true` OU `pareceres_analisou_medicamento == true`.

**Problema**: A regra ativa para QUALQUER caso que mencione medicamento, mesmo quando o pedido principal e cirurgia, internacao ou outro procedimento. O usuario exclui porque o modulo nao e relevante quando o caso nao gira em torno de medicamentos.

**Como corrigir**: Refinar a regra para diferenciar "caso de medicamento" de "caso de procedimento que menciona medicamento incidentalmente". Sugestao: exigir que `peticao_inicial_pedido_medicamento == true` E que NAO haja pedido de cirurgia como pedido principal:
```
peticao_inicial_pedido_medicamento == true
AND NOT (peticao_inicial_pedido_cirurgia == true AND peticao_inicial_pedido_medicamento_complementar == true)
```
Ou, mais simples: criar uma variavel `peticao_inicial_pedido_principal` que indique o tipo principal do pedido (medicamento, cirurgia, insumo, etc.) e usar essa variavel como condicao.

#### 3b. Reembolso a Agente Privado - Tema 1.033 (#59) - excluido 3x

**Regra atual**: Ativa quando `peticao_inicial_pedido_cirurgia == 1` OU decisoes/sentenca sobre Tema 1.033 OU transferencia hospitalar.

**Problema**: A regra e muito ampla - ativa para TODA cirurgia, mesmo quando nao ha discussao sobre reembolso ou agente privado. O modulo deveria ativar apenas quando ha indicacao de que o procedimento sera feito fora da rede publica.

**Como corrigir**: Adicionar condicao: exigir que alem da cirurgia, haja indicacao de atendimento privado ou discussao sobre Tema 1.033:
```
(peticao_inicial_pedido_cirurgia == 1 AND pareceres_atendimento_privado == true)
OR decisoes_afastamento_tema_1033 == 1
OR peticao_inicial_pedido_transferencia_hospitalar == 1
```

#### 3c. Sem Indicacao Cirurgica por Medico do SUS (#28) - excluido 2x

**Regra atual**: Ativa quando `pareceres_laudo_medico_sus == false` E `pareceres_analisou_cirurgia == true`.

**Problema**: Ativa sempre que ha analise de cirurgia com laudo nao-SUS, mesmo em casos onde a discussao principal nao e sobre indicacao cirurgica. Os usuarios podem excluir quando o argumento nao e relevante ao caso especifico.

**Como corrigir**: Considerar adicionar condicao extra: `peticao_inicial_pedido_cirurgia == true` (garantir que a cirurgia e um pedido da peticao inicial, nao apenas mencionada nos pareceres).

---

### PROBLEMA 4 (BAIXO): 4 geracoes sem `curadoria_metadata`

**O que acontece**: As geracoes #337, #338, #340 e #341 (todas do mesmo processo 08002094320268120800) tem `curadoria_metadata = NULL`.

**Por que acontece**: Provavelmente essas geracoes foram feitas antes da migration que adicionou a coluna `curadoria_metadata` ser aplicada no banco de producao, ou houve um erro ao tentar salvar os metadados (o router.py linhas 2883-2891 tem um fallback que salva sem metadados se a coluna nao existir).

**Impacto**: Essas 4 geracoes nao podem ser auditadas. Dados de curadoria foram perdidos permanentemente.

**Como corrigir**: Nao ha correcao retroativa. Para evitar no futuro, garantir que a migration `20260202_1500_a7c3b8d2e1f0` esteja aplicada no banco de producao antes de usar o modo semi-automatico.

---

### PROBLEMA 5 (BAIXO): Logs de ativacao nao populados no semi-automatico

**O que acontece**: A tabela `prompt_activation_logs` tem 0 registros no periodo analisado para o modo semi-automatico.

**Por que acontece**: A funcao `_registrar_log_ativacao` e chamada dentro do `detector_modulos.py` durante a avaliacao deterministica (modo automatico), mas no fluxo semi-automatico o preview pode nao estar chamando essa funcao, ou os logs sao registrados apenas para o modo automatico.

**Impacto**: Sem logs de ativacao, nao e possivel saber exatamente quais variaveis estavam disponiveis e qual foi a decisao de cada modulo no momento do preview. A auditoria fica limitada a re-avaliacao com variaveis armazenadas (que podem nao incluir variaveis de processo).

**Como corrigir**: Garantir que `_registrar_log_ativacao` seja chamada tambem no fluxo de preview do semi-automatico (endpoint `/curadoria/preview`). Isso exige verificar se o `detectar_modulos_relevantes` do Agente 2 esta chamando a funcao de log quando executado via preview.

---

### Resumo Geral de Recomendacoes (priorizado)

| # | Prioridade | O que fazer | Impacto esperado | Esforco |
|---|------------|-------------|------------------|---------|
| 1 | CRITICO | Adicionar pergunta "municipio no polo passivo" ao modelo de extracao da Peticao Inicial | Resolve 70% das inclusoes manuais (14 de 20) | ~30min |
| 2 | ALTO | Verificar modelo de extracao para variaveis `peticao_inicial_pedido_*` faltantes | Resolve falhas de ativacao de varios modulos | ~1h |
| 3 | MEDIO | Refinar regra do modulo #33 (Sumulas 60/61) para nao ativar em casos de cirurgia | Reduz falsos positivos mais frequentes | ~30min |
| 4 | MEDIO | Refinar regra do modulo #59 (Tema 1.033) para exigir indicacao de atendimento privado | Reduz exclusoes desnecessarias | ~30min |
| 5 | MEDIO | Alterar regra do modulo #49 para aceitar `municipio_polo_passivo` booleano OU `peticao_inicial_municipio_polo_passivo` | Fallback mais robusto | ~15min |
| 6 | BAIXO | Persistir variaveis de processo resolvidas no `dados_processo` | Melhora auditoria futura | ~2h |
| 7 | BAIXO | Habilitar `prompt_activation_logs` no fluxo semi-automatico | Melhora diagnostico | ~1h |

## 8. Anexo: Queries Executadas

```sql
-- Q1: Geracoes semi-automaticas no periodo
SELECT gp.*, u.username, u.full_name
FROM geracoes_pecas gp
LEFT JOIN users u ON u.id = gp.usuario_id
WHERE gp.modo_ativacao_agente2 = 'semi_automatico'
  AND gp.criado_em >= NOW() - INTERVAL '7 days'
ORDER BY gp.criado_em DESC;

-- Q2: Modulos de conteudo
SELECT * FROM prompt_modulos WHERE tipo = 'conteudo';

-- Q3: Regras por tipo de peca
SELECT * FROM regra_deterministica_tipo_peca WHERE ativo = true;

-- Q4: Logs de ativacao
SELECT * FROM prompt_activation_logs
WHERE timestamp >= NOW() - INTERVAL '7 days'
ORDER BY timestamp;
```
