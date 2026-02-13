"""
Auditoria: Backend vs Frontend — cruza rotas do FastAPI com chamadas do React.

Gera:
- docs/auditoria/CHAMADAS_FRONTEND.json
- docs/auditoria/NAVEGACAO_FRONTEND.json
- docs/auditoria/CRUZAMENTO.json
- docs/auditoria/RELATORIO_BACKEND_NAO_USADO_PELO_FRONT.md

Uso:
    python scripts/audit_backend_vs_frontend.py
"""

import json
import re
import sys
import io
from pathlib import Path
from datetime import datetime

# Força UTF-8 no stdout (Windows cp1252 quebra com caracteres unicode)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
FRONTEND_SRC = ROOT / "frontend-react" / "src"
AUDIT_DIR = ROOT / "docs" / "auditoria"
AUDIT_DIR.mkdir(parents=True, exist_ok=True)

# ============================================================
# 1) CARREGAR ROTAS BACKEND
# ============================================================

def load_backend_routes() -> list[dict]:
    """Carrega rotas do backend (geradas por list_routes.py)."""
    path = AUDIT_DIR / "ROTAS_BACKEND.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


# ============================================================
# 2) EXTRAIR CHAMADAS API DO FRONTEND
# ============================================================

# Mapeamento de API clients para prefixos (conforme lib/api.ts)
API_CLIENTS = {
    "authApi": "/auth",
    "usersApi": "/users",
    "adminApi": "",
    "geradorApi": "/gerador-pecas/api",
    "geradorAdminApi": "/gerador-pecas-admin",
    "classificadorApi": "/classificador/api",
    "extratorApi": "/extrator-autos/api",
    "pedidoCalculoApi": "/pedido-calculo/api",
    "pedidoCalculoAdminApi": "/pedido-calculo-admin",
    "prestacaoContasApi": "/prestacao-contas/api",
    "relatorioCumprimentoApi": "/relatorio-cumprimento/api",
    "cumprimentoBetaApi": "/cumprimento-beta/api",
    "assistenciaApi": "/assistencia/api",
    "matriculasApi": "/matriculas/api",
    "bertApi": "/bert-training/api",
}

# Clientes criados inline em páginas específicas
INLINE_CLIENTS = {
    "configApi": "/api/gerador-pecas/config",
    "adminConfigApi": "/admin/api/config-pecas",
    "prestacaoAdminApi": "/admin/api/prestacao-admin",
}


def resolve_constants(path: str, constants: dict[str, str]) -> str:
    """Resolve constantes JS em template literals.
    Ex: ${BASE}/foo com BASE='/admin/api' → /admin/api/foo
    """
    for var_name, var_value in constants.items():
        path = path.replace(f"${{{var_name}}}", var_value)
    return path


def normalize_api_path(path: str, constants: dict[str, str] | None = None) -> str:
    """Remove partes dinâmicas de paths para comparação.
    Ex: /historico/${id} -> /historico/{id}
    """
    # Resolve constantes conhecidas primeiro
    if constants:
        path = resolve_constants(path, constants)

    # Template literals JS restantes → pattern FastAPI
    path = re.sub(r'\$\{[^}]+\}', '{id}', path)
    # Remove query strings
    path = path.split('?')[0]
    return path


def extract_frontend_api_calls() -> list[dict]:
    """Varre o frontend React e extrai todas as chamadas HTTP."""
    calls = []

    # Regex para capturar chamadas como: clientName.method('/path' ou `path`)
    # Padrão: (clientVar).(get|post|put|delete|patch|blob)(<T>)?( '/path' ou `/path`)
    call_pattern = re.compile(
        r'(\w+Api\w*|configApi|adminConfigApi|prestacaoAdminApi)'
        r'\.(get|post|put|delete|patch|blob)'
        r'(?:<[^>]*>)?'
        r"""\(\s*['"`]([^'"`]+)['"`]"""
    )

    # Regex para createApiClient inline
    inline_pattern = re.compile(
        r"createApiClient\(\s*['\"]([^'\"]+)['\"]\s*\)"
    )

    # Regex para apiRequest direto
    api_request_pattern = re.compile(
        r"""apiRequest(?:<[^>]*>)?\(\s*['"`]([^'"`]+)['"`]"""
    )

    # Regex para EventSource/SSE
    sse_pattern = re.compile(
        r"""(?:EventSource|evtSource)\s*\(\s*(?:['"`]([^'"`]+)['"`]|(\w+))"""
    )

    # Regex para fetch direto
    fetch_pattern = re.compile(
        r"""fetch\(\s*(?:['"`]([^'"`]+)['"`]|`([^`]+)`)"""
    )

    all_clients = {**API_CLIENTS, **INLINE_CLIENTS}

    for ts_file in FRONTEND_SRC.rglob("*.ts"):
        _scan_file(ts_file, call_pattern, inline_pattern, api_request_pattern,
                   sse_pattern, fetch_pattern, all_clients, calls)
    for tsx_file in FRONTEND_SRC.rglob("*.tsx"):
        _scan_file(tsx_file, call_pattern, inline_pattern, api_request_pattern,
                   sse_pattern, fetch_pattern, all_clients, calls)

    return calls


