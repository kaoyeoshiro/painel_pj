"""
Testes do servico generico de obrigatoriedade de categorias de documento.

Cobre:
- Carregamento de requisitos obrigatorios
- Filtragem por tipo de peca
- Verificacao de presenca de documentos
- Categorias com obrigatoriedade desativada ou None
- Integracao com piece_requires_parecer (novo modelo + fallback)
"""

import pytest
from unittest.mock import MagicMock, patch
from dataclasses import dataclass

from sistemas.gerador_pecas.services_obrigatoriedade import (
    RequisitoCategoria,
    ResultadoRequisito,
    load_requisitos_obrigatorios,
    check_requisitos,
    has_missing_requisitos,
    tipo_peca_tem_obrigatoriedade,
)
from sistemas.gerador_pecas.services_parecer_natjus import (
    ParecerNatjusConfig,
    evaluate_parecer_via_obrigatoriedade,
    piece_requires_parecer,
    evaluate_parecer_status,
)


# === Fixtures e helpers ===

def _make_categoria(
    id: int,
    nome: str,
    group_id: int,
    codigos_documento: list,
    obrigatoriedade: dict | None,
    ativo: bool = True,
    titulo: str | None = None,
):
    """Cria mock de CategoriaResumoJSON."""
    cat = MagicMock()
    cat.id = id
    cat.nome = nome
    cat.titulo = titulo or nome.replace("_", " ").title()
    cat.group_id = group_id
    cat.codigos_documento = codigos_documento
    cat.obrigatoriedade = obrigatoriedade
    cat.ativo = ativo
    return cat


def _make_doc(tipo_documento: int):
    """Cria dict simulando documento do TJ-MS."""
    return {"tipo_documento": tipo_documento}


def _make_config(
    required_piece_types=(),
    document_codes=(),
    required_group_slugs=(),
):
    """Cria ParecerNatjusConfig para testes de fallback."""
    return ParecerNatjusConfig(
        required_piece_types=tuple(required_piece_types),
        document_codes=tuple(document_codes),
        required_group_slugs=tuple(required_group_slugs),
    )


# === Testes de load_requisitos_obrigatorios ===

class TestLoadRequisitosObrigatorios:

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.session_query")
    def test_carrega_categorias_com_obrigatoriedade_ativa(self, mock_query):
        """Deve retornar requisitos apenas de categorias com obrigatoriedade.ativo=True."""
        cat_ativa = _make_categoria(
            id=1, nome="parecer_natjus", group_id=1,
            codigos_documento=[60, 61, 62],
            obrigatoriedade={"ativo": True, "tipos_peca": ["contestacao"], "mensagem_quando_ausente": "Falta parecer"},
        )
        cat_inativa = _make_categoria(
            id=2, nome="laudo", group_id=1,
            codigos_documento=[43],
            obrigatoriedade={"ativo": False, "tipos_peca": ["contestacao"]},
        )
        # session_query retorna um mock chainable
        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = [cat_ativa, cat_inativa]
        mock_query.return_value = mock_q

        db = MagicMock()
        resultado = load_requisitos_obrigatorios(db, group_id=1)

        assert len(resultado) == 1
        assert resultado[0].categoria_id == 1
        assert resultado[0].categoria_nome == "parecer_natjus"
        assert resultado[0].codigos_documento == (60, 61, 62)
        assert "contestacao" in resultado[0].tipos_peca

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.session_query")
    def test_ignora_categorias_sem_obrigatoriedade(self, mock_query):
        """Categorias com obrigatoriedade=None devem ser ignoradas."""
        cat = _make_categoria(
            id=1, nome="decisoes", group_id=1,
            codigos_documento=[10, 11],
            obrigatoriedade=None,
        )
        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = [cat]
        mock_query.return_value = mock_q

        db = MagicMock()
        resultado = load_requisitos_obrigatorios(db, group_id=1)

        # obrigatoriedade=None nao passa no filtro SQL, mas mesmo que passe, e ignorado
        assert len(resultado) == 0

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.session_query")
    def test_ignora_tipos_peca_vazios(self, mock_query):
        """Categorias com tipos_peca vazio devem ser ignoradas."""
        cat = _make_categoria(
            id=1, nome="parecer", group_id=1,
            codigos_documento=[60],
            obrigatoriedade={"ativo": True, "tipos_peca": [], "mensagem_quando_ausente": "Msg"},
        )
        mock_q = MagicMock()
        mock_q.filter.return_value = mock_q
        mock_q.all.return_value = [cat]
        mock_query.return_value = mock_q

        db = MagicMock()
        resultado = load_requisitos_obrigatorios(db, group_id=1)

        assert len(resultado) == 0


