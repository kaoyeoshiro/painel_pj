# -*- coding: utf-8 -*-
"""
Testes de seguranca para rate limiting e protecao de endpoints.

Verifica:
- /health/detailed requer admin
- /metrics requer admin
- /health basico e publico
- Endpoints de IA possuem decorator de rate limit (analise estatica)
"""

import re
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.security

# Adiciona raiz do projeto ao path
sys.path.insert(0, str(Path(__file__).parent.parent))


class TestEndpointAuth:
    """Testes de protecao de endpoints sensiveis."""

    def test_health_detailed_requires_admin(self):
        """
        /health/detailed deve exigir admin (Depends(require_admin) na assinatura).
        """
        main_path = Path(__file__).parent.parent / "main.py"
        content = main_path.read_text(encoding="utf-8")

        # Procura a funcao health_check_detailed com require_admin
        pattern = re.compile(
            r"async def health_check_detailed\(.*?require_admin.*?\)",
            re.DOTALL,
        )
        assert pattern.search(content), (
            "/health/detailed NAO tem require_admin na assinatura. "
            "Endpoint expoe informacoes sensiveis sem autenticacao."
        )

    def test_metrics_requires_admin(self):
        """
        /metrics deve exigir admin.
        """
        main_path = Path(__file__).parent.parent / "main.py"
        content = main_path.read_text(encoding="utf-8")

        pattern = re.compile(
            r"async def prometheus_metrics\(.*?require_admin.*?\)",
            re.DOTALL,
        )
        assert pattern.search(content), (
            "/metrics NAO tem require_admin na assinatura."
        )

    def test_metrics_json_requires_admin(self):
        """
        /metrics/json deve exigir admin.
        """
        main_path = Path(__file__).parent.parent / "main.py"
        content = main_path.read_text(encoding="utf-8")

        pattern = re.compile(
            r"async def metrics_json\(.*?require_admin.*?\)",
            re.DOTALL,
        )
        assert pattern.search(content), (
            "/metrics/json NAO tem require_admin na assinatura."
        )

    def test_health_basic_is_public(self):
        """
        /health (basico) NAO deve ter auth (necessario para load balancer/k8s).
        """
        main_path = Path(__file__).parent.parent / "main.py"
        content = main_path.read_text(encoding="utf-8")

        # Procura a funcao health_check (sem _detailed)
        pattern = re.compile(
            r"async def health_check\(\):",
        )
        assert pattern.search(content), (
            "/health basico deve ser publico (sem parametros de auth)."
        )


class TestAIEndpointsHaveRateLimit:
    """Verifica que endpoints de IA possuem rate limiting."""

    # Mapa: arquivo -> lista de nomes de funcoes esperados com rate limit
    _AI_ENDPOINTS = {
        "sistemas/gerador_pecas/router.py": [
            "processar_processo_stream",
            "processar_pdfs_stream",
            "editar_minuta_stream",
            "curation_preview",
            "curation_generate_stream",
        ],
        "sistemas/pedido_calculo/router.py": [
            "gerar_pedido",
            "processar_stream",
            "editar_pedido",
        ],
        "sistemas/prestacao_contas/router.py": [
            "analisar_processo_stream",
        ],
        "sistemas/relatorio_cumprimento/router.py": [
            "processar_stream",
        ],
        "sistemas/cumprimento_beta/router.py": [
            "processar_sessao",
            "iniciar_consolidacao",
            "enviar_mensagem",
            "criar_peca",
        ],
        "sistemas/classificador_documentos/router.py": [
            "classificar_documento_avulso",
        ],
        "sistemas/matriculas_confrontantes/router.py": [
            "analisar_documento",
            "analisar_lote",
            "gerar_relatorio",
        ],
        "sistemas/assistencia_judiciaria/router.py": [
            "consultar_processo",
        ],
    }

    def test_ai_endpoints_have_rate_limit_decorator(self):
        """
        Todos os endpoints de IA devem ter @limiter.limit antes da definicao.
        """
        project_root = Path(__file__).parent.parent
        violations = []

        for rel_path, func_names in self._AI_ENDPOINTS.items():
            file_path = project_root / rel_path
            if not file_path.exists():
                violations.append(f"{rel_path}: arquivo nao encontrado")
                continue

            content = file_path.read_text(encoding="utf-8")

            for func_name in func_names:
                # Procura: @limiter.limit(...) seguido de async def func_name(
                pattern = re.compile(
                    rf"@limiter\.limit\(.*?\)\s*\n\s*async def {func_name}\(",
                    re.DOTALL,
                )
                if not pattern.search(content):
                    violations.append(f"{rel_path}: {func_name}() SEM @limiter.limit")

        assert not violations, (
            f"{len(violations)} endpoint(s) de IA sem rate limiting:\n"
            + "\n".join(f"  - {v}" for v in violations)
        )

    def test_ai_routers_import_rate_limit(self):
        """
        Todos os routers de IA devem importar limiter e LIMITS.
        """
        project_root = Path(__file__).parent.parent
        violations = []

        for rel_path in self._AI_ENDPOINTS:
            file_path = project_root / rel_path
            if not file_path.exists():
                continue

            content = file_path.read_text(encoding="utf-8")
            if "from utils.rate_limit import" not in content:
                violations.append(rel_path)

        assert not violations, (
            f"{len(violations)} router(s) sem import de rate_limit:\n"
            + "\n".join(f"  - {v}" for v in violations)
        )
