# tests/test_merge_primeiro_doc.py
"""
Testes para merge de documentos multi-parte com codigos_primeiro_doc.

Cenário: Petição inicial digitalizada página por página gera N documentos
com mesmo código (ex: 500) e mesmo timestamp. O filtro deve permitir
todas as partes do mesmo lote (mesma data/hora) e bloquear apenas
documentos de lotes diferentes.
"""

import sys
import os
import pytest
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, List
from unittest.mock import MagicMock

# Garantir imports do projeto
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sistemas.gerador_pecas.agente_tjms import (
    DocumentoTJMS,
    agrupar_documentos_por_descricao,
    documento_permitido,
)


# =============================================================================
# Helpers
# =============================================================================

def criar_doc(id: str, tipo: str, data: datetime, descricao: str = "Petição Inicial") -> DocumentoTJMS:
    """Helper para criar DocumentoTJMS para testes."""
    return DocumentoTJMS(
        id=id,
        tipo_documento=tipo,
        data_juntada=data,
        descricao=descricao,
    )


def filtrar_docs_agente(docs: List[DocumentoTJMS], codigos_permitidos: set, codigos_primeiro_doc: set) -> List[DocumentoTJMS]:
    """
    Reproduz a lógica de filtro do agente_tjms.py (pós-fix).
    Extrai a lógica inline do método coletar_documentos para teste isolado.
    """
    docs_filtrados = []
    codigos_primeiro_lote = {}

    for d in docs:
        if not d.tipo_documento:
            continue

        codigo = int(d.tipo_documento)

        if not documento_permitido(codigo, codigos_permitidos):
            continue

        if codigo in codigos_primeiro_doc:
            data_key = d.data_juntada.strftime('%Y%m%d%H%M') if d.data_juntada else 'sem_data'
            if codigo in codigos_primeiro_lote:
                if codigos_primeiro_lote[codigo] != data_key:
                    continue
            else:
                codigos_primeiro_lote[codigo] = data_key

        docs_filtrados.append(d)

    return docs_filtrados


def filtrar_docs_filtro_categorias(docs: List[DocumentoTJMS], codigos: set, codigos_primeiro_doc: set) -> List[DocumentoTJMS]:
    """
    Reproduz a lógica de filtro do filtro_categorias.py (pós-fix).
    Extrai a lógica de filtrar_documentos para teste isolado.
    """
    docs_filtrados = []
    codigos_primeiro_doc_usados = set()
    codigos_primeiro_lote = {}

    for doc in docs:
        if not doc.tipo_documento:
            continue

        codigo = int(doc.tipo_documento)

        if codigo not in codigos:
            continue

        if codigo in codigos_primeiro_doc:
            data_key = doc.data_juntada.strftime('%Y%m%d%H%M') if doc.data_juntada else 'sem_data'
            if codigo in codigos_primeiro_doc_usados:
                if codigos_primeiro_lote.get(codigo) != data_key:
                    continue
            else:
                codigos_primeiro_lote[codigo] = data_key
                codigos_primeiro_doc_usados.update(codigos_primeiro_doc)

        docs_filtrados.append(doc)

    return docs_filtrados


# =============================================================================
# Dados de teste
# =============================================================================

DATA_LOTE_1 = datetime(2026, 2, 2, 21, 30, 45)  # 20260202213045
DATA_LOTE_2 = datetime(2026, 3, 15, 10, 0, 0)    # Lote diferente

CODIGOS_PERMITIDOS = {500, 9500, 10, 8369, 1000, 2000}
CODIGOS_PRIMEIRO_DOC = {500, 9500, 10}


# =============================================================================
# Testes - Filtro agente_tjms.py
# =============================================================================

class TestFiltroAgente:
    """Testes para o filtro de primeiro documento no agente_tjms.py"""

    def test_filtro_permite_multiplas_partes_mesmo_lote(self):
        """26 docs com mesmo código+data devem todos passar o filtro."""
        docs = [
            criar_doc(f"241197442-{i}", "500", DATA_LOTE_1)
            for i in range(1, 27)
        ]

        resultado = filtrar_docs_agente(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)

        assert len(resultado) == 26, f"Esperava 26 docs, obteve {len(resultado)}"
        ids = {d.id for d in resultado}
        assert ids == {f"241197442-{i}" for i in range(1, 27)}

    def test_filtro_bloqueia_segundo_lote(self):
        """Doc com mesmo código mas data diferente deve ser bloqueado."""
        docs = [
            criar_doc("241197442-1", "500", DATA_LOTE_1),
            criar_doc("241197442-2", "500", DATA_LOTE_1),
            criar_doc("999999999-1", "500", DATA_LOTE_2),  # Lote diferente
        ]

        resultado = filtrar_docs_agente(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)

        assert len(resultado) == 2
        ids = {d.id for d in resultado}
        assert "999999999-1" not in ids

    def test_docs_sem_primeiro_doc_nao_afetados(self):
        """Docs com códigos normais passam sem nenhuma alteração."""
        docs = [
            criar_doc("doc-1", "8369", DATA_LOTE_1, "Laudo Pericial"),
            criar_doc("doc-2", "1000", DATA_LOTE_1, "Certidão"),
            criar_doc("doc-3", "2000", DATA_LOTE_2, "Ofício"),
        ]

        resultado = filtrar_docs_agente(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)

        assert len(resultado) == 3

    def test_doc_unico_funciona(self):
        """Petição inicial com apenas 1 doc continua funcionando."""
        docs = [
            criar_doc("doc-unico", "500", DATA_LOTE_1),
        ]

        resultado = filtrar_docs_agente(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)

        assert len(resultado) == 1
        assert resultado[0].id == "doc-unico"

    def test_doc_sem_data_agrupa_como_sem_data(self):
        """Docs sem data_juntada usam fallback 'sem_data' como chave."""
        docs = [
            criar_doc("doc-1", "500", None),
            criar_doc("doc-2", "500", None),
        ]
        # Ambos têm data_key='sem_data', devem ser tratados como mesmo lote
        resultado = filtrar_docs_agente(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)

        assert len(resultado) == 2


