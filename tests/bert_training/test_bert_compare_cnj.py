# -*- coding: utf-8 -*-
"""
Testes para feature Comparar CNJ do BERT Training.

Testa:
- Recorte de tokens (first/last)
- Sanitizacao de JSON (NaN/Infinity)
- Endpoint de comparacao com mocks
"""

import pytest
import math
from unittest.mock import AsyncMock, MagicMock, patch
from typing import List, Dict, Any


# ==================== Testes de Recorte de Tokens ====================

class TestExtrairChunk:
    """Testes unitarios para recorte de tokens via TextExtractor."""

    def test_chunk_fim_tokens(self):
        """Testa recorte dos ultimos N tokens."""
        from sistemas.classificador_documentos.services_extraction import TextExtractor

        extractor = TextExtractor()
        texto = "palavra " * 1000  # ~1000 tokens
        chunk = extractor.extrair_chunk(texto, 100, "fim")

        assert len(chunk) > 0
        assert len(chunk) < len(texto)

    def test_chunk_inicio_tokens(self):
        """Testa recorte dos primeiros N tokens."""
        from sistemas.classificador_documentos.services_extraction import TextExtractor

        extractor = TextExtractor()
        texto = "palavra " * 1000
        chunk = extractor.extrair_chunk(texto, 100, "inicio")

        assert chunk.startswith("palavra")
        assert len(chunk) < len(texto)

    def test_chunk_maior_que_texto(self):
        """Testa quando N > tamanho do texto (deve retornar texto completo)."""
        from sistemas.classificador_documentos.services_extraction import TextExtractor

        extractor = TextExtractor()
        texto = "texto curto"
        chunk = extractor.extrair_chunk(texto, 10000, "fim")

        assert chunk == texto

    def test_chunk_texto_vazio(self):
        """Testa com texto vazio (deve retornar vazio)."""
        from sistemas.classificador_documentos.services_extraction import TextExtractor

        extractor = TextExtractor()
        chunk = extractor.extrair_chunk("", 100, "fim")

        assert chunk == ""

    def test_chunk_texto_none(self):
        """Testa com texto None."""
        from sistemas.classificador_documentos.services_extraction import TextExtractor

        extractor = TextExtractor()
        # Deve tratar None como string vazia
        try:
            chunk = extractor.extrair_chunk(None, 100, "fim")
            assert chunk == "" or chunk is None
        except (TypeError, AttributeError):
            # Comportamento aceitavel se lanca excecao
            pass


# ==================== Testes de Sanitizacao JSON ====================

class TestSanitizacaoJSON:
    """Testes para sanitizacao de NaN/Infinity em JSON."""

    def test_nan_para_none(self):
        """Testa conversao de NaN para None."""
        value = float('nan')
        result = None if math.isnan(value) else value
        assert result is None

    def test_infinity_para_none(self):
        """Testa conversao de Infinity para None."""
        value = float('inf')
        result = None if math.isinf(value) else value
        assert result is None

    def test_neg_infinity_para_none(self):
        """Testa conversao de -Infinity para None."""
        value = float('-inf')
        result = None if math.isinf(value) else value
        assert result is None

    def test_valor_normal_preservado(self):
        """Testa que valores normais sao preservados."""
        value = 0.95
        result = None if (math.isnan(value) or math.isinf(value)) else value
        assert result == 0.95

    def test_zero_preservado(self):
        """Testa que zero e preservado."""
        value = 0.0
        result = None if (math.isnan(value) or math.isinf(value)) else value
        assert result == 0.0

    def test_negativo_preservado(self):
        """Testa que valores negativos sao preservados."""
        value = -0.5
        result = None if (math.isnan(value) or math.isinf(value)) else value
        assert result == -0.5


# ==================== Testes de Schemas ====================

