# Guia de Migração - Módulo SSE Comum

> **Data**: 2026-02-12
> **Autor**: LAB/PGE-MS
> **Status**: Opcional (não obrigatório)

## Introdução

Este guia mostra como migrar código existente que usa formatação inline de eventos SSE para o novo módulo `services/shared/sse.py`.

**IMPORTANTE**: Esta migração é OPCIONAL. O código existente continua funcionando perfeitamente.

## Estratégia de Migração

### Opção 1: Migração Gradual (Recomendada)

Migre apenas quando:
1. Criar novo endpoint SSE
2. Refatorar endpoint existente
3. Corrigir bug relacionado a SSE

**Não force migração de código estável.**

### Opção 2: Migração em Batch

Se decidir migrar múltiplos endpoints de uma vez:
1. Escolha um sistema por vez (ex: pedido_calculo)
2. Rode os testes antes e depois
3. Valide funcionamento manual
4. Commit incremental

---

## Passo a Passo: Migrando um Endpoint

### 1. Identificar Padrões

Busque por padrões inline como:
```python
yield f"data: {json.dumps({'tipo': 'info', 'mensagem': '...'})}\n\n"
yield f"data: {json.dumps({'tipo': 'agente', ...})}\n\n"
```

### 2. Adicionar Import

No topo do arquivo:
```python
from services.shared import SSEEventFormatter
```

### 3. Substituir Formatações

Use tabela de conversão abaixo.

### 4. Testar

```bash
pytest tests/test_<seu_sistema>.py -v
```

### 5. Validar Manual

Rode o servidor e teste o endpoint via frontend.

---

## Tabela de Conversão

| Padrão Antigo | Padrão Novo |
|---------------|-------------|
| `f"data: {json.dumps({'tipo': 'info', 'mensagem': msg})}\n\n"` | `SSEEventFormatter.info(msg)` |
| `f"data: {json.dumps({'tipo': 'inicio', 'mensagem': msg})}\n\n"` | `SSEEventFormatter.inicio(msg)` |
| `f"data: {json.dumps({'tipo': 'erro', 'mensagem': msg})}\n\n"` | `SSEEventFormatter.error(msg)` |
| `f"data: {json.dumps({'tipo': 'sucesso', ...})}\n\n"` | `SSEEventFormatter.success({...})` |
| `f"data: {json.dumps({'tipo': 'chunk', 'content': txt})}\n\n"` | `SSEEventFormatter.chunk(txt)` |
| `f"data: {json.dumps({'tipo': 'agente', 'agente': n, 'status': s, 'mensagem': m})}\n\n"` | `SSEEventFormatter.agent_status(n, s, m)` |

---

## Exemplo Real: pedido_calculo/services_stream.py

### ANTES (linhas 220-234)

```python
def _emit_event(self, tipo: str, mensagem: str) -> str:
    """Emite evento genérico."""
    return f"data: {json.dumps({'tipo': tipo, 'mensagem': mensagem})}\n\n"

def _emit_agent_status(self, agente: int, status: str, mensagem: str) -> str:
    """Emite status de agente."""
    return f"data: {json.dumps({'tipo': 'agente', 'agente': agente, 'status': status, 'mensagem': mensagem})}\n\n"

def _emit_info(self, mensagem: str) -> str:
    """Emite mensagem informativa."""
    return f"data: {json.dumps({'tipo': 'info', 'mensagem': mensagem})}\n\n"

def _emit_error(self, mensagem: str) -> str:
    """Emite mensagem de erro."""
    return f"data: {json.dumps({'tipo': 'erro', 'mensagem': mensagem})}\n\n"
```

### DEPOIS (refatorado)

```python
from services.shared import SSEEventFormatter

def _emit_event(self, tipo: str, mensagem: str) -> str:
    """Emite evento genérico."""
    return SSEEventFormatter.format(tipo, {"mensagem": mensagem})

def _emit_agent_status(self, agente: int, status: str, mensagem: str) -> str:
    """Emite status de agente."""
    return SSEEventFormatter.agent_status(agente, status, mensagem)

def _emit_info(self, mensagem: str) -> str:
    """Emite mensagem informativa."""
    return SSEEventFormatter.info(mensagem)

def _emit_error(self, mensagem: str) -> str:
    """Emite mensagem de erro."""
    return SSEEventFormatter.error(mensagem)
```

**Vantagens**:
- Menos código repetido
- Formatação padronizada
- Mais fácil de testar

**Compatibilidade**: 100% compatível (saída idêntica)

---

## Exemplo Real: classificador_documentos/router.py

### ANTES (linha 457)

```python
async for evento in service.executar_projeto(...):
    yield f"data: {json.dumps(evento, ensure_ascii=False)}\n\n"
```

### DEPOIS (se evento já tem estrutura completa)

```python
from services.shared import SSEEventFormatter

async for evento in service.executar_projeto(...):
    # Se evento já tem 'tipo' e outros campos, use format() diretamente
    yield SSEEventFormatter.format(evento["tipo"], {k: v for k, v in evento.items() if k != "tipo"})
```

**Nota**: Este caso é mais complexo pois o evento já vem montado do service. Considere refatorar o service para retornar eventos usando SSEEventFormatter internamente.

