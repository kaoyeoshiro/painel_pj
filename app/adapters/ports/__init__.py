"""
Ports (interfaces) para adapters outbound.

Mantém compatibilidade importando contratos de `app.domain.shared.protocols`.
"""

from app.domain.shared.protocols import (
    AIServiceProtocol,
    DocumentClassifierProtocol,
    IBertPort,
    IGeminiPort,
    ITJMSPort,
    TJMSClientProtocol,
)

__all__ = [
    "AIServiceProtocol",
    "DocumentClassifierProtocol",
    "TJMSClientProtocol",
    "IGeminiPort",
    "ITJMSPort",
    "IBertPort",
]

