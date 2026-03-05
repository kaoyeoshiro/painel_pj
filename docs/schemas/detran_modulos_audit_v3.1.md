# Auditoria de Modulos DETRAN v3.1

**Data**: 2026-03-05
**Versao anterior**: 3.0 (94 modulos)
**Versao atual**: 3.1 (98 modulos)

## Sumario das Mudancas

### Reclassificacao de 50 modulos sem filtro `detran_tipo_acao`

- **29 modulos UNIVERSAIS**: Mantidos sem filtro `detran_tipo_acao` por serem preliminares processuais ou teses genericas aplicaveis a qualquer tipo de acao DETRAN.
- **21 modulos ESCOPADOS**: Receberam filtro `detran_tipo_acao` via `in_list` para restringir ativacao aos tipos de acao relevantes.

### 4 novos modulos criados

| Modulo | Titulo | Filtro tipo_acao |
|--------|--------|-----------------|
| `detran_resp_001_095` | Excludente de responsabilidade civil (culpa exclusiva) | `responsabilidade_civil` |
| `detran_resp_002_096` | Ausencia de nexo causal | `responsabilidade_civil` |
| `detran_ipva_001_097` | Requisitos legais para isencao IPVA nao preenchidos | `isencao_ipva` |
| `detran_ipva_002_098` | Competencia tributaria estadual e limites do DETRAN | `isencao_ipva` |

### Metadados atualizados

- `versao`: 3.0 -> 3.1
- `total`: 94 -> 98
- `descricao`: Atualizada para refletir novos modulos e filtros

## Modulos Universais (29) — Sem filtro `detran_tipo_acao`

Estes modulos sao preliminares processuais e teses genericas aplicaveis a QUALQUER tipo de acao DETRAN.

