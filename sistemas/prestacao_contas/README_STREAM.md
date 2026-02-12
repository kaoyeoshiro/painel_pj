# Helpers de Streaming SSE - Prestação de Contas

## Visão Geral

O módulo `services_stream.py` centraliza a criação de eventos SSE (Server-Sent Events) para endpoints de streaming do sistema de prestação de contas.

## Motivação

Antes desta refatoração, eventos SSE eram criados inline nos métodos do orquestrador, misturando lógica de negócio com formatação de eventos. Este módulo extrai essa responsabilidade para helpers reutilizáveis e testáveis.

## Arquitetura

```
sistemas/prestacao_contas/
├── services_stream.py       # Helpers de formatação SSE (NOVO)
├── services.py              # Orquestrador (usa os helpers)
├── router.py                # Endpoints SSE (repassa eventos)
└── schemas.py               # Schema EventoSSE
```

## Helpers Disponíveis

### Eventos Básicos

```python
from sistemas.prestacao_contas.services_stream import (
    evento_inicio,
    evento_etapa,
    evento_progresso,
    evento_info,
    evento_aviso,
    evento_erro,
    evento_sucesso,
    evento_resultado,
    evento_fim,
)

# Início do processamento
yield evento_inicio("Iniciando análise")

# Início de uma etapa
yield evento_etapa(
    etapa=1,
    etapa_nome="Consulta XML",
    mensagem="Consultando processo...",
    progresso=10
)

# Progresso dentro de uma etapa
yield evento_progresso(
    etapa=1,
    mensagem="Processo encontrado",
    progresso=20,
    dados={"autor": "João Silva"}
)

# Informação
yield evento_info("Encontrados 5 documentos")

# Aviso
yield evento_aviso("Documento pode estar incompleto")

# Erro
yield evento_erro("Falha ao baixar documento", etapa=3)

# Sucesso
yield evento_sucesso("Documentos processados com sucesso")

# Resultado final
yield evento_resultado(
    "Análise concluída",
    dados={
        "geracao_id": 123,
        "parecer": "favoravel"
    }
)

# Fim do processamento
yield evento_fim("Processamento finalizado")
```

### Eventos Especiais

```python
from sistemas.prestacao_contas.services_stream import (
    evento_solicitar_documentos,
    evento_erro_com_fim,
)

# Solicitar documentos faltantes
yield evento_solicitar_documentos(
    "Documentos necessários para continuar",
    dados={
        "geracao_id": 456,
        "documentos_faltantes": ["extrato_subconta"]
    }
)

# Erro + Fim (helper composto)
evt_erro, evt_fim = evento_erro_com_fim("Erro crítico", etapa=2)
yield evt_erro
yield evt_fim
```

## Tipos de Eventos

O schema `EventoSSE` define 10 tipos de eventos:

| Tipo | Uso | Campos Típicos |
|------|-----|----------------|
| `inicio` | Início do processamento | mensagem |
| `etapa` | Início de uma etapa | etapa, etapa_nome, mensagem, progresso |
| `progresso` | Progresso dentro de uma etapa | etapa, mensagem, progresso, dados |
| `info` | Informação | mensagem, dados |
| `aviso` | Aviso | mensagem, dados |
| `erro` | Erro | mensagem, etapa, dados |
| `sucesso` | Sucesso | mensagem, dados |
| `resultado` | Resultado final | mensagem, dados |
| `solicitar_documentos` | Solicitar documentos | mensagem, dados |
| `fim` | Fim do processamento | mensagem, dados |

## Exemplo de Uso no Orquestrador

```python
async def processar_completo(self, numero_cnj: str) -> AsyncGenerator[EventoSSE, None]:
    """Pipeline completo com eventos SSE"""

    # Início
    yield evento_inicio("Iniciando análise")

    # Etapa 1: XML
    yield evento_etapa(1, "Consulta XML", "Consultando processo...", progresso=10)

    try:
        xml = await self._consultar_xml(numero_cnj)
        yield evento_progresso(1, "Processo encontrado", progresso=20)
    except Exception as e:
        # Erro + Fim
        evt_erro, evt_fim = evento_erro_com_fim(f"Erro ao consultar: {e}", etapa=1)
        yield evt_erro
        yield evt_fim
        return

    # Etapa 2: Documentos
    yield evento_etapa(2, "Download", "Baixando documentos...", progresso=30)
    docs = await self._baixar_documentos(xml)
    yield evento_progresso(2, f"Baixados {len(docs)} documentos", progresso=50)

    # Resultado final
    yield evento_resultado(
        "Análise concluída",
        dados={"geracao_id": 123, "parecer": "favoravel"}
    )

    # Fim
    yield evento_fim("Processamento finalizado")
```

## Testes

O módulo possui 34 testes unitários em `tests/test_prestacao_stream.py`:

```bash
# Rodar testes
pytest tests/test_prestacao_stream.py -v

# Com cobertura
pytest tests/test_prestacao_stream.py --cov=sistemas.prestacao_contas.services_stream
```

Cobertura esperada: 100% (todas as funções são testadas).

## Princípios de Design

### Single Responsibility (SOLID)
Cada função cria UM tipo de evento específico. Não há lógica de negócio misturada.

### Open/Closed
Novos tipos de eventos podem ser adicionados sem modificar os existentes. Basta criar uma nova função.

### Dependency Inversion
Os helpers dependem apenas do schema `EventoSSE` (abstração), não de implementações concretas.

### Testabilidade
Todas as funções são puras (mesmos inputs = mesmo output), facilitando testes unitários.

## Quando NÃO Usar

### Safety Nets Críticos
No router, há um safety net que formata eventos de erro inline:

```python
# router.py - NÃO MODIFICAR (safety net)
except Exception as e:
    yield f"data: {json.dumps({'tipo': 'erro', 'mensagem': str(e)}, ensure_ascii=True)}\n\n"
```

Este código DEVE permanecer inline pois:
1. Garante envio de erro mesmo se os imports falharem
2. Usa `ensure_ascii=True` para evitar problemas de encoding
3. É o último recurso antes do stream morrer

### Lógica Complexa de Orquestração
Os helpers são apenas para FORMATAÇÃO. Lógica de decisão de quando emitir eventos permanece no orquestrador.

## Migração Futura

Se mais sistemas adotarem SSE, considerar:
1. Mover helpers para `utils/sse_helpers.py` (compartilhado)
2. Criar classe `SSEEventBuilder` com métodos chainable
3. Adicionar validação de progresso (0-100)

## Changelog

### 2026-02-12 (Criação)
- Extração de helpers de `services.py`
- 34 testes unitários (100% cobertura)
- Documentação completa
- Abordagem conservadora: apenas formatação, sem lógica de negócio
