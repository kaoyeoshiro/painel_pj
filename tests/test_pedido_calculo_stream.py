# -*- coding: utf-8 -*-
"""
Testes para PedidoCalculoStreamService.

Verifica lógica de streaming isolada do router HTTP.
"""

import json
import pytest
from unittest.mock import Mock, AsyncMock, patch

from sistemas.pedido_calculo.services_stream import PedidoCalculoStreamService
from sistemas.pedido_calculo.services import PedidoCalculoService
from sistemas.pedido_calculo.models import (
    ResultadoAgente1,
    ResultadoAgente2,
    DadosBasicos,
    DocumentosParaDownload,
    MovimentosRelevantes,
)

pytestmark = pytest.mark.unit


@pytest.fixture
def mock_db():
    """Mock da sessão do banco de dados."""
    db = Mock()
    db.query.return_value.filter.return_value.first.return_value = None
    db.commit = Mock()
    db.rollback = Mock()
    db.add = Mock()
    return db


@pytest.fixture
def mock_user():
    """Mock do usuário autenticado."""
    user = Mock()
    user.id = 1
    user.username = "test_user"
    return user


@pytest.fixture
def mock_service():
    """Mock do PedidoCalculoService."""
    service = Mock(spec=PedidoCalculoService)
    service.modelo = "gemini-3-flash-preview"
    return service


@pytest.fixture
def sample_agente1_result():
    """Resultado exemplo do Agente 1."""
    dados_basicos = DadosBasicos(
        numero_processo="0000000-00.0000.8.12.0000",
        autor="João da Silva",
        cpf_autor="123.456.789-00",
        reu="Estado de Mato Grosso do Sul",
        comarca="Campo Grande",
        vara="1ª Vara de Fazenda Pública",
    )

    return ResultadoAgente1(
        dados_basicos=dados_basicos,
        documentos_para_download=DocumentosParaDownload(),
        movimentos_relevantes=MovimentosRelevantes(),
    )


@pytest.fixture
def sample_agente2_result():
    """Resultado exemplo do Agente 2."""
    from sistemas.pedido_calculo.models import (
        PeriodoCondenacao,
        CorrecaoMonetaria,
        JurosMoratorios,
    )

    result = ResultadoAgente2(
        objeto_condenacao="Pagamento de indenização",
        valor_solicitado_parte="R$ 10.000,00",
    )
    result.periodo_condenacao = PeriodoCondenacao(inicio="01/01/2020", fim="31/12/2020")
    result.correcao_monetaria = CorrecaoMonetaria(indice="IPCA-E", termo_inicial="01/01/2020")
    result.juros_moratorios = JurosMoratorios(taxa="0,5% ao mês", termo_inicial="01/01/2020")

    return result


