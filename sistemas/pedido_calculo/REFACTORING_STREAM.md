# Refatoração do Streaming de Pedido de Cálculo

## Resumo

Extração da lógica de streaming do router para um service testável, seguindo os princípios SOLID e melhorando a manutenibilidade do código.

## Arquivos Criados

### `sistemas/pedido_calculo/services_stream.py`
Service dedicado ao processamento em streaming de pedidos de cálculo.

**Responsabilidades:**
- Orquestrar o pipeline completo de processamento
- Emitir eventos SSE formatados
- Salvar histórico no banco de dados

**Classe principal:** `PedidoCalculoStreamService`

**Métodos públicos:**
- `processar_stream()`: Generator principal que emite eventos SSE
- `_emit_event()`: Emite evento genérico
- `_emit_agent_status()`: Emite status de agente
- `_emit_info()`: Emite mensagem informativa
- `_emit_error()`: Emite mensagem de erro
- `_emit_dados_processo()`: Emite informações do processo
- `_emit_dados_extracao()`: Emite dados extraídos pela IA
- `_salvar_historico_sync()`: Salva geração no histórico (síncrono)

### `tests/test_pedido_calculo_stream.py`
Suite de testes unitários para o service de streaming.

**Cobertura:**
- Inicialização do service com dependências
- Formato dos eventos SSE (JSON válido)
- Emissão de status de agentes
- Emissão de dados do processo
- Emissão de dados extraídos
- Tratamento de erros (processo não encontrado, erro na análise XML)

**Resultado:** 8 testes passando ✅

## O Que Foi Extraído

### ✅ Completamente Extraído

1. **Formato de eventos SSE**: Métodos helpers para gerar eventos JSON formatados
2. **Emissão de informações do processo**: Lógica de formatação dos dados do Agente 1
3. **Emissão de dados de extração**: Lógica de formatação dos dados do Agente 2
4. **Salvamento no histórico**: Lógica de criação/atualização de registros no banco
5. **Estrutura de erro handling**: Emissão de eventos de erro com formato consistente

### ⚠️ Parcialmente Extraído (TODOs)

As seguintes lógicas **permaneceram no router** devido à complexidade e risco de regressão:

1. **Lógica de cumprimento autônomo** (linhas 490-632 do router)
   - Busca recursiva do processo de origem
   - Atualização de dados do Agente 1 com informações da origem
   - Detecção de loops em processos encadeados
   - **Motivo:** Lógica muito complexa com múltiplas variáveis de estado compartilhado

2. **Download de documentos** (linhas 633-762 do router)
   - Download paralelo de múltiplos documentos
   - Classificação de documentos (planilha vs petição)
   - Extração de texto e contagem de caracteres
   - **Motivo:** Dependências de variáveis locais e lógica de decisão complexa

3. **Análise de certidões com IA** (linhas 764-866 do router)
   - Análise paralela de certidões candidatas
   - Identificação da certidão correta com IA
   - Fallback para heurística quando IA falha
   - **Motivo:** Lógica de decisão com múltiplos caminhos alternativos

4. **Coleta de documentos baixados** (linhas 943-1093 do router)
   - Construção da lista de documentos baixados
   - Classificação por tipo (processo principal vs origem)
   - Metadados de classificação da IA
   - **Motivo:** Dependências de variáveis locais do pipeline

## Próximas Etapas (Recomendadas)

### Fase 2: Extrair Lógica de Cumprimento Autônomo

1. Criar `services_cumprimento_autonomo.py`
2. Extrair método `buscar_processo_origem_recursivo()`
3. Extrair método `atualizar_dados_origem()`
4. Testes focados em casos de cumprimento autônomo

### Fase 3: Extrair Lógica de Download

1. Criar `services_download.py`
2. Extrair método `baixar_documentos_completo()`
3. Extrair método `classificar_documentos()`
4. Testes de download com mocks do TJ-MS

### Fase 4: Extrair Análise de Certidões

1. Criar `services_certidoes.py`
2. Extrair método `analisar_certidoes_ia()`
3. Extrair método `identificar_certidao_correta()`
4. Testes de análise de certidões

### Fase 5: Integração Final

1. Atualizar `services_stream.py` para usar os novos services
2. Remover código duplicado do router
3. Router fica "thin": apenas validação de input e chamada ao service
4. Suite de testes de integração end-to-end

## Benefícios Imediatos

1. **Testabilidade**: Lógica de emissão de eventos SSE agora testável sem HTTP
2. **Separação de Responsabilidades**: Service focado em streaming, router focado em HTTP
3. **Reutilização**: Métodos de formatação de eventos podem ser reusados
4. **Manutenibilidade**: Lógica de negócio isolada facilita mudanças futuras
5. **Documentação**: Código mais legível com responsabilidades claras

## Princípios SOLID Aplicados

- **S (Single Responsibility)**: Service tem uma única responsabilidade (streaming)
- **O (Open/Closed)**: Métodos de emissão de eventos extensíveis via herança
- **D (Dependency Inversion)**: Service depende de abstrações (Session, User, PedidoCalculoService)

## Impacto no Router

O router `router.py` **NÃO foi modificado** nesta fase para evitar riscos de regressão.

**Próximo passo seguro:**
1. Criar novo endpoint experimental `/processar-stream-v2` usando o service
2. Testar em paralelo com o endpoint original
3. Quando estável, deprecar endpoint antigo
4. Remover código duplicado do router

## Como Usar o Novo Service

```python
from sistemas.pedido_calculo.services_stream import PedidoCalculoStreamService
from sistemas.pedido_calculo.services import PedidoCalculoService

# No router
@router.post("/processar-stream-v2")
async def processar_stream_v2(
    req: ProcessarStreamRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Cria services
    pedido_service = PedidoCalculoService(logger=create_logger())
    stream_service = PedidoCalculoStreamService(
        db=db,
        user=current_user,
        service=pedido_service,
        numero_cnj=req.numero_cnj,
        sobrescrever_existente=req.sobrescrever_existente,
    )

    # Retorna streaming response
    return StreamingResponse(
        stream_service.processar_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
```

## Testes

Rodar testes:
```bash
pytest tests/test_pedido_calculo_stream.py -v
```

Resultado esperado:
```
8 passed in 0.77s
```

## Notas Técnicas

### Por que `_salvar_historico_sync()` em vez de async?

- Generator assíncrono não pode usar `return` com valor
- Método síncrono retorna tupla `(geracao_id, mensagem)`
- Generator chama o método e emite o evento separadamente

### Por que alguns TODOs no código?

- Refatoração incremental minimiza risco de regressão
- Lógica complexa requer análise detalhada antes de extração
- Testes atuais validam a estrutura, futuras extrações terão testes dedicados

## Autor

Time T4-PedidoCalculoStream - Refatoração Backend Portal PGE
Data: 2026-02-12
