# Filtro de Documentos por Grupo — Plano de Implementacao

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminar tipos de peca fantasma (derivar de prompt_modulos) e permitir configuracao de categorias de documento por (tipo_peca, grupo) no filtro do Agente 1.

**Architecture:** Nova tabela de juncao `tipo_peca_grupo_categorias` com `(tipo_peca_nome, group_id, categoria_documento_id)`. Tipos de peca derivados de `prompt_modulos` (tipo='peca'). Frontend com seletor de grupo. Retrocompatibilidade via fallback quando group_id nao informado.

**Tech Stack:** Python/FastAPI, SQLAlchemy, Alembic, React/TypeScript, Radix UI components

---

### Task 1: Alembic Migration — Criar tabela tipo_peca_grupo_categorias

**Files:**
- Create: `migrations/versions/20260219_1500_c3d4e5f6a7b8_add_tipo_peca_grupo_categorias.py`

**Step 1: Criar migration**

Run: `cd E:/Projetos/PGE/portal-pge && python -m alembic revision --autogenerate -m "add_tipo_peca_grupo_categorias"`

Se autogenerate nao detectar (tabela nova sem model ainda), criar manualmente:

```python
"""add_tipo_peca_grupo_categorias

Revision ID: c3d4e5f6a7b8
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3d4e5f6a7b8'
down_revision = 'b2c3d4e5f6a7'  # ultima migration existente
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'tipo_peca_grupo_categorias',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('tipo_peca_nome', sa.String(50), nullable=False),
        sa.Column('group_id', sa.Integer(), sa.ForeignKey('prompt_groups.id'), nullable=False),
        sa.Column('categoria_documento_id', sa.Integer(), sa.ForeignKey('categorias_documento.id'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tipo_peca_nome', 'group_id', 'categoria_documento_id', name='uq_tpgc_tipo_group_cat'),
    )
    op.create_index('ix_tpgc_tipo_group', 'tipo_peca_grupo_categorias', ['tipo_peca_nome', 'group_id'])


def downgrade() -> None:
    op.drop_index('ix_tpgc_tipo_group', table_name='tipo_peca_grupo_categorias')
    op.drop_table('tipo_peca_grupo_categorias')
```

**Step 2: Aplicar migration localmente**

Run: `cd E:/Projetos/PGE/portal-pge && python -m alembic upgrade head`
Expected: Tabela criada sem erros.

**Step 3: Commit**

```bash
git add migrations/versions/*tipo_peca_grupo*
git commit -m "feat(db): cria tabela tipo_peca_grupo_categorias para filtro por grupo"
```

---

### Task 2: Model — TipoPecaGrupoCategoria

**Files:**
- Modify: `sistemas/gerador_pecas/models_config_pecas.py`
- Test: `tests/gerador_pecas/test_filtro_grupo.py`

**Step 1: Escrever teste basico do model**

Criar `tests/gerador_pecas/test_filtro_grupo.py`:

```python
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
```

**Step 2: Rodar teste para verificar que falha**

Run: `cd E:/Projetos/PGE/portal-pge && python -m pytest tests/gerador_pecas/test_filtro_grupo.py -v`
Expected: FAIL — `ImportError: cannot import name 'TipoPecaGrupoCategoria'`

**Step 3: Criar model TipoPecaGrupoCategoria**

Modificar `sistemas/gerador_pecas/models_config_pecas.py` — adicionar apos a classe `TipoPeca` (depois da linha 153):

```python
class TipoPecaGrupoCategoria(Base):
    """
    Associacao entre tipo de peca, grupo e categoria de documento.

    Permite configurar quais categorias de documento o Agente 1 analisa
    para cada tipo de peca em cada grupo (PS, PP, Detran).
    """
    __tablename__ = "tipo_peca_grupo_categorias"
    __table_args__ = (
        UniqueConstraint(
            'tipo_peca_nome', 'group_id', 'categoria_documento_id',
            name='uq_tpgc_tipo_group_cat'
        ),
    )

    id = Column(Integer, primary_key=True, index=True)
    tipo_peca_nome = Column(String(50), nullable=False, index=True)
    group_id = Column(Integer, ForeignKey("prompt_groups.id"), nullable=False, index=True)
    categoria_documento_id = Column(Integer, ForeignKey("categorias_documento.id"), nullable=False)

    # Relacionamentos
    categoria = relationship("CategoriaDocumento")
```