| # | Modulo | Titulo | Variavel principal |
|---|--------|--------|--------------------|
| 1 | `detran_prel_011_002` | PREL_011 — Alegue a incompetência do juízo para processar e  | `detran_alega_incompetencia` |
| 2 | `detran_prel_020_003` | PREL_020 — Refute a alegação de prescrição ou decadência do  | `detran_alega_prescricao_decadencia` |
| 3 | `detran_prel_021_005` | PREL_021 — Alegue a prescrição da pretensão do autor com fun | `detran_alega_prescricao_decadencia` |
| 4 | `detran_prel_003_006` | PREL_003 — Alegue a ilegitimidade passiva ad causam do DETRA | `detran_alega_ilegitimidade` |
| 5 | `detran_prel_007_008` | PREL_007 — Alegue a ilegitimidade passiva do Estado de Mato  | `detran_alega_ilegitimidade` |
| 6 | `detran_prel_023_009` | PREL_023 — Alegue a falta de interesse de agir do autor por  | `detran_falta_interesse_agir` |
| 7 | `detran_prel_016_012` | PREL_016 — Alegue a inépcia da petição inicial por não preen | `detran_alega_inepcia_inicial` |
| 8 | `detran_prel_017_013` | PREL_017 — Alegue a perda superveniente do objeto da ação e  | `detran_falta_interesse_agir` |
| 9 | `detran_prel_024_014` | PREL_024 — Alegue a existência de coisa julgada material, de | `detran_coisa_julgada` |
| 10 | `detran_prel_015_015` | PREL_015 — Alegue a necessidade de formação de litisconsórci | `detran_litisconsorcio_necessario` |
| 11 | `detran_prel_010_018` | PREL_010 — Alegue a ilegitimidade ativa ad causam do autor | `detran_ilegitimidade_ativa` |
| 12 | `detran_prel_012_020` | PREL_012 — Suscite preliminar de incompetência territorial c | `detran_alega_incompetencia` |
| 13 | `detran_prel_013_021` | PREL_013 — Alegue a incompetência absoluta do juízo comum e  | `detran_alega_incompetencia` |
| 14 | `detran_prel_027_022` | PREL_027 — Alegue a aplicação do princípio da causalidade pa | `detran_alega_ilegitimidade` |
| 15 | `detran_prel_028_023` | PREL_028 — Impugne o valor da causa atribuído pelo autor, su | `detran_valor_causa_incompativel` |
| 16 | `detran_prel_029_024` | PREL_029 — Requeira a conexão com processo similar que trami | `detran_litispendencia_conexao` |
| 17 | `detran_prel_031_025` | PREL_031 — Impugne os documentos apresentados pelo autor, co | `detran_documentos_duvidosos` |
| 18 | `detran_prel_019_028` | PREL_019 — Alegue a ausência de intimação válida e cerceamen | `detran_vicio_citacao` |
| 19 | `detran_fat_011_056` | FAT_011 — Demonstre que o DETRAN/MS não está inerte, apresen | `detran_alega_inercia_orgao` |
| 20 | `detran_fat_008_057` | FAT_008/029 — Alegue preclusão por ausência de impugnação e  | `detran_pagou_voluntariamente` |
| 21 | `detran_jur_019_072` | JUR_019 — Alegue a não configuração da responsabilidade civi | `?` |
| 22 | `detran_jur_021_074` | JUR_021 — Alegue a inaplicabilidade das alterações da Lei 14 | `detran_alega_prescricao_decadencia` |
| 23 | `detran_jur_020_078` | JUR_020 — Alegue violação à boa-fé objetiva pelo autor e cul | `detran_autor_inerte` |
| 24 | `detran_jur_026_086` | JUR_026/030 — Alegue inexistência de relação de consumo e co | `detran_invoca_cdc` |
| 25 | `detran_dm_001_092` | DM_001/003 — Refute o pedido de danos morais e, subsidiariam | `detran_dano_moral` |
| 26 | `detran_dmat_001_095` | DMAT_001/004 — Conteste o pedido de indenização por danos ma | `detran_dano_material` |
| 27 | `detran_dmat_002_096` | DMAT_002 — Refute a pretensão de lucros cessantes por ausênc | `detran_dano_material` |
| 28 | `detran_tut_002_101` | TUT_002 — Alegue a necessidade de revogação da tutela já con | `detran_tutela_urgencia` |
| 29 | `detran_tut_003_102` | TUT_003 — Alegue a impossibilidade técnica de cumprimento da | `detran_tutela_urgencia` |

## Modulos com Filtro `detran_tipo_acao` (69 total)

### 44 modulos ja existentes com filtro (inalterados)

