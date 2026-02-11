# -*- coding: utf-8 -*-
"""
Testes para sistemas/extrator_autos/services_download.py.

Cobre ordenacao, filtragem por periodo, deteccao de RTF e geracao de nomes.
"""

import pytest
from datetime import datetime
from unittest.mock import patch

from services.tjms.models import DocumentoMetadata
from sistemas.extrator_autos.services_download import (
    detectar_rtf,
    filtrar_por_periodo,
    gerar_nome_arquivo,
    ordenar_documentos,
)


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------


def _criar_doc(
    id: str = "1",
    data_juntada=None,
    ordem: int = 0,
    tipo_codigo: int = 9500,
    tipo_descricao: str = "Peticao",
    descricao: str = "Peticao inicial",
) -> DocumentoMetadata:
    """Cria um DocumentoMetadata para uso nos testes."""
    return DocumentoMetadata(
        id=id,
        tipo_codigo=tipo_codigo,
        tipo_descricao=tipo_descricao,
        descricao=descricao,
        data_juntada=data_juntada,
        ordem=ordem,
    )


# ==================================================================
# Testes de ordenar_documentos
# ==================================================================


class TestOrdenarDocumentos:
    """Testes de ordenacao cronologica de documentos."""

    def test_ordena_por_data_juntada_ascendente(self):
        """Documentos devem ser ordenados do mais antigo para o mais recente."""
        doc_recente = _criar_doc(id="R", data_juntada=datetime(2025, 6, 1))
        doc_antigo = _criar_doc(id="A", data_juntada=datetime(2024, 1, 10))
        doc_meio = _criar_doc(id="M", data_juntada=datetime(2024, 8, 20))

        resultado = ordenar_documentos([doc_recente, doc_antigo, doc_meio])

        assert [d.id for d in resultado] == ["A", "M", "R"]

    def test_datas_none_vao_para_o_final(self):
        """Documentos sem data_juntada devem ficar por ultimo."""
        doc_com_data = _criar_doc(id="D", data_juntada=datetime(2024, 3, 15))
        doc_sem_data = _criar_doc(id="N", data_juntada=None)

        resultado = ordenar_documentos([doc_sem_data, doc_com_data])

        assert resultado[0].id == "D"
        assert resultado[1].id == "N"

    def test_mesma_data_usa_ordem_como_desempate(self):
        """Com mesma data, o campo ordem deve definir a posicao."""
        data = datetime(2024, 5, 1)
        doc_ordem_3 = _criar_doc(id="O3", data_juntada=data, ordem=3)
        doc_ordem_1 = _criar_doc(id="O1", data_juntada=data, ordem=1)
        doc_ordem_2 = _criar_doc(id="O2", data_juntada=data, ordem=2)

        resultado = ordenar_documentos([doc_ordem_3, doc_ordem_1, doc_ordem_2])

        assert [d.id for d in resultado] == ["O1", "O2", "O3"]

    def test_lista_vazia_retorna_vazia(self):
        """Lista vazia nao deve causar erro."""
        resultado = ordenar_documentos([])

        assert resultado == []

    def test_documento_unico_retorna_inalterado(self):
        """Lista com um unico documento deve retornar o mesmo documento."""
        doc = _criar_doc(id="U", data_juntada=datetime(2024, 1, 1))

        resultado = ordenar_documentos([doc])

        assert len(resultado) == 1
        assert resultado[0].id == "U"


# ==================================================================
# Testes de filtrar_por_periodo
# ==================================================================


