"""
Registro de rotas legadas temporárias.

Concentra os endpoints/templates legados de admin e seus static assets.
"""

from pathlib import Path

from fastapi.staticfiles import StaticFiles

from .admin_templates import router as legacy_admin_templates_router


BASE_DIR = Path(__file__).resolve().parents[3]
LEGACY_STATIC_DIR = BASE_DIR / "frontend" / "static"


def register_legacy_routers(app):
    """
    Registra rotas legadas temporárias e assets necessários.
    """
    app.include_router(legacy_admin_templates_router)

    if LEGACY_STATIC_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(LEGACY_STATIC_DIR)), name="static")

    return app