| # | Modulo | Tipos de acao |
|---|--------|--------------|
| 1 | `detran_prel_001_001` | `['multa']` |
| 2 | `detran_prel_002_004` | `['transferencia_registro']` |
| 3 | `detran_prel_005_007` | `['pontuacao_cnh']` |
| 4 | `detran_prel_025_010` | `['suspensao_cnh']` |
| 5 | `detran_prel_006_016` | `['transferencia_registro']` |
| 6 | `detran_prel_022_017` | `['suspensao_cnh', 'cassacao_cnh']` |
| 7 | `detran_prel_014_026` | `['multa']` |
| 8 | `detran_prel_008_027` | `['suspensao_cnh', 'cassacao_cnh']` |
| 9 | `detran_prel_026_029` | `['transferencia_registro']` |
| 10 | `detran_adm_011_033` | `['transferencia_registro']` |
| 11 | `detran_adm_005_034` | `['suspensao_cnh', 'cassacao_cnh']` |
| 12 | `detran_adm_012_035` | `['multa']` |
| 13 | `detran_adm_008_039` | `['multa']` |
| 14 | `detran_adm_007_040` | `['suspensao_cnh']` |
| 15 | `detran_adm_017_043` | `['bloqueio_renajud']` |
| 16 | `detran_adm_006_044` | `['multa']` |
| 17 | `detran_adm_013_045` | `['multa']` |
| 18 | `detran_adm_016_046` | `['suspensao_cnh']` |
| 19 | `detran_adm_015_047` | `['pontuacao_cnh']` |
| 20 | `detran_fat_001_048` | `['multa']` |
| 21 | `detran_fat_003_050` | `['transferencia_registro']` |
| 22 | `detran_fat_005_051` | `['ear_cnh']` |
| 23 | `detran_fat_010_053` | `['multa']` |
| 24 | `detran_fat_009_055` | `['multa']` |
| 25 | `detran_jur_003_060` | `['multa']` |
| 26 | `detran_jur_001_062` | `['multa']` |
| 27 | `detran_jur_005_064` | `['suspensao_cnh']` |
| 28 | `detran_jur_009_065` | `['transferencia_registro']` |
| 29 | `detran_jur_007_066` | `['suspensao_cnh', 'cassacao_cnh']` |
| 30 | `detran_jur_014_067` | `['transferencia_registro']` |
| 31 | `detran_jur_010_070` | `['transferencia_registro']` |
| 32 | `detran_jur_015_071` | `['transferencia_registro']` |
| 33 | `detran_jur_022_073` | `['suspensao_cnh']` |
| 34 | `detran_jur_012_077` | `['baixa_veiculo']` |
| 35 | `detran_jur_013_080` | `['baixa_veiculo']` |
| 36 | `detran_jur_028_081` | `['suspensao_cnh', 'cassacao_cnh']` |
| 37 | `detran_jur_027_082` | `['multa']` |
| 38 | `detran_jur_023_083` | `['transferencia_registro']` |
| 39 | `detran_jur_034_084` | `['ear_cnh']` |
| 40 | `detran_jur_016_085` | `['pontuacao_cnh']` |
| 41 | `detran_jur_033_089` | `['multa']` |
| 42 | `detran_dm_002_093` | `['suspensao_cnh']` |
| 43 | `detran_dmat_003_097` | `['ear_cnh']` |
| 44 | `detran_tut_001_100` | `['suspensao_cnh', 'cassacao_cnh']` |

### 21 modulos reclassificados (escopados nesta versao)

| # | Modulo | Tipos de acao adicionados |
|---|--------|--------------------------|
| 1 | `detran_prel_004_011` | `['transferencia_registro', 'isencao_ipva']` |
| 2 | `detran_prel_009_019` | `['bloqueio_renajud']` |
| 3 | `detran_adm_001_031` | `['multa', 'suspensao_cnh', 'cassacao_cnh', 'pontuacao_cnh']` |
| 4 | `detran_adm_002_032` | `['multa']` |
| 5 | `detran_adm_009_036` | `['multa']` |
| 6 | `detran_adm_014_037` | `['multa']` |
| 7 | `detran_fat_006_049` | `['suspensao_cnh', 'cassacao_cnh']` |
| 8 | `detran_fat_002_052` | `['multa', 'transferencia_registro']` |
| 9 | `detran_fat_004_054` | `['transferencia_registro']` |
| 10 | `detran_fat_007_058` | `['multa']` |
| 11 | `detran_fat_012_059` | `['transferencia_registro', 'baixa_veiculo']` |
| 12 | `detran_jur_008_061` | `['transferencia_registro']` |
| 13 | `detran_jur_004_063` | `['pontuacao_cnh']` |
| 14 | `detran_jur_006_068` | `['multa', 'suspensao_cnh', 'cassacao_cnh']` |
| 15 | `detran_jur_032_069` | `['transferencia_registro']` |
| 16 | `detran_jur_024_076` | `['transferencia_registro', 'isencao_ipva']` |
| 17 | `detran_jur_011_079` | `['transferencia_registro', 'isencao_ipva']` |
| 18 | `detran_jur_031_088` | `['transferencia_registro']` |
| 19 | `detran_jur_030_087` | `['transferencia_registro']` |
| 20 | `detran_jur_035_091` | `['multa', 'transferencia_registro', 'baixa_veiculo']` |
| 21 | `detran_dmat_005_099` | `['multa']` |

### 4 novos modulos criados

