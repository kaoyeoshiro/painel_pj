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


if __name__ == "__main__":
    unittest.main()
