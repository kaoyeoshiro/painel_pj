"""
Verificador de boundaries arquiteturais do Portal PGE.

Regras verificadas:
1. app/services/ NÃO importa FastAPI (Request, Response, APIRouter)
2. app/api/ NÃO importa ORM/models diretamente (apenas via services/repos)
3. Nenhum torch.load() direto (já existe; manter)
4. Endpoints de IA devem ter rate limit
5. app/domain/ não deve ter dependências externas

Uso: python scripts/check_boundaries.py
"""
import ast
import sys
import os
import re
from pathlib import Path
from typing import NamedTuple


# ANSI color codes para output no terminal
class Colors:
    RED = "\033[91m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    MAGENTA = "\033[95m"
    CYAN = "\033[96m"
    RESET = "\033[0m"
    BOLD = "\033[1m"


class Violation(NamedTuple):
    file: str
    line: int
    rule: str
    message: str
    severity: str = "error"  # error | warning


def normalize_path(path: Path, root: Path) -> str:
    """Normaliza path para usar / mesmo no Windows."""
    try:
        rel = path.relative_to(root)
        return str(rel).replace("\\", "/")
    except ValueError:
        return str(path).replace("\\", "/")


def check_services_no_fastapi(root: Path) -> list[Violation]:
    """app/services/ não deve importar FastAPI."""
    violations = []
    services_dir = root / "app" / "services"
    if not services_dir.exists():
        return violations

    forbidden = {
        "fastapi": ["Request", "Response", "APIRouter", "HTTPException"],
        "starlette": ["Request", "Response"],
    }

    for py_file in services_dir.rglob("*.py"):
        if py_file.name.startswith("__"):
            continue

        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for i, line in enumerate(content.splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue

            for pkg, symbols in forbidden.items():
                # Checa import direto do pacote
                if f"import {pkg}" in line and "from" not in line:
                    violations.append(Violation(
                        normalize_path(py_file, root),
                        i,
                        "SERVICES_NO_FASTAPI",
                        f"app/services/ não deve importar {pkg}",
                        "error"
                    ))
                # Checa from package import ...
                elif f"from {pkg}" in line:
                    violations.append(Violation(
                        normalize_path(py_file, root),
                        i,
                        "SERVICES_NO_FASTAPI",
                        f"app/services/ não deve importar de {pkg}",
                        "error"
                    ))

    return violations


def check_no_raw_torch_load(root: Path) -> list[Violation]:
    """Nenhum arquivo deve usar torch.load() diretamente."""
    violations = []
    excluded = {
        "utils/safe_torch.py",
        "tests/test_torch_load_safety.py",
        "tests/test_architecture_boundaries.py",
        "scripts/check_boundaries.py",
    }

    for py_file in root.rglob("*.py"):
        rel = normalize_path(py_file, root)

        # Pula arquivos excluídos
        if any(excl in rel for excl in excluded):
            continue
        if "__pycache__" in rel or ".pyc" in rel:
            continue

        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for i, line in enumerate(content.splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue

            # Detecta torch.load() mas não safe_torch_load()
            # Pula linhas que são comentários ou strings de documentação
            if "torch.load(" in line and "safe_torch_load" not in line:
                # Verifica se não é parte de uma string de documentação
                if '"""' in line or "'''" in line or line.strip().startswith('"') or line.strip().startswith("'"):
                    continue

                violations.append(Violation(
                    rel,
                    i,
                    "NO_RAW_TORCH_LOAD",
                    "Usar safe_torch_load() de utils/safe_torch.py",
                    "error"
                ))

    return violations


def check_no_db_query_in_new_routers(root: Path) -> list[Violation]:
    """Routers em app/api/ não devem ter db.query ou db.execute."""
    violations = []
    api_dir = root / "app" / "api"
    if not api_dir.exists():
        return violations

    for py_file in api_dir.rglob("*.py"):
        if py_file.name in {"bootstrap.py", "__init__.py"}:
            continue

        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for i, line in enumerate(content.splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue

            # Detecta uso direto de ORM
            if "db.query(" in line or "db.execute(" in line:
                violations.append(Violation(
                    normalize_path(py_file, root),
                    i,
                    "NO_DB_IN_ROUTER",
                    "app/api/ não deve fazer queries diretamente. Usar repository/service",
                    "error"
                ))

    return violations


def check_domain_no_external_deps(root: Path) -> list[Violation]:
    """app/domain/ não deve importar libs externas."""
    violations = []
    domain_dir = root / "app" / "domain"
    if not domain_dir.exists():
        return violations

    # Libs permitidas (stdlib + typing)
    allowed_packages = {
        "typing", "dataclasses", "enum", "datetime", "abc", "pathlib",
        "uuid", "decimal", "collections", "functools", "itertools",
    }

    # Libs proibidas comuns
    forbidden_keywords = [
        "fastapi", "starlette", "sqlalchemy", "pydantic", "requests",
        "httpx", "aiohttp", "redis", "celery",
    ]

    for py_file in domain_dir.rglob("*.py"):
        if py_file.name.startswith("__"):
            continue

        try:
            content = py_file.read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue

        for i, line in enumerate(content.splitlines(), 1):
            stripped = line.strip()
            if stripped.startswith("#"):
                continue

            # Checa imports de libs proibidas
            if "import" in line:
                for forbidden in forbidden_keywords:
                    if forbidden in line.lower():
                        violations.append(Violation(
                            normalize_path(py_file, root),
                            i,
                            "DOMAIN_NO_EXTERNAL_DEPS",
                            f"app/domain/ não deve importar {forbidden} (usar interfaces/protocolos)",
                            "warning"
                        ))

    return violations


def check_ai_endpoints_have_rate_limit(root: Path) -> list[Violation]:
    """Endpoints de IA devem ter @limiter.limit."""
    violations = []

    # Diretórios que podem ter endpoints de IA
    api_dirs = [
        root / "app" / "api",
        root / "sistemas",
        root / "admin",
    ]

    # Pattern para detectar funções async que chamam IA
    ai_keywords = [
        "gemini", "chat", "gerar", "classificar", "processar_lote",
        "generate_text", "ai_service", "llm",
    ]

    for api_dir in api_dirs:
        if not api_dir.exists():
            continue

        for py_file in api_dir.rglob("*router*.py"):
            try:
                content = py_file.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                continue

            lines = content.splitlines()
            for i, line in enumerate(lines, 1):
                stripped = line.strip()

                # Detecta definição de endpoint async
                if stripped.startswith("async def") or stripped.startswith("def"):
                    # Checa se função tem keywords de IA
                    func_name = stripped.split("(")[0].replace("async def", "").replace("def", "").strip()
                    has_ai_keyword = any(kw in func_name.lower() for kw in ai_keywords)

                    if has_ai_keyword:
                        # Verifica se tem rate limit nas linhas anteriores
                        has_rate_limit = False
                        for j in range(max(0, i - 10), i):
                            if j < len(lines) and "@limiter.limit" in lines[j]:
                                has_rate_limit = True
                                break

                        if not has_rate_limit:
                            violations.append(Violation(
                                normalize_path(py_file, root),
                                i,
                                "AI_ENDPOINT_NEEDS_RATE_LIMIT",
                                f"Endpoint de IA '{func_name}' deve ter @limiter.limit",
                                "warning"
                            ))

    return violations


def print_violations(violations: list[Violation]):
    """Imprime violações com cores."""
    if not violations:
        print(f"{Colors.GREEN}{Colors.BOLD}OK - Nenhuma violação arquitetural encontrada.{Colors.RESET}")
        return

    # Agrupa por regra
    by_rule = {}
    for v in violations:
        if v.rule not in by_rule:
            by_rule[v.rule] = []
        by_rule[v.rule].append(v)

    # Conta erros e warnings
    errors = [v for v in violations if v.severity == "error"]
    warnings = [v for v in violations if v.severity == "warning"]

    print(f"\n{Colors.RED}{Colors.BOLD}ERRO - {len(errors)} erro(s) encontrado(s){Colors.RESET}")
    if warnings:
        print(f"{Colors.YELLOW}{Colors.BOLD}AVISO - {len(warnings)} aviso(s) encontrado(s){Colors.RESET}")
    print()

    for rule, rule_violations in sorted(by_rule.items()):
        severity = rule_violations[0].severity
        color = Colors.RED if severity == "error" else Colors.YELLOW
        icon = "X" if severity == "error" else "!"

        print(f"{color}{Colors.BOLD}[{icon}] {rule} ({len(rule_violations)}){Colors.RESET}")
        for v in rule_violations:
            print(f"  {Colors.CYAN}{v.file}:{v.line}{Colors.RESET} - {v.message}")
        print()


def main():
    # Configura encoding UTF-8 para Windows
    if sys.platform == "win32":
        import io
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

    root = Path(__file__).resolve().parent.parent

    print(f"{Colors.BOLD}Verificando boundaries arquiteturais...{Colors.RESET}\n")

    all_violations = []

    # Executa todos os checks
    checks = [
        ("Services não importa FastAPI", check_services_no_fastapi),
        ("Nenhum torch.load() direto", check_no_raw_torch_load),
        ("Routers novos sem db.query", check_no_db_query_in_new_routers),
        ("Domain sem dependências externas", check_domain_no_external_deps),
        ("Endpoints de IA com rate limit", check_ai_endpoints_have_rate_limit),
    ]

    for name, check_fn in checks:
        print(f"  {Colors.BLUE}>{Colors.RESET} {name}...", end=" ")
        violations = check_fn(root)
        all_violations.extend(violations)

        if violations:
            errors = [v for v in violations if v.severity == "error"]
            warnings = [v for v in violations if v.severity == "warning"]
            if errors:
                print(f"{Colors.RED}X {len(errors)} erro(s){Colors.RESET}")
            elif warnings:
                print(f"{Colors.YELLOW}! {len(warnings)} aviso(s){Colors.RESET}")
        else:
            print(f"{Colors.GREEN}OK{Colors.RESET}")

    print()
    print_violations(all_violations)

    # Exit code baseado em erros (warnings não falham o script)
    errors = [v for v in all_violations if v.severity == "error"]
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
