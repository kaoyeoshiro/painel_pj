"""
Routers v1 do sistema Prestação de Contas.
"""

from sistemas.prestacao_contas.router import router
from sistemas.prestacao_contas.router_admin import router as admin_router

__all__ = ["router", "admin_router"]

