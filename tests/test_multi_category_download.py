# tests/test_multi_category_download.py
"""
Testes para o bug de multi-categorias no Extrator de Autos.

Quando Peticao Inicial + Contestacao sao selecionadas, o primeiro documento
(cod 9500) aparece em ambas. Sem fix, a resolucao BERT sobrescreve a de
PrimeiroDocumento, e o doc e perdido.

Cobre:
- Prioridade de resolucao no preview (nao sobrescrever primeiro_cronologico)
- Registro de multiplas resolucoes (resolucoes_todas)
- Protecao de docs nao-BERT na logica do frontend
- Safety net backend em _aplicar_bert_pos_download
- Regressao: docs so-BERT continuam sendo removidos normalmente
"""

import pytest
from dataclasses import dataclass
from typing import Dict, Any, Optional, Set, List
from unittest.mock import AsyncMock, MagicMock, patch

from services.tjms.models import DocumentoTJMS


# =============================================================================
# Helpers
# =============================================================================


def _build_resolucao_por_doc(cat_resolucoes: list) -> Dict[str, Dict[str, Any]]:
    """
    Reproduz a logica de services.py:500-533 (pos-fix) para montar
    resolucao_por_doc a partir de resolucoes de categoria.
    """
    _PRIORIDADE_METODO = {"primeiro_cronologico": 0, "codigo": 1, "bert": 2}
    resolucao_por_doc: Dict[str, Dict[str, Any]] = {}

    for reso in cat_resolucoes:
        metodo = reso["metodo"]
        pred_map = {}
        if reso.get("bert_predictions"):
            for p in reso["bert_predictions"]:
                pred_map[p["doc_id"]] = p

        for did in reso["documento_ids"]:
            info: Dict[str, Any] = {
                "metodo": metodo,
                "categoria": reso["categoria_id"],
            }
            if metodo == "bert":
                if did in pred_map:
                    info["bert_status"] = pred_map[did].get("motivo", "classificado")
                else:
                    info["bert_status"] = "codigo_direto"

            if did not in resolucao_por_doc:
                info["resolucoes_todas"] = [info.copy()]
                resolucao_por_doc[did] = info
            else:
                existing = resolucao_por_doc[did]
                if "resolucoes_todas" not in existing:
                    existing["resolucoes_todas"] = [
                        {k: v for k, v in existing.items() if k != "resolucoes_todas"}
                    ]
                existing["resolucoes_todas"].append(info.copy())
                if _PRIORIDADE_METODO.get(info["metodo"], 99) < _PRIORIDADE_METODO.get(existing["metodo"], 99):
                    for k, v in info.items():
                        if k != "resolucoes_todas":
                            existing[k] = v

    return resolucao_por_doc


def _frontend_filter_bert_candidates(
    preview_resolucoes: List[Dict[str, Any]],
    selected_docs: Set[str],
) -> List[Dict[str, Any]]:
    """
    Reproduz a logica do frontend (index.html) para montar
    resolucoes_especiais excluindo docs protegidos.
    """
    protected_doc_ids: Set[str] = set()
    for reso in preview_resolucoes:
        if reso.get("metodo") != "bert":
            for doc_id in reso.get("documento_ids", []):
                protected_doc_ids.add(doc_id)

    resolucoes = []
    for r in preview_resolucoes:
        if r.get("metodo") != "bert" or not r.get("bert_predictions"):
            continue
        candidatos = [
            p["doc_id"]
            for p in r["bert_predictions"]
            if p.get("motivo") == "candidato_pendente_bert"
            and p["doc_id"] in selected_docs
            and p["doc_id"] not in protected_doc_ids
        ]
        if candidatos:
            resolucoes.append({
                "tipo": "bert",
                "label_match": r.get("detalhes", {}).get("label_match", ""),
                "model_run_id": r.get("detalhes", {}).get("model_run_id"),
                "doc_ids_bert_candidatos": candidatos,
            })
    return resolucoes


# =============================================================================
# Test: Preview - primeiro_cronologico NAO sobrescrita por BERT
# =============================================================================