---

## Exemplo Real: gerador_pecas/router.py

### ANTES (linha 851)

```python
yield f"data: {json.dumps({'tipo': 'inicio', 'mensagem': 'Iniciando processamento...', 'request_id': tracker.request_id})}\n\n"
```

### DEPOIS

```python
from services.shared import SSEEventFormatter

yield SSEEventFormatter.format("inicio", {
    "mensagem": "Iniciando processamento...",
    "request_id": tracker.request_id
})
```

**OU**, se quiser criar método específico:

```python
def _emit_inicio_com_request_id(mensagem: str, request_id: str) -> str:
    return SSEEventFormatter.format("inicio", {
        "mensagem": mensagem,
        "request_id": request_id
    })

# Uso:
yield _emit_inicio_com_request_id("Iniciando processamento...", tracker.request_id)
```

---

## Checklist de Migração

Ao migrar um arquivo:

- [ ] Adicionar import `from services.shared import SSEEventFormatter`
- [ ] Substituir formatações inline pelos métodos do formatter
- [ ] Rodar testes do módulo: `pytest tests/test_<modulo>.py -v`
- [ ] Validar manualmente via frontend (se aplicável)
- [ ] Verificar logs do servidor (nenhum erro de formatação)
- [ ] Commit com mensagem descritiva: `refactor: migra [módulo] para SSEEventFormatter comum`

---

## Armadilhas Comuns

### 1. Evento com campos extras além de 'mensagem'

**❌ Errado**:
```python
# Evento original: {'tipo': 'info', 'mensagem': 'teste', 'extra': 123}
yield SSEEventFormatter.info("teste")  # Perde o campo 'extra'
```

**✅ Correto**:
```python
yield SSEEventFormatter.format("info", {
    "mensagem": "teste",
    "extra": 123
})
```

---

### 2. Evento de agente com campos adicionais

**❌ Errado**:
```python
# Original: {'tipo': 'agente', 'agente': 1, 'status': 'ativo', 'mensagem': 'test', 'progress': 0.5}
yield SSEEventFormatter.agent_status(1, "ativo", "test")  # Perde 'progress'
```

**✅ Correto**:
```python
yield SSEEventFormatter.format("agente", {
    "agente": 1,
    "status": "ativo",
    "mensagem": "test",
    "progress": 0.5
})
```

---

### 3. ensure_ascii=False

**Não precisa se preocupar**: O módulo já usa `ensure_ascii=False` por padrão em todos os métodos.

```python
# Ambos preservam unicode corretamente:
old = f"data: {json.dumps({'tipo': 'info', 'mensagem': 'análise'}, ensure_ascii=False)}\n\n"
new = SSEEventFormatter.info("análise")
```

---

## Testes Após Migração

### Teste Unitário

```python
def test_evento_migrado():
    """Verifica que migração mantém compatibilidade."""
    # Padrão antigo
    import json
    old = f"data: {json.dumps({'tipo': 'info', 'mensagem': 'teste'})}\n\n"

    # Padrão novo
    from services.shared import SSEEventFormatter
    new = SSEEventFormatter.info("teste")

    # JSON deve ser equivalente
    old_json = json.loads(old.replace("data: ", "").strip())
    new_json = json.loads(new.replace("data: ", "").strip())

    assert old_json == new_json
```

### Teste de Integração

```python
@pytest.mark.asyncio
async def test_endpoint_sse_apos_migracao(client):
    """Testa endpoint SSE após migração."""
    async with client.stream("POST", "/api/processar", json={...}) as response:
        eventos = []
        async for line in response.aiter_lines():
            if line.startswith("data: "):
                eventos.append(json.loads(line.replace("data: ", "")))

        # Validações
        assert eventos[0]["tipo"] == "inicio"
        assert eventos[-1]["tipo"] == "sucesso"
```

---

## Quando NÃO Migrar

**Não migre se**:
1. Código está em módulo deprecated (será removido)
2. Sistema está em feature freeze (aguardando release)
3. Não há cobertura de testes (migre junto com criação de testes)
4. Evento tem formato muito customizado (custos > benefícios)

**Regra**: Código funcionando e testado tem prioridade sobre padronização.

---

## Rollback

Se algo der errado após migração:

```bash
# Reverter último commit
git revert HEAD

# Ou desfazer mudanças específicas
git checkout HEAD~1 -- sistemas/meu_modulo/router.py
```

---

## Exemplo Completo: Migração de um Service

Veja `tests/test_sse_common.py` na classe `TestSSEIntegracao` para exemplos práticos de migração.

---

## Suporte

Dúvidas ou problemas:
1. Consulte `services/shared/SSE_USAGE_EXAMPLES.md`
2. Rode os testes de referência: `pytest tests/test_sse_common.py -v`
3. Compare com código existente em `sistemas/pedido_calculo/services_stream.py`

---

## Histórico de Migrações

| Data | Módulo | Autor | Status |
|------|--------|-------|--------|
| 2026-02-12 | módulo SSE criado | T10 | ✅ Completo |
| - | - | - | - |

**Nota**: Adicione entradas conforme módulos forem migrados.