def _scan_file(filepath, call_pattern, inline_pattern, api_request_pattern,
               sse_pattern, fetch_pattern, all_clients, calls):
    """Escaneia um arquivo e extrai chamadas API."""
    try:
        content = filepath.read_text(encoding="utf-8")
    except (UnicodeDecodeError, PermissionError):
        return

    rel_path = str(filepath.relative_to(ROOT)).replace("\\", "/")

    # Detecta constantes de string no arquivo (const BASE = '/admin/api/...')
    file_constants: dict[str, str] = {}
    for cm in re.finditer(r"""const\s+(\w+)\s*=\s*['"]([^'"]+)['"]""", content):
        var_name = cm.group(1)
        var_value = cm.group(2)
        if var_value.startswith("/"):
            file_constants[var_name] = var_value

    # Detecta clientes inline criados no arquivo
    local_clients = dict(all_clients)
    for match in inline_pattern.finditer(content):
        prefix = match.group(1)
        # Tenta achar o nome da variável
        line_start = content.rfind("\n", 0, match.start()) + 1
        line = content[line_start:match.end()]
        var_match = re.search(r'(?:const|let|var)\s+(\w+)', line)
        if var_match:
            local_clients[var_match.group(1)] = prefix

    # Chamadas via API clients
    for match in call_pattern.finditer(content):
        client_name = match.group(1)
        method = match.group(2).upper()
        path_suffix = match.group(3)

        prefix = local_clients.get(client_name, "")
        full_path = normalize_api_path(prefix + path_suffix, file_constants)

        if method == "BLOB":
            method = "GET"

        calls.append({
            "path": full_path,
            "method": method,
            "file": rel_path,
            "client": client_name,
        })

    # Chamadas via apiRequest direto
    for match in api_request_pattern.finditer(content):
        path = normalize_api_path(match.group(1), file_constants)
        # Tenta detectar método
        context = content[max(0, match.start()-100):match.end()+100]
        method = "GET"
        if "POST" in context:
            method = "POST"
        elif "PUT" in context:
            method = "PUT"
        elif "DELETE" in context:
            method = "DELETE"

        calls.append({
            "path": path,
            "method": method,
            "file": rel_path,
            "client": "apiRequest",
        })

    # SSE/EventSource — captura URLs de variáveis como sseUrl
    for match in re.finditer(
        r"""(?:const|let)\s+\w*[Ss]se\w*\s*=\s*`([^`]+)`""", content
    ):
        url = normalize_api_path(match.group(1), file_constants)
        if url.startswith("/"):
            calls.append({
                "path": url,
                "method": "SSE",
                "file": rel_path,
                "client": "EventSource",
            })

    for match in sse_pattern.finditer(content):
        url = match.group(1) or match.group(2)
        if url and url.startswith("/"):
            calls.append({
                "path": normalize_api_path(url, file_constants),
                "method": "SSE",
                "file": rel_path,
                "client": "EventSource",
            })

    # fetch direto com URL
    for match in fetch_pattern.finditer(content):
        url = match.group(1) or match.group(2)
        if url and "/" in url and not url.startswith("http"):
            calls.append({
                "path": normalize_api_path(url, file_constants),
                "method": "FETCH",
                "file": rel_path,
                "client": "fetch",
            })