# === Testes de check_requisitos ===

class TestCheckRequisitos:

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.load_requisitos_obrigatorios")
    def test_filtra_por_tipo_peca(self, mock_load):
        """Deve retornar apenas requisitos que se aplicam ao tipo de peca."""
        mock_load.return_value = [
            RequisitoCategoria(
                categoria_id=1, categoria_nome="parecer_natjus",
                codigos_documento=(60, 61), tipos_peca=("contestacao",),
                mensagem_quando_ausente="Falta parecer",
            ),
            RequisitoCategoria(
                categoria_id=2, categoria_nome="laudo",
                codigos_documento=(43,), tipos_peca=("recurso_apelacao",),
                mensagem_quando_ausente="Falta laudo",
            ),
        ]

        db = MagicMock()
        resultados = check_requisitos("contestacao", 1, [], db)

        assert len(resultados) == 1
        assert resultados[0]["categoria_nome"] == "parecer_natjus"
        assert resultados[0]["obrigatorio"] is True

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.load_requisitos_obrigatorios")
    def test_verifica_documentos_presentes(self, mock_load):
        """Deve marcar como satisfeito quando codigos estao nos documentos."""
        mock_load.return_value = [
            RequisitoCategoria(
                categoria_id=1, categoria_nome="parecer_natjus",
                codigos_documento=(60, 61, 62), tipos_peca=("contestacao",),
                mensagem_quando_ausente="Falta parecer",
            ),
        ]

        docs = [_make_doc(60), _make_doc(500), _make_doc(10)]
        db = MagicMock()
        resultados = check_requisitos("contestacao", 1, docs, db)

        assert len(resultados) == 1
        assert resultados[0]["satisfeito"] is True
        assert 60 in resultados[0]["codigos_encontrados"]
        assert resultados[0]["mensagem"] is None

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.load_requisitos_obrigatorios")
    def test_documentos_ausentes(self, mock_load):
        """Deve marcar como nao satisfeito quando codigos estao ausentes."""
        mock_load.return_value = [
            RequisitoCategoria(
                categoria_id=1, categoria_nome="parecer_natjus",
                codigos_documento=(60, 61, 62), tipos_peca=("contestacao",),
                mensagem_quando_ausente="Falta parecer NATJus",
            ),
        ]

        docs = [_make_doc(500), _make_doc(10)]  # Sem codigos 60/61/62
        db = MagicMock()
        resultados = check_requisitos("contestacao", 1, docs, db)

        assert len(resultados) == 1
        assert resultados[0]["satisfeito"] is False
        assert resultados[0]["codigos_encontrados"] == []
        assert resultados[0]["mensagem"] == "Falta parecer NATJus"

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.load_requisitos_obrigatorios")
    def test_tipo_peca_none_retorna_vazio(self, mock_load):
        """Tipo de peca None deve retornar lista vazia."""
        db = MagicMock()
        resultados = check_requisitos(None, 1, [], db)
        assert resultados == []
        mock_load.assert_not_called()

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.load_requisitos_obrigatorios")
    def test_nenhum_requisito_retorna_vazio(self, mock_load):
        """Sem requisitos obrigatorios deve retornar lista vazia."""
        mock_load.return_value = []

        db = MagicMock()
        resultados = check_requisitos("contestacao", 1, [], db)
        assert resultados == []

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.load_requisitos_obrigatorios")
    def test_normalizacao_tipo_peca(self, mock_load):
        """Deve normalizar tipo de peca para comparacao (acentos, case, separadores)."""
        mock_load.return_value = [
            RequisitoCategoria(
                categoria_id=1, categoria_nome="parecer",
                codigos_documento=(60,), tipos_peca=("recurso_apelacao",),
                mensagem_quando_ausente="Msg",
            ),
        ]

        db = MagicMock()
        # "Recurso Apelação" deve normalizar para "recurso_apelacao"
        resultados = check_requisitos("Recurso Apelação", 1, [_make_doc(60)], db)
        assert len(resultados) == 1
        assert resultados[0]["satisfeito"] is True


# === Testes de has_missing_requisitos ===

class TestHasMissingRequisitos:

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.check_requisitos")
    def test_retorna_true_quando_ausente(self, mock_check):
        mock_check.return_value = [{"satisfeito": False}]

        db = MagicMock()
        assert has_missing_requisitos("contestacao", 1, [], db) is True

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.check_requisitos")
    def test_retorna_false_quando_satisfeito(self, mock_check):
        mock_check.return_value = [{"satisfeito": True}]

        db = MagicMock()
        assert has_missing_requisitos("contestacao", 1, [], db) is False

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.check_requisitos")
    def test_retorna_false_sem_requisitos(self, mock_check):
        mock_check.return_value = []

        db = MagicMock()
        assert has_missing_requisitos("contestacao", 1, [], db) is False


