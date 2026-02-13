"""
Rota legada _frame-bridge para sincronização de token em desenvolvimento.

Todas as 16 rotas de templates Jinja2 foram removidas pois o React SPA
agora cobre 100% das páginas admin via React Router.
"""

import json

from fastapi import APIRouter
from fastapi.responses import HTMLResponse


router = APIRouter(tags=["Legacy Admin"])


@router.get("/admin/_frame-bridge")
async def react_admin_frame_bridge(target: str = "/admin/users", token: str = ""):
    """
    Bridge de desenvolvimento para iframe admin.

    Sincroniza o token de autenticação no localStorage e redireciona
    para a rota alvo no React SPA.
    """
    safe_target = target if target.startswith("/") else f"/{target}"
    allowed_prefixes = (
        "/admin/",
        "/api/gerador-pecas/config/admin",
        "/assistencia",
        "/matriculas",
        "/gerador-pecas",
        "/pedido-calculo",
        "/prestacao-contas",
        "/relatorio-cumprimento",
        "/classificador",
        "/bert-training",
    )
    if not any(safe_target.startswith(prefix) for prefix in allowed_prefixes):
        safe_target = "/admin/users"

    target_js = json.dumps(safe_target)
    token_js = json.dumps(token or "")

    return HTMLResponse(
        content=f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Carregando Admin...</title>
    </head>
    <body>
      <script>
        const token = {token_js};
        const target = {target_js};
        if (token) {{
          localStorage.setItem('access_token', token);
          localStorage.setItem('auth_token', token);
          sessionStorage.setItem('auth_token', token);
        }}
        window.location.replace(target);
      </script>
    </body>
    </html>
    """
    )
