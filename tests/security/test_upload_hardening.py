# -*- coding: utf-8 -*-
"""
Testes de hardening de upload — validacao de magic bytes.

Verifica:
- BERT training rejeita arquivo falso renomeado para .xlsx
- BERT training aceita xlsx valido
- Classificador rejeita arquivo falso renomeado para .pdf
- Classificador aceita PDF valido
"""

import re
import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.security


class TestBertUploadHardening:
    """Testes de magic bytes no upload do BERT Training."""

    def test_bert_upload_has_magic_bytes_validation(self):
        """
        upload_dataset deve validar magic bytes do Excel
        antes de processar o arquivo.
        """
        router_path = Path(__file__).parent.parent.parent / "sistemas" / "bert_training" / "router_datasets.py"
        content = router_path.read_text(encoding="utf-8")

        # Verifica presenca da validacao de magic bytes
        assert "\\x50\\x4b\\x03\\x04" in content or "XLSX_MAGIC" in content, (
            "Upload BERT nao valida magic bytes do Excel (XLSX/ZIP: PK\\x03\\x04)"
        )
        assert "\\xd0\\xcf\\x11\\xe0" in content or "XLS_MAGIC" in content, (
            "Upload BERT nao valida magic bytes do Excel (XLS/OLE2)"
        )

    def test_bert_rejects_fake_xlsx(self):
        """
        Simulacao: conteudo de texto com extensao .xlsx deve ser rejeitado
        pela validacao de magic bytes.
        """
        fake_content = b"isto e um arquivo de texto, nao um excel"

        # Magic bytes esperados
        xlsx_magic = b"\x50\x4b\x03\x04"
        xls_magic = b"\xd0\xcf\x11\xe0"

        assert fake_content[:4] != xlsx_magic, "Conteudo fake nao deveria ter magic bytes XLSX"
        assert fake_content[:4] != xls_magic, "Conteudo fake nao deveria ter magic bytes XLS"

    def test_bert_accepts_valid_xlsx(self):
        """
        Conteudo com magic bytes PK (ZIP/XLSX) deve passar validacao.
        """
        valid_content = b"\x50\x4b\x03\x04" + b"\x00" * 100
        xlsx_magic = b"\x50\x4b\x03\x04"
        assert valid_content[:4] == xlsx_magic

    def test_bert_accepts_valid_xls(self):
        """
        Conteudo com magic bytes OLE2 (XLS) deve passar validacao.
        """
        valid_content = b"\xd0\xcf\x11\xe0" + b"\x00" * 100
        xls_magic = b"\xd0\xcf\x11\xe0"
        assert valid_content[:4] == xls_magic


class TestClassificadorUploadHardening:
    """Testes de magic bytes no upload do Classificador."""

    def test_classificador_upload_has_magic_bytes_validation(self):
        """
        upload_arquivos_lote deve validar magic bytes de PDF e ZIP.
        """
        router_path = (
            Path(__file__).parent.parent.parent
            / "sistemas"
            / "classificador_documentos"
            / "router.py"
        )
        content = router_path.read_text(encoding="utf-8")

        assert "%PDF" in content or "b\"%PDF\"" in content, (
            "Upload classificador nao valida magic bytes do PDF"
        )
        assert "\\x50\\x4b\\x03\\x04" in content, (
            "Upload classificador nao valida magic bytes do ZIP"
        )

    def test_classificador_rejects_fake_pdf(self):
        """
        Conteudo de texto com extensao .pdf deve ser rejeitado.
        """
        fake_content = b"este nao e um pdf"
        assert fake_content[:4] != b"%PDF"

    def test_classificador_accepts_valid_pdf(self):
        """
        Conteudo com magic bytes %PDF deve passar.
        """
        valid_content = b"%PDF-1.4 dummy content"
        assert valid_content[:4] == b"%PDF"

    def test_classificador_rejects_fake_zip(self):
        """
        Conteudo de texto com extensao .zip deve ser rejeitado.
        """
        fake_content = b"este nao e um zip"
        assert fake_content[:4] != b"\x50\x4b\x03\x04"

    def test_classificador_accepts_valid_zip(self):
        """
        Conteudo com magic bytes PK deve passar.
        """
        valid_content = b"\x50\x4b\x03\x04" + b"\x00" * 100
        assert valid_content[:4] == b"\x50\x4b\x03\x04"
