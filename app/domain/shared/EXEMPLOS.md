# Exemplos de Uso - app/domain/shared

Este arquivo contém exemplos práticos de como usar os tipos e protocolos compartilhados.

## 1. Usando NewTypes para Type Safety

```python
from app.domain.shared import ProcessoNumero, DocumentoId

# ✅ CORRETO: Criar instâncias de NewTypes
numero_processo = ProcessoNumero("08043300920248120017")
doc_id = DocumentoId(8369)

# ✅ CORRETO: Usar em funções
def consultar_processo(numero: ProcessoNumero) -> dict:
    """Type checker garante que numero é realmente um ProcessoNumero"""
    return {"numero": numero, "status": "ativo"}

# ❌ ERRO: Type checker vai reclamar
consultar_processo("08043300920248120017")  # mypy error: Expected ProcessoNumero

# ✅ CORRETO: Converter explicitamente
consultar_processo(ProcessoNumero("08043300920248120017"))
```

## 2. Usando TypeAliases para Estruturas

```python
from app.domain.shared import JsonExtraido, VariaveisProcesso, ConfigIA

# ✅ CORRETO: Type hints em funções
def processar_extracao(dados: JsonExtraido) -> VariaveisProcesso:
    """
    Processa dados extraídos e retorna variáveis.

    Type checker sabe que ambos são Dict[str, Any],
    mas semanticamente são diferentes.
    """
    variaveis: VariaveisProcesso = {
        "municipio": dados.get("municipio"),
        "valor": dados.get("valor_causa"),
    }
    return variaveis

# ✅ CORRETO: Usar em classes
class ExtractorService:
    def __init__(self, config: ConfigIA):
        self.modelo = config.get("modelo", "gemini-1.5-pro")
        self.temperatura = config.get("temperatura", 0.7)
```

## 3. Usando Protocols para Dependency Injection

```python
from app.domain.shared import AIServiceProtocol, TJMSClientProtocol
from typing import Protocol

# ✅ CORRETO: Aceitar protocolo em vez de classe concreta
class GeradorPecasService:
    def __init__(
        self,
        ai_service: AIServiceProtocol,  # Qualquer serviço de IA
        tjms_client: TJMSClientProtocol  # Qualquer cliente TJ-MS
    ):
        self.ai = ai_service
        self.tjms = tjms_client

    async def gerar_peca(self, prompt: str) -> str:
        """Usa interface abstrata, não implementação concreta"""
        return await self.ai.gerar_texto(prompt)

# ✅ CORRETO: Injetar implementação real
from services.gemini_service import gemini_service
from services.tjms.client import TJMSClient

gerador = GeradorPecasService(
    ai_service=gemini_service,  # GeminiService implementa AIServiceProtocol
    tjms_client=TJMSClient()    # TJMSClient implementa TJMSClientProtocol
)

# ✅ CORRETO: Injetar mock em testes
class MockAIService:
    async def gerar_texto(self, prompt: str, **kwargs) -> str:
        return "Texto mockado"

    async def gerar_streaming(self, prompt: str, **kwargs):
        yield "Chunk 1"
        yield "Chunk 2"

gerador_teste = GeradorPecasService(
    ai_service=MockAIService(),  # Mock implementa AIServiceProtocol
    tjms_client=mock_tjms
)
```

## 4. Criando Novos Protocolos

```python
from typing import Protocol, Any, Dict

# ✅ CORRETO: Protocol para repositório
class RepositoryProtocol(Protocol):
    """Interface para repositórios de dados"""

    async def save(self, entity: Any) -> int:
        """Salva entidade e retorna ID"""
        ...

    async def get_by_id(self, id: int) -> Dict[str, Any] | None:
        """Busca por ID"""
        ...

    async def delete(self, id: int) -> bool:
        """Remove entidade"""
        ...

# ✅ CORRETO: Usar em serviço
class ProcessoService:
    def __init__(self, repo: RepositoryProtocol):
        self.repo = repo

    async def criar_processo(self, dados: dict) -> int:
        return await self.repo.save(dados)
```

## 5. Quando NÃO Usar

```python
# ❌ ERRADO: Usar NewType para valores simples
from app.domain.shared import ProcessoNumero

def calcular_taxa(valor: float) -> float:
    # NÃO criar TaxaValor = NewType("TaxaValor", float)
    # Usar float diretamente é mais simples
    return valor * 0.1

# ❌ ERRADO: Usar Protocol para classe concreta
from app.domain.shared import AIServiceProtocol

class GeminiService:
    # NÃO precisa herdar de Protocol
    # Protocol é apenas para type hints, não herança
    async def gerar_texto(self, prompt: str) -> str:
        ...

# ✅ CORRETO: GeminiService implementa implicitamente
def usar_ai(service: AIServiceProtocol):
    # service pode ser GeminiService, MockAI, etc.
    # Sem necessidade de herança explícita
    pass
```

## 6. Padrões de Migração

### Antes (sem tipos compartilhados)
```python
# sistemas/gerador_pecas/services.py
from services.gemini_service import GeminiService  # Acoplamento forte

class GeradorService:
    def __init__(self):
        self.gemini = GeminiService()  # Instanciação direta
```

### Depois (com tipos compartilhados)
```python
# sistemas/gerador_pecas/services.py
from app.domain.shared import AIServiceProtocol  # Apenas interface

class GeradorService:
    def __init__(self, ai_service: AIServiceProtocol):  # Inversão de dependência
        self.ai = ai_service

# sistemas/gerador_pecas/router.py (injeção)
from services.gemini_service import gemini_service

gerador = GeradorService(ai_service=gemini_service)
```

## 7. Testando com Protocols

```python
# tests/test_gerador_service.py
import pytest
from app.domain.shared import AIServiceProtocol

class FakeAIService:
    """Mock simples que implementa AIServiceProtocol"""

    def __init__(self, response: str = "Resposta fake"):
        self.response = response
        self.calls = []

    async def gerar_texto(self, prompt: str, **kwargs) -> str:
        self.calls.append(("gerar_texto", prompt, kwargs))
        return self.response

    async def gerar_streaming(self, prompt: str, **kwargs):
        for char in self.response:
            yield char

@pytest.mark.asyncio
async def test_gerador_service():
    # ✅ CORRETO: Mock implementa protocolo
    fake_ai = FakeAIService(response="Peça jurídica fake")
    gerador = GeradorService(ai_service=fake_ai)

    resultado = await gerador.gerar_peca("prompt teste")

    assert resultado == "Peça jurídica fake"
    assert len(fake_ai.calls) == 1
    assert fake_ai.calls[0][1] == "prompt teste"
```

## Referências

- [PEP 544 - Protocols](https://peps.python.org/pep-0544/)
- [PEP 484 - Type Hints](https://peps.python.org/pep-0484/)
- [typing.NewType](https://docs.python.org/3/library/typing.html#newtype)
- [typing.Protocol](https://docs.python.org/3/library/typing.html#typing.Protocol)
