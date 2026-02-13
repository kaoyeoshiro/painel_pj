"""
Registro de rotas legadas remanescentes.

Mantém apenas a rota _frame-bridge para sincronização de token em dev.
Os static assets do frontend legado foram removidos — o React SPA
serve seus próprios assets via Vite.
"""

from .admin_templates import router as legacy_admin_templates_router


def register_legacy_routers(app):
    """
    Registra rotas legadas remanescentes (apenas _frame-bridge).
    """
    app.include_router(legacy_admin_templates_router)
    return app