| # | Modulo | Categoria | Tipos de acao |
|---|--------|-----------|--------------|
| 1 | `detran_resp_001_095` | Merito | `['responsabilidade_civil']` |
| 2 | `detran_resp_002_096` | Merito | `['responsabilidade_civil']` |
| 3 | `detran_ipva_001_097` | Merito | `['isencao_ipva']` |
| 4 | `detran_ipva_002_098` | Merito | `['isencao_ipva']` |

## Cobertura por Tipo de Acao

### `multa` (22 modulos escopados + 29 universais)

- `detran_prel_001_001`
- `detran_prel_014_026`
- `detran_adm_001_031`
- `detran_adm_002_032`
- `detran_adm_012_035`
- `detran_adm_009_036`
- `detran_adm_014_037`
- `detran_adm_008_039`
- `detran_adm_006_044`
- `detran_adm_013_045`
- `detran_fat_001_048`
- `detran_fat_002_052`
- `detran_fat_010_053`
- `detran_fat_009_055`
- `detran_fat_007_058`
- `detran_jur_003_060`
- `detran_jur_001_062`
- `detran_jur_006_068`
- `detran_jur_027_082`
- `detran_jur_033_089`
- `detran_jur_035_091`
- `detran_dmat_005_099`

### `suspensao_cnh` (17 modulos escopados + 29 universais)

- `detran_prel_025_010`
- `detran_prel_022_017`
- `detran_prel_008_027`
- `detran_adm_001_031`
- `detran_adm_005_034`
- `detran_adm_008_039`
- `detran_adm_007_040`
- `detran_adm_006_044`
- `detran_adm_016_046`
- `detran_fat_006_049`
- `detran_jur_005_064`
- `detran_jur_007_066`
- `detran_jur_006_068`
- `detran_jur_022_073`
- `detran_jur_028_081`
- `detran_dm_002_093`
- `detran_tut_001_100`

### `cassacao_cnh` (11 modulos escopados + 29 universais)

- `detran_prel_022_017`
- `detran_prel_008_027`
- `detran_adm_001_031`
- `detran_adm_005_034`
- `detran_adm_008_039`
- `detran_adm_006_044`
- `detran_fat_006_049`
- `detran_jur_007_066`
- `detran_jur_006_068`
- `detran_jur_028_081`
- `detran_tut_001_100`

### `pontuacao_cnh` (6 modulos escopados + 29 universais)

- `detran_prel_005_007`
- `detran_prel_008_027`
- `detran_adm_001_031`
- `detran_adm_015_047`
- `detran_jur_004_063`
- `detran_jur_016_085`

### `ear_cnh` (5 modulos escopados + 29 universais)

- `detran_prel_005_007`
- `detran_prel_008_027`
- `detran_fat_005_051`
- `detran_jur_034_084`
- `detran_dmat_003_097`

### `transferencia_registro` (21 modulos escopados + 29 universais)

- `detran_prel_002_004`
- `detran_prel_004_011`
- `detran_prel_006_016`
- `detran_prel_026_029`
- `detran_adm_011_033`
- `detran_fat_003_050`
- `detran_fat_002_052`
- `detran_fat_004_054`
- `detran_fat_012_059`
- `detran_jur_008_061`
- `detran_jur_009_065`
- `detran_jur_014_067`
- `detran_jur_032_069`
- `detran_jur_010_070`
- `detran_jur_015_071`
- `detran_jur_024_076`
- `detran_jur_011_079`
- `detran_jur_023_083`
- `detran_jur_030_087`
- `detran_jur_031_088`
- `detran_jur_035_091`

### `baixa_veiculo` (4 modulos escopados + 29 universais)

- `detran_fat_012_059`
- `detran_jur_012_077`
- `detran_jur_013_080`
- `detran_jur_035_091`

### `bloqueio_renajud` (2 modulos escopados + 29 universais)

- `detran_prel_009_019`
- `detran_adm_017_043`

### `isencao_ipva` (5 modulos escopados + 29 universais)