# ============================================================
# 3) EXTRAIR NAVEGAÇÃO DO FRONTEND
# ============================================================

def extract_frontend_navigation() -> list[dict]:
    """Extrai rotas do React Router e itens de navegação."""
    nav_items = []

    router_file = FRONTEND_SRC / "router.tsx"
    if router_file.exists():
        content = router_file.read_text(encoding="utf-8")
        # Extrai paths do router
        for match in re.finditer(r"path:\s*['\"]([^'\"]+)['\"]", content):
            path = match.group(1)
            # Tenta encontrar o componente
            line_start = content.rfind("\n", 0, match.start())
            block = content[line_start:match.start()+200]
            comp_match = re.search(r"component:\s*(\w+)", block)
            component = comp_match.group(1) if comp_match else "unknown"

            nav_items.append({
                "path": path,
                "component": component,
                "type": "react-router",
                "file": "frontend-react/src/router.tsx",
            })

    # Busca Links e navigate() em todo o frontend
    for f in FRONTEND_SRC.rglob("*.tsx"):
        try:
            content = f.read_text(encoding="utf-8")
        except (UnicodeDecodeError, PermissionError):
            continue

        rel_path = str(f.relative_to(ROOT)).replace("\\", "/")

        # <Link to="/path">
        for match in re.finditer(r"""(?:to|href)=\s*['"]([^'"]+)['"]""", content):
            path = match.group(1)
            if path.startswith("/"):
                nav_items.append({
                    "path": path,
                    "component": "",
                    "type": "link",
                    "file": rel_path,
                })

        # navigate('/path')
        for match in re.finditer(r"""navigate\(\s*['"]([^'"]+)['"]""", content):
            nav_items.append({
                "path": match.group(1),
                "component": "",
                "type": "navigate",
                "file": rel_path,
            })

    return nav_items


# ============================================================
# 4) CRUZAR E CLASSIFICAR
# ============================================================

# Rotas sabidamente "internas" (backend-only)
BACKEND_ONLY_PATTERNS = [
    r"^/health",
    r"^/metrics",
    r"^/openapi",
    r"^/docs",
    r"^/redoc",
    r"^/vite\.svg$",
]

# Montagens estáticas (não são endpoints API)
STATIC_MOUNT_PATTERNS = [
    r"^/assets$",
    r"^/static$",
    r"^/logo$",
]

# Rotas que são meros espelhos Jinja2 do legado (servem HTML estático)
LEGACY_MIRROR_PATTERNS = [
    r"^/assistencia/\{",
    r"^/matriculas/\{",
    r"^/gerador-pecas/\{",
    r"^/pedido-calculo/\{",
    r"^/prestacao-contas/\{",
    r"^/relatorio-cumprimento/\{",
    r"^/classificador/\{",
    r"^/bert-training/templates/\{",
]

# Catch-all React SPA e redirects
CATCHALL_PATTERNS = [
    r"^/\{full_path",
]

# Redirects (não são funcionalidade real)
REDIRECT_PATTERNS = [
    r"^/$",  # Redirect para /dashboard
]


def normalize_backend_path(path: str) -> str:
    """Normaliza path do backend para comparação."""
    # Remove partes dinâmicas: {id}, {filename:path} etc
    path = re.sub(r'\{[^}]+\}', '{id}', path)
    return path


def path_matches(backend_path: str, frontend_paths: set[str]) -> bool:
    """Verifica se um path backend tem correspondência no frontend."""
    norm_back = normalize_backend_path(backend_path)

    for fp in frontend_paths:
        norm_front = fp.rstrip("/")
        if not norm_front:
            continue

        # Match exato
        if norm_back == norm_front:
            return True

        # Backend tem parâmetro, frontend usa {id}
        back_base = re.sub(r'/\{id\}(?:/.*)?$', '', norm_back)
        front_base = re.sub(r'/\{id\}(?:/.*)?$', '', norm_front)
        if back_base and front_base and back_base == front_base:
            return True

        # Comparação de prefixo (para paths como /admin/api/prompts/{id}/restaurar-padrao)
        if norm_back.startswith(norm_front + "/") or norm_front.startswith(norm_back + "/"):
            return True

    return False


