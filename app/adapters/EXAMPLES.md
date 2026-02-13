# Exemplos de Uso dos Adapters

Este documento demonstra casos de uso práticos dos adapters implementados.

## Exemplo 1: Resumir Documento com IA

### Sem Adapter (código legado, acoplado)

```python
# módulo qualquer
from services.gemini_service import GeminiService

async def resumir_documento(texto: str) -> str:
    """Gera resumo usando Gemini diretamente."""
    gemini = GeminiService()  # dependência concreta
    response = await gemini.generate(
        prompt=f"Resuma este texto:\n\n{texto}",
        model="flash",
        temperature=0.3
    )
    return response.content if response.success else ""
```

**Problemas**:
- ❌ Acoplado ao GeminiService (difícil trocar de IA)
- ❌ Difícil de testar (precisa mockar GeminiService inteiro)
- ❌ Viola SOLID (Dependency Inversion)

### Com Adapter (desacoplado)

```python
# módulo de domínio
from app.domain.shared.protocols import AIServiceProtocol

class DocumentSummarizer:
    """Resumidor de documentos - independente de IA específica."""

    def __init__(self, ai_service: AIServiceProtocol):
        self.ai_service = ai_service  # dependência abstrata

    async def resumir(self, texto: str) -> str:
        """Gera resumo usando qualquer IA que implemente o protocolo."""
        return await self.ai_service.gerar_texto(
            prompt=f"Resuma este texto:\n\n{texto}",
            modelo="flash",
            temperatura=0.3
        )
```

**Uso em produção**:
```python
from app.adapters import GeminiAdapter

summarizer = DocumentSummarizer(ai_service=GeminiAdapter())
resumo = await summarizer.resumir("Texto longo...")
```

**Uso em testes**:
```python
class MockAI:
    async def gerar_texto(self, prompt, **kwargs):
        return "Resumo mockado"

summarizer = DocumentSummarizer(ai_service=MockAI())
resumo = await summarizer.resumir("Texto longo...")
assert resumo == "Resumo mockado"  # sem chamar API real
```

**Vantagens**:
- ✅ Desacoplado (fácil trocar de IA)
- ✅ Testável (mock trivial)
- ✅ Segue SOLID (Dependency Inversion)

---

## Exemplo 2: Consultar Processo no TJ-MS

### Sem Adapter (acoplado)

```python
from services.tjms.client import TJMSClient

async def obter_dados_processo(numero_cnj: str) -> dict:
    """Consulta TJ-MS diretamente."""
    client = TJMSClient()
    processo = await client.consultar_processo(numero_cnj)
    return processo.model_dump()  # depende de modelo Pydantic
```

**Problemas**:
- ❌ Acoplado ao TJMSClient
- ❌ Depende de detalhes de implementação (model_dump)
- ❌ Difícil migrar para outro tribunal

### Com Adapter (desacoplado)

```python
from app.domain.shared.protocols import TJMSClientProtocol

class ProcessoService:
    """Serviço de processos - independente de tribunal específico."""

    def __init__(self, tjms: TJMSClientProtocol):
        self.tjms = tjms

    async def obter_dados(self, numero_cnj: str) -> dict:
        """Consulta processo usando qualquer cliente que implemente o protocolo."""
        return await self.tjms.consultar_processo(numero_cnj)
```

**Uso em produção**:
```python
from app.adapters import TJMSAdapter

service = ProcessoService(tjms=TJMSAdapter())
dados = await service.obter_dados("0808281-22.2025.8.12.0002")
```

**Uso em testes**:
```python
class MockTJMS:
    async def consultar_processo(self, numero_cnj, **kwargs):
        return {"numero": numero_cnj, "partes": ["Autor", "Réu"]}

service = ProcessoService(tjms=MockTJMS())
dados = await service.obter_dados("0808281-22.2025.8.12.0002")
assert dados["numero"] == "0808281-22.2025.8.12.0002"
```

**Vantagens**:
- ✅ Independente de tribunal
- ✅ Fácil adicionar TJ-SP, TJ-RJ, etc
- ✅ Testes não dependem de SOAP/XML

---

## Exemplo 3: Classificar Documentos com BERT

### Sem Adapter (acoplado)

```python
from sistemas.extrator_autos.services_bert_client import BertClassifierClient

async def classificar_peticao(texto: str) -> str:
    """Classifica petição usando BERT diretamente."""
    client = BertClassifierClient()
    result = await client.classify(texto, model_name="model_run_5")
    return result.get("predicted_label", "")
```