- `detran_prel_004_011`
- `detran_jur_024_076`
- `detran_jur_011_079`
- `detran_ipva_001_097`
- `detran_ipva_002_098`

### `responsabilidade_civil` (2 modulos escopados + 29 universais)

- `detran_resp_001_095`
- `detran_resp_002_096`

## Tabela Completa — 98 Modulos

| # | Modulo | Categoria | Filtro tipo_acao | Status |
|---|--------|-----------|-----------------|--------|
| 1 | `detran_prel_001_001` | Preliminar | multa | Existente v3.0 |
| 2 | `detran_prel_011_002` | Preliminar | Universal (sem filtro) | Inalterado |
| 3 | `detran_prel_020_003` | Preliminar | Universal (sem filtro) | Inalterado |
| 4 | `detran_prel_002_004` | Preliminar | transferencia_registro | Existente v3.0 |
| 5 | `detran_prel_021_005` | Preliminar | Universal (sem filtro) | Inalterado |
| 6 | `detran_prel_003_006` | Preliminar | Universal (sem filtro) | Inalterado |
| 7 | `detran_prel_005_007` | Preliminar | pontuacao_cnh | Existente v3.0 |
| 8 | `detran_prel_007_008` | Preliminar | Universal (sem filtro) | Inalterado |
| 9 | `detran_prel_023_009` | Preliminar | Universal (sem filtro) | Inalterado |
| 10 | `detran_prel_025_010` | Preliminar | suspensao_cnh | Existente v3.0 |
| 11 | `detran_prel_004_011` | Preliminar | transferencia_registro, isencao_ipva | Escopado v3.1 |
| 12 | `detran_prel_016_012` | Preliminar | Universal (sem filtro) | Inalterado |
| 13 | `detran_prel_017_013` | Preliminar | Universal (sem filtro) | Inalterado |
| 14 | `detran_prel_024_014` | Preliminar | Universal (sem filtro) | Inalterado |
| 15 | `detran_prel_015_015` | Preliminar | Universal (sem filtro) | Inalterado |
| 16 | `detran_prel_006_016` | Preliminar | transferencia_registro | Existente v3.0 |
| 17 | `detran_prel_022_017` | Preliminar | suspensao_cnh, cassacao_cnh | Existente v3.0 |
| 18 | `detran_prel_010_018` | Preliminar | Universal (sem filtro) | Inalterado |
| 19 | `detran_prel_009_019` | Preliminar | bloqueio_renajud | Escopado v3.1 |
| 20 | `detran_prel_012_020` | Preliminar | Universal (sem filtro) | Inalterado |
| 21 | `detran_prel_013_021` | Preliminar | Universal (sem filtro) | Inalterado |
| 22 | `detran_prel_027_022` | Preliminar | Universal (sem filtro) | Inalterado |
| 23 | `detran_prel_028_023` | Preliminar | Universal (sem filtro) | Inalterado |
| 24 | `detran_prel_029_024` | Preliminar | Universal (sem filtro) | Inalterado |
| 25 | `detran_prel_031_025` | Preliminar | Universal (sem filtro) | Inalterado |
| 26 | `detran_prel_014_026` | Preliminar | multa | Existente v3.0 |
| 27 | `detran_prel_008_027` | Preliminar | suspensao_cnh, cassacao_cnh | Existente v3.0 |
| 28 | `detran_prel_019_028` | Preliminar | Universal (sem filtro) | Inalterado |
| 29 | `detran_prel_026_029` | Preliminar | transferencia_registro | Existente v3.0 |
| 30 | `detran_adm_001_031` | Mérito | multa, suspensao_cnh, cassacao_cnh, pontuacao_cnh | Escopado v3.1 |
| 31 | `detran_adm_002_032` | Mérito | multa | Escopado v3.1 |
| 32 | `detran_adm_011_033` | Mérito | transferencia_registro | Existente v3.0 |
| 33 | `detran_adm_005_034` | Mérito | suspensao_cnh, cassacao_cnh | Existente v3.0 |
| 34 | `detran_adm_012_035` | Mérito | multa | Existente v3.0 |
| 35 | `detran_adm_009_036` | Mérito | multa | Escopado v3.1 |
| 36 | `detran_adm_014_037` | Mérito | multa | Escopado v3.1 |
| 37 | `detran_adm_008_039` | Mérito | multa | Existente v3.0 |
| 38 | `detran_adm_007_040` | Mérito | suspensao_cnh | Existente v3.0 |
| 39 | `detran_adm_017_043` | Mérito | bloqueio_renajud | Existente v3.0 |
| 40 | `detran_adm_006_044` | Mérito | multa | Existente v3.0 |
| 41 | `detran_adm_013_045` | Mérito | multa | Existente v3.0 |
| 42 | `detran_adm_016_046` | Mérito | suspensao_cnh | Existente v3.0 |
| 43 | `detran_adm_015_047` | Mérito | pontuacao_cnh | Existente v3.0 |
| 44 | `detran_fat_001_048` | Mérito | multa | Existente v3.0 |
| 45 | `detran_fat_006_049` | Mérito | suspensao_cnh, cassacao_cnh | Escopado v3.1 |
| 46 | `detran_fat_003_050` | Mérito | transferencia_registro | Existente v3.0 |
| 47 | `detran_fat_005_051` | Mérito | ear_cnh | Existente v3.0 |
| 48 | `detran_fat_002_052` | Mérito | multa, transferencia_registro | Escopado v3.1 |
| 49 | `detran_fat_010_053` | Mérito | multa | Existente v3.0 |
| 50 | `detran_fat_004_054` | Mérito | transferencia_registro | Escopado v3.1 |
| 51 | `detran_fat_009_055` | Mérito | multa | Existente v3.0 |
| 52 | `detran_fat_011_056` | Mérito | Universal (sem filtro) | Inalterado |
| 53 | `detran_fat_008_057` | Mérito | Universal (sem filtro) | Inalterado |
| 54 | `detran_fat_007_058` | Mérito | multa | Escopado v3.1 |
| 55 | `detran_fat_012_059` | Mérito | transferencia_registro, baixa_veiculo | Escopado v3.1 |
| 56 | `detran_jur_003_060` | Mérito | multa | Existente v3.0 |
| 57 | `detran_jur_008_061` | Mérito | transferencia_registro | Escopado v3.1 |
| 58 | `detran_jur_001_062` | Mérito | multa | Existente v3.0 |
| 59 | `detran_jur_004_063` | Mérito | pontuacao_cnh | Escopado v3.1 |
| 60 | `detran_jur_005_064` | Mérito | suspensao_cnh | Existente v3.0 |
| 61 | `detran_jur_009_065` | Mérito | transferencia_registro | Existente v3.0 |
| 62 | `detran_jur_007_066` | Mérito | suspensao_cnh, cassacao_cnh | Existente v3.0 |
| 63 | `detran_jur_014_067` | Mérito | transferencia_registro | Existente v3.0 |
| 64 | `detran_jur_006_068` | Mérito | multa, suspensao_cnh, cassacao_cnh | Escopado v3.1 |
| 65 | `detran_jur_032_069` | Mérito | transferencia_registro | Escopado v3.1 |
| 66 | `detran_jur_010_070` | Mérito | transferencia_registro | Existente v3.0 |
| 67 | `detran_jur_015_071` | Mérito | transferencia_registro | Existente v3.0 |
| 68 | `detran_jur_019_072` | Mérito | Universal (sem filtro) | Inalterado |
| 69 | `detran_jur_022_073` | Mérito | suspensao_cnh | Existente v3.0 |
| 70 | `detran_jur_021_074` | Mérito | Universal (sem filtro) | Inalterado |
| 71 | `detran_jur_024_076` | Mérito | transferencia_registro, isencao_ipva | Escopado v3.1 |
| 72 | `detran_jur_012_077` | Mérito | baixa_veiculo | Existente v3.0 |
| 73 | `detran_jur_020_078` | Mérito | Universal (sem filtro) | Inalterado |
| 74 | `detran_jur_011_079` | Mérito | transferencia_registro, isencao_ipva | Escopado v3.1 |
| 75 | `detran_jur_013_080` | Mérito | baixa_veiculo | Existente v3.0 |
| 76 | `detran_jur_028_081` | Mérito | suspensao_cnh, cassacao_cnh | Existente v3.0 |
| 77 | `detran_jur_027_082` | Mérito | multa | Existente v3.0 |
| 78 | `detran_jur_023_083` | Mérito | transferencia_registro | Existente v3.0 |
| 79 | `detran_jur_034_084` | Mérito | ear_cnh | Existente v3.0 |
| 80 | `detran_jur_016_085` | Mérito | pontuacao_cnh | Existente v3.0 |
| 81 | `detran_jur_026_086` | Mérito | Universal (sem filtro) | Inalterado |
| 82 | `detran_jur_030_087` | Mérito | transferencia_registro | Escopado v3.1 |
| 83 | `detran_jur_031_088` | Mérito | transferencia_registro | Escopado v3.1 |
| 84 | `detran_jur_033_089` | Mérito | multa | Existente v3.0 |
| 85 | `detran_jur_035_091` | Mérito | multa, transferencia_registro, baixa_veiculo | Escopado v3.1 |
| 86 | `detran_dm_001_092` | Mérito | Universal (sem filtro) | Inalterado |
| 87 | `detran_dm_002_093` | Mérito | suspensao_cnh | Existente v3.0 |
| 88 | `detran_dmat_001_095` | Mérito | Universal (sem filtro) | Inalterado |
| 89 | `detran_dmat_002_096` | Mérito | Universal (sem filtro) | Inalterado |
| 90 | `detran_dmat_003_097` | Mérito | ear_cnh | Existente v3.0 |
| 91 | `detran_dmat_005_099` | Eventualidade | multa | Escopado v3.1 |
| 92 | `detran_tut_001_100` | Tutela de Urgência | suspensao_cnh, cassacao_cnh | Existente v3.0 |
| 93 | `detran_tut_002_101` | Tutela de Urgência | Universal (sem filtro) | Inalterado |
| 94 | `detran_tut_003_102` | Tutela de Urgência | Universal (sem filtro) | Inalterado |
| 95 | `detran_resp_001_095` | Mérito | responsabilidade_civil | NOVO v3.1 |
| 96 | `detran_resp_002_096` | Mérito | responsabilidade_civil | NOVO v3.1 |
| 97 | `detran_ipva_001_097` | Mérito | isencao_ipva | NOVO v3.1 |
| 98 | `detran_ipva_002_098` | Mérito | isencao_ipva | NOVO v3.1 |

## Lacunas Documentadas por Tipo de Acao

| Tipo de Acao | Modulos Escopados | Observacao |
|-------------|-------------------|------------|
| `multa` | 20+ | Tipo mais coberto — multas de transito sao o contencioso mais frequente |
| `suspensao_cnh` | 15+ | Bem coberto — processos de suspensao e penalidade |
| `cassacao_cnh` | 10+ | Adequado — muitas teses compartilhadas com suspensao |
| `pontuacao_cnh` | 8+ | Adequado — inclui legalidade da pontuacao e ear |
| `ear_cnh` | 5+ | Minimo — EAR (exame de aptidao para reciclagem) e especifico |
| `transferencia_registro` | 20+ | Bem coberto — segundo tipo mais frequente |
| `baixa_veiculo` | 5+ | Adequado — poucos modulos especificos necessarios |
| `bloqueio_renajud` | 3+ | Minimo mas adequado — tese principal e a ilegitimidade |
| `isencao_ipva` | 6+ | Novo — 2 modulos novos (ipva_001, ipva_002) + 3 reclassificados |
| `responsabilidade_civil` | 2 | Novo — resp_001 (excludente) e resp_002 (nexo causal). Considerar futuramente: dano moral especifico, quantum indenizatorio |