Tambem adicionar `UniqueConstraint` ao import no topo do arquivo:
```python
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, JSON, ForeignKey, Table, UniqueConstraint
```

**Step 4: Rodar testes e verificar que passam**

Run: `cd E:/Projetos/PGE/portal-pge && python -m pytest tests/gerador_pecas/test_filtro_grupo.py -v`
Expected: 2 tests PASS

**Step 5: Commit**

```bash
git add sistemas/gerador_pecas/models_config_pecas.py tests/gerador_pecas/test_filtro_grupo.py
git commit -m "feat(model): adiciona TipoPecaGrupoCategoria para filtro por grupo"
```

---

### Task 3: Backend — Atualizar FiltroCategoriasDocumento com suporte a group_id

**Files:**
- Modify: `sistemas/gerador_pecas/filtro_categorias.py`
- Modify: `tests/gerador_pecas/test_filtro_grupo.py`

**Step 1: Escrever testes do filtro com group_id**

Adicionar ao arquivo `tests/gerador_pecas/test_filtro_grupo.py`:

```python
class TestFiltroCategoriasComGrupo(unittest.TestCase):
    """Testa FiltroCategoriasDocumento com suporte a group_id."""

    def setUp(self):
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

        # PS: contestacao usa peticao + decisao → codigos {500, 510, 600, 610}
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_ps.id, categoria_documento_id=cat_peticao.id))
        self.db.add(TipoPecaGrupoCategoria(tipo_peca_nome="contestacao", group_id=grupo_ps.id, categoria_documento_id=cat_decisao.id))

        # Detran: contestacao usa peticao + laudo → codigos {500, 510, 700}
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
        """Sem group_id, faz fallback para comportamento antigo (tipo_peca_categorias)."""
        from sistemas.gerador_pecas.filtro_categorias import FiltroCategoriasDocumento

        self._setup_dados()

        filtro = FiltroCategoriasDocumento(self.db)
        # Sem group_id, usa cache antigo (tipo_peca_categorias ou sem filtro)
        codigos = filtro.get_codigos_permitidos("contestacao")
        # Deve retornar algo (fallback), nao set vazio
        self.assertIsInstance(codigos, set)

    def test_documento_permitido_com_group_id(self):
        """Verifica documento_permitido() com group_id."""
        from sistemas.gerador_pecas.filtro_categorias import FiltroCategoriasDocumento

        grupo_ps, grupo_detran = self._setup_dados()
        filtro = FiltroCategoriasDocumento(self.db)

        # 700 (laudo) permitido no Detran, nao no PS
        self.assertFalse(filtro.documento_permitido("contestacao", 700, group_id=grupo_ps.id))
        self.assertTrue(filtro.documento_permitido("contestacao", 700, group_id=grupo_detran.id))

        # 600 (decisao) permitido no PS, nao no Detran
        self.assertTrue(filtro.documento_permitido("contestacao", 600, group_id=grupo_ps.id))
        self.assertFalse(filtro.documento_permitido("contestacao", 600, group_id=grupo_detran.id))
```

**Step 2: Rodar testes para verificar que falham**

Run: `cd E:/Projetos/PGE/portal-pge && python -m pytest tests/gerador_pecas/test_filtro_grupo.py::TestFiltroCategoriasComGrupo -v`
Expected: FAIL — `TypeError: get_codigos_permitidos() got an unexpected keyword argument 'group_id'`

**Step 3: Implementar suporte a group_id no FiltroCategoriasDocumento**

Modificar `sistemas/gerador_pecas/filtro_categorias.py`:

1. Adicionar import no topo:
```python
from sistemas.gerador_pecas.models_config_pecas import TipoPeca, CategoriaDocumento, TipoPecaGrupoCategoria
```