**Problemas**:
- ❌ Acoplado ao BertClassifierClient
- ❌ Difícil trocar de classificador (OpenAI, Claude, etc)
- ❌ Testes precisam de modelo BERT rodando

### Com Adapter (desacoplado)

```python
from app.domain.shared.protocols import DocumentClassifierProtocol

class PeticaoClassifier:
    """Classificador de petições - independente de modelo específico."""

    def __init__(self, classifier: DocumentClassifierProtocol):
        self.classifier = classifier

    async def classificar(self, texto: str, threshold: float = 0.7) -> str:
        """Classifica usando qualquer classificador que implemente o protocolo."""
        result = await self.classifier.classificar(
            texto=texto,
            threshold=threshold
        )
        return result["categoria"]
```

**Uso em produção**:
```python
from app.adapters import BertAdapter

classifier = PeticaoClassifier(classifier=BertAdapter())
categoria = await classifier.classificar("Vem apresentar contestação...")
# Retorna: "contestacao"
```

**Uso em testes**:
```python
class MockClassifier:
    async def classificar(self, texto, threshold=0.5):
        return {"categoria": "contestacao", "confianca": 0.95}

classifier = PeticaoClassifier(classifier=MockClassifier())
categoria = await classifier.classificar("Qualquer texto...")
assert categoria == "contestacao"
```

**Vantagens**:
- ✅ Fácil trocar de modelo (BERT → GPT → Claude)
- ✅ Testes não precisam de modelo carregado
- ✅ Configuração flexível (threshold por contexto)

---

## Exemplo 4: Pipeline Completo (Múltiplos Adapters)

### Caso Real: Extrator de Autos com IA

```python
from app.domain.shared.protocols import (
    TJMSClientProtocol,
    AIServiceProtocol,
    DocumentClassifierProtocol,
)

class ExtratorAutosService:
    """
    Pipeline de extração de autos processuais.

    Usa 3 serviços externos via adapters:
    - TJ-MS: baixar documentos
    - IA: extrair dados estruturados
    - BERT: classificar documentos
    """

    def __init__(
        self,
        tjms: TJMSClientProtocol,
        ai_service: AIServiceProtocol,
        classifier: DocumentClassifierProtocol,
    ):
        self.tjms = tjms
        self.ai = ai_service
        self.classifier = classifier

    async def extrair(self, numero_cnj: str) -> dict:
        """
        Pipeline completo:
        1. Consultar processo (TJ-MS)
        2. Baixar documentos (TJ-MS)
        3. Classificar documentos (BERT)
        4. Extrair dados (IA)
        """
        # 1. Consultar processo
        processo = await self.tjms.consultar_processo(numero_cnj)

        # 2. Baixar petição inicial (código 9500)
        pdf_bytes = await self.tjms.baixar_documento(
            codigo_documento=9500,
            numero_cnj=numero_cnj
        )

        # 3. Classificar documento
        texto = self._extrair_texto_pdf(pdf_bytes)
        classificacao = await self.classifier.classificar(texto)

        # 4. Extrair dados com IA
        if classificacao["categoria"] == "peticao_inicial":
            dados = await self._extrair_dados_peticao(texto)
        else:
            dados = await self._extrair_dados_genericos(texto)

        return {
            "processo": processo,
            "classificacao": classificacao,
            "dados_extraidos": dados,
        }

    async def _extrair_dados_peticao(self, texto: str) -> dict:
        """Usa IA para extrair dados estruturados."""
        prompt = f"""
        Extraia os seguintes dados da petição inicial:
        - Nome do autor
        - CPF/CNPJ
        - Valor da causa
        - Pedidos

        Texto:
        {texto}
        """

        resposta = await self.ai.gerar_texto(
            prompt=prompt,
            modelo="pro",
            temperatura=0.1
        )

        return self._parsear_json(resposta)

    def _extrair_texto_pdf(self, pdf_bytes: bytes) -> str:
        """Extrai texto do PDF (OCR se necessário)."""
        # Implementação simplificada
        return pdf_bytes.decode("latin1", errors="ignore")

    def _parsear_json(self, texto: str) -> dict:
        """Parseia resposta JSON da IA."""
        import json
        try:
            return json.loads(texto)
        except:
            return {}

    async def _extrair_dados_genericos(self, texto: str) -> dict:
        """Extração genérica para outros tipos de documento."""
        return {"texto": texto[:500]}  # primeiros 500 chars
```