def classify_routes(backend_routes, frontend_calls, frontend_nav):
    """Classifica cada rota backend."""
    # Coleta todos os paths usados pelo frontend
    api_paths = set()
    for call in frontend_calls:
        api_paths.add(call["path"])

    nav_paths = set()
    for nav in frontend_nav:
        nav_paths.add(nav["path"])

    results = []
    for route in backend_routes:
        path = route["path"]
        methods = route["methods"]

        # Pula catch-all, redirects, static mounts
        if any(re.match(p, path) for p in CATCHALL_PATTERNS):
            continue
        if any(re.match(p, path) for p in STATIC_MOUNT_PATTERNS):
            continue
        if any(re.match(p, path) for p in REDIRECT_PATTERNS):
            continue

        # Classifica
        is_backend_only = any(re.match(p, path) for p in BACKEND_ONLY_PATTERNS)
        is_legacy_mirror = any(re.match(p, path) for p in LEGACY_MIRROR_PATTERNS)
        is_called = path_matches(path, api_paths)
        is_in_nav = path_matches(path, nav_paths)

        if is_backend_only:
            classification = "BACKEND-ONLY"
            reason = "Uso interno (healthcheck/métricas/infra)"
        elif is_legacy_mirror:
            classification = "LEGADO-MIRROR"
            reason = "Espelho Jinja2 de sistema legado"
        elif is_called and is_in_nav:
            classification = "USADO"
            reason = "Chamado pelo frontend e presente na navegação"
        elif is_called:
            classification = "USADO"
            reason = "Chamado pelo frontend via API"
        elif is_in_nav:
            classification = "USADO"
            reason = "Presente na navegação do React Router"
        else:
            classification = "ÓRFÃO PROVÁVEL"
            reason = "Não encontrado nas chamadas nem na navegação do frontend"

        # Busca evidência detalhada
        evidence_calls = [c for c in frontend_calls if normalize_api_path(c["path"]) == normalize_backend_path(path)]
        evidence_nav = [n for n in frontend_nav if n["path"] == path]

        results.append({
            "path": path,
            "methods": methods,
            "name": route["name"],
            "tags": route["tags"],
            "source_file": route["source_file"],
            "source_line": route["source_line"],
            "description": route["description"],
            "classification": classification,
            "reason": reason,
            "frontend_calls": len(evidence_calls),
            "frontend_nav": len(evidence_nav),
            "evidence_files": list(set(c["file"] for c in evidence_calls)),
        })

    return results


# ============================================================
# 5) GERAR RELATÓRIO
# ============================================================

