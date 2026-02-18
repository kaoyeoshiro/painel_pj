"""
Testes de compatibilidade de imports após reorganização para `app/`.
"""

import pytest

pytestmark = pytest.mark.unit


def test_repositorio_gerador_pecas_compat():
    from app.repositories.sqlalchemy.gerador_pecas import GeracaoPecaRepository as NovoRepo
    from sistemas.gerador_pecas.repositories import GeracaoPecaRepository as LegadoRepo

    assert LegadoRepo is NovoRepo


def test_repositorio_pedido_calculo_compat():
    from app.repositories.sqlalchemy.pedido_calculo import (
        GeracaoPedidoCalculoRepository as NovoRepo,
    )
    from sistemas.pedido_calculo.repositories import (
        GeracaoPedidoCalculoRepository as LegadoRepo,
    )

    assert LegadoRepo is NovoRepo


def test_bootstrap_api_v1_disponivel():
    from app.api.bootstrap import register_routers
    from app.api.v1.routers import register_v1_routers

    assert callable(register_routers)
    assert callable(register_v1_routers)


def test_ports_disponiveis_no_namespace_adapters():
    from app.adapters import IBertPort, IGeminiPort, ITJMSPort
    from app.adapters.ports import IBertPort as PortBert
    from app.adapters.ports import IGeminiPort as PortGemini
    from app.adapters.ports import ITJMSPort as PortTJMS

    assert IBertPort is PortBert
    assert IGeminiPort is PortGemini
    assert ITJMSPort is PortTJMS

