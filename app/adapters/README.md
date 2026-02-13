# Adapters - Camada de Adaptação (Ports & Adapters)

Esta camada implementa o padrão **Ports & Adapters** (também conhecido como **Hexagonal Architecture**) para desacoplar os módulos de domínio das implementações concretas de serviços externos.

## Visão Geral

Os **adapters** são wrappers finos sobre os serviços legados que implementam as interfaces (protocols) definidas em `app/domain/shared/protocols.py`.

Isso permite que:
- Módulos de domínio dependam apenas de abstrações (protocols)
- Serviços concretos possam ser substituídos sem alterar o domínio
- Testes fiquem mais simples (mock apenas a interface, não o serviço)
- Código fique mais modular e manutenível

## Adaptadores Disponíveis

### 1. GeminiAdapter

**Interface**: `AIServiceProtocol`

**Wrapper sobre**: `services.gemini_service.GeminiService`

**Uso**:
```python
from app.adapters import GeminiAdapter

gemini = GeminiAdapter()

# Geração simples
texto = await gemini.gerar_texto(
    prompt="Resuma este documento...",
    modelo="flash",
    temperatura=0.7
)

# Geração em streaming
async for chunk in gemini.gerar_streaming(
    prompt="Gere um relatório...",
    modelo="pro"
):
    print(chunk, end="", flush=True)
```

**Métodos**:
- `gerar_texto(prompt, modelo, temperatura, max_tokens, **kwargs) -> str`
- `gerar_streaming(prompt, modelo, temperatura, max_tokens, **kwargs) -> AsyncGenerator[str, None]`

### 2. TJMSAdapter

**Interface**: `TJMSClientProtocol`

**Wrapper sobre**: `services.tjms.client.TJMSClient`

**Uso**:
```python
from app.adapters import TJMSAdapter

tjms = TJMSAdapter()

# Consultar processo
processo = await tjms.consultar_processo("0808281-22.2025.8.12.0002")
# Retorna: Dict[str, Any] com dados do XML parseado

# Baixar documento
pdf_bytes = await tjms.baixar_documento(
    codigo_documento=8369,  # Laudo Pericial
    numero_cnj="0808281-22.2025.8.12.0002"
)
# Retorna: bytes do PDF
```

**Métodos**:
- `consultar_processo(numero_cnj, **kwargs) -> Dict[str, Any]`
- `baixar_documento(codigo_documento, numero_cnj, **kwargs) -> bytes`

### 3. BertAdapter

**Interface**: `DocumentClassifierProtocol`

**Wrapper sobre**: `sistemas.extrator_autos.services_bert_client.BertClassifierClient`

**Uso**:
```python
from app.adapters import BertAdapter

bert = BertAdapter()

# Classificar documento
resultado = await bert.classificar(
    texto="Vem a Fazenda apresentar contestação...",
    model_name="model_run_5",
    threshold=0.5
)

# Retorna:
# {
#     "categoria": "contestacao",
#     "confianca": 0.95,
#     "alternativas": [],
#     "fonte": "http",
#     "erro": None
# }
```

**Métodos**:
- `classificar(texto, model_name, threshold) -> Dict[str, Any]`

## Vantagens da Arquitetura

### 1. Desacoplamento

**Antes** (acoplamento direto):
```python
# módulo de domínio
from services.gemini_service import GeminiService

class MeuService:
    def __init__(self):
        self.gemini = GeminiService()  # dependência concreta
```

**Depois** (inversão de dependência):
```python
# módulo de domínio
from app.domain.shared.protocols import AIServiceProtocol

class MeuService:
    def __init__(self, ai_service: AIServiceProtocol):
        self.ai_service = ai_service  # dependência abstrata
```

### 2. Testabilidade

**Mock simples**:
```python
class MockAI:
    """Mock que implementa AIServiceProtocol."""
    async def gerar_texto(self, prompt, **kwargs):
        return "Texto mockado"

# Teste
service = MeuService(ai_service=MockAI())
result = await service.processar()
assert result == "Texto mockado"
```

### 3. Substituibilidade

Trocar implementação é trivial:
```python
# Produção
from app.adapters import GeminiAdapter
service = MeuService(ai_service=GeminiAdapter())

# Testes
from tests.mocks import MockAI
service = MeuService(ai_service=MockAI())

# Outra IA
from app.adapters import OpenRouterAdapter
service = MeuService(ai_service=OpenRouterAdapter())
```

## Padrões e Convenções

### Import Lazy

Os adapters usam **import lazy** para evitar ciclos de dependência:

```python
class GeminiAdapter:
    def __init__(self):
        # Import DENTRO do método, não no topo do arquivo
        from services.gemini_service import GeminiService
        self._service = GeminiService()
```

Isso permite:
- Testar adapters sem ter os serviços instalados
- Evitar ciclos de import entre módulos
- Carregar serviços apenas quando necessário

### Mapeamento de Parâmetros

Adapters traduzem entre a interface do protocol e a API do serviço real:

```python
# Protocol define: max_tokens
# GeminiService também usa: max_tokens

async def gerar_texto(self, max_tokens=None, **kwargs):
    response = await self._service.generate(
        max_tokens=max_tokens,
        **kwargs
    )
```

### Conversão de Tipos

Adapters podem converter tipos de retorno:

```python
# TJMSClient retorna: ProcessoTJMS (Pydantic model)
# Protocol define: Dict[str, Any]

async def consultar_processo(self, numero_cnj):
    processo = await self._client.consultar_processo(numero_cnj)
    return processo.model_dump()  # Pydantic → dict
```

## Testes

Todos os adapters têm testes unitários em `tests/test_adapters.py`.

**Executar testes**:
```bash
pytest tests/test_adapters.py -v
```

**Cobertura dos testes**:
- ✅ Instanciação sem erro
- ✅ Implementação dos protocols
- ✅ Métodos principais (gerar_texto, consultar_processo, classificar)
- ✅ Casos de erro (falha de API, confiança baixa, etc)
- ✅ Passagem de parâmetros (model_name, threshold, etc)

## Futuras Expansões

Novos adapters podem ser adicionados para:
- **OpenRouter** (IA alternativa)
- **ESAJ** (scraping de tribunais)
- **OCR** (extração de texto de imagens)
- **Armazenamento** (S3, Azure Blob, etc)

**Template para novo adapter**:
```python
"""Adaptador para ServiçoX - implementa ProtocoloY."""

from app.domain.shared.protocols import ProtocoloY

class ServicoXAdapter(ProtocoloY):
    """Wrapper sobre ServiçoXClient."""

    def __init__(self, **kwargs):
        from caminho.para.servico import ServiçoXClient
        self._client = ServiçoXClient(**kwargs)

    async def metodo_do_protocolo(self, param1, param2):
        result = await self._client.metodo_real(param1, param2)
        return self._converter(result)
```

## Referências

- [Hexagonal Architecture (Ports & Adapters)](https://alistair.cockburn.us/hexagonal-architecture/)
- [Dependency Inversion Principle (SOLID)](https://en.wikipedia.org/wiki/Dependency_inversion_principle)
- [Python Protocols (PEP 544)](https://peps.python.org/pep-0544/)
