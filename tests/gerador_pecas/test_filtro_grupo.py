"""
Testes do filtro de categorias por grupo.
Valida que a tabela tipo_peca_grupo_categorias funciona corretamente.
"""
import unittest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from database.connection import Base


class TestTipoPecaGrupoCategoriasModel(unittest.TestCase):
    """Testa o modelo TipoPecaGrupoCategoria e queries basicas."""

    def setUp(self):
        # Importar modelos para resolver FK dependencies
        from auth.models import User  # noqa: F401
        from admin.models_prompt_groups import PromptGroup  # noqa: F401
        from sistemas.gerador_pecas.models_config_pecas import (  # noqa: F401
            CategoriaDocumento,
            TipoPecaGrupoCategoria,
        )

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

    def test_criar_associacao_tipo_grupo_categoria(self):
        """Cria associacao e verifica que persiste corretamente."""
        from admin.models_prompt_groups import PromptGroup
        from sistemas.gerador_pecas.models_config_pecas import (
            CategoriaDocumento,
            TipoPecaGrupoCategoria,
        )

        grupo = PromptGroup(name="PS", slug="ps", active=True)
        self.db.add(grupo)
        self.db.flush()

        cat = CategoriaDocumento(
            nome="peticao",
            titulo="Peticao",
            codigos_documento=[500, 510, 9500],
        )
        self.db.add(cat)
        self.db.flush()

        assoc = TipoPecaGrupoCategoria(
            tipo_peca_nome="contestacao",
            group_id=grupo.id,
            categoria_documento_id=cat.id,
        )
        self.db.add(assoc)
        self.db.commit()

        resultado = self.db.query(TipoPecaGrupoCategoria).filter(
            TipoPecaGrupoCategoria.tipo_peca_nome == "contestacao",
            TipoPecaGrupoCategoria.group_id == grupo.id,
        ).all()

        self.assertEqual(len(resultado), 1)
        self.assertEqual(resultado[0].categoria_documento_id, cat.id)

    def test_associacoes_diferentes_por_grupo(self):
        """Grupos diferentes podem ter categorias diferentes para o mesmo tipo de peca."""
        from admin.models_prompt_groups import PromptGroup
        from sistemas.gerador_pecas.models_config_pecas import (
            CategoriaDocumento,
            TipoPecaGrupoCategoria,
        )

        grupo_ps = PromptGroup(name="PS", slug="ps", active=True)
        grupo_detran = PromptGroup(name="Detran", slug="detran", active=True)
        self.db.add_all([grupo_ps, grupo_detran])
        self.db.flush()

        cat_peticao = CategoriaDocumento(nome="peticao", titulo="Peticao", codigos_documento=[500])
        cat_recurso = CategoriaDocumento(nome="recurso", titulo="Recurso", codigos_documento=[600])
        cat_laudo = CategoriaDocumento(nome="laudo", titulo="Laudo", codigos_documento=[700])
        self.db.add_all([cat_peticao, cat_recurso, cat_laudo])
        self.db.flush()

        # PS: contestacao usa peticao + recurso
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_ps.id, categoria_documento_id=cat_peticao.id))
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_ps.id, categoria_documento_id=cat_recurso.id))

        # Detran: contestacao usa peticao + laudo (diferente!)
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_detran.id, categoria_documento_id=cat_peticao.id))
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_detran.id, categoria_documento_id=cat_laudo.id))
        self.db.commit()

        # Verifica PS
        assocs_ps = self.db.query(TipoPecaGrupoCategoria).filter(
            TipoPecaGrupoCategoria.tipo_peca_nome == "contestacao",
            TipoPecaGrupoCategoria.group_id == grupo_ps.id,
        ).all()
        ids_ps = {a.categoria_documento_id for a in assocs_ps}
        self.assertEqual(ids_ps, {cat_peticao.id, cat_recurso.id})

        # Verifica Detran
        assocs_detran = self.db.query(TipoPecaGrupoCategoria).filter(
            TipoPecaGrupoCategoria.tipo_peca_nome == "contestacao",
            TipoPecaGrupoCategoria.group_id == grupo_detran.id,
        ).all()
        ids_detran = {a.categoria_documento_id for a in assocs_detran}
        self.assertEqual(ids_detran, {cat_peticao.id, cat_laudo.id})


