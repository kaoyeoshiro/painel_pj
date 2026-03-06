"""
Testes do isolamento de busca vetorial e keyword por group_id.

Valida que:
1. buscar_argumentos_relevantes() filtra por group_id
2. _buscar_com_numpy() filtra por group_id
3. Sem group_id, retorna modulos de todos os grupos (backward compat)
4. EditarMinutaRequest aceita group_id
5. BuscarArgumentosRequest aceita group_id
"""

import unittest
from unittest.mock import patch, MagicMock, AsyncMock

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base


class TestBuscarArgumentosKeywordGroupId(unittest.TestCase):
    """Testa buscar_argumentos_relevantes com filtro de group_id."""

    def setUp(self):
        from auth.models import User  # noqa: F401
        from admin.models_prompts import PromptModulo  # noqa: F401
        from admin.models_prompt_groups import PromptGroup  # noqa: F401

        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def _criar_modulos(self):
        """Cria modulos de conteudo em 2 grupos distintos."""
        from admin.models_prompt_groups import PromptGroup
        from admin.models_prompts import PromptModulo

        grupo_ps = PromptGroup(name="PS", slug="ps", active=True)
        grupo_detran = PromptGroup(name="Detran", slug="detran", active=True)
        self.db.add_all([grupo_ps, grupo_detran])
        self.db.flush()

        # Modulo PS: prescricao
        mod_ps = PromptModulo(
            tipo="conteudo", nome="prescricao_ps", titulo="Prescricao Quinquenal PS",
            conteudo="Argumento de prescricao para PS",
            group_id=grupo_ps.id, ativo=True, ordem=1,
            categoria="preliminar", subcategoria="prescricao",
        )
        # Modulo Detran: prescricao
        mod_detran = PromptModulo(
            tipo="conteudo", nome="prescricao_detran", titulo="Prescricao Detran",
            conteudo="Argumento de prescricao para Detran",
            group_id=grupo_detran.id, ativo=True, ordem=1,
            categoria="preliminar", subcategoria="prescricao",
        )
        # Modulo PS: ilegitimidade
        mod_ps2 = PromptModulo(
            tipo="conteudo", nome="ilegitimidade_ps", titulo="Ilegitimidade PS",
            conteudo="Argumento de ilegitimidade para PS",
            group_id=grupo_ps.id, ativo=True, ordem=2,
            categoria="preliminar", subcategoria="ilegitimidade",
        )
        self.db.add_all([mod_ps, mod_detran, mod_ps2])
        self.db.commit()

        return grupo_ps, grupo_detran

    def test_busca_com_group_id_filtra_corretamente(self):
        """Com group_id, retorna apenas modulos daquele grupo."""
        from sistemas.gerador_pecas.services_busca_argumentos import buscar_argumentos_relevantes

        grupo_ps, grupo_detran = self._criar_modulos()

        # Busca prescricao no grupo PS
        resultados_ps = buscar_argumentos_relevantes(
            self.db, "prescricao", group_id=grupo_ps.id
        )
        nomes_ps = [r["nome"] for r in resultados_ps]
        self.assertIn("prescricao_ps", nomes_ps)
        self.assertNotIn("prescricao_detran", nomes_ps)

        # Busca prescricao no grupo Detran
        resultados_detran = buscar_argumentos_relevantes(
            self.db, "prescricao", group_id=grupo_detran.id
        )
        nomes_detran = [r["nome"] for r in resultados_detran]
        self.assertIn("prescricao_detran", nomes_detran)
        self.assertNotIn("prescricao_ps", nomes_detran)

    def test_busca_sem_group_id_retorna_todos(self):
        """Sem group_id (backward compat), retorna modulos de todos os grupos."""
        from sistemas.gerador_pecas.services_busca_argumentos import buscar_argumentos_relevantes

        grupo_ps, grupo_detran = self._criar_modulos()

        resultados = buscar_argumentos_relevantes(self.db, "prescricao")
        nomes = [r["nome"] for r in resultados]
        self.assertIn("prescricao_ps", nomes)
        self.assertIn("prescricao_detran", nomes)

    def test_busca_com_group_id_sem_resultados(self):
        """Busca por termo inexistente no grupo retorna lista vazia."""
        from sistemas.gerador_pecas.services_busca_argumentos import buscar_argumentos_relevantes

        grupo_ps, grupo_detran = self._criar_modulos()

        # Ilegitimidade so existe no PS
        resultados = buscar_argumentos_relevantes(
            self.db, "ilegitimidade", group_id=grupo_detran.id
        )
        self.assertEqual(len(resultados), 0)