### Uso em Produção

```python
from app.adapters import GeminiAdapter, TJMSAdapter, BertAdapter

extrator = ExtratorAutosService(
    tjms=TJMSAdapter(),
    ai_service=GeminiAdapter(),
    classifier=BertAdapter(),
)

resultado = await extrator.extrair("0808281-22.2025.8.12.0002")
print(resultado["classificacao"])  # {"categoria": "peticao_inicial", ...}
print(resultado["dados_extraidos"])  # {"nome": "João", "cpf": "123...", ...}
```

### Uso em Testes

```python
class MockTJMS:
    async def consultar_processo(self, numero_cnj, **kwargs):
        return {"numero": numero_cnj}

    async def baixar_documento(self, codigo_documento, numero_cnj, **kwargs):
        return b"PDF mockado"

class MockAI:
    async def gerar_texto(self, prompt, **kwargs):
        return '{"nome": "João Silva", "cpf": "123.456.789-00"}'

class MockClassifier:
    async def classificar(self, texto, **kwargs):
        return {"categoria": "peticao_inicial", "confianca": 0.99}

# Testes não dependem de APIs externas
extrator = ExtratorAutosService(
    tjms=MockTJMS(),
    ai_service=MockAI(),
    classifier=MockClassifier(),
)

resultado = await extrator.extrair("0808281-22.2025.8.12.0002")
assert resultado["dados_extraidos"]["nome"] == "João Silva"
```

**Vantagens do Pipeline Desacoplado**:
- ✅ **3 serviços mockados** facilmente
- ✅ **Testes rápidos** (sem API, sem SOAP, sem modelo)
- ✅ **Substituibilidade** (trocar IA: Gemini → Claude)
- ✅ **Manutenibilidade** (mudanças em TJMSClient não afetam pipeline)

---

## Padrões de Injeção de Dependência

### 1. Injeção via Construtor (Recomendado)

```python
class MeuService:
    def __init__(self, ai_service: AIServiceProtocol):
        self.ai_service = ai_service

# Uso
service = MeuService(ai_service=GeminiAdapter())
```

**Vantagens**:
- ✅ Explícito
- ✅ Testável
- ✅ Type-safe (mypy/pyright detecta erros)

### 2. Injeção via Factory (Casos Complexos)

```python
from typing import Protocol

class ServiceFactory(Protocol):
    def create_ai_service(self) -> AIServiceProtocol: ...
    def create_tjms_client(self) -> TJMSClientProtocol: ...

class ProductionFactory:
    def create_ai_service(self):
        return GeminiAdapter()

    def create_tjms_client(self):
        return TJMSAdapter()

class MeuService:
    def __init__(self, factory: ServiceFactory):
        self.ai = factory.create_ai_service()
        self.tjms = factory.create_tjms_client()

# Uso
factory = ProductionFactory()
service = MeuService(factory=factory)
```

**Uso em testes**:
```python
class TestFactory:
    def create_ai_service(self):
        return MockAI()

    def create_tjms_client(self):
        return MockTJMS()

service = MeuService(factory=TestFactory())
```

### 3. Injeção via Parâmetro (Funções Simples)

```python
async def processar_documento(
    texto: str,
    ai_service: AIServiceProtocol
) -> str:
    """Função pura - recebe dependências como parâmetros."""
    return await ai_service.gerar_texto(
        prompt=f"Processe: {texto}",
        modelo="flash"
    )

# Uso
resultado = await processar_documento(
    texto="...",
    ai_service=GeminiAdapter()
)

# Teste
resultado = await processar_documento(
    texto="...",
    ai_service=MockAI()
)
```

---

## Conclusão

Os adapters transformam código **acoplado e difícil de testar** em código **modular e manutenível**.

**Regra de ouro**:
> **Módulos de domínio NUNCA devem importar serviços concretos.**
> **Sempre dependa de protocolos (interfaces abstratas).**

**Checklist para novos módulos**:
- [ ] Depende de `AIServiceProtocol` (não `GeminiService`)
- [ ] Depende de `TJMSClientProtocol` (não `TJMSClient`)
- [ ] Depende de `DocumentClassifierProtocol` (não `BertClassifierClient`)
- [ ] Testes usam mocks (não chamam APIs reais)
- [ ] Injeção de dependência via construtor ou parâmetro