class TestFiltroCategoriasComGrupo(unittest.TestCase):
    """Testa FiltroCategoriasDocumento com suporte a group_id."""

    def setUp(self):
        from auth.models import User  # noqa: F401
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

    def _setup_dados(self):
        """Cria dados base: 2 grupos, 3 categorias, associacoes distintas."""
        from admin.models_prompt_groups import PromptGroup
        from sistemas.gerador_pecas.models_config_pecas import (
            CategoriaDocumento,
            TipoPecaGrupoCategoria,
        )

        grupo_ps = PromptGroup(name="PS", slug="ps", active=True)
        grupo_detran = PromptGroup(name="Detran", slug="detran", active=True)
        self.db.add_all([grupo_ps, grupo_detran])
        self.db.flush()

        cat_peticao = CategoriaDocumento(nome="peticao", titulo="Peticao", codigos_documento=[500, 510])
        cat_decisao = CategoriaDocumento(nome="decisao", titulo="Decisao", codigos_documento=[600, 610])
        cat_laudo = CategoriaDocumento(nome="laudo", titulo="Laudo", codigos_documento=[700])
        self.db.add_all([cat_peticao, cat_decisao, cat_laudo])
        self.db.flush()

        # PS: contestacao usa peticao + decisao
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_ps.id, categoria_documento_id=cat_peticao.id))
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_ps.id, categoria_documento_id=cat_decisao.id))

        # Detran: contestacao usa peticao + laudo
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_detran.id, categoria_documento_id=cat_peticao.id))
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_detran.id, categoria_documento_id=cat_laudo.id))
        self.db.commit()

        return grupo_ps, grupo_detran

    def test_codigos_permitidos_com_group_id(self):
        """Retorna codigos corretos quando group_id e informado."""
        from sistemas.gerador_pecas.filtro_categorias import FiltroCategoriasDocumento
        grupo_ps, grupo_detran = self._setup_dados()
        filtro = FiltroCategoriasDocumento(self.db)

        codigos_ps = filtro.get_codigos_permitidos("contestacao", group_id=grupo_ps.id)
        self.assertEqual(codigos_ps, {500, 510, 600, 610})

        codigos_detran = filtro.get_codigos_permitidos("contestacao", group_id=grupo_detran.id)
        self.assertEqual(codigos_detran, {500, 510, 700})

    def test_codigos_permitidos_sem_group_id_fallback(self):
        """Sem group_id, faz fallback para comportamento antigo."""
        from sistemas.gerador_pecas.filtro_categorias import FiltroCategoriasDocumento
        self._setup_dados()
        filtro = FiltroCategoriasDocumento(self.db)
        codigos = filtro.get_codigos_permitidos("contestacao")
        self.assertIsInstance(codigos, set)

    def test_documento_permitido_com_group_id(self):
        """Verifica documento_permitido() com group_id."""
        from sistemas.gerador_pecas.filtro_categorias import FiltroCategoriasDocumento
        grupo_ps, grupo_detran = self._setup_dados()
        filtro = FiltroCategoriasDocumento(self.db)

        self.assertFalse(filtro.documento_permitido("contestacao", 700, group_id=grupo_ps.id))
        self.assertTrue(filtro.documento_permitido("contestacao", 700, group_id=grupo_detran.id))
        self.assertTrue(filtro.documento_permitido("contestacao", 600, group_id=grupo_ps.id))
        self.assertFalse(filtro.documento_permitido("contestacao", 600, group_id=grupo_detran.id))