class TestResolucaoPrioridade:
    """Garante que resolucao primeiro_cronologico tem prioridade sobre BERT."""

    def test_resolucao_primeiro_cronologico_nao_sobrescrita(self):
        """DOC_1 (9500) selecionado por PrimeiroDoc + BERT -> resolucao final = primeiro_cronologico."""
        cat_resolucoes = [
            # PrimeiroDocumentoResolver -> primeiro doc cod 9500
            {
                "metodo": "primeiro_cronologico",
                "categoria_id": 1,  # Peticao Inicial
                "documento_ids": ["DOC_1"],
                "bert_predictions": None,
            },
            # BertClassificationResolver -> todos docs cod 9500 como candidatos
            {
                "metodo": "bert",
                "categoria_id": 2,  # Contestacao
                "documento_ids": ["DOC_1", "DOC_2", "DOC_3"],
                "bert_predictions": [
                    {"doc_id": "DOC_1", "motivo": "candidato_pendente_bert"},
                    {"doc_id": "DOC_2", "motivo": "candidato_pendente_bert"},
                    {"doc_id": "DOC_3", "motivo": "candidato_pendente_bert"},
                ],
            },
        ]

        result = _build_resolucao_por_doc(cat_resolucoes)

        assert result["DOC_1"]["metodo"] == "primeiro_cronologico"
        assert result["DOC_1"]["categoria"] == 1

    def test_resolucoes_todas_registra_multiplas(self):
        """DOC_1 deve ter resolucoes_todas com ambas categorias."""
        cat_resolucoes = [
            {
                "metodo": "primeiro_cronologico",
                "categoria_id": 1,
                "documento_ids": ["DOC_1"],
                "bert_predictions": None,
            },
            {
                "metodo": "bert",
                "categoria_id": 2,
                "documento_ids": ["DOC_1", "DOC_2"],
                "bert_predictions": [
                    {"doc_id": "DOC_1", "motivo": "candidato_pendente_bert"},
                    {"doc_id": "DOC_2", "motivo": "candidato_pendente_bert"},
                ],
            },
        ]

        result = _build_resolucao_por_doc(cat_resolucoes)

        assert len(result["DOC_1"]["resolucoes_todas"]) == 2
        metodos = [r["metodo"] for r in result["DOC_1"]["resolucoes_todas"]]
        assert "primeiro_cronologico" in metodos
        assert "bert" in metodos

    def test_bert_nao_sobrescreve_codigo(self):
        """Resolucao 'codigo' tambem nao deve ser sobrescrita por BERT."""
        cat_resolucoes = [
            {
                "metodo": "codigo",
                "categoria_id": 5,
                "documento_ids": ["DOC_X"],
                "bert_predictions": None,
            },
            {
                "metodo": "bert",
                "categoria_id": 2,
                "documento_ids": ["DOC_X"],
                "bert_predictions": [
                    {"doc_id": "DOC_X", "motivo": "candidato_pendente_bert"},
                ],
            },
        ]

        result = _build_resolucao_por_doc(cat_resolucoes)
        assert result["DOC_X"]["metodo"] == "codigo"
        assert result["DOC_X"]["categoria"] == 5

    def test_only_bert_categories_no_conflict(self):
        """Sem conflito: BERT unica resolucao -> mantida normalmente."""
        cat_resolucoes = [
            {
                "metodo": "bert",
                "categoria_id": 2,
                "documento_ids": ["DOC_A"],
                "bert_predictions": [
                    {"doc_id": "DOC_A", "motivo": "candidato_pendente_bert"},
                ],
            },
        ]

        result = _build_resolucao_por_doc(cat_resolucoes)
        assert result["DOC_A"]["metodo"] == "bert"
        assert result["DOC_A"]["bert_status"] == "candidato_pendente_bert"

    def test_multiple_docs_same_code_both_selected(self):
        """Varios docs cod 9500: primeiro = PrimeiroDoc, outros = BERT candidatos."""
        cat_resolucoes = [
            {
                "metodo": "primeiro_cronologico",
                "categoria_id": 1,
                "documento_ids": ["DOC_1"],
                "bert_predictions": None,
            },
            {
                "metodo": "bert",
                "categoria_id": 2,
                "documento_ids": ["DOC_1", "DOC_2", "DOC_3"],
                "bert_predictions": [
                    {"doc_id": "DOC_1", "motivo": "candidato_pendente_bert"},
                    {"doc_id": "DOC_2", "motivo": "candidato_pendente_bert"},
                    {"doc_id": "DOC_3", "motivo": "candidato_pendente_bert"},
                ],
            },
        ]

        result = _build_resolucao_por_doc(cat_resolucoes)

        # DOC_1 = primeiro_cronologico (protegido)
        assert result["DOC_1"]["metodo"] == "primeiro_cronologico"
        # DOC_2, DOC_3 = bert (candidatos normais)
        assert result["DOC_2"]["metodo"] == "bert"
        assert result["DOC_3"]["metodo"] == "bert"


