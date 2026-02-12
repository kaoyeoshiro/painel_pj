"""
Routers v1 do sistema Gerador de Peças.
"""

from sistemas.gerador_pecas.router import router
from sistemas.gerador_pecas.router_admin import router as admin_router
from sistemas.gerador_pecas.router_categorias_json import router as categorias_json_router
from sistemas.gerador_pecas.router_config_pecas import router as config_pecas_router
from sistemas.gerador_pecas.router_ext_deps import router as ext_deps_router
from sistemas.gerador_pecas.router_ext_models import router as ext_models_router
from sistemas.gerador_pecas.router_ext_questions import router as ext_questions_router
from sistemas.gerador_pecas.router_ext_variables import router as ext_variables_router
from sistemas.gerador_pecas.router_teste_categorias import router as teste_categorias_router


def get_teste_ativacao_router():
    """
    Retorna router de teste de ativação quando disponível.
    """
    try:
        from sistemas.gerador_pecas.router_teste_ativacao import router as teste_ativacao_router

        return teste_ativacao_router
    except ImportError:
        return None


__all__ = [
    "router",
    "admin_router",
    "categorias_json_router",
    "config_pecas_router",
    "teste_categorias_router",
    "ext_questions_router",
    "ext_models_router",
    "ext_variables_router",
    "ext_deps_router",
    "get_teste_ativacao_router",
]

