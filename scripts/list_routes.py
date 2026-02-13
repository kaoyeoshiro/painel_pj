"""
Inventário de rotas do backend FastAPI.

Gera JSON com todas as rotas registradas no app, incluindo:
- path, methods, name, tags, arquivo de origem (quando possível).

Uso:
    python scripts/list_routes.py
"""

import sys
import os
import json
import inspect
from pathlib import Path

# Garante que o diretório raiz do projeto esteja no path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.chdir(str(ROOT))

# Carrega .env do projeto para DATABASE_URL e demais configs
from dotenv import load_dotenv
load_dotenv(ROOT / ".env")

from main import app


def get_route_source(endpoint) -> dict:
    """Retorna arquivo e linha onde o endpoint foi definido."""
    try:
        source_file = inspect.getfile(endpoint)
        source_line = inspect.getsourcelines(endpoint)[1]
        # Torna o caminho relativo ao projeto
        try:
            rel = Path(source_file).resolve().relative_to(ROOT)
            source_file = str(rel).replace("\\", "/")
        except ValueError:
            pass
        return {"file": source_file, "line": source_line}
    except (TypeError, OSError):
        return {"file": "unknown", "line": 0}


def collect_routes() -> list[dict]:
    """Coleta todas as rotas registradas no app FastAPI."""
    routes = []
    for route in app.routes:
        # Pula rotas internas do FastAPI (openapi, docs, redoc)
        if hasattr(route, "path"):
            path = route.path

            # Ignora rotas de documentação automática e montagens estáticas
            if path in ("/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"):
                continue

            methods = sorted(route.methods - {"HEAD", "OPTIONS"}) if hasattr(route, "methods") and route.methods else []
            name = route.name or ""
            tags = getattr(route, "tags", []) or []

            # Fonte do endpoint
            endpoint = getattr(route, "endpoint", None)
            source = get_route_source(endpoint) if endpoint else {"file": "unknown", "line": 0}

            # Descrição (docstring resumida)
            doc = ""
            if endpoint and endpoint.__doc__:
                doc = endpoint.__doc__.strip().split("\n")[0][:120]

            routes.append({
                "path": path,
                "methods": methods,
                "name": name,
                "tags": tags,
                "source_file": source["file"],
                "source_line": source["line"],
                "description": doc,
            })

    # Ordena por path
    routes.sort(key=lambda r: r["path"])
    return routes


def main():
    routes = collect_routes()

    # Garante diretório de saída
    output_dir = ROOT / "docs" / "auditoria"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / "ROTAS_BACKEND.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(routes, f, indent=2, ensure_ascii=False)

    print(f"[OK] {len(routes)} rotas salvas em {output_path}")

    # Também imprime resumo
    print(f"\n{'='*80}")
    print(f"{'PATH':<55} {'METHODS':<12} {'FILE'}")
    print(f"{'='*80}")
    for r in routes:
        methods_str = ",".join(r["methods"])
        print(f"{r['path']:<55} {methods_str:<12} {r['source_file']}:{r['source_line']}")


if __name__ == "__main__":
    main()