# =============================================================================
# Test: Frontend - docs protegidos excluidos de BERT candidates
# =============================================================================


class TestFrontendProtectedFilter:
    """Simula logica frontend que exclui docs protegidos dos candidatos BERT."""

    def test_protected_doc_not_in_bert_candidates(self):
        """Doc em cat nao-BERT (primeiro_cronologico) NAO aparece como candidato BERT."""
        preview_resolucoes = [
            {
                "metodo": "primeiro_cronologico",
                "documento_ids": ["DOC_1"],
                "bert_predictions": None,
            },
            {
                "metodo": "bert",
                "documento_ids": ["DOC_1", "DOC_2"],
                "bert_predictions": [
                    {"doc_id": "DOC_1", "motivo": "candidato_pendente_bert"},
                    {"doc_id": "DOC_2", "motivo": "candidato_pendente_bert"},
                ],
                "detalhes": {"label_match": "contestacao", "model_run_id": 5},
            },
        ]
        selected = {"DOC_1", "DOC_2"}

        resolucoes = _frontend_filter_bert_candidates(preview_resolucoes, selected)

        assert len(resolucoes) == 1
        assert "DOC_1" not in resolucoes[0]["doc_ids_bert_candidatos"]
        assert "DOC_2" in resolucoes[0]["doc_ids_bert_candidatos"]

    def test_unprotected_docs_sent_normally(self):
        """Docs so-BERT sao enviados normalmente como candidatos."""
        preview_resolucoes = [
            {
                "metodo": "bert",
                "documento_ids": ["DOC_A", "DOC_B"],
                "bert_predictions": [
                    {"doc_id": "DOC_A", "motivo": "candidato_pendente_bert"},
                    {"doc_id": "DOC_B", "motivo": "candidato_pendente_bert"},
                ],
                "detalhes": {"label_match": "contestacao"},
            },
        ]
        selected = {"DOC_A", "DOC_B"}

        resolucoes = _frontend_filter_bert_candidates(preview_resolucoes, selected)

        assert len(resolucoes) == 1
        assert set(resolucoes[0]["doc_ids_bert_candidatos"]) == {"DOC_A", "DOC_B"}


# =============================================================================
# Test: Backend safety net - _aplicar_bert_pos_download
# =============================================================================