def generate_report(results: list[dict]):
    """Gera o relatório markdown."""

    orphans = [r for r in results if r["classification"] == "ÓRFÃO PROVÁVEL"]
    backend_only = [r for r in results if r["classification"] == "BACKEND-ONLY"]
    legacy = [r for r in results if r["classification"] == "LEGADO-MIRROR"]
    used = [r for r in results if r["classification"] == "USADO"]

    lines = []
    lines.append("# Relatório: Backend não usado pelo Frontend")
    lines.append("")
    lines.append(f"> Gerado automaticamente em {datetime.now().strftime('%d/%m/%Y %H:%M')}")
    lines.append(f"> Branch: `refactor/backend-cleanup`")
    lines.append("")

    # ---- Seção 1: O que é isso ----
    lines.append("## 1. O que é isso e por que importa")
    lines.append("")
    lines.append("Este relatório mostra **endpoints do backend (FastAPI)** que **não são chamados pelo frontend React**.")
    lines.append("Isso pode significar:")
    lines.append("- Funcionalidade escondida que deveria aparecer no sistema")
    lines.append("- Código legado que pode ser removido")
    lines.append("- Endpoints internos (health check, métricas) que são usados por infraestrutura")
    lines.append("")

    # ---- Seção 2: Metodologia ----
    lines.append("## 2. Como foi detectado")
    lines.append("")
    lines.append("1. **Inventário backend**: Script `scripts/list_routes.py` importa o app FastAPI e lista todas as rotas registradas")
    lines.append(f"2. **Inventário frontend**: Script `scripts/audit_backend_vs_frontend.py` varre todos os arquivos `.ts/.tsx` do React")
    lines.append("3. **Cruzamento**: Cada rota backend é comparada com as chamadas HTTP e rotas de navegação do frontend")
    lines.append("")
    lines.append("**Números:**")
    lines.append(f"- Total de rotas backend: **{len(results)}** (excluindo catch-all)")
    lines.append(f"- Usadas pelo frontend: **{len(used)}**")
    lines.append(f"- Órfãs prováveis: **{len(orphans)}**")
    lines.append(f"- Backend-only (infra): **{len(backend_only)}**")
    lines.append(f"- Espelho legado (Jinja2): **{len(legacy)}**")
    lines.append("")

    # ---- Seção 3: Órfãos prováveis ----
    lines.append("## 3. Prováveis Órfãos")
    lines.append("")
    if orphans:
        lines.append("Endpoints que existem no backend mas **não foram encontrados** em nenhuma chamada HTTP do React.")
        lines.append("")
        lines.append("| # | Endpoint | Método | Descrição/Tags | Arquivo | Sugestão |")
        lines.append("|---|----------|--------|---------------|---------|----------|")
        for i, r in enumerate(orphans, 1):
            tags = ", ".join(r["tags"]) if r["tags"] else "-"
            desc = r["description"][:60] if r["description"] else tags
            src = f"`{r['source_file']}:{r['source_line']}`"
            methods_str = ", ".join(r["methods"])
            suggestion = _suggest_action(r)
            lines.append(f"| {i} | `{r['path']}` | {methods_str} | {desc} | {src} | {suggestion} |")
        lines.append("")
    else:
        lines.append("Nenhum endpoint órfão encontrado!")
        lines.append("")

    # ---- Seção 4: Backend-only ----
    lines.append("## 4. Uso interno provável (Backend-Only)")
    lines.append("")
    lines.append("Endpoints de infraestrutura que não precisam aparecer no frontend.")
    lines.append("")
    if backend_only:
        lines.append("| Endpoint | Método | Descrição | Motivo |")
        lines.append("|----------|--------|-----------|--------|")
        for r in backend_only:
            desc = r["description"][:80] if r["description"] else "-"
            methods_str = ", ".join(r["methods"])
            lines.append(f"| `{r['path']}` | {methods_str} | {desc} | {r['reason']} |")
        lines.append("")

    # ---- Seção 4b: Legado ----
    if legacy:
        lines.append("## 4b. Espelhos Legado (Jinja2)")
        lines.append("")
        lines.append("Rotas que servem templates HTML do sistema legado. Com a migração para React completa,")
        lines.append("estas rotas podem ser candidatas a remoção.")
        lines.append("")
        lines.append("| Endpoint | Arquivo | Descrição |")
        lines.append("|----------|---------|-----------|")
        for r in legacy:
            desc = r["description"][:80] if r["description"] else "-"
            lines.append(f"| `{r['path']}` | `{r['source_file']}:{r['source_line']}` | {desc} |")
        lines.append("")

    # ---- Seção 5: Ações recomendadas ----
    lines.append("## 5. Ações recomendadas")
    lines.append("")
    lines.append("### Curto prazo (1-2 sprints)")
    lines.append("")
    lines.append("- [ ] Revisar cada órfão e decidir: **adicionar no front**, **documentar como interno**, ou **marcar deprecated**")
    lines.append("- [ ] Remover espelhos Jinja2 que não são mais necessários (após confirmar que nenhuma página os carrega)")
    lines.append("- [ ] Documentar endpoints backend-only no README/docs de operações")
    lines.append("")
    lines.append("### Médio prazo")
    lines.append("")
    lines.append("- [ ] Adicionar telemetria (log de acessos por endpoint) para confirmar uso real em produção")
    lines.append("- [ ] Criar testes E2E que verifiquem que cada página do React faz as chamadas esperadas")
    lines.append("")

    # ---- Checklist de follow-up ----
    lines.append("## 6. Checklist de Follow-up")
    lines.append("")
    if orphans:
        for i, r in enumerate(orphans, 1):
            action = _suggest_action_detailed(r)
            lines.append(f"- [ ] **{r['path']}** ({', '.join(r['methods'])}): {action}")
        lines.append("")

    # ---- Nota sobre telemetria ----
    lines.append("## 7. Observação sobre telemetria")
    lines.append("")
    lines.append("Este relatório é baseado em análise estática do código-fonte.")
    lines.append("**Sem telemetria de produção** para confirmar se os endpoints são chamados em runtime")
    lines.append("(ex: por scripts externos, integrações, ou usuários com bookmarks diretos).")
    lines.append("Recomenda-se adicionar logging de acesso antes de remover qualquer endpoint.")

    return "\n".join(lines)