2. Adicionar metodo `_get_codigos_por_grupo` na classe:
```python
    def _get_codigos_por_grupo(self, tipo_peca: str, group_id: int) -> Set[int]:
        """
        Busca codigos de documento permitidos para (tipo_peca, group_id)
        na tabela tipo_peca_grupo_categorias.

        Returns:
            Conjunto de codigos ou set vazio se nao houver configuracao
        """
        assocs = self.db.query(TipoPecaGrupoCategoria).filter(
            TipoPecaGrupoCategoria.tipo_peca_nome == tipo_peca.lower(),
            TipoPecaGrupoCategoria.group_id == group_id,
        ).all()

        if not assocs:
            return set()

        codigos = set()
        cat_ids = [a.categoria_documento_id for a in assocs]
        categorias = self.db.query(CategoriaDocumento).filter(
            CategoriaDocumento.id.in_(cat_ids),
            CategoriaDocumento.ativo == True,
        ).all()
        for cat in categorias:
            codigos.update(cat.get_codigos())
        return codigos

    def _get_codigos_primeiro_doc_por_grupo(self, tipo_peca: str, group_id: int) -> Set[int]:
        """
        Busca codigos de primeiro documento para (tipo_peca, group_id).
        """
        assocs = self.db.query(TipoPecaGrupoCategoria).filter(
            TipoPecaGrupoCategoria.tipo_peca_nome == tipo_peca.lower(),
            TipoPecaGrupoCategoria.group_id == group_id,
        ).all()

        if not assocs:
            return set()

        codigos = set()
        cat_ids = [a.categoria_documento_id for a in assocs]
        categorias = self.db.query(CategoriaDocumento).filter(
            CategoriaDocumento.id.in_(cat_ids),
            CategoriaDocumento.ativo == True,
            CategoriaDocumento.is_primeiro_documento == True,
        ).all()
        for cat in categorias:
            codigos.update(cat.get_codigos())
        return codigos
```

3. Modificar `get_codigos_permitidos` (adicionar parametro `group_id`):
```python
    def get_codigos_permitidos(self, tipo_peca: str, group_id: int | None = None) -> Set[int]:
        """
        Retorna os codigos de documento permitidos para um tipo de peca.

        Args:
            tipo_peca: Nome do tipo de peca (ex: 'contestacao')
            group_id: ID do grupo (opcional). Se informado, busca na tabela
                      tipo_peca_grupo_categorias. Se None, fallback para cache antigo.
        """
        # Se group_id informado, busca na nova tabela
        if group_id is not None:
            codigos = self._get_codigos_por_grupo(tipo_peca, group_id)
            if codigos:
                return codigos
            # Fallback: se nao tem config por grupo, usa cache antigo

        tipo_lower = tipo_peca.lower() if tipo_peca else ""

        if tipo_lower in self._cache_tipos:
            return self._cache_tipos[tipo_lower]["codigos"]

        # ... restante do metodo existente permanece igual
```

4. Modificar `get_codigos_primeiro_documento` (adicionar parametro `group_id`):
```python
    def get_codigos_primeiro_documento(self, tipo_peca: str, group_id: int | None = None) -> Set[int]:
        """..."""
        if group_id is not None:
            codigos = self._get_codigos_primeiro_doc_por_grupo(tipo_peca, group_id)
            if codigos:
                return codigos

        # ... restante do metodo existente
```

5. Modificar `documento_permitido` (adicionar parametro `group_id`):
```python
    def documento_permitido(
        self,
        tipo_peca: Optional[str],
        codigo_documento: int,
        group_id: int | None = None,
    ) -> bool:
        if tipo_peca:
            codigos = self.get_codigos_permitidos(tipo_peca, group_id=group_id)
        else:
            codigos = self.get_todos_codigos()

        return codigo_documento in codigos
```

**Step 4: Rodar testes**

Run: `cd E:/Projetos/PGE/portal-pge && python -m pytest tests/gerador_pecas/test_filtro_grupo.py -v`
Expected: Todos os testes PASS

**Step 5: Rodar testes existentes para garantir retrocompatibilidade**

Run: `cd E:/Projetos/PGE/portal-pge && python -m pytest tests/gerador_pecas/ -v`
Expected: Todos os testes existentes continuam passando (group_id=None = comportamento antigo)

**Step 6: Commit**

```bash
git add sistemas/gerador_pecas/filtro_categorias.py tests/gerador_pecas/test_filtro_grupo.py
git commit -m "feat(filtro): suporte a group_id no FiltroCategoriasDocumento"
```

---

### Task 4: Backend — Atualizar endpoints do filtro-documentos