class TestBackendSafetyNet:
    """Testa que _aplicar_bert_pos_download protege docs nao-BERT."""

    @pytest.mark.asyncio
    async def test_backend_safety_protected_doc_survives_bert_rejection(self):
        """Doc protegido (nao e candidato BERT) sobrevive mesmo se BERT o rejeitasse."""
        from sistemas.extrator_autos.services import ExtratorAutosService

        # Mock service com BERT disponivel
        service = ExtratorAutosService.__new__(ExtratorAutosService)
        service.bert_client = AsyncMock()
        service.bert_client.check_health = AsyncMock(return_value={"available": True})
        # BERT classifica como "peticao" (nao "contestacao") -> deveria rejeitar
        service.bert_client.classify = AsyncMock(return_value={
            "predicted_label": "peticao_inicial",
            "confidence": 0.92,
        })
        service._report_progress = AsyncMock()

        # DOC_1 baixado (protegido - nao aparece em bert_candidatos)
        # DOC_2 baixado (candidato BERT)
        docs = {
            "DOC_1": DocumentoTJMS(
                id="DOC_1", numero_processo="123",
                conteudo_bytes=b"fake pdf content for DOC_1",
            ),
            "DOC_2": DocumentoTJMS(
                id="DOC_2", numero_processo="123",
                conteudo_bytes=b"fake pdf content for DOC_2",
            ),
        }

        # Resolucoes: somente DOC_2 como candidato BERT
        resolucoes = [
            {
                "tipo": "bert",
                "label_match": "contestacao",
                "model_run_id": 5,
                "doc_ids_bert_candidatos": ["DOC_2"],  # DOC_1 NAO esta aqui
            },
        ]

        with patch("sistemas.extrator_autos.services.pdf_to_text", new_callable=AsyncMock) as mock_pdf:
            mock_pdf.return_value = "Texto longo o suficiente para classificacao BERT " * 5

            result = await service._aplicar_bert_pos_download(docs, resolucoes)

        # DOC_1 DEVE estar presente (protegido)
        assert "DOC_1" in result
        # DOC_2 removido (BERT classificou como peticao, nao contestacao)
        assert "DOC_2" not in result

    @pytest.mark.asyncio
    async def test_unprotected_bert_candidate_removed_normally(self):
        """Doc so-BERT que BERT rejeita deve ser removido (regressao)."""
        from sistemas.extrator_autos.services import ExtratorAutosService

        service = ExtratorAutosService.__new__(ExtratorAutosService)
        service.bert_client = AsyncMock()
        service.bert_client.check_health = AsyncMock(return_value={"available": True})
        service.bert_client.classify = AsyncMock(return_value={
            "predicted_label": "peticao_inicial",
            "confidence": 0.88,
        })
        service._report_progress = AsyncMock()

        docs = {
            "DOC_A": DocumentoTJMS(
                id="DOC_A", numero_processo="456",
                conteudo_bytes=b"fake pdf for DOC_A",
            ),
        }

        resolucoes = [
            {
                "tipo": "bert",
                "label_match": "contestacao",
                "doc_ids_bert_candidatos": ["DOC_A"],
            },
        ]

        with patch("sistemas.extrator_autos.services.pdf_to_text", new_callable=AsyncMock) as mock_pdf:
            mock_pdf.return_value = "Texto contestacao fake " * 10

            result = await service._aplicar_bert_pos_download(docs, resolucoes)

        assert "DOC_A" not in result

    @pytest.mark.asyncio
    async def test_bert_unavailable_protected_doc_kept(self):
        """BERT indisponivel: candidatos removidos, mas protegidos mantidos."""
        from sistemas.extrator_autos.services import ExtratorAutosService

        service = ExtratorAutosService.__new__(ExtratorAutosService)
        service.bert_client = AsyncMock()
        service.bert_client.check_health = AsyncMock(return_value={"available": False})
        service._report_progress = AsyncMock()

        docs = {
            "DOC_1": DocumentoTJMS(id="DOC_1", numero_processo="789"),
            "DOC_2": DocumentoTJMS(id="DOC_2", numero_processo="789"),
            "DOC_3": DocumentoTJMS(id="DOC_3", numero_processo="789"),
        }

        # DOC_2 e DOC_3 sao candidatos BERT; DOC_1 nao
        resolucoes = [
            {
                "tipo": "bert",
                "label_match": "contestacao",
                "doc_ids_bert_candidatos": ["DOC_2", "DOC_3"],
            },
        ]

        result = await service._aplicar_bert_pos_download(docs, resolucoes)

        # DOC_1 protegido, mantido
        assert "DOC_1" in result
        # DOC_2, DOC_3 removidos (BERT indisponivel)
        assert "DOC_2" not in result
        assert "DOC_3" not in result

    @pytest.mark.asyncio
    async def test_only_bert_categories_no_protected_docs(self):
        """Sem docs protegidos: comportamento inalterado."""
        from sistemas.extrator_autos.services import ExtratorAutosService

        service = ExtratorAutosService.__new__(ExtratorAutosService)
        service.bert_client = AsyncMock()
        service.bert_client.check_health = AsyncMock(return_value={"available": True})
        service.bert_client.classify = AsyncMock(return_value={
            "predicted_label": "contestacao",
            "confidence": 0.95,
        })
        service._report_progress = AsyncMock()

        docs = {
            "DOC_X": DocumentoTJMS(
                id="DOC_X", numero_processo="111",
                conteudo_bytes=b"pdf content",
            ),
            "DOC_Y": DocumentoTJMS(
                id="DOC_Y", numero_processo="111",
                conteudo_bytes=b"pdf content",
            ),
        }

        resolucoes = [
            {
                "tipo": "bert",
                "label_match": "contestacao",
                "doc_ids_bert_candidatos": ["DOC_X", "DOC_Y"],
            },
        ]

        with patch("sistemas.extrator_autos.services.pdf_to_text", new_callable=AsyncMock) as mock_pdf:
            mock_pdf.return_value = "Texto da contestacao " * 10

            result = await service._aplicar_bert_pos_download(docs, resolucoes)

        # Ambos classificados como contestacao -> mantidos
        assert "DOC_X" in result
        assert "DOC_Y" in result