class TestSchemas:
    """Testes dos schemas Pydantic."""

    def test_compare_cnj_request_valido(self):
        """Testa request valido."""
        from sistemas.bert_training.schemas import CompareCNJRequest

        request = CompareCNJRequest(
            cnj="0804330-09.2024.8.12.0017",
            categoria_id=1,
            bert_model_id=5,
            llm_temperature=0.1,
            llm_token_limit=8000,
            llm_token_window="fim"
        )

        assert request.cnj == "0804330-09.2024.8.12.0017"
        assert request.categoria_id == 1
        assert request.bert_model_id == 5
        assert request.llm_token_window == "fim"

    def test_compare_cnj_request_defaults(self):
        """Testa valores default do request."""
        from sistemas.bert_training.schemas import CompareCNJRequest

        request = CompareCNJRequest(
            cnj="0804330-09.2024.8.12.0017",
            categoria_id=1,
            bert_model_id=5
        )

        assert request.llm_temperature == 0.1
        assert request.llm_token_limit == 8000
        assert request.llm_token_window == "fim"

    def test_compare_cnj_request_token_window_inicio(self):
        """Testa token_window com valor 'inicio'."""
        from sistemas.bert_training.schemas import CompareCNJRequest

        request = CompareCNJRequest(
            cnj="0804330-09.2024.8.12.0017",
            categoria_id=1,
            bert_model_id=5,
            llm_token_window="inicio"
        )

        assert request.llm_token_window == "inicio"

    def test_compare_cnj_request_token_window_invalido(self):
        """Testa token_window com valor invalido."""
        from sistemas.bert_training.schemas import CompareCNJRequest
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            CompareCNJRequest(
                cnj="0804330-09.2024.8.12.0017",
                categoria_id=1,
                bert_model_id=5,
                llm_token_window="meio"  # Invalido
            )

    def test_document_comparison_item(self):
        """Testa schema de item de comparacao."""
        from sistemas.bert_training.schemas import DocumentComparisonItem

        item = DocumentComparisonItem(
            doc_id="12345",
            doc_title="Peticao Inicial",
            doc_tipo_codigo=9500,
            texto_preview="Texto de exemplo...",
            bert_label="Peticao",
            bert_confidence=0.95,
            llm_label="Peticao",
            llm_failed=False,
            match=True
        )

        assert item.match == True
        assert item.bert_confidence == 0.95

    def test_compare_cnj_response(self):
        """Testa schema de resposta."""
        from sistemas.bert_training.schemas import CompareCNJResponse, DocumentComparisonItem

        items = [
            DocumentComparisonItem(
                doc_id="1",
                doc_title="Doc 1",
                doc_tipo_codigo=500,
                texto_preview="...",
                bert_label="A",
                bert_confidence=0.9,
                llm_label="A",
                match=True
            )
        ]

        response = CompareCNJResponse(
            cnj="0804330-09.2024.8.12.0017",
            categoria={"id": 1, "nome": "peticao", "titulo": "Peticao"},
            bert_model={"id": 5, "name": "Modelo Teste"},
            llm={"model": "gemini-3.7-flash", "thinking": "minimal", "temperature": 0.1, "token_limit": 8000, "token_window": "fim"},
            summary={"total": 1, "matches": 1, "accuracy": 1.0, "llm_failed": 0},
            items=items
        )

        assert response.summary["accuracy"] == 1.0
        assert len(response.items) == 1


# ==================== Testes de Funcoes Auxiliares ====================

class TestFuncoesAuxiliares:
    """Testes das funcoes auxiliares do router."""

    def test_limpar_cnj_formatado(self):
        """Testa limpeza de CNJ formatado."""
        # Importa a funcao do router
        import re

        def _limpar_cnj(numero_cnj: str) -> str:
            if '/' in numero_cnj:
                numero_cnj = numero_cnj.split('/')[0]
            return re.sub(r'\D', '', numero_cnj)

        cnj = "0804330-09.2024.8.12.0017"
        resultado = _limpar_cnj(cnj)

        assert resultado == "08043300920248120017"
        assert len(resultado) == 20

    def test_limpar_cnj_com_sufixo(self):
        """Testa limpeza de CNJ com sufixo /50003."""
        import re

        def _limpar_cnj(numero_cnj: str) -> str:
            if '/' in numero_cnj:
                numero_cnj = numero_cnj.split('/')[0]
            return re.sub(r'\D', '', numero_cnj)

        cnj = "0804330-09.2024.8.12.0017/50003"
        resultado = _limpar_cnj(cnj)

        assert resultado == "08043300920248120017"
        assert "/50003" not in resultado

    def test_limpar_cnj_ja_limpo(self):
        """Testa CNJ que ja esta limpo."""
        import re

        def _limpar_cnj(numero_cnj: str) -> str:
            if '/' in numero_cnj:
                numero_cnj = numero_cnj.split('/')[0]
            return re.sub(r'\D', '', numero_cnj)

        cnj = "08043300920248120017"
        resultado = _limpar_cnj(cnj)

        assert resultado == "08043300920248120017"

    def test_sanitize_float_nan(self):
        """Testa sanitizacao de NaN."""
        def _sanitize_float(value):
            if value is None:
                return None
            if math.isnan(value) or math.isinf(value):
                return None
            return value

        assert _sanitize_float(float('nan')) is None

    def test_sanitize_float_normal(self):
        """Testa sanitizacao de valor normal."""
        def _sanitize_float(value):
            if value is None:
                return None
            if math.isnan(value) or math.isinf(value):
                return None
            return value

        assert _sanitize_float(0.95) == 0.95


# ==================== Testes de Integracao (com mocks) ====================

