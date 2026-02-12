"""
Camada de adaptadores - integrações externas e infraestrutura.

Este módulo expõe wrappers (adapters) sobre serviços legados,
implementando as interfaces (protocols) definidas em app.domain.shared.protocols.

Adaptadores disponíveis:
- GeminiAdapter: Interface padrão para serviço de IA (Gemini)
- TJMSAdapter: Interface padrão para cliente TJ-MS (SOAP/MNI)
- BertAdapter: Interface padrão para classificador BERT

Uso:
    from app.adapters import GeminiAdapter, TJMSAdapter, BertAdapter

    gemini = GeminiAdapter()
    texto = await gemini.gerar_texto("Olá, mundo!")

    tjms = TJMSAdapter()
    processo = await tjms.consultar_processo("0808281-22.2025.8.12.0002")

    bert = BertAdapter()
    resultado = await bert.classificar("Texto do documento...")
"""

from .gemini_adapter import GeminiAdapter
from .tjms_adapter import TJMSAdapter
from .bert_adapter import BertAdapter
from .ports import (
    AIServiceProtocol,
    DocumentClassifierProtocol,
    IBertPort,
    IGeminiPort,
    ITJMSPort,
    TJMSClientProtocol,
)

__all__ = [
    "GeminiAdapter",
    "TJMSAdapter",
    "BertAdapter",
    "AIServiceProtocol",
    "DocumentClassifierProtocol",
    "TJMSClientProtocol",
    "IGeminiPort",
    "ITJMSPort",
    "IBertPort",
]
