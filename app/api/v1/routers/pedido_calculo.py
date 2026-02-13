"""
Routers v1 do sistema Pedido de Cálculo.
"""

from sistemas.pedido_calculo.router import router
from sistemas.pedido_calculo.router_admin import router as admin_router

__all__ = ["router", "admin_router"]

