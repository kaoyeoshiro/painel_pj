# tests/test_batch_lote.py
"""
Testes para o modo lote v2 do Extrator de Autos.

Cobre: processar_lote_v2 (CategoryResolver completo), resumo_lote,
deduplicacao, erro por processo, BERT pos-download, filtro por periodo.
"""

import asyncio
import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

from sistemas.extrator_autos.services import ExtratorAutosService, LoteResult
from sistemas.extrator_autos.services_category_resolver import (
    DocumentoCandidate,
    ResolutionResult,
    resolve_all_categories,
)


# =============================================================================
# Mocks
# =============================================================================


class MockBertClient:
    """BERT client simulado."""

    def __init__(self, available=True, result_label="contestacao", confidence=0.95):
        self.available = available
        self.result_label = result_label
        self.confidence = confidence

    async def check_health(self):
        return {"available": self.available, "mode": "inference" if self.available else "unavailable"}

    async def classify(self, text, model_name=None):
        return {
            "predicted_label": self.result_label,
            "confidence": self.confidence,
            "source": "bert_classifier",
        }


class MockCategoria:
    """Categoria de documento simulada."""

    def __init__(self, id, nome, codigos, is_primeiro=False, resolver_config=None):
        self.id = id
        self.nome = nome
        self.titulo = nome.title()
        self.codigos_documento = codigos
        self.is_primeiro_documento = is_primeiro
        self.resolver_config = resolver_config
        self.ativo = True

    def get_codigos(self):
        return self.codigos_documento or []


class MockDocBaixado:
    """Simula DocumentoTJMS baixado."""

    def __init__(self, sucesso=True, conteudo=b"PDF content"):
        self.sucesso = sucesso
        self.conteudo_bytes = conteudo if sucesso else None
        self.erro = None if sucesso else "Erro simulado"


def make_doc_info(doc_id, tipo_codigo, descricao="Doc", data_juntada=None):
    """Cria dict de info de documento como retornado por consultar_processo."""
    return {
        "id": doc_id,
        "tipo_codigo": tipo_codigo,
        "tipo_descricao": descricao,
        "descricao": descricao,
        "data_juntada": data_juntada,
        "mimetype": "application/pdf",
        "ordem": 0,
    }


def make_consulta_result(cnj, docs_info, erro=None):
    """Cria resultado simulado de consultar_processo."""
    return {
        "numero_cnj": cnj,
        "processo": {"numero_cnj": cnj} if not erro else None,
        "documentos": docs_info if not erro else [],
        "erro": erro,
    }


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_db():
    """Mock de sessao de banco."""
    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    return db


@pytest.fixture
def service(mock_db):
    """Service com mocks."""
    svc = ExtratorAutosService(mock_db)
    svc.bert_client = MockBertClient(available=False)
    svc.tjms_client = MagicMock()
    return svc


# =============================================================================
# Testes: processar_lote_v2
# =============================================================================


