# Exemplos de Uso - Módulo SSE Comum

> **Data**: 2026-02-12
> **Autor**: LAB/PGE-MS

## Visão Geral

O módulo `services/shared/sse.py` fornece abstrações reutilizáveis para Server-Sent Events (SSE), padronizando a formatação de eventos entre diferentes sistemas do Portal PGE.

**IMPORTANTE**: Este módulo é para NOVA adoção — não obriga migração imediata dos services existentes.

## Importação

```python
from services.shared import SSEEventFormatter, SSEHeartbeat
```

## Casos de Uso

### 1. Evento de Status Básico

**ANTES** (padrão existente):
```python
yield f"data: {json.dumps({'tipo': 'info', 'mensagem': 'Processando documento...'}, ensure_ascii=False)}\n\n"
```

**DEPOIS** (usando SSEEventFormatter):
```python
yield SSEEventFormatter.info("Processando documento...")
```

---

### 2. Evento de Início

**ANTES**:
```python
yield f"data: {json.dumps({'tipo': 'inicio', 'mensagem': 'Iniciando processamento...'})}\n\n"
```

**DEPOIS**:
```python
yield SSEEventFormatter.inicio("Iniciando processamento...")
```

---

### 3. Status de Agente (padrão específico do projeto)

**ANTES**:
```python
yield f"data: {json.dumps({'tipo': 'agente', 'agente': 1, 'status': 'ativo', 'mensagem': 'Baixando documentos do TJ-MS...'})}\n\n"
```

**DEPOIS**:
```python
yield SSEEventFormatter.agent_status(1, "ativo", "Baixando documentos do TJ-MS...")
```

**Status comuns de agente**:
- `"ativo"` - Agente em execução
- `"concluido"` - Agente finalizou com sucesso
- `"erro"` - Agente falhou

---

### 4. Evento de Erro

**ANTES**:
```python
yield f"data: {json.dumps({'tipo': 'erro', 'mensagem': f'Erro na conexão: {str(e)}'})}\n\n"
```

**DEPOIS**:
```python
yield SSEEventFormatter.error(f"Erro na conexão: {str(e)}")
```

**Com código e detalhes**:
```python
yield SSEEventFormatter.error(
    "Timeout ao conectar ao TJ-MS",
    code="TJMS_TIMEOUT",
    details="Tempo limite de 30s excedido"
)
```

---

### 5. Evento de Sucesso/Conclusão

**ANTES**:
```python
yield f"data: {json.dumps({'tipo': 'sucesso', 'geracao_id': geracao_id, 'total': 10})}\n\n"
```

**DEPOIS**:
```python
yield SSEEventFormatter.success({
    "geracao_id": geracao_id,
    "total": 10
})
```

---

### 6. Chunks de Streaming (geração de texto)

**ANTES**:
```python
yield f"data: {json.dumps({'tipo': 'chunk', 'content': texto_parcial})}\n\n"
```

**DEPOIS**:
```python
yield SSEEventFormatter.chunk(texto_parcial)
```

---

### 7. Status com Progresso

```python
yield SSEEventFormatter.status(
    "Processando documentos",
    step="processing",
    progress=0.65  # 65%
)
```

**Resultado JSON**:
```json
{
  "tipo": "status",
  "mensagem": "Processando documentos",
  "step": "processing",
  "progress": 0.65
}
```

---

## Exemplo Completo: Migração de um Endpoint

### ANTES (padrão inline)

```python
@router.post("/processar")
async def processar_documento(request: ProcessarRequest):
    async def event_generator():
        try:
            yield f"data: {json.dumps({'tipo': 'inicio', 'mensagem': 'Iniciando...'})}\n\n"

            yield f"data: {json.dumps({'tipo': 'agente', 'agente': 1, 'status': 'ativo', 'mensagem': 'Analisando...'})}\n\n"

            resultado = await service.processar()

            yield f"data: {json.dumps({'tipo': 'agente', 'agente': 1, 'status': 'concluido', 'mensagem': 'Análise concluída'})}\n\n"

            yield f"data: {json.dumps({'tipo': 'sucesso', 'resultado_id': resultado.id})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'tipo': 'erro', 'mensagem': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

### DEPOIS (usando SSEEventFormatter)

```python
from services.shared import SSEEventFormatter

@router.post("/processar")
async def processar_documento(request: ProcessarRequest):
    async def event_generator():
        try:
            yield SSEEventFormatter.inicio("Iniciando...")

            yield SSEEventFormatter.agent_status(1, "ativo", "Analisando...")

            resultado = await service.processar()

            yield SSEEventFormatter.agent_status(1, "concluido", "Análise concluída")

            yield SSEEventFormatter.success({"resultado_id": resultado.id})
        except Exception as e:
            yield SSEEventFormatter.error(str(e))

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**Benefícios**:
- ✅ Código mais limpo e legível
- ✅ Menos chances de erro de formatação
- ✅ Padronização automática (ensure_ascii=False, formato correto)
- ✅ Facilita manutenção futura