**Files:**
- Modify: `admin/router_filtro_documentos.py`
- Modify: `sistemas/gerador_pecas/schemas.py`

**Step 1: Adicionar novos schemas**

Em `sistemas/gerador_pecas/schemas.py`, adicionar apos `AssociacaoCategoriasRequest` (linha 178):

```python
class AssociacaoCategoriasGrupoRequest(BaseModel):
    """Request para associar categorias a um tipo de peca em um grupo."""
    group_id: int
    categorias_ids: List[int]


class TipoPecaDerivadoResponse(BaseModel):
    """Tipo de peca derivado de prompt_modulos (sem tabela tipos_peca)."""
    nome: str
    titulo: str
    group_id: int
    categorias_count: int = 0
    categorias_documento: List[CategoriaDocumentoResponse] = []

    class Config:
        from_attributes = True
```

**Step 2: Atualizar endpoint `/tipos-peca` para derivar de prompt_modulos**

Em `admin/router_filtro_documentos.py`, substituir o endpoint `listar_tipos_peca` (linhas 160-170):

```python
@router.get("/tipos-peca")
async def listar_tipos_peca(
    group_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Lista tipos de peca derivados de prompt_modulos (tipo='peca').
    Se group_id informado, retorna apenas os tipos com template naquele grupo.
    Inclui categorias associadas via tipo_peca_grupo_categorias.
    """
    from admin.models_prompts import PromptModulo
    from sistemas.gerador_pecas.models_config_pecas import TipoPecaGrupoCategoria

    query = db.query(PromptModulo).filter(
        PromptModulo.tipo == "peca",
        PromptModulo.ativo == True,
    )
    if group_id:
        query = query.filter(PromptModulo.group_id == group_id)

    modulos_peca = query.order_by(PromptModulo.ordem).all()

    resultado = []
    for m in modulos_peca:
        # Buscar categorias associadas para este (tipo_peca, group_id)
        cats = []
        cat_count = 0
        if group_id:
            assocs = db.query(TipoPecaGrupoCategoria).filter(
                TipoPecaGrupoCategoria.tipo_peca_nome == m.nome,
                TipoPecaGrupoCategoria.group_id == group_id,
            ).all()
            cat_ids = [a.categoria_documento_id for a in assocs]
            if cat_ids:
                cats_db = session_query(db, CategoriaDocumento).filter(
                    CategoriaDocumento.id.in_(cat_ids)
                ).order_by(CategoriaDocumento.ordem).all()
                cats = cats_db
            cat_count = len(cats)

        resultado.append({
            "nome": m.nome,
            "titulo": m.titulo,
            "group_id": group_id or m.group_id,
            "categorias_count": cat_count,
            "categorias_documento": cats,
        })

    return resultado
```

**Step 3: Atualizar endpoint de associacao de categorias**

Em `admin/router_filtro_documentos.py`, substituir `atualizar_categorias_tipo_peca` (linhas 173-198):

```python
@router.put("/tipos-peca/{tipo_peca_nome}/categorias")
async def atualizar_categorias_tipo_peca(
    tipo_peca_nome: str,
    dados: AssociacaoCategoriasGrupoRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Atualiza associacao de categorias para um tipo de peca em um grupo.
    Substitui todas as associacoes existentes para (tipo_peca_nome, group_id).
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Acesso negado")

    from sistemas.gerador_pecas.models_config_pecas import TipoPecaGrupoCategoria

    # Remove associacoes antigas
    db.query(TipoPecaGrupoCategoria).filter(
        TipoPecaGrupoCategoria.tipo_peca_nome == tipo_peca_nome,
        TipoPecaGrupoCategoria.group_id == dados.group_id,
    ).delete()

    # Cria novas associacoes
    for cat_id in dados.categorias_ids:
        db.add(TipoPecaGrupoCategoria(
            tipo_peca_nome=tipo_peca_nome,
            group_id=dados.group_id,
            categoria_documento_id=cat_id,
        ))

    db.commit()

    return {
        "message": "Categorias atualizadas com sucesso",
        "tipo_peca": tipo_peca_nome,
        "group_id": dados.group_id,
        "categorias_count": len(dados.categorias_ids),
    }
```

**Step 4: Adicionar import do novo schema**

No topo de `admin/router_filtro_documentos.py`, adicionar `AssociacaoCategoriasGrupoRequest` ao import:

```python
from sistemas.gerador_pecas.schemas import (
    CategoriaDocumentoBase,
    CategoriaDocumentoResponse,
    TipoPecaBase,
    TipoPecaCreate,
    TipoPecaResponse,
    AssociacaoCategoriasRequest,
    AssociacaoCategoriasGrupoRequest,
)
```

**Step 5: Verificar que nao quebrou nada**

Run: `cd E:/Projetos/PGE/portal-pge && python -c "from admin.router_filtro_documentos import router; print('OK')" `
Expected: "OK" sem erros de import

**Step 6: Commit**

```bash
git add admin/router_filtro_documentos.py sistemas/gerador_pecas/schemas.py
git commit -m "feat(api): endpoint tipos-peca derivado de prompt_modulos com grupo"
```

---

### Task 5: Backend — Atualizar router.py do gerador para passar group_id ao filtro

**Files:**
- Modify: `sistemas/gerador_pecas/router.py` (3 locais: ~L908, ~L3078, ~L3424)

**Step 1: Atualizar local 1 (~L908) — geracao automatica**

Contexto: O `group_id` ja esta disponivel como variavel local no escopo da funcao.
Alterar de:
```python
codigos = filtro.get_codigos_permitidos(tipo_peca_inicial)
codigos_primeiro = filtro.get_codigos_primeiro_documento(tipo_peca_inicial)
```

Para:
```python
codigos = filtro.get_codigos_permitidos(tipo_peca_inicial, group_id=group_id)
codigos_primeiro = filtro.get_codigos_primeiro_documento(tipo_peca_inicial, group_id=group_id)
```

**Step 2: Atualizar local 2 (~L3078) — curadoria/preview**

Mesmo padrao: adicionar `group_id=group_id` as chamadas de `get_codigos_permitidos` e `get_codigos_primeiro_documento`.

**Step 3: Atualizar local 3 (~L3424) — geracao com curadoria**

Mesmo padrao.

**Step 4: Verificar que nao quebrou imports**

Run: `cd E:/Projetos/PGE/portal-pge && python -c "from sistemas.gerador_pecas.router import router; print('OK')"`
Expected: "OK"

**Step 5: Commit**

```bash
git add sistemas/gerador_pecas/router.py
git commit -m "feat(pipeline): passa group_id ao FiltroCategoriasDocumento no Agente 1"
```

---

### Task 6: Frontend — Adicionar GroupSelector ao FiltroDocumentosPage

**Files:**
- Modify: `frontend-react/src/pages/admin/filtro-documentos/FiltroDocumentosPage.tsx`

**Step 1: Adicionar state e import do GroupSelector**

No topo do componente, adicionar:
```typescript
import { GroupSelector } from '@/components/ui/GroupSelector'
```

Dentro do componente `FiltroDocumentosPage`, adicionar state:
```typescript
const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null)
```

**Step 2: Atualizar interface TipoPeca para o novo formato**

Substituir a interface `TipoPeca` existente:
```typescript
interface TipoPeca {
  nome: string
  titulo: string
  group_id: number
  categorias_count: number
  categorias_documento: CategoriaDocumento[]
}
```

**Step 3: Atualizar loadData para passar group_id**

```typescript
const loadData = useCallback(async () => {
  setLoading(true)
  try {
    const params = selectedGroupId ? `?group_id=${selectedGroupId}` : ''
    const [cats, tipos] = await Promise.all([
      api.get<CategoriaDocumento[]>('/categorias'),
      api.get<TipoPeca[]>(`/tipos-peca${params}`),
    ])
    setCategorias(cats)
    setTiposPeca(tipos)
  } catch {
    toast({ title: 'Erro', description: 'Erro ao carregar dados', variant: 'destructive' })
  } finally {
    setLoading(false)
  }
}, [toast, selectedGroupId])

useEffect(() => {
  if (selectedGroupId) {
    loadData()
  }
}, [selectedGroupId, loadData])
```

**Step 4: Adicionar GroupSelector no JSX**

Na secao de header da pagina, adicionar ANTES do botao de seed:
```typescript
<GroupSelector
  selectedGroupId={selectedGroupId}
  onGroupChange={setSelectedGroupId}
  label="Grupo"
/>
```