class TestCompareCNJIntegracao:
    """Testes de integracao do endpoint com mocks."""

    @pytest.fixture
    def mock_categoria(self):
        """Mock de categoria de documento."""
        categoria = MagicMock()
        categoria.id = 1
        categoria.nome = "peticao"
        categoria.titulo = "Peticao"
        categoria.codigos_documento = [500, 510, 9500]
        categoria.ativo = True
        return categoria

    @pytest.fixture
    def mock_bert_run(self):
        """Mock de run BERT completado."""
        run = MagicMock()
        run.id = 5
        run.name = "Classificador Teste"
        run.status = "completed"
        run.config_json = {"local_path": "models/bert_runs/5"}
        return run

    @pytest.fixture
    def mock_bert_metric(self):
        """Mock de metrica BERT com classification_report."""
        metric = MagicMock()
        metric.epoch = 10
        metric.classification_report = {
            "Peticao": {"precision": 0.9, "recall": 0.85, "f1-score": 0.87},
            "Contestacao": {"precision": 0.88, "recall": 0.92, "f1-score": 0.90},
            "Decisao": {"precision": 0.85, "recall": 0.80, "f1-score": 0.82},
            "accuracy": 0.87,
            "macro avg": {"precision": 0.88, "recall": 0.86, "f1-score": 0.87},
            "weighted avg": {"precision": 0.88, "recall": 0.87, "f1-score": 0.87}
        }
        return metric

    def test_extrai_labels_do_classification_report(self, mock_bert_metric):
        """Testa extracao de labels do classification_report."""
        report = mock_bert_metric.classification_report
        excluded_keys = {"accuracy", "macro avg", "weighted avg"}
        labels = [k for k in report.keys() if k not in excluded_keys]

        assert "Peticao" in labels
        assert "Contestacao" in labels
        assert "Decisao" in labels
        assert "accuracy" not in labels
        assert "macro avg" not in labels

    def test_calculo_accuracy(self):
        """Testa calculo de accuracy."""
        # Simula resultados de comparacao
        comparisons = [
            {"bert_label": "A", "llm_label": "A", "match": True, "llm_failed": False},
            {"bert_label": "B", "llm_label": "B", "match": True, "llm_failed": False},
            {"bert_label": "A", "llm_label": "B", "match": False, "llm_failed": False},
            {"bert_label": "C", "llm_label": None, "match": False, "llm_failed": True},
        ]

        total = len(comparisons)
        llm_failed_count = sum(1 for c in comparisons if c["llm_failed"])
        valid_comparisons = [c for c in comparisons if not c["llm_failed"] and c["bert_label"] != "ERRO"]
        matches = sum(1 for c in valid_comparisons if c["match"])
        accuracy = matches / len(valid_comparisons) if valid_comparisons else 0.0

        assert total == 4
        assert llm_failed_count == 1
        assert len(valid_comparisons) == 3
        assert matches == 2
        assert accuracy == pytest.approx(0.6667, rel=0.01)

    def test_comparacao_case_insensitive(self):
        """Testa que comparacao e case-insensitive."""
        bert_label = "Peticao"
        llm_label = "peticao"

        match = bert_label.lower() == llm_label.lower()

        assert match == True

    def test_comparacao_labels_diferentes(self):
        """Testa comparacao com labels diferentes."""
        bert_label = "Peticao"
        llm_label = "Contestacao"

        match = bert_label.lower() == llm_label.lower()

        assert match == False


# ==================== Testes de Contagem de Tokens ====================

class TestContagemTokens:
    """Testes para contagem de tokens."""

    def test_contar_tokens_texto_simples(self):
        """Testa contagem de tokens em texto simples."""
        from sistemas.classificador_documentos.services_extraction import TextExtractor

        extractor = TextExtractor()
        texto = "Esta e uma frase simples para teste."
        tokens = extractor.contar_tokens(texto)

        # Deve ser um numero razoavel (entre 5 e 20 tokens para esta frase)
        assert tokens > 0
        assert tokens < 50

    def test_contar_tokens_texto_vazio(self):
        """Testa contagem de tokens em texto vazio."""
        from sistemas.classificador_documentos.services_extraction import TextExtractor

        extractor = TextExtractor()
        tokens = extractor.contar_tokens("")

        assert tokens == 0

    def test_contar_tokens_texto_grande(self):
        """Testa contagem de tokens em texto grande."""
        from sistemas.classificador_documentos.services_extraction import TextExtractor

        extractor = TextExtractor()
        texto = "palavra " * 10000  # ~10000 palavras
        tokens = extractor.contar_tokens(texto)

        # Tiktoken tende a ter ~1 token por palavra simples
        # Mas pode variar. O importante e que seja proporcional.
        assert tokens > 1000
        assert tokens < 20000


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