class TestEndpointTiposPecaDerivado(unittest.TestCase):
    """
    Testa que tipos de peca sao derivados de prompt_modulos (tipo='peca')
    e NAO da tabela tipos_peca antiga.
    """

    def setUp(self):
        from auth.models import User  # noqa: F401
        from admin.models_prompts import PromptModulo  # noqa: F401
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

    def test_tipos_peca_vem_de_prompt_modulos(self):
        """Verifica que a query de tipos de peca filtra prompt_modulos por tipo='peca'."""
        from admin.models_prompt_groups import PromptGroup
        from admin.models_prompts import PromptModulo

        grupo = PromptGroup(name="PS", slug="ps", active=True)
        self.db.add(grupo)
        self.db.flush()

        # Criar modulos: 2 pecas e 1 conteudo
        peca1 = PromptModulo(
            tipo="peca", nome="contestacao", titulo="Contestacao",
            conteudo="Template contestacao", group_id=grupo.id, ativo=True, ordem=1,
        )
        peca2 = PromptModulo(
            tipo="peca", nome="recurso", titulo="Recurso Ordinario",
            conteudo="Template recurso", group_id=grupo.id, ativo=True, ordem=2,
        )
        conteudo1 = PromptModulo(
            tipo="conteudo", nome="medicamento", titulo="Medicamento",
            conteudo="Conteudo medicamento", group_id=grupo.id, ativo=True, ordem=3,
        )
        self.db.add_all([peca1, peca2, conteudo1])
        self.db.commit()

        # Query igual ao endpoint: filtra por tipo='peca' e group_id
        modulos_peca = self.db.query(PromptModulo).filter(
            PromptModulo.tipo == "peca",
            PromptModulo.ativo == True,
            PromptModulo.group_id == grupo.id,
        ).order_by(PromptModulo.ordem).all()

        nomes = [m.nome for m in modulos_peca]
        self.assertEqual(nomes, ["contestacao", "recurso"])
        # conteudo NAO aparece
        self.assertNotIn("medicamento", nomes)

    def test_tipos_peca_fantasma_nao_aparecem(self):
        """
        Tipos de peca da tabela tipos_peca (ex: 'Parecer Juridico') NAO aparecem
        se nao tem template em prompt_modulos.
        """
        from admin.models_prompt_groups import PromptGroup
        from admin.models_prompts import PromptModulo
        from sistemas.gerador_pecas.models_config_pecas import TipoPeca

        grupo = PromptGroup(name="PS", slug="ps", active=True)
        self.db.add(grupo)
        self.db.flush()

        # Tipo na tabela antiga (fantasma — sem template)
        tipo_fantasma = TipoPeca(nome="parecer_juridico", titulo="Parecer Juridico", ativo=True)
        self.db.add(tipo_fantasma)

        # Template real em prompt_modulos
        peca = PromptModulo(
            tipo="peca", nome="contestacao", titulo="Contestacao",
            conteudo="Template", group_id=grupo.id, ativo=True, ordem=1,
        )
        self.db.add(peca)
        self.db.commit()

        # Query do endpoint: so consulta prompt_modulos
        modulos_peca = self.db.query(PromptModulo).filter(
            PromptModulo.tipo == "peca",
            PromptModulo.ativo == True,
            PromptModulo.group_id == grupo.id,
        ).all()

        nomes = [m.nome for m in modulos_peca]
        self.assertIn("contestacao", nomes)
        self.assertNotIn("parecer_juridico", nomes)

    def test_tipos_peca_filtrados_por_grupo(self):
        """Cada grupo retorna apenas seus proprios tipos de peca."""
        from admin.models_prompt_groups import PromptGroup
        from admin.models_prompts import PromptModulo

        grupo_ps = PromptGroup(name="PS", slug="ps", active=True)
        grupo_detran = PromptGroup(name="Detran", slug="detran", active=True)
        self.db.add_all([grupo_ps, grupo_detran])
        self.db.flush()

        # PS tem contestacao e recurso
        self.db.add(PromptModulo(
            tipo="peca", nome="contestacao", titulo="Contestacao",
            conteudo="T", group_id=grupo_ps.id, ativo=True, ordem=1,
        ))
        self.db.add(PromptModulo(
            tipo="peca", nome="recurso", titulo="Recurso",
            conteudo="T", group_id=grupo_ps.id, ativo=True, ordem=2,
        ))

        # Detran so tem contestacao
        self.db.add(PromptModulo(
            tipo="peca", nome="contestacao", titulo="Contestacao Detran",
            conteudo="T", group_id=grupo_detran.id, ativo=True, ordem=1,
        ))
        self.db.commit()

        # Filtro PS
        pecas_ps = self.db.query(PromptModulo).filter(
            PromptModulo.tipo == "peca",
            PromptModulo.ativo == True,
            PromptModulo.group_id == grupo_ps.id,
        ).all()
        self.assertEqual(len(pecas_ps), 2)

        # Filtro Detran
        pecas_detran = self.db.query(PromptModulo).filter(
            PromptModulo.tipo == "peca",
            PromptModulo.ativo == True,
            PromptModulo.group_id == grupo_detran.id,
        ).all()
        self.assertEqual(len(pecas_detran), 1)
        self.assertEqual(pecas_detran[0].nome, "contestacao")