**Step 5: Atualizar dialog de edicao de TipoPeca**

No `EditarTipoPecaDialog`, ajustar `handleSave` para enviar `group_id`:
```typescript
const handleSave = async () => {
  if (!tipoPeca || !selectedGroupId) return
  setSaving(true)
  try {
    await api.put(`/tipos-peca/${tipoPeca.nome}/categorias`, {
      group_id: selectedGroupId,
      categorias_ids: Array.from(selectedIds),
    })
    toast({
      title: 'Salvo',
      description: `Categorias de "${tipoPeca.titulo}" atualizadas (${selectedIds.size})`,
    })
    onOpenChange(false)
    onSaved()
  } catch {
    toast({ title: 'Erro', description: 'Erro ao salvar associacoes', variant: 'destructive' })
  } finally {
    setSaving(false)
  }
}
```

**Step 6: Atualizar referencia de `tipoPeca.id` para `tipoPeca.nome`**

O endpoint agora usa `nome` como identificador (nao mais `id`). Verificar todas as referencias no dialog.

**Step 7: Mostrar aviso quando tipo nao tem categorias configuradas**

No card de tipo de peca, quando `categorias_count === 0`:
```typescript
{tipo.categorias_count === 0 && (
  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
    Sem filtro configurado
  </Badge>
)}
```

**Step 8: Build do frontend**

Run: `cd E:/Projetos/PGE/portal-pge/frontend-react && node node_modules/vite/bin/vite.js build`
Expected: Build sem erros

**Step 9: Commit**

```bash
git add frontend-react/src/pages/admin/filtro-documentos/FiltroDocumentosPage.tsx
git add -f frontend-react/dist/
git commit -m "feat(frontend): seletor de grupo no filtro de documentos"
```

---

### Task 7: Script de migracao de dados

**Files:**
- Create: `scripts/data-fix/migrar_tipo_peca_grupo_categorias.py`

**Step 1: Criar script de migracao**

```python
"""
Migra dados de tipo_peca_categorias (antigo, sem grupo) para
tipo_peca_grupo_categorias (novo, com grupo).

Para cada grupo ativo, replica as associacoes existentes na tabela antiga.
Assim a transicao e transparente e nenhum grupo perde configuracao.

Uso:
    python scripts/data-fix/migrar_tipo_peca_grupo_categorias.py
"""
import sys
from pathlib import Path

# Adiciona raiz do projeto ao sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from sqlalchemy import text
from database.connection import SessionLocal

def main():
    db = SessionLocal()
    try:
        # Busca grupos ativos
        grupos = db.execute(text("SELECT id, name FROM prompt_groups WHERE active = true")).fetchall()
        print(f"Grupos ativos: {len(grupos)}")

        # Busca associacoes antigas (tipo_peca_categorias)
        assocs_antigas = db.execute(text("""
            SELECT tp.nome as tipo_peca_nome, tpc.categoria_documento_id
            FROM tipo_peca_categorias tpc
            JOIN tipos_peca tp ON tp.id = tpc.tipo_peca_id
        """)).fetchall()
        print(f"Associacoes antigas: {len(assocs_antigas)}")

        if not assocs_antigas:
            print("Nenhuma associacao para migrar.")
            return

        # Para cada grupo, replica as associacoes
        total = 0
        for grupo_id, grupo_nome in grupos:
            for tipo_peca_nome, cat_id in assocs_antigas:
                # Verifica se ja existe
                existe = db.execute(text("""
                    SELECT 1 FROM tipo_peca_grupo_categorias
                    WHERE tipo_peca_nome = :nome AND group_id = :gid AND categoria_documento_id = :cid
                """), {"nome": tipo_peca_nome, "gid": grupo_id, "cid": cat_id}).fetchone()

                if not existe:
                    db.execute(text("""
                        INSERT INTO tipo_peca_grupo_categorias (tipo_peca_nome, group_id, categoria_documento_id)
                        VALUES (:nome, :gid, :cid)
                    """), {"nome": tipo_peca_nome, "gid": grupo_id, "cid": cat_id})
                    total += 1

            print(f"  Grupo '{grupo_nome}' (id={grupo_id}): replicadas associacoes")

        db.commit()
        print(f"\nMigracao concluida: {total} novas associacoes criadas.")

    except Exception as e:
        db.rollback()
        print(f"ERRO: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
```