class TestBuscarVetorialNumpyGroupId(unittest.TestCase):
    """Testa _buscar_com_numpy com filtro de group_id."""

    def setUp(self):
        from auth.models import User  # noqa: F401
        from admin.models_prompts import PromptModulo  # noqa: F401
        from admin.models_prompt_groups import PromptGroup  # noqa: F401
        from sistemas.gerador_pecas.models_embeddings import ModuloEmbedding  # noqa: F401

        self.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False}
        )
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)
        self.db = self.Session()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def _criar_embeddings(self):
        """Cria modulos com embeddings em 2 grupos."""
        from admin.models_prompt_groups import PromptGroup
        from admin.models_prompts import PromptModulo
        from sistemas.gerador_pecas.models_embeddings import ModuloEmbedding

        grupo_ps = PromptGroup(name="PS", slug="ps", active=True)
        grupo_detran = PromptGroup(name="Detran", slug="detran", active=True)
        self.db.add_all([grupo_ps, grupo_detran])
        self.db.flush()

        mod_ps = PromptModulo(
            tipo="conteudo", nome="mod_ps", titulo="Modulo PS",
            conteudo="Conteudo PS", group_id=grupo_ps.id, ativo=True, ordem=1,
        )
        mod_detran = PromptModulo(
            tipo="conteudo", nome="mod_detran", titulo="Modulo Detran",
            conteudo="Conteudo Detran", group_id=grupo_detran.id, ativo=True, ordem=1,
        )
        self.db.add_all([mod_ps, mod_detran])
        self.db.flush()

        # Embeddings simples (vetores unitarios em direcoes diferentes)
        emb_ps = ModuloEmbedding(
            modulo_id=mod_ps.id,
            texto_embedding="Conteudo PS",
            texto_hash="hash_ps",
            embedding_json=[1.0, 0.0, 0.0],
            ativo=True,
        )
        emb_detran = ModuloEmbedding(
            modulo_id=mod_detran.id,
            texto_embedding="Conteudo Detran",
            texto_hash="hash_detran",
            embedding_json=[0.9, 0.1, 0.0],
            ativo=True,
        )
        self.db.add_all([emb_ps, emb_detran])
        self.db.commit()

        return grupo_ps, grupo_detran, mod_ps, mod_detran

    def test_numpy_com_group_id_filtra(self):
        """_buscar_com_numpy com group_id retorna apenas embeddings do grupo."""
        from sistemas.gerador_pecas.services_busca_vetorial import _buscar_com_numpy

        grupo_ps, grupo_detran, mod_ps, mod_detran = self._criar_embeddings()

        query_vec = [1.0, 0.0, 0.0]  # Similar a ambos

        # Filtra PS
        resultados_ps = _buscar_com_numpy(
            self.db, query_vec, limit=10, threshold=0.0, group_id=grupo_ps.id
        )
        ids_ps = [r["modulo_id"] for r in resultados_ps]
        self.assertIn(mod_ps.id, ids_ps)
        self.assertNotIn(mod_detran.id, ids_ps)

        # Filtra Detran
        resultados_detran = _buscar_com_numpy(
            self.db, query_vec, limit=10, threshold=0.0, group_id=grupo_detran.id
        )
        ids_detran = [r["modulo_id"] for r in resultados_detran]
        self.assertIn(mod_detran.id, ids_detran)
        self.assertNotIn(mod_ps.id, ids_detran)

    def test_numpy_sem_group_id_retorna_todos(self):
        """_buscar_com_numpy sem group_id retorna todos os embeddings."""
        from sistemas.gerador_pecas.services_busca_vetorial import _buscar_com_numpy

        grupo_ps, grupo_detran, mod_ps, mod_detran = self._criar_embeddings()

        query_vec = [1.0, 0.0, 0.0]
        resultados = _buscar_com_numpy(self.db, query_vec, limit=10, threshold=0.0)
        ids = [r["modulo_id"] for r in resultados]
        self.assertIn(mod_ps.id, ids)
        self.assertIn(mod_detran.id, ids)