# === Testes de tipo_peca_tem_obrigatoriedade ===

class TestTipoPecaTemObrigatoriedade:

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.load_requisitos_obrigatorios")
    def test_retorna_true_quando_existe(self, mock_load):
        """Deve retornar True se existe obrigatoriedade para o tipo de peca."""
        mock_load.return_value = [
            RequisitoCategoria(
                categoria_id=1, categoria_nome="parecer",
                codigos_documento=(60,), tipos_peca=("contestacao",),
                mensagem_quando_ausente="Msg",
            ),
        ]

        db = MagicMock()
        assert tipo_peca_tem_obrigatoriedade("contestacao", 1, db) is True

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.load_requisitos_obrigatorios")
    def test_retorna_false_quando_tipo_nao_listado(self, mock_load):
        """Deve retornar False se ha obrigatoriedade mas nao para este tipo."""
        mock_load.return_value = [
            RequisitoCategoria(
                categoria_id=1, categoria_nome="parecer",
                codigos_documento=(60,), tipos_peca=("contestacao",),
                mensagem_quando_ausente="Msg",
            ),
        ]

        db = MagicMock()
        assert tipo_peca_tem_obrigatoriedade("recurso_apelacao", 1, db) is False

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.load_requisitos_obrigatorios")
    def test_retorna_none_sem_requisitos(self, mock_load):
        """Deve retornar None se nenhuma obrigatoriedade configurada (fallback legado)."""
        mock_load.return_value = []

        db = MagicMock()
        assert tipo_peca_tem_obrigatoriedade("contestacao", 1, db) is None

    def test_retorna_none_sem_tipo_peca(self):
        """Tipo de peca None deve retornar None."""
        db = MagicMock()
        assert tipo_peca_tem_obrigatoriedade(None, 1, db) is None

    def test_retorna_none_sem_group_id(self):
        """Group ID 0/None deve retornar None."""
        db = MagicMock()
        assert tipo_peca_tem_obrigatoriedade("contestacao", 0, db) is None


# === Testes de integracao: piece_requires_parecer com novo modelo ===

class TestPieceRequiresParecerIntegracao:

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.tipo_peca_tem_obrigatoriedade")
    def test_usa_novo_modelo_quando_disponivel(self, mock_obrig):
        """Deve usar modelo novo quando db e group_id sao fornecidos."""
        mock_obrig.return_value = True
        config = _make_config()

        db = MagicMock()
        resultado = piece_requires_parecer("contestacao", config, db=db, group_id=1)

        assert resultado is True
        mock_obrig.assert_called_once_with("contestacao", 1, db)

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.tipo_peca_tem_obrigatoriedade")
    def test_fallback_quando_novo_modelo_retorna_none(self, mock_obrig):
        """Deve usar fallback legado quando novo modelo retorna None."""
        mock_obrig.return_value = None
        config = _make_config(
            required_piece_types=["contestacao"],
            document_codes=[60, 61],
            required_group_slugs=["ps"],
        )

        db = MagicMock()
        resultado = piece_requires_parecer(
            "contestacao", config, group_slug="ps", db=db, group_id=1,
        )

        assert resultado is True

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.tipo_peca_tem_obrigatoriedade")
    def test_fallback_quando_novo_modelo_false(self, mock_obrig):
        """Quando novo modelo retorna False, deve usar esse resultado (nao fallback)."""
        mock_obrig.return_value = False
        config = _make_config(
            required_piece_types=["contestacao"],
            document_codes=[60],
        )

        db = MagicMock()
        resultado = piece_requires_parecer("contestacao", config, db=db, group_id=1)

        # Novo modelo disse False, deve retornar False mesmo que legado diria True
        assert resultado is False

    def test_legado_sem_db(self):
        """Sem db, deve usar apenas modelo legado."""
        config = _make_config(
            required_piece_types=["contestacao"],
            document_codes=[60],
            required_group_slugs=["ps"],
        )

        resultado = piece_requires_parecer("contestacao", config, group_slug="ps")
        assert resultado is True

    def test_legado_grupo_nao_listado(self):
        """Grupo nao listado no legado deve retornar False."""
        config = _make_config(
            required_piece_types=["contestacao"],
            document_codes=[60],
            required_group_slugs=["ps"],
        )

        resultado = piece_requires_parecer("contestacao", config, group_slug="pp")
        assert resultado is False


# === Testes de integracao: evaluate_parecer_status com novo modelo ===

