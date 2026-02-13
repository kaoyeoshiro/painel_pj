# Contrato do Pipeline de Agentes - Gerador de Pecas

## Visao Geral

O pipeline de geracao de pecas juridicas consiste em 3 agentes sequenciais:

```
Agente 1 (Coletor TJ-MS) → Agente 2 (Detector de Modulos) → Agente 3 (Gerador de Peca)
```

Este documento define o **contrato de payload** entre cada etapa, com enfase nas regras de seguranca para documentos NATJus.

## Agente 1 → Agente 2/3: Resumo Consolidado

### Formato Esperado

O Agente 1 produz um `resumo_consolidado` (string Markdown) contendo:
- Cabecalho com dados do processo
- Dados estruturados (JSON) extraidos do XML do TJ-MS
- Resumos individuais de cada documento (JSON estruturado ou Markdown)

### Regras de Tamanho

| Campo | Limite | Justificativa |
|-------|--------|---------------|
| `resumo_consolidado` total | 200.000 chars | Evitar estouro de contexto do LLM |
| Resumo individual (JSON) | ~5.000 chars | Tamanho tipico de resumo estruturado |
| Resumo individual (MD) | ~10.000 chars | Tamanho tipico de resumo markdown |
| Documento integral | 50.000 chars | Apenas tipos especificos (ex: Laudo Pericial) |

### Documentos Integrais

Apenas documentos cujo codigo esta em `CODIGOS_TEXTO_INTEGRAL` podem ser enviados sem resumo. Atualmente:

| Codigo | Tipo | Observacao |
|--------|------|-----------|
| 8369 | Laudo Pericial | Unico tipo permitido |

**REGRA CRITICA**: Documentos NATJus (Nota Tecnica, Parecer NAT/CATES) **NUNCA** devem ser enviados como texto integral. Devem sempre passar pelo pipeline de extracao JSON.

### Guardrails Implementados

1. **Tamanho maximo para integrais**: Documentos que excedem `MAX_TEXTO_INTEGRAL_CHARS` (50.000) sao redirecionados para o pipeline de resumo normal
2. **Deteccao de NATJus integral**: `_montar_prompt_agente3` detecta e remove blocos `[DOCUMENTO INTEGRAL - NATJus/NAT/CATES]` que escaparem
3. **Tamanho maximo do resumo**: Resumo consolidado acima de `MAX_RESUMO_CONSOLIDADO_CHARS` (200.000) e truncado

## NATJus: Fluxo de Extracao

### Fluxo Normal (documento encontrado no processo)

```
TJ-MS → Agente 1 → _obter_prompt_json(doc) → CategoriaResumoJSON → resumo JSON estruturado
```

O documento NATJus passa pelo mesmo pipeline de extracao JSON que outros documentos. Se nao houver CategoriaResumoJSON configurada para o codigo, usa o pipeline de resumo Markdown padrao.

### Fluxo de Upload Manual

```
Usuario → upload PDF → _extrair_json_upload_parecer_natjus() → JSON estruturado
                                                              ↓ (se falhar)
                                                        snippet limitado (3.000 chars max)
```

Quando o JSON estruturado nao pode ser extraido do upload:
- **NAO** envia o texto integral como fallback
- Limita a um snippet de ate `_MAX_PARECER_FALLBACK_CHARS` (3.000 chars)
- Registra log de warning com `upload_id` e erro
- Registra metrica `natjus_extraction_success=False`

### Fluxo quando NATJus e obrigatorio mas ausente

```
Agente 1 → sem NATJus encontrado → evaluate_parecer_status() → parecer_required=True, parecer_found=False
    ↓
SSE: tipo='parecer_natjus_ausente' → Frontend abre modal de upload
    ↓
Opcao A: Usuario faz upload → retoma fluxo com upload
Opcao B: Usuario continua sem → modo semi-automatico obrigatorio
```

## Metricas e Observabilidade

### Logs Estruturados

| Tag | Descricao |
|-----|-----------|
| `[AGENTE1] Documento integral` | Documento enviado/rejeitado como integral |
| `[AGENTE3-GUARDRAIL]` | Guardrail acionado antes do Agente 3 |
| `[PARECER-NATJUS]` | Operacoes relacionadas a extracao de NATJus |
| `[PIPELINE] agent3_payload_size` | Tamanho do payload enviado ao Agente 3 |

### Metricas no Tracker

| Metrica | Tipo | Descricao |
|---------|------|-----------|
| `agent3_resumo_size` | int | Tamanho em chars do resumo consolidado |
| `natjus_extraction_success` | bool | Se a extracao JSON do NATJus teve sucesso |
| `natjus_extraction_error` | str | Erro da extracao (quando falha) |
| `parecer_required` | bool | Se o tipo de peca exige parecer |
| `parecer_found` | bool | Se o parecer foi encontrado |
| `parecer_source` | str | Fonte: process_docs, user_upload, none |

## Incidente de Referencia

**Data**: 2026-02-06
**Processo**: 0828724-58.2025.8.12.0110

**Problema**: Codigos NATJus eram adicionados a `codigos_texto_integral` no construtor do `AgenteTJMS`, causando envio do texto integral (ate 150K chars) ao Agente 3.

**Causa raiz**: Linha `self.codigos_texto_integral.update(obter_codigos_nat_configurados(db_session))` adicionava codigos NATJus ao set de documentos integrais.

**Correcao**: Remocao da linha. NATJus agora passa pelo pipeline JSON normal. Adicionados guardrails de tamanho em multiplas camadas.

## Testes

Arquivo: `tests/test_natjus_guardrails.py` (21 testes)

Cobertura:
- NATJus nao esta em codigos_texto_integral
- Guardrail de tamanho para integrais
- Deteccao e remocao de NATJus integral no prompt do Agente 3
- Fallback de upload limitado
- Regressao: outros tipos de documento nao afetados
- Constantes de limite definidas corretamente