class TestFiltrarPorPeriodo:
    """Testes de filtragem de documentos por ano e mes."""

    def _montar_lista(self):
        """Retorna lista de documentos em datas variadas para filtragem."""
        return [
            _criar_doc(id="jan24", data_juntada=datetime(2024, 1, 15)),
            _criar_doc(id="mar24", data_juntada=datetime(2024, 3, 10)),
            _criar_doc(id="jun24", data_juntada=datetime(2024, 6, 20)),
            _criar_doc(id="jan25", data_juntada=datetime(2025, 1, 5)),
            _criar_doc(id="jul25", data_juntada=datetime(2025, 7, 30)),
            _criar_doc(id="sem_data", data_juntada=None),
        ]

    def test_filtrar_por_ano_unico(self):
        """Filtra somente documentos do ano informado."""
        docs = self._montar_lista()

        resultado = filtrar_por_periodo(docs, anos=[2024])

        ids = [d.id for d in resultado]
        assert "jan24" in ids
        assert "mar24" in ids
        assert "jun24" in ids
        assert "jan25" not in ids
        assert "jul25" not in ids
        assert "sem_data" not in ids

    def test_filtrar_por_multiplos_anos(self):
        """Filtra documentos de dois anos simultaneamente."""
        docs = self._montar_lista()

        resultado = filtrar_por_periodo(docs, anos=[2024, 2025])

        ids = [d.id for d in resultado]
        assert len(ids) == 5
        assert "sem_data" not in ids

    def test_filtrar_por_mes(self):
        """Filtra documentos pelo mes dentro dos anos informados."""
        docs = self._montar_lista()

        resultado = filtrar_por_periodo(docs, anos=[2024], mes=1)

        assert len(resultado) == 1
        assert resultado[0].id == "jan24"

    def test_filtrar_por_ano_e_mes_combinados(self):
        """Filtra por ano e mes ao mesmo tempo."""
        docs = self._montar_lista()

        resultado = filtrar_por_periodo(docs, anos=[2025], mes=7)

        assert len(resultado) == 1
        assert resultado[0].id == "jul25"

    def test_sem_filtro_retorna_todos(self):
        """Sem anos informados, retorna todos os documentos (incluindo sem data)."""
        docs = self._montar_lista()

        resultado = filtrar_por_periodo(docs, anos=None, mes=None)

        assert len(resultado) == len(docs)


# ==================================================================
# Testes de detectar_rtf
# ==================================================================


class TestDetectarRtf:
    """Testes de deteccao de conteudo RTF."""

    def test_conteudo_rtf_detectado(self):
        """Bytes iniciando com '{\\rtf' sao identificados como RTF."""
        rtf_bytes = b"{\\rtf1\\ansi\\ansicpg1252 Conteudo RTF de teste}"

        assert detectar_rtf(rtf_bytes) is True

    def test_conteudo_pdf_nao_detectado_como_rtf(self):
        """Bytes de PDF nao devem ser confundidos com RTF."""
        pdf_bytes = b"%PDF-1.4 conteudo PDF qualquer"

        assert detectar_rtf(pdf_bytes) is False

    def test_bytes_vazios_retorna_false(self):
        """Bytes vazios nao sao RTF."""
        assert detectar_rtf(b"") is False


# ==================================================================
# Testes de gerar_nome_arquivo
# ==================================================================


class TestGerarNomeArquivo:
    """Testes de geracao de nomes de arquivo sanitizados."""

    def test_nome_normal(self):
        """Gera nome com data, numero CNJ, descricao e indice."""
        nome = gerar_nome_arquivo(
            numero_cnj="08001234520248120001",
            tipo_codigo=9500,
            tipo_descricao="Peticao Inicial",
            data_juntada=datetime(2024, 3, 15),
            indice=1,
            extensao="pdf",
        )

        assert nome == "20240315_08001234520248120001 - Peticao Inicial-001.pdf"

    def test_nome_com_caracteres_especiais_sanitizados(self):
        """Caracteres invalidos para nome de arquivo sao substituidos por '-'."""
        nome = gerar_nome_arquivo(
            numero_cnj="08001234520248120001",
            tipo_codigo=9500,
            tipo_descricao='Sentenca "Final" <teste>',
            data_juntada=datetime(2024, 6, 1),
            indice=5,
            extensao="pdf",
        )

        assert "<" not in nome
        assert ">" not in nome
        assert '"' not in nome
        assert nome.startswith("20240601_")
        assert nome.endswith("-005.pdf")

    def test_nome_sem_data_juntada(self):
        """Quando data_juntada e None, usa '00000000' como prefixo."""
        nome = gerar_nome_arquivo(
            numero_cnj="08001234520248120001",
            tipo_codigo=9500,
            tipo_descricao="Peticao",
            data_juntada=None,
            indice=2,
            extensao="pdf",
        )

        assert nome.startswith("00000000_")

    def test_extensao_com_ponto_duplicado_removido(self):
        """Se extensao vier com ponto, ele e removido para nao duplicar."""
        nome = gerar_nome_arquivo(
            numero_cnj="08001234520248120001",
            tipo_codigo=9500,
            tipo_descricao="Doc",
            data_juntada=datetime(2024, 1, 1),
            indice=1,
            extensao=".pdf",
        )

        assert nome.endswith(".pdf")
        assert ".." not in nome