# =============================================================================
# Testes - Filtro filtro_categorias.py
# =============================================================================

class TestFiltroCategoriasDoc:
    """Testes para o filtro de primeiro documento no filtro_categorias.py"""

    def test_filtro_permite_multiplas_partes_mesmo_lote(self):
        """26 docs com mesmo código+data devem todos passar o filtro."""
        docs = [
            criar_doc(f"241197442-{i}", "500", DATA_LOTE_1)
            for i in range(1, 27)
        ]

        resultado = filtrar_docs_filtro_categorias(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)

        assert len(resultado) == 26

    def test_filtro_bloqueia_segundo_lote(self):
        """Doc com mesmo código mas data diferente deve ser bloqueado."""
        docs = [
            criar_doc("241197442-1", "500", DATA_LOTE_1),
            criar_doc("999999999-1", "500", DATA_LOTE_2),
        ]

        resultado = filtrar_docs_filtro_categorias(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)

        assert len(resultado) == 1
        assert resultado[0].id == "241197442-1"

    def test_codigos_cruzados_bloqueiam(self):
        """Após registrar código 500, código 9500 de outro lote é bloqueado (cross-code)."""
        docs = [
            criar_doc("doc-500", "500", DATA_LOTE_1),
            criar_doc("doc-9500", "9500", DATA_LOTE_2),  # Código diferente, lote diferente
        ]

        resultado = filtrar_docs_filtro_categorias(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)

        # 500 passa e marca 9500/10 como usados. 9500 com data diferente é bloqueado.
        assert len(resultado) == 1
        assert resultado[0].id == "doc-500"

    def test_codigos_cruzados_mesmo_lote_bloqueiam(self):
        """Códigos cruzados: 9500 é bloqueado mesmo com mesma data (não tem lote registrado para 9500)."""
        docs = [
            criar_doc("doc-500", "500", DATA_LOTE_1),
            criar_doc("doc-9500", "9500", DATA_LOTE_1),  # Código diferente, mesma data
        ]

        resultado = filtrar_docs_filtro_categorias(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)

        # 500 passa e marca 9500 como usado. 9500 está em codigos_primeiro_doc_usados
        # mas não tem entrada em codigos_primeiro_lote (registrado como 500),
        # então codigos_primeiro_lote.get(9500) retorna None != data_key → bloqueado
        assert len(resultado) == 1
        assert resultado[0].id == "doc-500"


# =============================================================================
# Testes - Agrupamento pós-filtro
# =============================================================================

class TestAgrupamento:
    """Testa que agrupar_documentos_por_descricao agrupa corretamente após o filtro."""

    def test_agrupamento_junta_partes(self):
        """26 docs com mesma descrição+data devem ser agrupados em 1 com ids_agrupados."""
        docs = [
            criar_doc(f"241197442-{i}", "500", DATA_LOTE_1, "Petição Inicial")
            for i in range(1, 27)
        ]

        resultado = agrupar_documentos_por_descricao(docs)

        assert len(resultado) == 1, f"Esperava 1 grupo, obteve {len(resultado)}"
        assert len(resultado[0].ids_agrupados) == 26
        assert resultado[0].ids_agrupados[0] == "241197442-1"
        assert resultado[0].ids_agrupados[-1] == "241197442-26"

    def test_agrupamento_docs_diferentes_nao_junta(self):
        """Docs com descrições ou datas diferentes não são agrupados."""
        docs = [
            criar_doc("doc-1", "500", DATA_LOTE_1, "Petição Inicial"),
            criar_doc("doc-2", "8369", DATA_LOTE_1, "Laudo Pericial"),
            criar_doc("doc-3", "500", DATA_LOTE_2, "Petição Inicial"),
        ]

        resultado = agrupar_documentos_por_descricao(docs)

        assert len(resultado) == 3

    def test_pipeline_filtro_e_agrupamento(self):
        """Teste end-to-end: filtro permite 26 partes → agrupamento junta em 1."""
        docs = [
            criar_doc(f"241197442-{i}", "500", DATA_LOTE_1, "Petição Inicial")
            for i in range(1, 27)
        ]
        # Adiciona um doc normal
        docs.append(criar_doc("doc-laudo", "8369", DATA_LOTE_1, "Laudo Pericial"))

        # Passo 1: Filtro
        filtrados = filtrar_docs_agente(docs, CODIGOS_PERMITIDOS, CODIGOS_PRIMEIRO_DOC)
        assert len(filtrados) == 27  # 26 PI + 1 laudo

        # Passo 2: Agrupamento
        agrupados = agrupar_documentos_por_descricao(filtrados)
        assert len(agrupados) == 2  # 1 grupo PI + 1 laudo

        # Verifica que o grupo PI tem 26 ids_agrupados
        pi_group = [d for d in agrupados if d.tipo_documento == "500"][0]
        assert len(pi_group.ids_agrupados) == 26