class TestProcessarLoteV2:
    """Testes para processar_lote_v2."""

    @pytest.mark.asyncio
    async def test_lote_com_codigo_simples(self, service):
        """Filtro por codigos sem categorias — usa codigos_fallback."""
        cnj1 = "08001234520248120001"
        docs = [
            make_doc_info("d1", 500, "Peticao Inicial"),
            make_doc_info("d2", 8320, "Contestacao"),
            make_doc_info("d3", 510, "Peticao Intermediaria"),
        ]

        service.consultar_processo = AsyncMock(return_value=make_consulta_result(cnj1, docs))
        service.tjms_client.baixar_documentos = AsyncMock(return_value={
            "d1": MockDocBaixado(),
        })

        with patch.object(service, '_processar_documentos_para_zip', new_callable=AsyncMock) as mock_proc:
            mock_proc.return_value = [{"nome": "doc.pdf", "conteudo": b"pdf", "tipo": "pdf"}]
            with patch('sistemas.extrator_autos.services.criar_zip_resultado', new_callable=AsyncMock) as mock_zip:
                mock_zip.return_value = b"ZIP"

                resultado = await service.processar_lote_v2(
                    numeros_cnj=[cnj1],
                    categorias_ids=[],
                    codigos_fallback=[500],
                )

        assert isinstance(resultado, LoteResult)
        assert resultado.total_processos == 1
        assert resultado.total_processados == 1
        assert resultado.total_erros == 0
        # Verificar que download foi chamado com doc d1 (codigo 500)
        call_args = service.tjms_client.baixar_documentos.call_args
        assert "d1" in call_args[0][1]

    @pytest.mark.asyncio
    async def test_lote_com_categoria_simples(self, service, mock_db):
        """CategoryResolver SimpleCode por processo."""
        cnj1 = "08001234520248120001"
        cat = MockCategoria(1, "Contestacao", [8320])
        docs = [
            make_doc_info("d1", 500),
            make_doc_info("d2", 8320),
        ]

        mock_db.query.return_value.filter.return_value.all.return_value = [cat]
        service.consultar_processo = AsyncMock(return_value=make_consulta_result(cnj1, docs))
        service.tjms_client.baixar_documentos = AsyncMock(return_value={
            "d2": MockDocBaixado(),
        })

        with patch.object(service, '_processar_documentos_para_zip', new_callable=AsyncMock) as mock_proc:
            mock_proc.return_value = [{"nome": "doc.pdf", "conteudo": b"pdf", "tipo": "pdf"}]
            with patch('sistemas.extrator_autos.services.criar_zip_resultado', new_callable=AsyncMock) as mock_zip:
                mock_zip.return_value = b"ZIP"

                resultado = await service.processar_lote_v2(
                    numeros_cnj=[cnj1],
                    categorias_ids=[1],
                )

        assert resultado.total_processados == 1
        call_args = service.tjms_client.baixar_documentos.call_args
        assert "d2" in call_args[0][1]
        assert "d1" not in call_args[0][1]

    @pytest.mark.asyncio
    async def test_lote_com_primeiro_documento(self, service, mock_db):
        """PrimeiroDocumentoResolver seleciona doc mais antigo se tipo_codigo bate."""
        cnj1 = "08001234520248120001"
        # Codigos incluem 510 (o mais antigo deve ter esse codigo)
        cat = MockCategoria(1, "PrimeiroDoc", [500, 510], is_primeiro=True,
                            resolver_config={"type": "primeiro_cronologico"})
        docs = [
            make_doc_info("d1", 500, data_juntada="2024-03-01T10:00:00"),
            make_doc_info("d2", 510, data_juntada="2024-01-01T08:00:00"),
        ]

        mock_db.query.return_value.filter.return_value.all.return_value = [cat]
        service.consultar_processo = AsyncMock(return_value=make_consulta_result(cnj1, docs))
        service.tjms_client.baixar_documentos = AsyncMock(return_value={
            "d2": MockDocBaixado(),
        })

        with patch.object(service, '_processar_documentos_para_zip', new_callable=AsyncMock) as mock_proc:
            mock_proc.return_value = [{"nome": "doc.pdf", "conteudo": b"pdf", "tipo": "pdf"}]
            with patch('sistemas.extrator_autos.services.criar_zip_resultado', new_callable=AsyncMock) as mock_zip:
                mock_zip.return_value = b"ZIP"

                resultado = await service.processar_lote_v2(
                    numeros_cnj=[cnj1],
                    categorias_ids=[1],
                )

        assert resultado.total_processados == 1

    @pytest.mark.asyncio
    async def test_lote_bert_indisponivel(self, service, mock_db):
        """Fallback: BERT offline, so matches diretos sao usados."""
        cnj1 = "08001234520248120001"
        cat = MockCategoria(1, "Contestacao BERT", [8320],
                            resolver_config={"type": "bert", "label_match": "contestacao", "codigos_bert": [510]})
        docs = [
            make_doc_info("d1", 8320),
            make_doc_info("d2", 510),
        ]

        mock_db.query.return_value.filter.return_value.all.return_value = [cat]
        service.bert_client = MockBertClient(available=False)
        service.consultar_processo = AsyncMock(return_value=make_consulta_result(cnj1, docs))
        service.tjms_client.baixar_documentos = AsyncMock(return_value={
            "d1": MockDocBaixado(),
        })

        with patch.object(service, '_processar_documentos_para_zip', new_callable=AsyncMock) as mock_proc:
            mock_proc.return_value = [{"nome": "doc.pdf", "conteudo": b"pdf", "tipo": "pdf"}]
            with patch('sistemas.extrator_autos.services.criar_zip_resultado', new_callable=AsyncMock) as mock_zip:
                mock_zip.return_value = b"ZIP"

                resultado = await service.processar_lote_v2(
                    numeros_cnj=[cnj1],
                    categorias_ids=[1],
                )

        assert resultado.total_processados == 1
        assert resultado.total_docs_filtrados_bert == 0

    @pytest.mark.asyncio
    async def test_deduplicacao_doc_multiplas_categorias(self, service, mock_db):
        """Doc em 2 categorias e baixado apenas 1x."""
        cnj1 = "08001234520248120001"
        cat1 = MockCategoria(1, "Cat A", [8320])
        cat2 = MockCategoria(2, "Cat B", [8320, 500])
        docs = [
            make_doc_info("d1", 8320),
            make_doc_info("d2", 500),
        ]

        mock_db.query.return_value.filter.return_value.all.return_value = [cat1, cat2]
        service.consultar_processo = AsyncMock(return_value=make_consulta_result(cnj1, docs))
        service.tjms_client.baixar_documentos = AsyncMock(return_value={
            "d1": MockDocBaixado(),
            "d2": MockDocBaixado(),
        })

        with patch.object(service, '_processar_documentos_para_zip', new_callable=AsyncMock) as mock_proc:
            mock_proc.return_value = [{"nome": "doc.pdf", "conteudo": b"pdf", "tipo": "pdf"}]
            with patch('sistemas.extrator_autos.services.criar_zip_resultado', new_callable=AsyncMock) as mock_zip:
                mock_zip.return_value = b"ZIP"

                resultado = await service.processar_lote_v2(
                    numeros_cnj=[cnj1],
                    categorias_ids=[1, 2],
                )

        # d1 aparece em cat1 e cat2, mas download e chamado 1x
        call_args = service.tjms_client.baixar_documentos.call_args
        doc_ids_baixados = call_args[0][1]
        assert len(doc_ids_baixados) == len(set(doc_ids_baixados)), "doc_ids devem ser unicos"

    @pytest.mark.asyncio
    async def test_erro_processo_nao_aborta_lote(self, service):
        """Falha em 1 processo nao impede outros."""
        cnj1 = "08001234520248120001"
        cnj2 = "08005678920248120002"
        docs2 = [make_doc_info("d1", 500)]

        async def consultar_side_effect(cnj, **kwargs):
            if cnj == cnj1:
                return make_consulta_result(cnj1, [], erro="Processo nao encontrado")
            return make_consulta_result(cnj2, docs2)

        service.consultar_processo = AsyncMock(side_effect=consultar_side_effect)
        service.tjms_client.baixar_documentos = AsyncMock(return_value={
            "d1": MockDocBaixado(),
        })

        with patch.object(service, '_processar_documentos_para_zip', new_callable=AsyncMock) as mock_proc:
            mock_proc.return_value = [{"nome": "doc.pdf", "conteudo": b"pdf", "tipo": "pdf"}]
            with patch('sistemas.extrator_autos.services.criar_zip_resultado', new_callable=AsyncMock) as mock_zip:
                mock_zip.return_value = b"ZIP"

                resultado = await service.processar_lote_v2(
                    numeros_cnj=[cnj1, cnj2],
                    categorias_ids=[],
                    codigos_fallback=[500],
                    pausa=0.0,
                )

        assert resultado.total_processos == 2
        assert resultado.total_processados == 1
        assert resultado.total_erros == 1
        assert resultado.detalhes_por_processo[0]["status"].startswith("erro_consulta")
        assert resultado.detalhes_por_processo[1]["status"] == "ok"

    @pytest.mark.asyncio
    async def test_detalhes_por_processo(self, service):
        """LoteResult.detalhes registra status e tempo por CNJ."""
        cnj1 = "08001234520248120001"
        docs = [make_doc_info("d1", 500)]

        service.consultar_processo = AsyncMock(return_value=make_consulta_result(cnj1, docs))
        service.tjms_client.baixar_documentos = AsyncMock(return_value={
            "d1": MockDocBaixado(),
        })

        with patch.object(service, '_processar_documentos_para_zip', new_callable=AsyncMock) as mock_proc:
            mock_proc.return_value = [{"nome": "doc.pdf", "conteudo": b"pdf", "tipo": "pdf"}]
            with patch('sistemas.extrator_autos.services.criar_zip_resultado', new_callable=AsyncMock) as mock_zip:
                mock_zip.return_value = b"ZIP"

                resultado = await service.processar_lote_v2(
                    numeros_cnj=[cnj1],
                    categorias_ids=[],
                    codigos_fallback=[500],
                )

        assert len(resultado.detalhes_por_processo) == 1
        det = resultado.detalhes_por_processo[0]
        assert det["cnj"] == cnj1
        assert det["status"] == "ok"
        assert det["tempo_s"] >= 0
        assert det["docs_baixados"] == 1

    @pytest.mark.asyncio
    async def test_processo_sem_documentos_filtrados(self, service):
        """Processo sem docs para os codigos solicitados aparece como sem_documentos."""
        cnj1 = "08001234520248120001"
        docs = [make_doc_info("d1", 999)]  # Codigo nao solicitado

        service.consultar_processo = AsyncMock(return_value=make_consulta_result(cnj1, docs))

        with patch('sistemas.extrator_autos.services.criar_zip_resultado', new_callable=AsyncMock) as mock_zip:
            mock_zip.return_value = b"ZIP"

            resultado = await service.processar_lote_v2(
                numeros_cnj=[cnj1],
                categorias_ids=[],
                codigos_fallback=[500],
            )

        assert resultado.total_processados == 0
        assert resultado.detalhes_por_processo[0]["status"] == "sem_documentos"

    @pytest.mark.asyncio
    async def test_callback_e_invocado(self, service):
        """Callback de progresso e invocado durante processamento."""
        cnj1 = "08001234520248120001"
        docs = [make_doc_info("d1", 500)]

        service.consultar_processo = AsyncMock(return_value=make_consulta_result(cnj1, docs))
        service.tjms_client.baixar_documentos = AsyncMock(return_value={
            "d1": MockDocBaixado(),
        })

        callback_calls = []

        async def track_callback(pct, msg):
            callback_calls.append((pct, msg))

        with patch.object(service, '_processar_documentos_para_zip', new_callable=AsyncMock) as mock_proc:
            mock_proc.return_value = [{"nome": "doc.pdf", "conteudo": b"pdf", "tipo": "pdf"}]
            with patch('sistemas.extrator_autos.services.criar_zip_resultado', new_callable=AsyncMock) as mock_zip:
                mock_zip.return_value = b"ZIP"

                await service.processar_lote_v2(
                    numeros_cnj=[cnj1],
                    categorias_ids=[],
                    codigos_fallback=[500],
                    callback=track_callback,
                )

        assert len(callback_calls) >= 2  # Pelo menos inicio + fim