class TestFiltroDocumentosComGrupo(unittest.TestCase):
    """Testa filtrar_documentos() e filtrar_resumos_por_tipo() com group_id."""

    def setUp(self):
        from auth.models import User  # noqa: F401
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

    def _setup_dados(self):
        """Cria dados: grupo PS com codigos {500, 600}, grupo Detran com {500, 700}."""
        from admin.models_prompt_groups import PromptGroup
        from sistemas.gerador_pecas.models_config_pecas import (
            CategoriaDocumento,
            TipoPecaGrupoCategoria,
        )

        grupo_ps = PromptGroup(name="PS", slug="ps", active=True)
        grupo_detran = PromptGroup(name="Detran", slug="detran", active=True)
        self.db.add_all([grupo_ps, grupo_detran])
        self.db.flush()

        cat_peticao = CategoriaDocumento(nome="peticao", titulo="Peticao", codigos_documento=[500])
        cat_decisao = CategoriaDocumento(nome="decisao", titulo="Decisao", codigos_documento=[600])
        cat_laudo = CategoriaDocumento(nome="laudo", titulo="Laudo", codigos_documento=[700])
        self.db.add_all([cat_peticao, cat_decisao, cat_laudo])
        self.db.flush()

        # PS: contestacao usa peticao + decisao (codigos 500, 600)
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_ps.id, categoria_documento_id=cat_peticao.id))
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_ps.id, categoria_documento_id=cat_decisao.id))

        # Detran: contestacao usa peticao + laudo (codigos 500, 700)
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_detran.id, categoria_documento_id=cat_peticao.id))
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_detran.id, categoria_documento_id=cat_laudo.id))
        self.db.commit()

        return grupo_ps, grupo_detran

    def test_filtrar_resumos_por_grupo(self):
        """filtrar_resumos_por_tipo respeita group_id."""
        from sistemas.gerador_pecas.filtro_categorias import FiltroCategoriasDocumento
        grupo_ps, grupo_detran = self._setup_dados()
        filtro = FiltroCategoriasDocumento(self.db)

        resumos = [
            {"tipo_documento": "500", "texto": "peticao"},
            {"tipo_documento": "600", "texto": "decisao"},
            {"tipo_documento": "700", "texto": "laudo"},
        ]

        # PS: deve incluir 500 e 600, excluir 700
        filtrados_ps = filtro.filtrar_resumos_por_tipo(resumos, "contestacao", group_id=grupo_ps.id)
        tipos_ps = {r["tipo_documento"] for r in filtrados_ps}
        self.assertEqual(tipos_ps, {"500", "600"})

        # Detran: deve incluir 500 e 700, excluir 600
        filtrados_detran = filtro.filtrar_resumos_por_tipo(resumos, "contestacao", group_id=grupo_detran.id)
        tipos_detran = {r["tipo_documento"] for r in filtrados_detran}
        self.assertEqual(tipos_detran, {"500", "700"})


class TestConstraintUnica(unittest.TestCase):
    """Testa que a unique constraint impede duplicatas."""

    def setUp(self):
        from auth.models import User  # noqa: F401
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

    def test_duplicata_rejeitada(self):
        """Nao permite inserir mesma combinacao (tipo, grupo, categoria) duas vezes."""
        from sqlalchemy.exc import IntegrityError
        from admin.models_prompt_groups import PromptGroup
        from sistemas.gerador_pecas.models_config_pecas import (
            CategoriaDocumento,
            TipoPecaGrupoCategoria,
        )

        grupo = PromptGroup(name="PS", slug="ps", active=True)
        self.db.add(grupo)
        self.db.flush()

        cat = CategoriaDocumento(nome="peticao", titulo="Peticao", codigos_documento=[500])
        self.db.add(cat)
        self.db.flush()

        assoc1 = TipoPecaGrupoCategoria(
            tipo_peca_nome="contestacao", group_id=grupo.id, categoria_documento_id=cat.id,
        )
        self.db.add(assoc1)
        self.db.commit()

        # Tentar duplicata
        assoc2 = TipoPecaGrupoCategoria(
            tipo_peca_nome="contestacao", group_id=grupo.id, categoria_documento_id=cat.id,
        )
        self.db.add(assoc2)
        with self.assertRaises(IntegrityError):
            self.db.commit()


if __name__ == "__main__":
    unittest.main()