# =============================================================================
# Test: Schema validators - normalizar opcoes por formato
# =============================================================================


class TestSchemaFormatoNormalization:
    """Testa model_validators que normalizam opcoes conforme formato."""

    def test_xml_only_forca_salvar_xml(self):
        """modo_saida=xml_only deve forcar salvar_xml_completo=True."""
        from sistemas.extrator_autos.schemas import BaixarDocumentosRequest

        req = BaixarDocumentosRequest(
            numero_cnj="08704651720258120001",
            documento_ids=["DOC_1"],
            modo_saida="xml_only",
            salvar_xml_completo=False,  # usuario nao marcou
        )
        assert req.salvar_xml_completo is True

    def test_xml_only_desabilita_mesclar(self):
        """modo_saida=xml_only deve forcar mesclar_pdfs=False."""
        from sistemas.extrator_autos.schemas import BaixarDocumentosRequest

        req = BaixarDocumentosRequest(
            numero_cnj="08704651720258120001",
            documento_ids=["DOC_1"],
            modo_saida="xml_only",
            mesclar_pdfs=True,
        )
        assert req.mesclar_pdfs is False

    def test_txt_desabilita_mesclar(self):
        """modo_saida=txt deve forcar mesclar_pdfs=False."""
        from sistemas.extrator_autos.schemas import BaixarDocumentosRequest

        req = BaixarDocumentosRequest(
            numero_cnj="08704651720258120001",
            documento_ids=["DOC_1"],
            modo_saida="txt",
            mesclar_pdfs=True,
        )
        assert req.mesclar_pdfs is False

    def test_pdf_mantem_mesclar(self):
        """modo_saida=pdf permite mesclar_pdfs=True."""
        from sistemas.extrator_autos.schemas import BaixarDocumentosRequest

        req = BaixarDocumentosRequest(
            numero_cnj="08704651720258120001",
            documento_ids=["DOC_1"],
            modo_saida="pdf",
            mesclar_pdfs=True,
        )
        assert req.mesclar_pdfs is True

    def test_pdf_txt_nao_forca_xml(self):
        """modo_saida=pdf_txt nao deve forcar salvar_xml."""
        from sistemas.extrator_autos.schemas import BaixarDocumentosRequest

        req = BaixarDocumentosRequest(
            numero_cnj="08704651720258120001",
            documento_ids=["DOC_1"],
            modo_saida="pdf_txt",
            salvar_xml_completo=False,
        )
        assert req.salvar_xml_completo is False

    def test_lote_xml_only_forca_salvar_xml(self):
        """BaixarLoteRequest com xml_only deve forcar salvar_xml_completo=True."""
        from sistemas.extrator_autos.schemas import BaixarLoteRequest

        req = BaixarLoteRequest(
            numeros_cnj=["08704651720258120001"],
            modo_saida="xml_only",
            salvar_xml_completo=False,
        )
        assert req.salvar_xml_completo is True
        assert req.mesclar_pdfs is False
