"""
Domínio compartilhado — tipos, protocolos e enums usados por múltiplos módulos.

Este módulo contém contratos neutros que evitam ciclos de import.
"""

from .protocols import AIServiceProtocol, DocumentClassifierProtocol, TJMSClientProtocol
from .types import (
    ProcessoNumero,
    DocumentoId,
    UserId,
    JsonExtraido,
    ConfigIA,
    VariaveisProcesso,
)

__all__ = [
    # Protocols
    "AIServiceProtocol",
    "DocumentClassifierProtocol",
    "TJMSClientProtocol",
    # Types
    "ProcessoNumero",
    "DocumentoId",
    "UserId",
    "JsonExtraido",
    "ConfigIA",
    "VariaveisProcesso",
]
