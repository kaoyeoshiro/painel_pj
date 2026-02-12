"""
Bootstrap da aplicação - registro centralizado de routers.

Mantém a função pública `register_routers(app)` para compatibilidade com `main.py`,
delegando o registro para o namespace novo `app.api.v1`.
"""

from app.api.legacy import register_legacy_routers
from app.api.v1.routers import register_v1_routers


def register_routers(app):
    """
    Registra todos os routers da aplicação.

    Ordem:
    1. Routers versionados (`app.api.v1`)
    2. Rotas legadas temporárias (`app.api.legacy`)
    """
    register_v1_routers(app)
    register_legacy_routers(app)