**Step 2: Testar localmente**

Run: `cd E:/Projetos/PGE/portal-pge && python scripts/data-fix/migrar_tipo_peca_grupo_categorias.py`
Expected: Mensagem de sucesso com contagem de associacoes criadas

**Step 3: Commit**

```bash
git add scripts/data-fix/migrar_tipo_peca_grupo_categorias.py
git commit -m "feat(script): migracao de dados tipo_peca_categorias para novo modelo com grupo"
```

---

### Task 8: Testes de integracao e verificacao final

**Files:**
- Modify: `tests/gerador_pecas/test_filtro_grupo.py`

**Step 1: Adicionar teste de integracao endpoint**

```python
class TestEndpointTiposPecaDerivado(unittest.TestCase):
    """Verifica que o endpoint retorna tipos de peca derivados de prompt_modulos."""

    def setUp(self):
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
        """Tipos de peca sao derivados de prompt_modulos, nao de tipos_peca."""
        from admin.models_prompts import PromptModulo
        from admin.models_prompt_groups import PromptGroup

        grupo = PromptGroup(name="PS", slug="ps", active=True)
        self.db.add(grupo)
        self.db.flush()

        # Cria 2 templates de peca no grupo
        self.db.add(PromptModulo(
            tipo="peca", nome="contestacao", titulo="Contestacao",
            conteudo="Template de contestacao", group_id=grupo.id, ativo=True, ordem=1,
        ))
        self.db.add(PromptModulo(
            tipo="peca", nome="recurso_apelacao", titulo="Recurso de Apelacao",
            conteudo="Template de recurso", group_id=grupo.id, ativo=True, ordem=2,
        ))
        # Cria um modulo de conteudo (NAO deve aparecer como tipo de peca)
        self.db.add(PromptModulo(
            tipo="conteudo", nome="prescricao", titulo="Prescricao",
            conteudo="Argumento de prescricao", group_id=grupo.id, ativo=True,
        ))
        self.db.commit()

        # Simula query do endpoint
        modulos_peca = self.db.query(PromptModulo).filter(
            PromptModulo.tipo == "peca",
            PromptModulo.ativo == True,
            PromptModulo.group_id == grupo.id,
        ).order_by(PromptModulo.ordem).all()

        nomes = [m.nome for m in modulos_peca]
        self.assertEqual(nomes, ["contestacao", "recurso_apelacao"])
        # "prescricao" NAO aparece (e tipo conteudo, nao peca)
        self.assertNotIn("prescricao", nomes)
        # "parecer" NAO aparece (nao tem template neste grupo)
        self.assertNotIn("parecer", nomes)
```

**Step 2: Rodar todos os testes**

Run: `cd E:/Projetos/PGE/portal-pge && python -m pytest tests/gerador_pecas/test_filtro_grupo.py -v`
Expected: Todos PASS

Run: `cd E:/Projetos/PGE/portal-pge && python -m pytest tests/ -v --timeout=60`
Expected: Suite completa passa (verificar retrocompatibilidade)

**Step 3: Commit final**

```bash
git add tests/gerador_pecas/test_filtro_grupo.py
git commit -m "test: adiciona testes de integracao para filtro por grupo"
```

---

## Resumo de Arquivos Modificados

| Arquivo | Acao |
|---------|------|
| `migrations/versions/20260219_*_add_tipo_peca_grupo_categorias.py` | CRIADO |
| `sistemas/gerador_pecas/models_config_pecas.py` | MODIFICADO (novo model) |
| `sistemas/gerador_pecas/filtro_categorias.py` | MODIFICADO (suporte group_id) |
| `sistemas/gerador_pecas/schemas.py` | MODIFICADO (novos schemas) |
| `admin/router_filtro_documentos.py` | MODIFICADO (endpoints atualizados) |
| `sistemas/gerador_pecas/router.py` | MODIFICADO (passa group_id ao filtro) |
| `frontend-react/src/pages/admin/filtro-documentos/FiltroDocumentosPage.tsx` | MODIFICADO |
| `scripts/data-fix/migrar_tipo_peca_grupo_categorias.py` | CRIADO |
| `tests/gerador_pecas/test_filtro_grupo.py` | CRIADO |
