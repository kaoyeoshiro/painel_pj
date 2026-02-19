"""
Routers v1 do domínio admin (compat com módulos legados).
"""

from admin.dashboard_router import router as dashboard_router
from admin.router import router
from admin.router_filtro_documentos import router as filtro_documentos_router
from admin.router_gemini_logs import router as gemini_logs_router
from admin.router_performance import router as performance_router
from admin.router_prompts import router as prompts_router

__all__ = [
    "router",
    "dashboard_router",
    "filtro_documentos_router",
    "performance_router",
    "gemini_logs_router",
    "prompts_router",
]

