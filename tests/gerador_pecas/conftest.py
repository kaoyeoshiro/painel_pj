# tests/gerador_pecas/conftest.py
"""
Configuração do pytest para testes do Gerador de Peças.

Aplica mocks de compatibilidade para pacotes incompatíveis com Python 3.13
(wrapt/slowapi usam formatargspec que foi removido do módulo inspect).
Esses mocks permitem importar módulos do projeto sem acionar a cadeia
wrapt -> limits -> slowapi durante a coleta de testes unitários.
"""

import sys
from unittest.mock import MagicMock


def _mock_slowapi_chain() -> None:
    """Registra mocks para a cadeia wrapt/slowapi antes da coleta de testes."""
    mods_to_mock = [
        "wrapt",
        "wrapt.decorators",
        "deprecated",
        "deprecated.classic",
        "deprecated.sphinx",
        "limits",
        "limits._version",
        "limits.aio",
        "limits.aio.storage",
        "limits.aio.storage.base",
        "limits.aio.strategies",
        "limits.storage",
        "limits.strategies",
        "slowapi",
        "slowapi.extension",
        "slowapi.util",
        "slowapi.errors",
    ]
    for mod in mods_to_mock:
        if mod not in sys.modules:
            sys.modules[mod] = MagicMock()

    # Atributos específicos que o código de produção importa por nome
    sys.modules["slowapi"].Limiter = MagicMock
    sys.modules["slowapi"]._rate_limit_exceeded_handler = MagicMock()
    sys.modules["slowapi.util"].get_remote_address = MagicMock()
    sys.modules["slowapi.errors"].RateLimitExceeded = Exception


_mock_slowapi_chain()