---

## Heartbeat (para conexões longas)

Se o seu endpoint tem longos períodos de silêncio (sem enviar eventos), use heartbeat para manter a conexão ativa:

```python
from services.shared import SSEEventFormatter, SSEHeartbeat

@router.post("/processar-longo")
async def processar_longo():
    async def event_generator():
        heartbeat = SSEHeartbeat(interval_seconds=15.0)

        try:
            # Inicia heartbeat em background
            heartbeat_task = asyncio.create_task(_emit_heartbeats(heartbeat))

            yield SSEEventFormatter.inicio("Processamento longo iniciado...")

            # Operação demorada (30+ segundos)
            await asyncio.sleep(30)

            yield SSEEventFormatter.success()
        finally:
            heartbeat.stop()
            try:
                await heartbeat_task
            except asyncio.CancelledError:
                pass

    async def _emit_heartbeats(heartbeat: SSEHeartbeat):
        async for event in heartbeat.start():
            yield event

    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

**NOTA**: A maioria dos endpoints do projeto NÃO precisa de heartbeat explícito, pois o processamento é contínuo (sempre emitindo eventos). Heartbeat é útil apenas para casos com longos períodos de silêncio (>15s sem eventos).

---

## Eventos Customizados

Para eventos não cobertos pelos métodos convenientes, use `format()` diretamente:

```python
yield SSEEventFormatter.format("evento_customizado", {
    "campo1": "valor1",
    "campo2": 123,
    "campo3": True
})
```

**Resultado**:
```
data: {"tipo": "evento_customizado", "campo1": "valor1", "campo2": 123, "campo3": true}

```

---

## Validação de Compatibilidade

Para garantir compatibilidade com código existente, você pode comparar a saída:

```python
# Padrão antigo
old_format = f"data: {json.dumps({'tipo': 'info', 'mensagem': 'Teste'}, ensure_ascii=False)}\n\n"

# Novo módulo
new_format = SSEEventFormatter.info("Teste")

# Ambos produzem JSON equivalente
import json
old_data = json.loads(old_format.replace("data: ", "").strip())
new_data = json.loads(new_format.replace("data: ", "").strip())

assert old_data == new_data  # ✓
```

---

## Padrões de Tipos Comuns no Projeto

| Tipo | Uso | Método |
|------|-----|--------|
| `inicio` | Início do processamento | `SSEEventFormatter.inicio()` |
| `info` | Mensagem informativa | `SSEEventFormatter.info()` |
| `agente` | Status de agente (1, 2, 3...) | `SSEEventFormatter.agent_status()` |
| `erro` | Mensagem de erro | `SSEEventFormatter.error()` |
| `sucesso` | Conclusão com sucesso | `SSEEventFormatter.success()` |
| `chunk` | Chunk de streaming (texto) | `SSEEventFormatter.chunk()` |
| `status` | Status com progresso | `SSEEventFormatter.status()` |

---

## Quando Migrar?

**SIM** - Migre quando:
- ✅ Criar novo endpoint SSE
- ✅ Refatorar endpoint existente
- ✅ Corrigir bug em formatação SSE

**NÃO** - Não migre se:
- ❌ Código funciona e não precisa de alteração
- ❌ Endpoint é legacy e será removido em breve
- ❌ Há pressa para entregar feature crítica

**Regra de ouro**: Migração deve ser incremental e pragmática, não "big bang".

---

## Testes

Para testar seu endpoint SSE usando o novo módulo:

```python
import pytest
from services.shared import SSEEventFormatter

@pytest.mark.asyncio
async def test_meu_endpoint_sse():
    async def mock_generator():
        yield SSEEventFormatter.inicio("Teste")
        yield SSEEventFormatter.info("Processando...")
        yield SSEEventFormatter.success()

    eventos = []
    async for event in mock_generator():
        eventos.append(event)

    assert len(eventos) == 3
    assert "inicio" in eventos[0]
    assert "info" in eventos[1]
    assert "sucesso" in eventos[2]
```

---

## Referências

- **Código fonte**: `services/shared/sse.py`
- **Testes**: `tests/test_sse_common.py` (33 testes)
- **Especificação SSE**: [MDN - Server-sent events](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

---

## Dúvidas?

Consulte os exemplos existentes no projeto:
- `sistemas/pedido_calculo/services_stream.py` (usa padrão inline similar)
- `sistemas/gerador_pecas/router.py` (eventos de agente)
- `sistemas/classificador_documentos/router.py` (eventos simples)