class TestEvaluateParecerStatusIntegracao:

    @patch("sistemas.gerador_pecas.services_parecer_natjus.evaluate_parecer_via_obrigatoriedade")
    def test_usa_novo_modelo_quando_disponivel(self, mock_eval):
        """Deve usar resultado do novo modelo quando retorna dict."""
        mock_eval.return_value = {
            "parecer_required": True,
            "parecer_found": True,
            "parecer_source": "process_docs",
            "matched_document_codes": [60],
            "parecer_document_codes": [60, 61, 62],
            "via_obrigatoriedade": True,
        }
        config = _make_config()
        db = MagicMock()

        resultado = evaluate_parecer_status(
            "contestacao", [_make_doc(60)], config, db=db, group_id=1,
        )

        assert resultado["via_obrigatoriedade"] is True
        assert resultado["parecer_required"] is True
        assert resultado["parecer_found"] is True

    @patch("sistemas.gerador_pecas.services_parecer_natjus.evaluate_parecer_via_obrigatoriedade")
    def test_incorpora_user_upload(self, mock_eval):
        """Deve incorporar upload do usuario no resultado do novo modelo."""
        mock_eval.return_value = {
            "parecer_required": True,
            "parecer_found": False,
            "parecer_source": "none",
            "matched_document_codes": [],
            "parecer_document_codes": [60],
            "via_obrigatoriedade": True,
        }
        config = _make_config()
        db = MagicMock()

        resultado = evaluate_parecer_status(
            "contestacao", [], config, has_user_upload=True, db=db, group_id=1,
        )

        assert resultado["parecer_found"] is True
        assert resultado["parecer_source"] == "user_upload"

    @patch("sistemas.gerador_pecas.services_parecer_natjus.evaluate_parecer_via_obrigatoriedade")
    def test_fallback_quando_none(self, mock_eval):
        """Deve usar fallback legado quando novo modelo retorna None."""
        mock_eval.return_value = None
        config = _make_config(
            required_piece_types=["contestacao"],
            document_codes=[60],
            required_group_slugs=["ps"],
        )
        db = MagicMock()

        resultado = evaluate_parecer_status(
            "contestacao", [_make_doc(60)], config,
            group_slug="ps", db=db, group_id=1,
        )

        assert resultado["parecer_required"] is True
        assert resultado["parecer_found"] is True
        assert resultado["parecer_source"] == "process_docs"
        assert "via_obrigatoriedade" not in resultado


# === Testes de evaluate_parecer_via_obrigatoriedade ===

class TestEvaluateParecerViaObrigatoriedade:

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.check_requisitos")
    def test_retorna_none_sem_group_id(self, mock_check):
        """Sem group_id deve retornar None."""
        db = MagicMock()
        assert evaluate_parecer_via_obrigatoriedade("contestacao", [], None, db) is None
        mock_check.assert_not_called()

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.check_requisitos")
    def test_retorna_none_sem_resultados(self, mock_check):
        """Sem resultados de check_requisitos deve retornar None (fallback)."""
        mock_check.return_value = []
        db = MagicMock()
        assert evaluate_parecer_via_obrigatoriedade("contestacao", [], 1, db) is None

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.check_requisitos")
    def test_retorna_resultado_quando_satisfeito(self, mock_check):
        """Deve retornar dict com parecer_found=True quando satisfeito."""
        mock_check.return_value = [{
            "categoria_id": 1,
            "satisfeito": True,
            "codigos_encontrados": [60],
            "codigos_esperados": [60, 61, 62],
            "tipos_peca": ["contestacao"],
        }]
        db = MagicMock()

        resultado = evaluate_parecer_via_obrigatoriedade("contestacao", [_make_doc(60)], 1, db)

        assert resultado is not None
        assert resultado["parecer_required"] is True
        assert resultado["parecer_found"] is True
        assert resultado["via_obrigatoriedade"] is True

    @patch("sistemas.gerador_pecas.services_obrigatoriedade.check_requisitos")
    def test_retorna_resultado_quando_ausente(self, mock_check):
        """Deve retornar dict com parecer_found=False quando ausente."""
        mock_check.return_value = [{
            "categoria_id": 1,
            "satisfeito": False,
            "codigos_encontrados": [],
            "codigos_esperados": [60, 61, 62],
            "tipos_peca": ["contestacao"],
        }]
        db = MagicMock()

        resultado = evaluate_parecer_via_obrigatoriedade("contestacao", [], 1, db)

        assert resultado is not None
        assert resultado["parecer_required"] is True
        assert resultado["parecer_found"] is False
        assert resultado["parecer_source"] == "none"
