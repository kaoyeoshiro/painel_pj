"""
Módulo shared - Componentes reutilizáveis do Portal PGE.

Fornece abstrações e utilitários compartilhados entre múltiplos sistemas.

Autor: LAB/PGE-MS
"""
from .sse import SSEEventFormatter, SSEHeartbeat

__all__ = [
    "SSEEventFormatter",
    "SSEHeartbeat",
]