class TestSchemasGroupId(unittest.TestCase):
    """Testa que os schemas aceitam group_id."""

    def test_editar_minuta_request_aceita_group_id(self):
        from sistemas.gerador_pecas.schemas import EditarMinutaRequest

        req = EditarMinutaRequest(
            minuta_atual="# Minuta",
            mensagem="adicione prescricao",
            group_id=42
        )
        self.assertEqual(req.group_id, 42)

    def test_editar_minuta_request_group_id_opcional(self):
        from sistemas.gerador_pecas.schemas import EditarMinutaRequest

        req = EditarMinutaRequest(
            minuta_atual="# Minuta",
            mensagem="corrija o texto"
        )
        self.assertIsNone(req.group_id)

    def test_buscar_argumentos_request_aceita_group_id(self):
        from sistemas.gerador_pecas.schemas import BuscarArgumentosRequest

        req = BuscarArgumentosRequest(
            query="prescricao",
            group_id=7
        )
        self.assertEqual(req.group_id, 7)

    def test_buscar_argumentos_request_group_id_opcional(self):
        from sistemas.gerador_pecas.schemas import BuscarArgumentosRequest

        req = BuscarArgumentosRequest(query="prescricao")
        self.assertIsNone(req.group_id)


class TestServiceRepassaGroupId(unittest.TestCase):
    """Testa que editar_minuta_stream aceita e propaga group_id."""

    def test_editar_minuta_stream_tem_param_group_id(self):
        """Verifica que editar_minuta_stream tem parametro group_id no source."""
        import ast
        import pathlib

        source = pathlib.Path("sistemas/gerador_pecas/services.py").read_text(encoding="utf-8")
        tree = ast.parse(source)

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.name == "editar_minuta_stream":
                    params = [a.arg for a in node.args.args]
                    self.assertIn("group_id", params)
                    return

        self.fail("Metodo editar_minuta_stream nao encontrado")

    def test_editar_minuta_tem_param_group_id(self):
        """Verifica que editar_minuta tem parametro group_id no source."""
        import ast
        import pathlib

        source = pathlib.Path("sistemas/gerador_pecas/services.py").read_text(encoding="utf-8")
        tree = ast.parse(source)

        for node in ast.walk(tree):
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                if node.name == "editar_minuta":
                    params = [a.arg for a in node.args.args]
                    self.assertIn("group_id", params)
                    return

        self.fail("Metodo editar_minuta nao encontrado")

    def test_router_repassa_group_id_nos_endpoints(self):
        """Verifica que router.py passa req.group_id nas chamadas de edicao."""
        import pathlib

        source = pathlib.Path("sistemas/gerador_pecas/router.py").read_text(encoding="utf-8")
        # Deve ter group_id=req.group_id em ambos os endpoints de edicao
        count = source.count("group_id=req.group_id")
        self.assertGreaterEqual(count, 2, "router.py deve repassar req.group_id em pelo menos 2 endpoints")


if __name__ == "__main__":
    unittest.main()
