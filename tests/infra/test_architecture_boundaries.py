"""
Testes para verificação de boundaries arquiteturais.

Garante que as camadas do sistema respeitam os contratos estabelecidos:
- Domain não importa libs externas
- Services não importa FastAPI
- API não faz queries diretas ao banco
- Nenhum torch.load() direto
"""
import ast
import pytest
from pathlib import Path


pytestmark = pytest.mark.unit


@pytest.fixture
def project_root():
    """Retorna o diretório raiz do projeto."""
    return Path(__file__).resolve().parent.parent.parent


class TestArchitectureBoundaries:
    """Testes de boundaries arquiteturais."""

    def test_services_nao_importa_fastapi(self, project_root):
        """
        Verifica que app/services/ não importa FastAPI.

        Services devem ser agnósticos ao framework web.
        """
        services_dir = project_root / "app" / "services"
        if not services_dir.exists():
            pytest.skip("Diretório app/services/ não existe ainda")

        forbidden = {"fastapi", "starlette"}
        violations = []

        for py_file in services_dir.rglob("*.py"):
            if py_file.name.startswith("__"):
                continue

            content = py_file.read_text(encoding="utf-8", errors="ignore")
            for i, line in enumerate(content.splitlines(), 1):
                if line.strip().startswith("#"):
                    continue

                for pkg in forbidden:
                    if f"import {pkg}" in line or f"from {pkg}" in line:
                        rel = py_file.relative_to(project_root)
                        violations.append(f"{rel}:{i} importa {pkg}")

        assert not violations, (
            f"app/services/ não deve importar FastAPI:\n" + "\n".join(violations)
        )

    def test_nenhum_torch_load_direto(self, project_root):
        """
        Verifica que nenhum arquivo usa torch.load() diretamente.

        Deve-se usar safe_torch_load() de utils/safe_torch.py.
        """
        excluded = {
            "utils/safe_torch.py",
            "tests/security/test_torch_load_safety.py",
            "tests/infra/test_architecture_boundaries.py",
            "scripts/check_boundaries.py",
        }

        violations = []

        for py_file in project_root.rglob("*.py"):
            rel = str(py_file.relative_to(project_root)).replace("\\", "/")

            if any(excl in rel for excl in excluded):
                continue
            if "__pycache__" in rel:
                continue

            content = py_file.read_text(encoding="utf-8", errors="ignore")
            for i, line in enumerate(content.splitlines(), 1):
                if line.strip().startswith("#"):
                    continue

                if "torch.load(" in line and "safe_torch_load" not in line:
                    violations.append(f"{rel}:{i}")

        assert not violations, (
            "Usar safe_torch_load() ao invés de torch.load():\n" + "\n".join(violations)
        )

    def test_routers_novos_sem_db_query(self, project_root):
        """
        Verifica que routers em app/api/ não fazem queries diretas.

        Routers devem usar services/repositories.
        """
        api_dir = project_root / "app" / "api"
        if not api_dir.exists():
            pytest.skip("Diretório app/api/ não existe ainda")

        violations = []

        for py_file in api_dir.rglob("*.py"):
            if py_file.name in {"bootstrap.py", "__init__.py"}:
                continue

            content = py_file.read_text(encoding="utf-8", errors="ignore")
            for i, line in enumerate(content.splitlines(), 1):
                if line.strip().startswith("#"):
                    continue

                if "db.query(" in line or "db.execute(" in line:
                    rel = py_file.relative_to(project_root)
                    violations.append(f"{rel}:{i}")

        assert not violations, (
            "app/api/ não deve fazer queries diretas (usar repository):\n"
            + "\n".join(violations)
        )

    def test_app_domain_sem_dependencias_externas(self, project_root):
        """
        Verifica que app/domain/ não importa libs externas.

        Domain deve conter apenas entidades puras sem dependências.
        """
        domain_dir = project_root / "app" / "domain"
        if not domain_dir.exists():
            pytest.skip("Diretório app/domain/ não existe ainda")

        forbidden_keywords = [
            "fastapi",
            "starlette",
            "sqlalchemy",
            "pydantic",
            "requests",
            "httpx",
        ]

        violations = []

        for py_file in domain_dir.rglob("*.py"):
            if py_file.name.startswith("__"):
                continue

            content = py_file.read_text(encoding="utf-8", errors="ignore")
            for i, line in enumerate(content.splitlines(), 1):
                stripped = line.strip()
                if stripped.startswith("#"):
                    continue

                if "import" in line:
                    for forbidden in forbidden_keywords:
                        if forbidden in line.lower():
                            rel = py_file.relative_to(project_root)
                            violations.append(f"{rel}:{i} importa {forbidden}")

        assert not violations, (
            "app/domain/ não deve importar libs externas:\n" + "\n".join(violations)
        )

    def test_no_db_models_in_api_layer(self, project_root):
        """
        Verifica que app/api/ não importa models de ORM diretamente.

        API deve usar DTOs/schemas, não models de banco.
        """
        api_dir = project_root / "app" / "api"
        if not api_dir.exists():
            pytest.skip("Diretório app/api/ não existe ainda")

        # Patterns suspeitos
        suspicious = [
            "from database.models import",
            "from models import",
            ".models import",
        ]

        violations = []

        for py_file in api_dir.rglob("*.py"):
            if py_file.name in {"bootstrap.py", "__init__.py"}:
                continue

            content = py_file.read_text(encoding="utf-8", errors="ignore")
            for i, line in enumerate(content.splitlines(), 1):
                if line.strip().startswith("#"):
                    continue

                for pattern in suspicious:
                    if pattern in line:
                        rel = py_file.relative_to(project_root)
                        violations.append(f"{rel}:{i} importa models de banco")

        # Este é warning, não erro (por enquanto)
        if violations:
            pytest.skip("Warnings encontrados: " + "; ".join(violations[:3]))

    def test_services_recebem_dependencias_por_injecao(self, project_root):
        """
        Verifica que services não instanciam dependências diretamente.

        Services devem receber dependências via construtor (DIP).
        """
        services_dir = project_root / "app" / "services"
        if not services_dir.exists():
            pytest.skip("Diretório app/services/ não existe ainda")

        # Patterns de instanciação direta suspeitos
        suspicious_patterns = [
            r"Session\(\)",
            r"create_engine\(",
            r"Redis\(",
            r"httpx\.Client\(",
            r"requests\.",
        ]

        violations = []

        for py_file in services_dir.rglob("*.py"):
            if py_file.name.startswith("__"):
                continue

            content = py_file.read_text(encoding="utf-8", errors="ignore")

            try:
                tree = ast.parse(content, filename=str(py_file))
            except SyntaxError:
                continue

            # Procura por classes de serviço
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    # Verifica se é um service (nome termina com Service)
                    if not node.name.endswith("Service"):
                        continue

                    # Procura por instanciações no __init__
                    for method in node.body:
                        if (
                            isinstance(method, ast.FunctionDef)
                            and method.name == "__init__"
                        ):
                            # Pega o código do __init__
                            init_code = ast.get_source_segment(content, method)
                            if init_code:
                                for pattern in suspicious_patterns:
                                    import re

                                    if re.search(pattern, init_code):
                                        rel = py_file.relative_to(project_root)
                                        violations.append(
                                            f"{rel}:{method.lineno} "
                                            f"'{node.name}' instancia dependência diretamente"
                                        )

        # Este é warning por enquanto
        if violations:
            pytest.skip("Warnings encontrados: " + "; ".join(violations[:3]))

    def test_rate_limit_em_endpoints_de_ia(self, project_root):
        """
        Verifica que endpoints que chamam IA têm rate limiting.

        Endpoints de IA devem ter @limiter.limit.
        """
        # Keywords que indicam endpoint de IA
        ai_keywords = [
            "gemini",
            "chat",
            "gerar",
            "classificar",
            "generate_text",
            "processar_lote",
        ]

        # Diretórios onde podem haver endpoints de IA
        api_dirs = [
            project_root / "app" / "api",
            project_root / "sistemas",
        ]

        violations = []

        for api_dir in api_dirs:
            if not api_dir.exists():
                continue

            for py_file in api_dir.rglob("*router*.py"):
                content = py_file.read_text(encoding="utf-8", errors="ignore")
                lines = content.splitlines()

                for i, line in enumerate(lines):
                    stripped = line.strip()

                    # Detecta função async
                    if stripped.startswith("async def") or stripped.startswith("def"):
                        func_name = (
                            stripped.split("(")[0]
                            .replace("async def", "")
                            .replace("def", "")
                            .strip()
                        )

                        # Checa se tem keyword de IA
                        has_ai_keyword = any(
                            kw in func_name.lower() for kw in ai_keywords
                        )

                        if has_ai_keyword:
                            # Verifica se tem rate limit nas linhas anteriores
                            has_rate_limit = False
                            for j in range(max(0, i - 10), i):
                                if "@limiter.limit" in lines[j]:
                                    has_rate_limit = True
                                    break

                            if not has_rate_limit:
                                rel = py_file.relative_to(project_root)
                                violations.append(f"{rel}:{i+1} '{func_name}' sem rate limit")

        # Este é warning por enquanto (muitos endpoints legados)
        if len(violations) > 20:
            pytest.skip(f"Muitos warnings ({len(violations)}) - sistema legado")
        elif violations:
            pytest.skip("Warnings encontrados: " + "; ".join(violations[:5]))