def _suggest_action(route: dict) -> str:
    """Sugere ação curta para tabela."""
    path = route["path"]
    tags = route["tags"]

    if "/admin/" in path:
        if "admin_" in route["source_file"] or "main.py" in route["source_file"]:
            return "Página legada → verificar se React substituiu"
        return "Verificar se admin React cobre"
    if "/text-normalizer" in path:
        return "Utilitário → documentar ou expor"
    if "dashboard" in path.lower():
        return "Dashboard → verificar integração"
    if any(t in str(tags).lower() for t in ["configuração", "config"]):
        return "Config → verificar se admin cobre"
    if "restaurar" in path or "slug" in path:
        return "Ferramenta admin → adicionar link"
    if "sse" in path.lower() or "stream" in path.lower():
        return "SSE → verificar useSSE hook"
    return "Investigar uso"


def _suggest_action_detailed(route: dict) -> str:
    """Sugere ação detalhada para checklist."""
    path = route["path"]

    if "/admin/" in path and "main.py" in route["source_file"]:
        return "Verificar se é página legada Jinja2 que o React já substituiu. Se sim, remover."
    if "/admin/" in path:
        return "Verificar se página admin React já implementa esta funcionalidade."
    if "text-normalizer" in path:
        return "Decidir: expor como utilitário no frontend ou documentar como endpoint interno."
    if "dashboard" in path.lower():
        return "Verificar se DashboardPage.tsx está integrando este endpoint."
    if "stream" in path.lower() or "sse" in path.lower():
        return "Verificar se useSSE.ts está configurado para esta URL."
    return f"Investigar se é necessário. Se ninguém usar em 30 dias, marcar como deprecated."


# ============================================================
# MAIN
# ============================================================

def main():
    print("[1/5] Carregando rotas backend...")
    backend_routes = load_backend_routes()
    print(f"      → {len(backend_routes)} rotas")

    print("[2/5] Extraindo chamadas API do frontend...")
    frontend_calls = extract_frontend_api_calls()
    print(f"      → {len(frontend_calls)} chamadas")

    # Salva
    with open(AUDIT_DIR / "CHAMADAS_FRONTEND.json", "w", encoding="utf-8") as f:
        json.dump(frontend_calls, f, indent=2, ensure_ascii=False)

    print("[3/5] Extraindo navegação do frontend...")
    frontend_nav = extract_frontend_navigation()
    print(f"      → {len(frontend_nav)} itens de navegação")

    # Salva
    with open(AUDIT_DIR / "NAVEGACAO_FRONTEND.json", "w", encoding="utf-8") as f:
        json.dump(frontend_nav, f, indent=2, ensure_ascii=False)

    print("[4/5] Cruzando backend vs frontend...")
    results = classify_routes(backend_routes, frontend_calls, frontend_nav)

    # Salva cruzamento
    with open(AUDIT_DIR / "CRUZAMENTO.json", "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    # Estatísticas
    classifications = {}
    for r in results:
        c = r["classification"]
        classifications[c] = classifications.get(c, 0) + 1
    print(f"      → Classificações: {classifications}")

    print("[5/5] Gerando relatório...")
    report = generate_report(results)
    report_path = AUDIT_DIR / "RELATORIO_BACKEND_NAO_USADO_PELO_FRONT.md"
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"\n[OK] Relatório salvo em: {report_path}")
    print(f"[OK] Dados em: {AUDIT_DIR}")

    # Resumo final
    orphans = [r for r in results if r["classification"] == "ÓRFÃO PROVÁVEL"]
    if orphans:
        print(f"\n⚠ {len(orphans)} endpoints órfãos encontrados!")
        for r in orphans[:10]:
            print(f"   {', '.join(r['methods']):>6}  {r['path']}")
        if len(orphans) > 10:
            print(f"   ... e mais {len(orphans) - 10}")


if __name__ == "__main__":
    main()