# =============================================================================
# Testes: resumo_lote
# =============================================================================


class TestResumoLote:
    """Testes para resumo_lote (sem consultar TJ-MS)."""

    @pytest.mark.asyncio
    async def test_resumo_lote_sem_consulta_tjms(self, service, mock_db):
        """Resumo nao faz request ao TJ-MS."""
        cat = MockCategoria(1, "Contestacao", [8320])
        mock_db.query.return_value.filter.return_value.all.return_value = [cat]

        resultado = await service.resumo_lote(categorias_ids=[1])

        assert resultado["total_codigos_unicos"] == 1
        assert len(resultado["categorias_selecionadas"]) == 1
        # TJ-MS nunca deve ser chamado
        service.tjms_client.consultar_processo.assert_not_called()

    @pytest.mark.asyncio
    async def test_resumo_indica_bert(self, service, mock_db):
        """Resumo identifica categorias BERT."""
        cat = MockCategoria(1, "Contestacao BERT", [8320],
                            resolver_config={"type": "bert", "label_match": "contestacao"})
        mock_db.query.return_value.filter.return_value.all.return_value = [cat]
        service.bert_client = MockBertClient(available=True)

        resultado = await service.resumo_lote(categorias_ids=[1])

        assert resultado["tem_categorias_bert"] is True
        assert resultado["aviso"] is None

    @pytest.mark.asyncio
    async def test_resumo_indica_primeiro_doc(self, service, mock_db):
        """Resumo identifica categorias PrimeiroDocumento."""
        cat = MockCategoria(1, "PrimeiroDoc", [], is_primeiro=True,
                            resolver_config={"type": "primeiro_cronologico"})
        mock_db.query.return_value.filter.return_value.all.return_value = [cat]

        resultado = await service.resumo_lote(categorias_ids=[1])

        assert resultado["tem_categorias_primeiro_doc"] is True

    @pytest.mark.asyncio
    async def test_resumo_aviso_bert_indisponivel(self, service, mock_db):
        """Resumo mostra aviso quando BERT esta indisponivel."""
        cat = MockCategoria(1, "Contestacao BERT", [8320],
                            resolver_config={"type": "bert", "label_match": "contestacao"})
        mock_db.query.return_value.filter.return_value.all.return_value = [cat]
        service.bert_client = MockBertClient(available=False)

        resultado = await service.resumo_lote(categorias_ids=[1])

        assert resultado["tem_categorias_bert"] is True
        assert resultado["aviso"] is not None
        assert "indisponivel" in resultado["aviso"].lower()
