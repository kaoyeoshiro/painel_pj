"""
Rotas legadas de admin baseadas em templates Jinja2.

Mantidas temporariamente para compatibilidade do frontend React (iframe/admin).
"""

from pathlib import Path
import json
import re

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates


BASE_DIR = Path(__file__).resolve().parents[3]
LEGACY_TEMPLATES_DIR = BASE_DIR / "frontend" / "templates"

templates = Jinja2Templates(directory=str(LEGACY_TEMPLATES_DIR))
router = APIRouter(tags=["Legacy Admin"])


def render_tjms_plano_response() -> HTMLResponse:
    """Retorna o plano de unificação TJMS em markdown."""
    plano_candidates = [
        BASE_DIR / "docs" / "integracoes" / "PLANO_UNIFICACAO_TJMS.md",
        BASE_DIR / "docs" / "PLANO_UNIFICACAO_TJMS.md",
    ]
    plano_path = next((path for path in plano_candidates if path.exists()), None)
    if plano_path:
        content = plano_path.read_text(encoding="utf-8")
        escaped_content = content.replace("`", "\\`")
        return HTMLResponse(
            content=f"""
        <!DOCTYPE html>
        <html>
        <head>
            <title>Plano Unificação TJMS</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.2.0/github-markdown.min.css">
            <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
            <style>
                body {{ max-width: 1200px; margin: 0 auto; padding: 20px; }}
                .markdown-body {{ box-sizing: border-box; min-width: 200px; max-width: 980px; margin: 0 auto; padding: 45px; }}
            </style>
        </head>
        <body class="markdown-body">
            <a href="/admin/tjms-docs" style="display:inline-block;margin-bottom:20px;color:#0969da;">← Voltar</a>
            <div id="content"></div>
            <script>
                document.getElementById('content').innerHTML = marked.parse(`{escaped_content}`);
            </script>
        </body>
        </html>
        """,
        )
    return HTMLResponse(content="Arquivo não encontrado", status_code=404)


def render_admin_restaurar_slugs_response() -> HTMLResponse:
    """
    Renderiza a tela de restaurar slugs em modo standalone.
    """
    template_path = LEGACY_TEMPLATES_DIR / "admin_restaurar_slugs.html"
    if not template_path.exists():
        return HTMLResponse(content="Template não encontrado", status_code=404)

    raw = template_path.read_text(encoding="utf-8")
    match = re.search(r"{%\s*block\s+content\s*%}(.*?){%\s*endblock\s*%}", raw, re.S)
    content_block = match.group(1).strip() if match else raw

    html = f"""
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Restaurar Slugs - Admin</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      <style>
        body {{
          background: #f3f4f6;
          color: #1f2937;
        }}
      </style>
    </head>
    <body>
      <header class="bg-white border-b border-gray-200 shadow-sm">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div class="h-16 flex items-center justify-between">
            <a href="/dashboard" class="text-sm text-gray-600 hover:text-gray-900">
              <i class="fas fa-arrow-left mr-2"></i>Voltar ao Dashboard
            </a>
            <h1 class="text-sm font-semibold tracking-wide text-gray-700">Administração</h1>
          </div>
        </div>
      </header>
      <main class="py-8 px-4 sm:px-6 lg:px-8">
        {content_block}
      </main>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


@router.get("/admin/_frame-bridge")
async def react_admin_frame_bridge(target: str = "/admin/users", token: str = ""):
    """
    Bridge de desenvolvimento para iframe admin.
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


@router.get("/admin/prompts-config")
async def react_admin_prompts_page(request: Request):
    return templates.TemplateResponse("admin_prompts.html", {"request": request})


@router.get("/admin/prompts-modulos")
async def react_admin_prompts_modulos_page(request: Request):
    return templates.TemplateResponse("admin_prompts_modulos.html", {"request": request})


@router.get("/admin/modulos-tipo-peca")
async def react_admin_modulos_tipo_peca_page(request: Request):
    return templates.TemplateResponse("admin_modulos_tipo_peca.html", {"request": request})


@router.get("/admin/gerador-pecas/historico")
async def react_admin_gerador_historico_page(request: Request):
    return templates.TemplateResponse("admin_gerador_historico.html", {"request": request})


@router.get("/admin/pedido-calculo/debug")
async def react_admin_pedido_calculo_debug_page(request: Request):
    return templates.TemplateResponse("admin_pedido_calculo_historico.html", {"request": request})


@router.get("/admin/prestacao-contas/debug")
async def react_admin_prestacao_contas_debug_page(request: Request):
    return templates.TemplateResponse("admin_prestacao_contas_historico.html", {"request": request})


@router.get("/admin/users")
async def react_admin_users_page(request: Request):
    return templates.TemplateResponse("admin_users.html", {"request": request})


@router.get("/admin/feedbacks")
async def react_admin_feedbacks_page(request: Request):
    return templates.TemplateResponse("admin_feedbacks.html", {"request": request})


@router.get("/admin/categorias-resumo-json")
async def react_admin_categorias_json_page(request: Request):
    return templates.TemplateResponse("admin_categorias_json.html", {"request": request})


@router.get("/admin/categorias-resumo-json/teste")
async def react_admin_teste_categorias_json_page(request: Request):
    return templates.TemplateResponse("admin_teste_categorias_json.html", {"request": request})


@router.get("/admin/prompts-modulos/teste")
async def react_admin_teste_ativacao_modulos_page(request: Request):
    return templates.TemplateResponse("admin_teste_ativacao_modulos.html", {"request": request})


@router.get("/admin/variaveis")
async def react_admin_variaveis_page(request: Request):
    return templates.TemplateResponse("admin_variaveis.html", {"request": request})


@router.get("/admin/restaurar-slugs")
async def react_admin_restaurar_slugs_page(request: Request):
    return render_admin_restaurar_slugs_response()


@router.get("/admin/performance")
async def react_admin_performance_page(request: Request):
    return templates.TemplateResponse("admin_performance.html", {"request": request})


@router.get("/admin/tjms-docs")
async def react_admin_tjms_docs_page(request: Request):
    return templates.TemplateResponse("admin_tjms_docs.html", {"request": request})


@router.get("/admin/tjms-docs/plano")
async def react_admin_tjms_plano_page():
    return render_tjms_plano_response()