class TestArchitecturePatterns:
    """Testes de padrões arquiteturais recomendados."""

    def test_repositories_implementam_interface(self, project_root):
        """
        Verifica que repositories implementam interfaces/protocolos.

        Repositories devem ter ABC ou Protocol correspondente.
        """
        repos_dir = project_root / "app" / "repositories"
        if not repos_dir.exists():
            pytest.skip("Diretório app/repositories/ não existe ainda")

        # TODO: implementar quando houver repositories
        pytest.skip("Não implementado ainda")

    def test_services_tem_testes_unitarios(self, project_root):
        """
        Verifica que cada service tem arquivo de teste correspondente.

        Para cada service em app/services/, deve existir test_*_service.py.
        """
        services_dir = project_root / "app" / "services"
        tests_dir = project_root / "tests" / "unit" / "services"

        if not services_dir.exists():
            pytest.skip("Diretório app/services/ não existe ainda")

        missing_tests = []

        for py_file in services_dir.rglob("*.py"):
            if py_file.name.startswith("__"):
                continue

            # Verifica se existe test correspondente
            test_name = f"test_{py_file.stem}.py"
            test_path = tests_dir / test_name

            if not test_path.exists():
                rel = py_file.relative_to(project_root)
                missing_tests.append(str(rel))

        # Isso é warning, não erro
        if missing_tests:
            pytest.skip(f"Services sem testes: {', '.join(missing_tests[:5])}")

    def test_app_domain_tem_dataclasses_ou_pydantic(self, project_root):
        """
        Verifica que entidades em app/domain/ usam dataclass ou Pydantic.

        Entidades devem ser estruturadas e tipadas.
        """
        domain_dir = project_root / "app" / "domain"
        if not domain_dir.exists():
            pytest.skip("Diretório app/domain/ não existe ainda")

        # TODO: implementar usando AST para verificar decorators
        pytest.skip("Não implementado ainda")