class TestPedidoCalculoStreamService:
    """Testes para o service de streaming."""

    def test_init_service(self, mock_db, mock_user, mock_service):
        """Testa inicialização do service com dependências."""
        stream_service = PedidoCalculoStreamService(
            db=mock_db,
            user=mock_user,
            service=mock_service,
            numero_cnj="0000000-00.0000.8.12.0000",
            sobrescrever_existente=False,
        )

        assert stream_service.db == mock_db
        assert stream_service.user == mock_user
        assert stream_service.service == mock_service
        assert stream_service.numero_cnj == "0000000-00.0000.8.12.0000"
        assert stream_service.sobrescrever_existente is False
        assert stream_service.ia_logger is not None

    def test_emit_event_format(self, mock_db, mock_user, mock_service):
        """Testa formato dos eventos SSE."""
        stream_service = PedidoCalculoStreamService(
            db=mock_db,
            user=mock_user,
            service=mock_service,
            numero_cnj="0000000-00.0000.8.12.0000",
        )

        event = stream_service._emit_info("Teste de mensagem")

        # Verifica formato SSE
        assert event.startswith("data: ")
        assert event.endswith("\n\n")

        # Parse JSON
        json_data = event.replace("data: ", "").replace("\n\n", "")
        parsed = json.loads(json_data)

        assert parsed["tipo"] == "info"
        assert parsed["mensagem"] == "Teste de mensagem"

    def test_emit_agent_status(self, mock_db, mock_user, mock_service):
        """Testa emissão de status de agente."""
        stream_service = PedidoCalculoStreamService(
            db=mock_db,
            user=mock_user,
            service=mock_service,
            numero_cnj="0000000-00.0000.8.12.0000",
        )

        event = stream_service._emit_agent_status(1, "ativo", "Processando...")

        json_data = event.replace("data: ", "").replace("\n\n", "")
        parsed = json.loads(json_data)

        assert parsed["tipo"] == "agente"
        assert parsed["agente"] == 1
        assert parsed["status"] == "ativo"
        assert parsed["mensagem"] == "Processando..."

    @pytest.mark.asyncio
    async def test_emit_dados_processo(
        self, mock_db, mock_user, mock_service, sample_agente1_result
    ):
        """Testa emissão de dados do processo."""
        stream_service = PedidoCalculoStreamService(
            db=mock_db,
            user=mock_user,
            service=mock_service,
            numero_cnj="0000000-00.0000.8.12.0000",
        )

        events = []
        async for event in stream_service._emit_dados_processo(sample_agente1_result):
            events.append(event)

        # Verifica que emitiu múltiplos eventos
        assert len(events) > 0

        # Verifica que contém informações do processo
        eventos_str = "".join(events)
        assert "0000000-00.0000.8.12.0000" in eventos_str
        # JSON escapa caracteres especiais como \u00e3 (ã)
        assert ("João da Silva" in eventos_str or "Jo\\u00e3o da Silva" in eventos_str)
        assert "Campo Grande" in eventos_str

    @pytest.mark.asyncio
    async def test_emit_dados_extracao(
        self, mock_db, mock_user, mock_service, sample_agente2_result
    ):
        """Testa emissão de dados extraídos."""
        stream_service = PedidoCalculoStreamService(
            db=mock_db,
            user=mock_user,
            service=mock_service,
            numero_cnj="0000000-00.0000.8.12.0000",
        )

        events = []
        async for event in stream_service._emit_dados_extracao(sample_agente2_result):
            events.append(event)

        # Verifica que emitiu múltiplos eventos
        assert len(events) > 0

        # Verifica que contém informações extraídas
        eventos_str = "".join(events)
        # JSON escapa caracteres especiais
        assert (
            "Pagamento de indenização" in eventos_str
            or "Pagamento de indeniza\\u00e7\\u00e3o" in eventos_str
        )
        assert "IPCA-E" in eventos_str
        assert ("0,5% ao mês" in eventos_str or "0,5% ao m\\u00eas" in eventos_str)

    @pytest.mark.asyncio
    async def test_processar_stream_xml_nao_encontrado(self, mock_db, mock_user, mock_service):
        """Testa erro quando processo não encontrado no TJ-MS."""
        stream_service = PedidoCalculoStreamService(
            db=mock_db,
            user=mock_user,
            service=mock_service,
            numero_cnj="0000000-00.0000.8.12.0000",
        )

        # Mock do DocumentDownloader retornando XML de erro
        with patch(
            "sistemas.pedido_calculo.document_downloader.DocumentDownloader"
        ) as mock_downloader:
            mock_downloader_instance = AsyncMock()
            mock_downloader_instance.__aenter__.return_value = mock_downloader_instance
            mock_downloader_instance.__aexit__.return_value = None
            mock_downloader_instance.consultar_processo.return_value = (
                "<sucesso>false</sucesso>"
            )
            mock_downloader.return_value = mock_downloader_instance

            events = []
            async for event in stream_service.processar_stream():
                events.append(event)

            # Verifica que emitiu erro
            eventos_str = "".join(events)
            assert "erro" in eventos_str.lower()
            # JSON escapa caracteres especiais
            assert (
                "não encontrado" in eventos_str.lower()
                or "n\\u00e3o encontrado" in eventos_str.lower()
            )

    @pytest.mark.asyncio
    async def test_processar_stream_erro_analise_xml(self, mock_db, mock_user, mock_service):
        """Testa erro na análise do XML."""
        mock_service.processar_xml = AsyncMock(
            return_value=(None, "Erro ao processar XML")
        )

        stream_service = PedidoCalculoStreamService(
            db=mock_db,
            user=mock_user,
            service=mock_service,
            numero_cnj="0000000-00.0000.8.12.0000",
        )

        # Mock do DocumentDownloader retornando XML válido
        with patch(
            "sistemas.pedido_calculo.document_downloader.DocumentDownloader"
        ) as mock_downloader:
            mock_downloader_instance = AsyncMock()
            mock_downloader_instance.__aenter__.return_value = mock_downloader_instance
            mock_downloader_instance.__aexit__.return_value = None
            mock_downloader_instance.consultar_processo.return_value = "<xml>valid</xml>"
            mock_downloader.return_value = mock_downloader_instance

            events = []
            async for event in stream_service.processar_stream():
                events.append(event)

            # Verifica que emitiu erro
            eventos_str = "".join(events)
            assert "erro" in eventos_str.lower()
            # JSON escapa caracteres especiais
            assert (
                "análise do XML" in eventos_str.lower()
                or "an\\u00e1lise do xml" in eventos_str.lower()
            )

    def test_emit_error_format(self, mock_db, mock_user, mock_service):
        """Testa formato de eventos de erro."""
        stream_service = PedidoCalculoStreamService(
            db=mock_db,
            user=mock_user,
            service=mock_service,
            numero_cnj="0000000-00.0000.8.12.0000",
        )

        event = stream_service._emit_error("Erro de teste")

        json_data = event.replace("data: ", "").replace("\n\n", "")
        parsed = json.loads(json_data)

        assert parsed["tipo"] == "erro"
        assert parsed["mensagem"] == "Erro de teste"
