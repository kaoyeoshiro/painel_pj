# Árvore de Decisão — Plano de Implementação

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar página `/admin/arvore-decisao` com visualização BPMN interativa mostrando como variáveis e perguntas se relacionam com prompts modulares.

**Architecture:** Backend serve um endpoint que retorna módulos, variáveis e stats. Frontend converte as regras AST em nós React Flow (losangos, ovals, conectores) e renderiza num canvas com zoom semântico e swimlanes por categoria.

**Tech Stack:** FastAPI + SQLAlchemy (backend), React + @xyflow/react + dagre + Zustand (frontend)

**Spec:** `docs/superpowers/specs/2026-03-12-arvore-decisao-design.md`

---

## Chunk 1: Backend (Schemas + Service + Endpoint)

### Task 1: Schemas Pydantic

**Files:**
- Create: `sistemas/gerador_pecas/schemas_arvore.py`
- Test: `tests/gerador_pecas/test_arvore_decisao.py`

- [ ] **Step 1: Criar arquivo de schemas**

```python
# sistemas/gerador_pecas/schemas_arvore.py
"""DTOs para o endpoint de árvore de decisão."""

from typing import Literal
from pydantic import BaseModel


class SwimlaneDTO(BaseModel):
    """Raia agrupadora por categoria de módulo."""
    id: str
    label: str
    modulos_count: int
    variaveis_count: int
    pct_deterministico: float


class ModuloDTO(BaseModel):
    """Módulo de prompt com sua regra de ativação."""
    id: int
    titulo: str
    categoria: str
    modo_ativacao: Literal["deterministic", "llm"]
    regra: dict | None
    regra_secundaria: dict | None = None
    fallback_habilitado: bool
    variaveis_usadas: list[str]
    tipos_peca: list[str]
    regras_tipo_peca: dict[str, dict] = {}


class VariavelDTO(BaseModel):
    """Variável de extração ou processo com metadata."""
    slug: str
    label: str
    tipo: str
    fonte: Literal["extraction", "process"]
    pergunta: str | None
    is_orfa: bool
    modulos_ids: list[int]
    depends_on: str | None = None
    dependency_operator: str | None = None
    dependency_value: str | None = None


class StatsDTO(BaseModel):
    """Estatísticas agregadas do grafo."""
    total_modulos: int
    total_variaveis: int
    total_orfas: int
    total_vinculos: int


class ArvoreDecisaoResponse(BaseModel):
    """Resposta completa do endpoint de árvore de decisão."""
    swimlanes: list[SwimlaneDTO]
    modulos: list[ModuloDTO]
    variaveis: list[VariavelDTO]
    stats: StatsDTO
```

- [ ] **Step 2: Criar teste básico de serialização dos schemas**

```python
# tests/gerador_pecas/test_arvore_decisao.py
"""Testes para a feature árvore de decisão."""

import pytest
from sistemas.gerador_pecas.schemas_arvore import (
    SwimlaneDTO, ModuloDTO, VariavelDTO, StatsDTO, ArvoreDecisaoResponse
)


class TestSchemas:
    """Testes de serialização dos DTOs."""

    def test_swimlane_dto_valido(self):
        """Deve criar SwimlaneDTO com campos obrigatórios."""
        dto = SwimlaneDTO(
            id="merito", label="Mérito",
            modulos_count=90, variaveis_count=52, pct_deterministico=85.0
        )
        assert dto.id == "merito"
        assert dto.pct_deterministico == 85.0

    def test_modulo_dto_com_regra(self):
        """Deve criar ModuloDTO com regra AST."""
        dto = ModuloDTO(
            id=27, titulo="Não Comparecimento",
            categoria="Mérito", modo_ativacao="deterministic",
            regra={"type": "condition", "variable": "var_x", "operator": "equals", "value": True},
            fallback_habilitado=False,
            variaveis_usadas=["var_x"],
            tipos_peca=["contestacao"]
        )
        assert dto.regra["type"] == "condition"
        assert dto.regras_tipo_peca == {}

    def test_modulo_dto_llm_sem_regra(self):
        """Deve criar ModuloDTO LLM com regra None."""
        dto = ModuloDTO(
            id=28, titulo="Módulo LLM",
            categoria="Preliminar", modo_ativacao="llm",
            regra=None, fallback_habilitado=False,
            variaveis_usadas=[], tipos_peca=["contestacao"]
        )
        assert dto.regra is None

    def test_variavel_dto_orfa(self):
        """Deve marcar variável como órfã."""
        dto = VariavelDTO(
            slug="var_sem_uso", label="Sem Uso", tipo="text",
            fonte="extraction", pergunta="Pergunta?",
            is_orfa=True, modulos_ids=[]
        )
        assert dto.is_orfa is True
        assert dto.depends_on is None

    def test_variavel_dto_com_dependencia(self):
        """Deve incluir dados de dependência."""
        dto = VariavelDTO(
            slug="var_filha", label="Filha", tipo="boolean",
            fonte="extraction", pergunta="Pergunta?",
            is_orfa=False, modulos_ids=[27],
            depends_on="var_pai", dependency_operator="equals",
            dependency_value="true"
        )
        assert dto.depends_on == "var_pai"

    def test_arvore_response_completa(self):
        """Deve montar response completa."""
        resp = ArvoreDecisaoResponse(
            swimlanes=[SwimlaneDTO(id="m", label="Mérito", modulos_count=1, variaveis_count=1, pct_deterministico=100.0)],
            modulos=[ModuloDTO(id=1, titulo="T", categoria="Mérito", modo_ativacao="deterministic",
                               regra=None, fallback_habilitado=False, variaveis_usadas=[], tipos_peca=[])],
            variaveis=[VariavelDTO(slug="v", label="V", tipo="text", fonte="extraction",
                                   pergunta=None, is_orfa=True, modulos_ids=[])],
            stats=StatsDTO(total_modulos=1, total_variaveis=1, total_orfas=1, total_vinculos=0)
        )
        assert len(resp.swimlanes) == 1
        assert resp.stats.total_orfas == 1
```

- [ ] **Step 3: Rodar testes dos schemas**

Run: `cd E:\Projetos\PGE\portal-pge && python -m pytest tests/gerador_pecas/test_arvore_decisao.py::TestSchemas -v`
Expected: 6 tests PASS

- [ ] **Step 4: Commit schemas**

```bash
git add sistemas/gerador_pecas/schemas_arvore.py tests/gerador_pecas/test_arvore_decisao.py
git commit -m "feat(arvore-decisao): schemas Pydantic para endpoint de árvore de decisão"
```

---

### Task 2: Service — Montagem do Grafo

**Files:**
- Create: `sistemas/gerador_pecas/services_arvore_decisao.py`
- Test: `tests/gerador_pecas/test_arvore_decisao.py` (append)

- [ ] **Step 1: Escrever testes do service**

Adicionar ao arquivo `tests/gerador_pecas/test_arvore_decisao.py`:

```python
from unittest.mock import MagicMock, patch
from sistemas.gerador_pecas.services_arvore_decisao import ArvoreDecisaoService


class TestArvoreDecisaoService:
    """Testes para o service que monta o grafo."""

    def _make_modulo(self, id, titulo, categoria, modo_ativacao="deterministic",
                     regra=None, group_id=1, ativo=True, tipo="conteudo"):
        """Helper para criar mock de PromptModulo."""
        m = MagicMock()
        m.id = id
        m.titulo = titulo
        m.categoria = categoria
        m.modo_ativacao = modo_ativacao
        m.regra_deterministica = regra
        m.regra_deterministica_secundaria = None
        m.fallback_habilitado = False
        m.group_id = group_id
        m.ativo = ativo
        m.tipo = tipo
        return m

    def _make_variavel(self, slug, label, tipo="boolean", categoria_id=1,
                       depends_on=None, dep_operator=None, dep_value=None):
        """Helper para criar mock de ExtractionVariable."""
        v = MagicMock()
        v.slug = slug
        v.label = label
        v.tipo = tipo
        v.categoria_id = categoria_id
        v.is_conditional = depends_on is not None
        v.depends_on_variable = depends_on
        v.dependency_operator = dep_operator
        v.dependency_value = dep_value
        v.source_question = MagicMock()
        v.source_question.pergunta = f"Pergunta sobre {slug}?"
        return v

    def test_extrair_variaveis_de_regra_simples(self):
        """Deve extrair slugs de uma regra condition simples."""
        regra = {"type": "condition", "variable": "var_a", "operator": "equals", "value": True}
        slugs = ArvoreDecisaoService._extrair_variaveis_regra(regra)
        assert slugs == {"var_a"}

    def test_extrair_variaveis_de_regra_and(self):
        """Deve extrair slugs de regra AND com múltiplas condições."""
        regra = {
            "type": "and",
            "conditions": [
                {"type": "condition", "variable": "var_a", "operator": "equals", "value": True},
                {"type": "condition", "variable": "var_b", "operator": "in_list", "value": [1, 2]}
            ]
        }
        slugs = ArvoreDecisaoService._extrair_variaveis_regra(regra)
        assert slugs == {"var_a", "var_b"}

    def test_extrair_variaveis_de_regra_aninhada(self):
        """Deve extrair slugs de regra com AND/OR/NOT aninhados."""
        regra = {
            "type": "or",
            "conditions": [
                {"type": "and", "conditions": [
                    {"type": "condition", "variable": "var_a", "operator": "equals", "value": True},
                    {"type": "not", "condition": {
                        "type": "condition", "variable": "var_b", "operator": "equals", "value": False
                    }}
                ]},
                {"type": "condition", "variable": "var_c", "operator": "exists", "value": None}
            ]
        }
        slugs = ArvoreDecisaoService._extrair_variaveis_regra(regra)
        assert slugs == {"var_a", "var_b", "var_c"}

    def test_extrair_variaveis_regra_none(self):
        """Deve retornar set vazio para regra None."""
        slugs = ArvoreDecisaoService._extrair_variaveis_regra(None)
        assert slugs == set()

    def test_montar_swimlanes(self):
        """Deve agrupar módulos em swimlanes por categoria."""
        modulos_dto = [
            ModuloDTO(id=1, titulo="M1", categoria="Mérito", modo_ativacao="deterministic",
                      regra=None, fallback_habilitado=False, variaveis_usadas=["v1"], tipos_peca=[]),
            ModuloDTO(id=2, titulo="M2", categoria="Mérito", modo_ativacao="llm",
                      regra=None, fallback_habilitado=False, variaveis_usadas=[], tipos_peca=[]),
            ModuloDTO(id=3, titulo="M3", categoria="Preliminar", modo_ativacao="deterministic",
                      regra=None, fallback_habilitado=False, variaveis_usadas=["v2"], tipos_peca=[]),
        ]
        swimlanes = ArvoreDecisaoService._montar_swimlanes(modulos_dto)
        assert len(swimlanes) == 2

        merito = next(s for s in swimlanes if s.label == "Mérito")
        assert merito.modulos_count == 2
        assert merito.pct_deterministico == 50.0

        preliminar = next(s for s in swimlanes if s.label == "Preliminar")
        assert preliminar.modulos_count == 1
        assert preliminar.pct_deterministico == 100.0
```

- [ ] **Step 2: Rodar testes — verificar que falham**

Run: `cd E:\Projetos\PGE\portal-pge && python -m pytest tests/gerador_pecas/test_arvore_decisao.py::TestArvoreDecisaoService -v`
Expected: FAIL (módulo não existe)

- [ ] **Step 3: Implementar o service**

```python
# sistemas/gerador_pecas/services_arvore_decisao.py
"""
Serviço para montar o grafo da árvore de decisão.

Responsabilidades:
- Consultar módulos, variáveis, perguntas e vínculos do banco
- Montar DTOs para o frontend renderizar
- Incluir variáveis de processo (ProcessVariableResolver)
- Calcular stats agregados
"""

import logging
from typing import Any

from sqlalchemy.orm import Session, joinedload

from admin.models_prompts import PromptModulo, ModuloTipoPeca, RegraDeterministicaTipoPeca
from sistemas.gerador_pecas.models_extraction import (
    ExtractionVariable, ExtractionQuestion, PromptVariableUsage
)
from sistemas.gerador_pecas.services_process_variables import ProcessVariableResolver
from sistemas.gerador_pecas.schemas_arvore import (
    SwimlaneDTO, ModuloDTO, VariavelDTO, StatsDTO, ArvoreDecisaoResponse
)

logger = logging.getLogger(__name__)


class ArvoreDecisaoService:
    """Monta o grafo de árvore de decisão para o frontend."""

    def __init__(self, db: Session):
        self.db = db

    def montar_grafo(
        self,
        grupo_id: int,
        tipo_peca_id: int | None = None,
        include_orphans: bool = True,
    ) -> ArvoreDecisaoResponse:
        """
        Monta o grafo completo de variáveis → módulos.

        Args:
            grupo_id: ID do grupo (PS/PP/DETRAN)
            tipo_peca_id: ID do tipo de peça para filtrar (opcional)
            include_orphans: Se deve incluir variáveis órfãs

        Returns:
            ArvoreDecisaoResponse com swimlanes, módulos, variáveis e stats
        """
        # 1. Buscar módulos de conteúdo do grupo
        modulos_query = (
            self.db.query(PromptModulo)
            .filter(
                PromptModulo.group_id == grupo_id,
                PromptModulo.tipo == "conteudo",
                PromptModulo.ativo == True,
            )
        )

        # Filtrar por tipo de peça se informado
        if tipo_peca_id is not None:
            # tipo_peca_id referencia PromptModulo.id de tipo='peca'
            # Precisamos buscar o nome (slug) do tipo de peça para filtrar em ModuloTipoPeca
            tipo_peca_obj = (
                self.db.query(PromptModulo)
                .filter(PromptModulo.id == tipo_peca_id, PromptModulo.tipo == "peca")
                .first()
            )
            if tipo_peca_obj:
                modulo_ids_tipo = (
                    self.db.query(ModuloTipoPeca.modulo_id)
                    .filter(
                        ModuloTipoPeca.tipo_peca == tipo_peca_obj.nome,
                        ModuloTipoPeca.ativo == True,
                    )
                    .subquery()
                )
                modulos_query = modulos_query.filter(
                    PromptModulo.id.in_(modulo_ids_tipo)
                )

        modulos_db = modulos_query.order_by(PromptModulo.categoria, PromptModulo.ordem).all()

        # 2. Buscar regras por tipo de peça
        modulo_ids = [m.id for m in modulos_db]
        regras_tipo_peca = {}
        if modulo_ids:
            regras_tp = (
                self.db.query(RegraDeterministicaTipoPeca)
                .filter(
                    RegraDeterministicaTipoPeca.modulo_id.in_(modulo_ids),
                    RegraDeterministicaTipoPeca.ativo == True,
                )
                .all()
            )
            for rtp in regras_tp:
                regras_tipo_peca.setdefault(rtp.modulo_id, {})[rtp.tipo_peca] = rtp.regra_deterministica

        # 3. Buscar tipos de peça por módulo
        tipos_peca_map: dict[int, list[str]] = {}
        if modulo_ids:
            tipos_result = (
                self.db.query(
                    ModuloTipoPeca.modulo_id,
                    ModuloTipoPeca.tipo_peca,
                )
                .filter(
                    ModuloTipoPeca.modulo_id.in_(modulo_ids),
                    ModuloTipoPeca.ativo == True,
                )
                .all()
            )
            for modulo_id, tipo_peca in tipos_result:
                tipos_peca_map.setdefault(modulo_id, []).append(tipo_peca)

        # 4. Montar ModuloDTOs
        # Coletar todas as variáveis usadas em regras
        todas_variaveis_usadas: set[str] = set()
        modulos_dto: list[ModuloDTO] = []

        for m in modulos_db:
            vars_primaria = self._extrair_variaveis_regra(m.regra_deterministica)
            vars_secundaria = self._extrair_variaveis_regra(m.regra_deterministica_secundaria)
            vars_usadas = vars_primaria | vars_secundaria
            todas_variaveis_usadas |= vars_usadas

            modulos_dto.append(ModuloDTO(
                id=m.id,
                titulo=m.titulo,
                categoria=m.categoria or "Sem Categoria",
                modo_ativacao=m.modo_ativacao or "llm",
                regra=m.regra_deterministica,
                regra_secundaria=m.regra_deterministica_secundaria,
                fallback_habilitado=m.fallback_habilitado or False,
                variaveis_usadas=sorted(vars_usadas),
                tipos_peca=tipos_peca_map.get(m.id, []),
                regras_tipo_peca=regras_tipo_peca.get(m.id, {}),
            ))

        # 5. Montar mapa reverso: variável → módulos que a usam
        var_to_modulos: dict[str, list[int]] = {}
        for mdto in modulos_dto:
            for slug in mdto.variaveis_usadas:
                var_to_modulos.setdefault(slug, []).append(mdto.id)

        # 6. Buscar variáveis de extração do grupo (filtradas via CategoriaResumoJSON.group_id)
        from sistemas.gerador_pecas.models_resumo_json import CategoriaResumoJSON
        variaveis_db = (
            self.db.query(ExtractionVariable)
            .options(joinedload(ExtractionVariable.source_question))
            .join(
                CategoriaResumoJSON,
                ExtractionVariable.categoria_id == CategoriaResumoJSON.id,
            )
            .filter(
                CategoriaResumoJSON.group_id == grupo_id,
                ExtractionVariable.ativo == True,
            )
            .all()
        )

        # 7. Montar VariavelDTOs (extração)
        variaveis_dto: list[VariavelDTO] = []
        slugs_vistos: set[str] = set()

        for v in variaveis_db:
            slug = v.slug
            if slug in slugs_vistos:
                continue
            slugs_vistos.add(slug)

            is_orfa = slug not in var_to_modulos
            if is_orfa and not include_orphans:
                continue

            pergunta = None
            if v.source_question:
                pergunta = v.source_question.pergunta

            # Extrair operador e valor da dependência do JSON dependency_config
            dep_operator = None
            dep_value = None
            if v.dependency_config and isinstance(v.dependency_config, dict):
                dep_operator = v.dependency_config.get("operator")
                raw_val = v.dependency_config.get("value")
                if raw_val is not None:
                    dep_value = str(raw_val)

            variaveis_dto.append(VariavelDTO(
                slug=slug,
                label=v.label or slug,
                tipo=v.tipo or "text",
                fonte="extraction",
                pergunta=pergunta,
                is_orfa=is_orfa,
                modulos_ids=var_to_modulos.get(slug, []),
                depends_on=v.depends_on_variable,
                dependency_operator=dep_operator,
                dependency_value=dep_value,
            ))

        # 8. Adicionar variáveis de processo
        for defn in ProcessVariableResolver.get_all_definitions():
            slug = defn.slug
            if slug in slugs_vistos:
                continue
            slugs_vistos.add(slug)

            is_orfa = slug not in var_to_modulos
            if is_orfa and not include_orphans:
                continue

            variaveis_dto.append(VariavelDTO(
                slug=slug,
                label=defn.label,
                tipo=defn.tipo,
                fonte="process",
                pergunta=defn.descricao,
                is_orfa=is_orfa,
                modulos_ids=var_to_modulos.get(slug, []),
            ))

        # 9. Montar swimlanes
        swimlanes = self._montar_swimlanes(modulos_dto)

        # 10. Calcular stats
        total_orfas = sum(1 for v in variaveis_dto if v.is_orfa)
        stats = StatsDTO(
            total_modulos=len(modulos_dto),
            total_variaveis=len(variaveis_dto),
            total_orfas=total_orfas,
            total_vinculos=sum(len(m.variaveis_usadas) for m in modulos_dto),
        )

        return ArvoreDecisaoResponse(
            swimlanes=swimlanes,
            modulos=modulos_dto,
            variaveis=variaveis_dto,
            stats=stats,
        )

    @staticmethod
    def _extrair_variaveis_regra(regra: dict | None) -> set[str]:
        """
        Extrai slugs de variáveis usadas numa regra AST recursivamente.

        Args:
            regra: Regra AST JSON (pode ser None)

        Returns:
            Set de slugs de variáveis encontradas
        """
        if regra is None:
            return set()

        slugs: set[str] = set()
        tipo = regra.get("type")

        if tipo == "condition":
            var = regra.get("variable")
            if var:
                slugs.add(var)
        elif tipo in ("and", "or"):
            for cond in regra.get("conditions", []):
                slugs |= ArvoreDecisaoService._extrair_variaveis_regra(cond)
        elif tipo == "not":
            sub = regra.get("condition")
            if sub:
                slugs |= ArvoreDecisaoService._extrair_variaveis_regra(sub)

        return slugs

    @staticmethod
    def _montar_swimlanes(modulos: list[ModuloDTO]) -> list[SwimlaneDTO]:
        """
        Agrupa módulos por categoria em swimlanes.

        Args:
            modulos: Lista de ModuloDTOs

        Returns:
            Lista de SwimlaneDTO ordenada por quantidade de módulos (desc)
        """
        categorias: dict[str, dict[str, Any]] = {}

        for m in modulos:
            cat = m.categoria
            if cat not in categorias:
                categorias[cat] = {
                    "modulos_count": 0,
                    "deterministic_count": 0,
                    "variaveis": set(),
                }
            info = categorias[cat]
            info["modulos_count"] += 1
            if m.modo_ativacao == "deterministic":
                info["deterministic_count"] += 1
            info["variaveis"].update(m.variaveis_usadas)

        swimlanes: list[SwimlaneDTO] = []
        for cat, info in categorias.items():
            total = info["modulos_count"]
            det = info["deterministic_count"]
            pct = (det / total * 100) if total > 0 else 0.0
            swimlanes.append(SwimlaneDTO(
                id=cat.lower().replace(" ", "_").replace("é", "e").replace("ê", "e"),
                label=cat,
                modulos_count=total,
                variaveis_count=len(info["variaveis"]),
                pct_deterministico=round(pct, 1),
            ))

        swimlanes.sort(key=lambda s: s.modulos_count, reverse=True)
        return swimlanes
```

- [ ] **Step 4: Rodar testes do service**

Run: `cd E:\Projetos\PGE\portal-pge && python -m pytest tests/gerador_pecas/test_arvore_decisao.py::TestArvoreDecisaoService -v`
Expected: PASS (5 tests — extração de variáveis + swimlanes)

- [ ] **Step 5: Commit service**

```bash
git add sistemas/gerador_pecas/services_arvore_decisao.py tests/gerador_pecas/test_arvore_decisao.py
git commit -m "feat(arvore-decisao): service para montagem do grafo de variáveis e módulos"
```

---

### Task 3: Endpoint no Router Admin

**Files:**
- Modify: `sistemas/gerador_pecas/router_admin.py`
- Test: `tests/gerador_pecas/test_arvore_decisao.py` (append)

- [ ] **Step 1: Escrever teste do endpoint**

Adicionar ao arquivo `tests/gerador_pecas/test_arvore_decisao.py`:

```python
from unittest.mock import patch, MagicMock
from sistemas.gerador_pecas.schemas_arvore import ArvoreDecisaoResponse


class TestEndpointArvoreDecisao:
    """Testes do endpoint de árvore de decisão."""

    def test_service_retorna_response_valida(self):
        """Deve retornar ArvoreDecisaoResponse com estrutura correta."""
        # Testar que o service consegue criar um response válido
        resp = ArvoreDecisaoResponse(
            swimlanes=[],
            modulos=[],
            variaveis=[],
            stats=StatsDTO(total_modulos=0, total_variaveis=0, total_orfas=0, total_vinculos=0)
        )
        data = resp.model_dump()
        assert "swimlanes" in data
        assert "modulos" in data
        assert "variaveis" in data
        assert "stats" in data

    def test_extrair_variaveis_regra_tipo_desconhecido(self):
        """Deve ignorar tipos de regra desconhecidos."""
        regra = {"type": "unknown_type", "data": "xyz"}
        slugs = ArvoreDecisaoService._extrair_variaveis_regra(regra)
        assert slugs == set()

    def test_montar_swimlanes_vazio(self):
        """Deve retornar lista vazia para zero módulos."""
        swimlanes = ArvoreDecisaoService._montar_swimlanes([])
        assert swimlanes == []
```

- [ ] **Step 2: Adicionar endpoint ao router**

No arquivo `sistemas/gerador_pecas/router_admin.py`, adicionar no topo (imports):

```python
from sistemas.gerador_pecas.services_arvore_decisao import ArvoreDecisaoService
from sistemas.gerador_pecas.schemas_arvore import ArvoreDecisaoResponse
```

E no final do arquivo, adicionar o endpoint:

```python
@router.get("/arvore-decisao", response_model=ArvoreDecisaoResponse)
async def get_arvore_decisao(
    grupo_id: int,
    tipo_peca_id: int | None = None,
    include_orphans: bool = True,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Retorna o grafo de árvore de decisão para visualização BPMN.

    O grafo inclui módulos, variáveis, swimlanes e estatísticas.
    Frontend gera nós de condição (losangos) a partir das regras AST.
    """
    # Controle de acesso: non-admin só vê seus grupos
    if not current_user.is_admin:
        allowed_ids = [g.id for g in current_user.allowed_groups]
        if grupo_id not in allowed_ids:
            raise HTTPException(status_code=403, detail="Sem acesso a este grupo")

    service = ArvoreDecisaoService(db)
    return service.montar_grafo(
        grupo_id=grupo_id,
        tipo_peca_id=tipo_peca_id,
        include_orphans=include_orphans,
    )
```

- [ ] **Step 3: Rodar todos os testes do arquivo**

Run: `cd E:\Projetos\PGE\portal-pge && python -m pytest tests/gerador_pecas/test_arvore_decisao.py -v`
Expected: PASS (todos os testes)

- [ ] **Step 4: Testar endpoint manualmente**

Run: `cd E:\Projetos\PGE\portal-pge && python -c "
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sistemas.gerador_pecas.services_arvore_decisao import ArvoreDecisaoService

engine = create_engine('postgresql://postgres:m0301052271@localhost:5432/portal_pge')
with Session(engine) as db:
    service = ArvoreDecisaoService(db)
    resp = service.montar_grafo(grupo_id=1, include_orphans=False)
    print(f'Modulos: {len(resp.modulos)}')
    print(f'Variaveis: {len(resp.variaveis)}')
    print(f'Swimlanes: {len(resp.swimlanes)}')
    print(f'Stats: {resp.stats}')
    import json
    size = len(json.dumps(resp.model_dump()))
    print(f'Payload size: {size / 1024:.1f} KB')
"`
Expected: Dados retornados com payload < 100KB

- [ ] **Step 5: Commit endpoint**

```bash
git add sistemas/gerador_pecas/router_admin.py tests/gerador_pecas/test_arvore_decisao.py
git commit -m "feat(arvore-decisao): endpoint GET /gerador-pecas-admin/arvore-decisao"
```

---

## Chunk 2: Frontend — Dependências, Tipos e Store

### Task 4: Instalar dependências npm

**Files:**
- Modify: `frontend-react/package.json`

- [ ] **Step 1: Instalar pacotes**

```bash
cd E:\Projetos\PGE\portal-pge\frontend-react && npm install @xyflow/react dagre html-to-image
```

- [ ] **Step 2: Instalar tipos do dagre**

```bash
cd E:\Projetos\PGE\portal-pge\frontend-react && npm install -D @types/dagre
```

- [ ] **Step 3: Commit**

```bash
git add frontend-react/package.json frontend-react/package-lock.json
git commit -m "feat(arvore-decisao): adiciona dependências @xyflow/react, dagre, html-to-image"
```

---

### Task 5: Tipos TypeScript e Zustand Store

**Files:**
- Create: `frontend-react/src/pages/admin/arvore-decisao/types.ts`
- Create: `frontend-react/src/pages/admin/arvore-decisao/store/useArvoreStore.ts`

- [ ] **Step 1: Criar tipos**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/types.ts
/**
 * Tipos para a visualização de árvore de decisão.
 * Espelha os DTOs do backend (schemas_arvore.py).
 */

// --- API Response Types ---

export interface SwimlaneDTO {
  id: string
  label: string
  modulos_count: number
  variaveis_count: number
  pct_deterministico: number
}

export interface ModuloDTO {
  id: number
  titulo: string
  categoria: string
  modo_ativacao: 'deterministic' | 'llm'
  regra: ASTRule | null
  regra_secundaria: ASTRule | null
  fallback_habilitado: boolean
  variaveis_usadas: string[]
  tipos_peca: string[]
  regras_tipo_peca: Record<string, ASTRule>
}

export interface VariavelDTO {
  slug: string
  label: string
  tipo: string
  fonte: 'extraction' | 'process'
  pergunta: string | null
  is_orfa: boolean
  modulos_ids: number[]
  depends_on: string | null
  dependency_operator: string | null
  dependency_value: string | null
}

export interface StatsDTO {
  total_modulos: number
  total_variaveis: number
  total_orfas: number
  total_vinculos: number
}

export interface ArvoreDecisaoResponse {
  swimlanes: SwimlaneDTO[]
  modulos: ModuloDTO[]
  variaveis: VariavelDTO[]
  stats: StatsDTO
}

// --- AST Rule Types ---

export type ASTRule = ASTCondition | ASTAnd | ASTOr | ASTNot

export interface ASTCondition {
  type: 'condition'
  variable: string
  operator: string
  value: unknown
}

export interface ASTAnd {
  type: 'and'
  conditions: ASTRule[]
}

export interface ASTOr {
  type: 'or'
  conditions: ASTRule[]
}

export interface ASTNot {
  type: 'not'
  condition: ASTRule
}

// --- React Flow Node Types ---

export type CustomNodeType = 'swimlane' | 'module' | 'condition' | 'connector' | 'variable' | 'orphan-variable'
export type CustomEdgeType = 'rule' | 'yes-no' | 'dependency' | 'shared-var'

export type ZoomLevel = 'macro' | 'medium' | 'detail'

// --- Node Data Types ---

export interface SwimLaneNodeData {
  label: string
  modulosCount: number
  variaveisCount: number
  pctDeterministico: number
  isCollapsed: boolean
}

export interface ModuleNodeData {
  id: number
  titulo: string
  modoAtivacao: 'deterministic' | 'llm'
  variaveisCount: number
  isExpanded: boolean
}

export interface ConditionNodeData {
  operator: string
  value: unknown
  variable?: string
}

export interface ConnectorNodeData {
  connectorType: 'and' | 'or' | 'not'
}

export interface VariableNodeData {
  slug: string
  label: string
  tipo: string
  isOrfa: boolean
}

// --- Detail Panel Types ---

export type DetailPanelContent =
  | { type: 'module'; data: ModuloDTO }
  | { type: 'variable'; data: VariavelDTO }
  | null
```

- [ ] **Step 2: Criar Zustand store**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/store/useArvoreStore.ts
/**
 * Estado global da árvore de decisão.
 * Gerencia filtros, zoom, expansão e seleção.
 */

import { create } from 'zustand'
import type { ZoomLevel, DetailPanelContent, ArvoreDecisaoResponse } from '../types'

interface ArvoreState {
  // Dados da API
  data: ArvoreDecisaoResponse | null
  loading: boolean
  error: string | null

  // Filtros
  grupoId: number | null
  tipoPecaId: number | null
  searchTerm: string
  showOrphans: boolean

  // Visualização
  zoomLevel: ZoomLevel
  collapsedSwimlanes: Set<string>
  expandedModules: Set<number>

  // Detail panel
  detailPanel: DetailPanelContent

  // Ações
  setData: (data: ArvoreDecisaoResponse) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setGrupoId: (id: number) => void
  setTipoPecaId: (id: number | null) => void
  setSearchTerm: (term: string) => void
  setShowOrphans: (show: boolean) => void
  setZoomLevel: (level: ZoomLevel) => void
  toggleSwimlane: (id: string) => void
  toggleModule: (id: number) => void
  expandAll: () => void
  collapseAll: () => void
  setDetailPanel: (content: DetailPanelContent) => void
  closeDetailPanel: () => void
}

export const useArvoreStore = create<ArvoreState>((set, get) => ({
  // Estado inicial
  data: null,
  loading: false,
  error: null,
  grupoId: null,
  tipoPecaId: null,
  searchTerm: '',
  showOrphans: false,
  zoomLevel: 'medium',
  collapsedSwimlanes: new Set(),
  expandedModules: new Set(),
  detailPanel: null,

  // Ações
  setData: (data) => set({ data, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
  setGrupoId: (grupoId) => set({ grupoId, data: null }),
  setTipoPecaId: (tipoPecaId) => set({ tipoPecaId }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setShowOrphans: (showOrphans) => set({ showOrphans }),
  setZoomLevel: (zoomLevel) => set({ zoomLevel }),

  toggleSwimlane: (id) => set((state) => {
    const next = new Set(state.collapsedSwimlanes)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { collapsedSwimlanes: next }
  }),

  toggleModule: (id) => set((state) => {
    const next = new Set(state.expandedModules)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return { expandedModules: next }
  }),

  expandAll: () => set((state) => {
    const ids = state.data?.modulos.map((m) => m.id) ?? []
    return { expandedModules: new Set(ids) }
  }),

  collapseAll: () => set({ expandedModules: new Set() }),

  setDetailPanel: (detailPanel) => set({ detailPanel }),
  closeDetailPanel: () => set({ detailPanel: null }),
}))
```

- [ ] **Step 3: Commit tipos e store**

```bash
git add frontend-react/src/pages/admin/arvore-decisao/types.ts frontend-react/src/pages/admin/arvore-decisao/store/useArvoreStore.ts
git commit -m "feat(arvore-decisao): tipos TypeScript e Zustand store"
```

---

### Task 6: Hook de dados e utilitário ruleToNodes

**Files:**
- Create: `frontend-react/src/pages/admin/arvore-decisao/hooks/useArvoreDecisaoData.ts`
- Create: `frontend-react/src/pages/admin/arvore-decisao/utils/ruleToNodes.ts`
- Create: `frontend-react/src/pages/admin/arvore-decisao/utils/searchHighlight.ts`

- [ ] **Step 1: Criar hook de fetch**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/hooks/useArvoreDecisaoData.ts
/**
 * Hook para buscar dados do endpoint de árvore de decisão.
 */

import { useEffect } from 'react'
import { createApiClient } from '@/lib/api'
import { useArvoreStore } from '../store/useArvoreStore'
import type { ArvoreDecisaoResponse } from '../types'

const geradorAdminApi = createApiClient('/admin/api/gerador-pecas-admin')

export function useArvoreDecisaoData() {
  const { grupoId, tipoPecaId, showOrphans, setData, setLoading, setError } = useArvoreStore()

  useEffect(() => {
    if (!grupoId) return

    let cancelled = false

    async function fetchData() {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          grupo_id: String(grupoId),
          include_orphans: String(showOrphans),
        })
        if (tipoPecaId) params.append('tipo_peca_id', String(tipoPecaId))

        const data = await geradorAdminApi.get<ArvoreDecisaoResponse>(
          `/arvore-decisao?${params.toString()}`
        )
        if (!cancelled) setData(data)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchData()
    return () => { cancelled = true }
  }, [grupoId, tipoPecaId, showOrphans])
}
```

- [ ] **Step 2: Criar ruleToNodes — converte AST em nós React Flow**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/utils/ruleToNodes.ts
/**
 * Converte regras AST JSON em nós e edges do React Flow.
 *
 * Para cada módulo com regra != null:
 * 1. Percorre AST recursivamente
 * 2. Cria ConditionNode (losango), ConnectorNode (AND/OR/NOT), VariableNode (oval)
 * 3. Retorna arrays de nodes e edges para React Flow
 */

import type { Node, Edge } from '@xyflow/react'
import type { ASTRule, ModuloDTO } from '../types'

/** Cria gerador de IDs determinísticos por escopo de módulo */
function createIdGenerator(moduleId: string) {
  const counters = new Map<string, number>()
  return (prefix: string): string => {
    const count = (counters.get(prefix) ?? 0) + 1
    counters.set(prefix, count)
    return `${moduleId}-${prefix}-${count}`
  }
}

interface RuleNodesResult {
  nodes: Node[]
  edges: Edge[]
}

/**
 * Converte a regra AST de um módulo em nós React Flow.
 *
 * @param moduleNodeId - ID do nó do módulo pai
 * @param regra - Regra AST JSON
 * @param label - Label do edge raiz (ex: "Fallback")
 */
export function ruleToNodes(
  moduleNodeId: string,
  regra: ASTRule | null,
  label?: string,
): RuleNodesResult {
  if (!regra) return { nodes: [], edges: [] }

  const nextId = createIdGenerator(moduleNodeId)
  const nodes: Node[] = []
  const edges: Edge[] = []
  const edgeKeys = new Set<string>()

  function addEdge(edge: Edge): void {
    const key = `${edge.source}→${edge.target}`
    if (edgeKeys.has(key)) return
    edgeKeys.add(key)
    edges.push(edge)
  }

  function processNode(rule: ASTRule, parentId: string, edgeLabel?: string): void {
    if (rule.type === 'condition') {
      // Losango de condição
      const condId = nextId('cond')
      nodes.push({
        id: condId,
        type: 'condition',
        position: { x: 0, y: 0 }, // dagre calcula
        data: {
          operator: rule.operator,
          value: rule.value,
          variable: rule.variable,
        },
      })
      addEdge({
        id: `${parentId}-${condId}`,
        source: parentId,
        target: condId,
        type: 'rule',
        label: edgeLabel,
      })

      // Oval da variável
      const varId = `var-${rule.variable}`
      // Evitar duplicar nós de variável
      if (!nodes.find((n) => n.id === varId)) {
        nodes.push({
          id: varId,
          type: 'variable',
          position: { x: 0, y: 0 },
          data: {
            slug: rule.variable,
            label: rule.variable,
            tipo: '',
            isOrfa: false,
          },
        })
      }
      addEdge({
        id: `${condId}-${varId}`,
        source: condId,
        target: varId,
        type: 'yes-no',
        data: { resultado: 'sim' },
      })
    } else if (rule.type === 'and' || rule.type === 'or') {
      // Conector AND/OR
      const connId = nextId('conn')
      nodes.push({
        id: connId,
        type: 'connector',
        position: { x: 0, y: 0 },
        data: { connectorType: rule.type },
      })
      addEdge({
        id: `${parentId}-${connId}`,
        source: parentId,
        target: connId,
        type: 'rule',
        label: edgeLabel,
      })
      for (const cond of rule.conditions) {
        processNode(cond, connId)
      }
    } else if (rule.type === 'not') {
      // Conector NOT
      const connId = nextId('conn')
      nodes.push({
        id: connId,
        type: 'connector',
        position: { x: 0, y: 0 },
        data: { connectorType: 'not' },
      })
      addEdge({
        id: `${parentId}-${connId}`,
        source: parentId,
        target: connId,
        type: 'rule',
        label: edgeLabel,
      })
      processNode(rule.condition, connId)
    }
  }

  processNode(regra, moduleNodeId, label)
  return { nodes, edges }
}

/**
 * Gera todos os nós e edges de decisão para um módulo.
 * Inclui regra primária e fallback (se habilitado).
 */
export function moduleRuleToNodes(modulo: ModuloDTO): RuleNodesResult {
  const moduleNodeId = `module-${modulo.id}`
  const allNodes: Node[] = []
  const allEdges: Edge[] = []

  // Regra primária
  const primary = ruleToNodes(moduleNodeId, modulo.regra)
  allNodes.push(...primary.nodes)
  allEdges.push(...primary.edges)

  // Regra secundária (fallback)
  if (modulo.fallback_habilitado && modulo.regra_secundaria) {
    const fallback = ruleToNodes(moduleNodeId, modulo.regra_secundaria, 'Fallback')
    allNodes.push(...fallback.nodes)
    allEdges.push(...fallback.edges)
  }

  return { nodes: allNodes, edges: allEdges }
}
```

- [ ] **Step 3: Criar searchHighlight**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/utils/searchHighlight.ts
/**
 * Lógica de busca e highlight para nós do grafo.
 */

import type { ModuloDTO, VariavelDTO } from '../types'

/**
 * Verifica se um módulo dá match na busca.
 */
export function moduloMatchesSearch(modulo: ModuloDTO, term: string): boolean {
  if (!term) return true
  const lower = term.toLowerCase()
  return (
    modulo.titulo.toLowerCase().includes(lower) ||
    modulo.categoria.toLowerCase().includes(lower)
  )
}

/**
 * Verifica se uma variável dá match na busca.
 */
export function variavelMatchesSearch(variavel: VariavelDTO, term: string): boolean {
  if (!term) return true
  const lower = term.toLowerCase()
  return (
    variavel.slug.toLowerCase().includes(lower) ||
    variavel.label.toLowerCase().includes(lower) ||
    (variavel.pergunta?.toLowerCase().includes(lower) ?? false)
  )
}

/**
 * Retorna classe CSS com base no match.
 */
export function getMatchClass(isMatch: boolean, hasSearch: boolean): string {
  if (!hasSearch) return ''
  return isMatch ? 'node-match' : 'node-no-match'
}
```

- [ ] **Step 4: Commit utils e hooks**

```bash
git add frontend-react/src/pages/admin/arvore-decisao/hooks/ frontend-react/src/pages/admin/arvore-decisao/utils/
git commit -m "feat(arvore-decisao): hook de dados, ruleToNodes e searchHighlight"
```

---

## Chunk 3: Frontend — Custom Nodes e Edges

### Task 7: Custom Nodes (6 componentes)

**Files:**
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/nodes/SwimLaneNode.tsx`
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/nodes/ModuleNode.tsx`
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/nodes/ConditionNode.tsx`
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/nodes/ConnectorNode.tsx`
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/nodes/VariableNode.tsx`
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/nodes/OrphanVariableNode.tsx`

- [ ] **Step 1: SwimLaneNode — raia por categoria**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/nodes/SwimLaneNode.tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { SwimLaneNodeData } from '../../types'
import { C } from '@/lib/designTokens'

const SWIMLANE_COLORS: Record<string, string> = {
  'Mérito': 'rgba(59, 130, 246, 0.08)',
  'Preliminar': 'rgba(249, 115, 22, 0.08)',
  'Eventualidade': 'rgba(34, 197, 94, 0.08)',
  'honorarios': 'rgba(168, 85, 247, 0.08)',
  'Tutela de Urgência': 'rgba(239, 68, 68, 0.08)',
}

const BORDER_COLORS: Record<string, string> = {
  'Mérito': 'rgba(59, 130, 246, 0.3)',
  'Preliminar': 'rgba(249, 115, 22, 0.3)',
  'Eventualidade': 'rgba(34, 197, 94, 0.3)',
  'honorarios': 'rgba(168, 85, 247, 0.3)',
  'Tutela de Urgência': 'rgba(239, 68, 68, 0.3)',
}

export const SwimLaneNode = memo(function SwimLaneNode({ data }: NodeProps) {
  const d = data as SwimLaneNodeData
  const bg = SWIMLANE_COLORS[d.label] ?? 'rgba(148, 163, 184, 0.08)'
  const border = BORDER_COLORS[d.label] ?? 'rgba(148, 163, 184, 0.3)'

  return (
    <div
      style={{
        background: bg,
        border: `2px solid ${border}`,
        borderRadius: 12,
        padding: '12px 16px',
        minWidth: 200,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 14, color: C.text700 }}>{d.label}</span>
        <span style={{ fontSize: 12, color: C.text400 }}>{d.modulosCount} módulos</span>
      </div>
      {d.isCollapsed && (
        <div style={{ marginTop: 8, fontSize: 11, color: C.text400 }}>
          <span>{d.variaveisCount} variáveis</span>
          <span style={{ marginLeft: 12 }}>{d.pctDeterministico.toFixed(0)}% determinístico</span>
        </div>
      )}
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  )
})
```

- [ ] **Step 2: ModuleNode — retângulo do módulo**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/nodes/ModuleNode.tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ModuleNodeData } from '../../types'
import { C } from '@/lib/designTokens'

export const ModuleNode = memo(function ModuleNode({ data }: NodeProps) {
  const d = data as ModuleNodeData
  const isDet = d.modoAtivacao === 'deterministic'

  return (
    <div
      style={{
        background: '#fff',
        border: `2px solid ${isDet ? '#22c55e' : '#8b5cf6'}`,
        borderRadius: 8,
        padding: '8px 12px',
        minWidth: 160,
        maxWidth: 220,
        cursor: 'pointer',
        boxShadow: d.isExpanded ? '0 0 0 2px rgba(59, 130, 246, 0.5)' : 'none',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: C.text700, lineHeight: 1.3 }}>
        {d.titulo.length > 40 ? d.titulo.slice(0, 40) + '…' : d.titulo}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
        <span
          style={{
            fontSize: 10,
            padding: '1px 6px',
            borderRadius: 4,
            background: isDet ? 'rgba(34, 197, 94, 0.1)' : 'rgba(139, 92, 246, 0.1)',
            color: isDet ? '#16a34a' : '#7c3aed',
          }}
        >
          {isDet ? 'determinístico' : 'LLM'}
        </span>
        {d.variaveisCount > 0 && (
          <span style={{ fontSize: 10, color: C.text400 }}>{d.variaveisCount} vars</span>
        )}
      </div>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  )
})
```

- [ ] **Step 3: ConditionNode — losango**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/nodes/ConditionNode.tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ConditionNodeData } from '../../types'

export const ConditionNode = memo(function ConditionNode({ data }: NodeProps) {
  const d = data as ConditionNodeData
  const displayValue = typeof d.value === 'boolean' ? String(d.value) :
    Array.isArray(d.value) ? `[${d.value.length}]` :
    d.value != null ? String(d.value) : ''

  return (
    <div
      style={{
        width: 80,
        height: 80,
        transform: 'rotate(45deg)',
        background: 'rgba(250, 204, 21, 0.15)',
        border: '2px solid rgba(250, 204, 21, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ transform: 'rotate(-45deg)', textAlign: 'center', fontSize: 10 }}>
        <div style={{ fontWeight: 600 }}>{d.operator}</div>
        {displayValue && <div style={{ color: '#64748b', marginTop: 2 }}>{displayValue}</div>}
      </div>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  )
})
```

- [ ] **Step 4: ConnectorNode — AND/OR/NOT**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/nodes/ConnectorNode.tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ConnectorNodeData } from '../../types'

const LABELS: Record<string, string> = {
  and: '&',
  or: '∥',
  not: '!',
}

export const ConnectorNode = memo(function ConnectorNode({ data }: NodeProps) {
  const d = data as ConnectorNodeData
  const isNot = d.connectorType === 'not'

  return (
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: isNot ? 'rgba(239, 68, 68, 0.1)' : 'rgba(148, 163, 184, 0.15)',
        border: `2px solid ${isNot ? 'rgba(239, 68, 68, 0.5)' : 'rgba(148, 163, 184, 0.4)'}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 16,
        fontWeight: 700,
        color: isNot ? '#dc2626' : '#64748b',
      }}
    >
      {LABELS[d.connectorType]}
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
      <Handle type="source" position={Position.Right} style={{ visibility: 'hidden' }} />
    </div>
  )
})
```

- [ ] **Step 5: VariableNode — oval**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/nodes/VariableNode.tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { VariableNodeData } from '../../types'
import { C } from '@/lib/designTokens'

export const VariableNode = memo(function VariableNode({ data }: NodeProps) {
  const d = data as VariableNodeData

  return (
    <div
      style={{
        background: 'rgba(59, 130, 246, 0.08)',
        border: '2px solid rgba(59, 130, 246, 0.4)',
        borderRadius: 20,
        padding: '6px 14px',
        maxWidth: 200,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text700, wordBreak: 'break-all' }}>
        {d.slug.length > 30 ? d.slug.slice(0, 30) + '…' : d.slug}
      </div>
      <div style={{ fontSize: 10, color: C.text400, marginTop: 2 }}>{d.tipo}</div>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
    </div>
  )
})
```

- [ ] **Step 6: OrphanVariableNode — oval tracejado**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/nodes/OrphanVariableNode.tsx
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { VariableNodeData } from '../../types'
import { C } from '@/lib/designTokens'

export const OrphanVariableNode = memo(function OrphanVariableNode({ data }: NodeProps) {
  const d = data as VariableNodeData

  return (
    <div
      style={{
        background: 'rgba(251, 146, 60, 0.06)',
        border: '2px dashed rgba(251, 146, 60, 0.5)',
        borderRadius: 20,
        padding: '6px 14px',
        maxWidth: 200,
        cursor: 'pointer',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, color: C.text700, wordBreak: 'break-all' }}>
        {d.slug.length > 30 ? d.slug.slice(0, 30) + '…' : d.slug}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 2, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: C.text400 }}>{d.tipo}</span>
        <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(251, 146, 60, 0.15)', color: '#ea580c' }}>
          sem vínculo
        </span>
      </div>
      <Handle type="target" position={Position.Left} style={{ visibility: 'hidden' }} />
    </div>
  )
})
```

- [ ] **Step 7: Commit nodes**

```bash
git add frontend-react/src/pages/admin/arvore-decisao/components/nodes/
git commit -m "feat(arvore-decisao): 6 custom nodes React Flow (swimlane, module, condition, connector, variable, orphan)"
```

---

### Task 8: Custom Edges (3 componentes)

**Files:**
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/edges/YesNoEdge.tsx`
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/edges/DependencyEdge.tsx`
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/edges/SharedVarEdge.tsx`

- [ ] **Step 1: YesNoEdge — verde/vermelho**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/edges/YesNoEdge.tsx
import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export const YesNoEdge = memo(function YesNoEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const resultado = (data as { resultado?: string })?.resultado ?? 'sim'
  const color = resultado === 'sim' ? '#22c55e' : '#ef4444'

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  return <BaseEdge path={edgePath} style={{ stroke: color, strokeWidth: 2 }} />
})
```

- [ ] **Step 2: DependencyEdge — tracejado cinza**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/edges/DependencyEdge.tsx
import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export const DependencyEdge = memo(function DependencyEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  return (
    <BaseEdge
      path={edgePath}
      style={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '6 4' }}
    />
  )
})
```

- [ ] **Step 3: SharedVarEdge — pontilhado**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/edges/SharedVarEdge.tsx
import { memo } from 'react'
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react'

export const SharedVarEdge = memo(function SharedVarEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props

  const [edgePath] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  })

  return (
    <BaseEdge
      path={edgePath}
      style={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '3 3' }}
    />
  )
})
```

- [ ] **Step 4: Commit edges**

```bash
git add frontend-react/src/pages/admin/arvore-decisao/components/edges/
git commit -m "feat(arvore-decisao): 3 custom edges React Flow (yes-no, dependency, shared-var)"
```

---

## Chunk 4: Frontend — Página Principal, Toolbar, Detail Panel e Integração

### Task 9: Toolbar

**Files:**
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/Toolbar.tsx`

- [ ] **Step 1: Criar Toolbar**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/Toolbar.tsx
/**
 * Toolbar da árvore de decisão.
 * Contém filtros (grupo, tipo peça, busca) e controles (órfãs, expandir, colapsar, exportar).
 */

import { useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { GroupSelector } from '@/components/ui/GroupSelector'
import { Search, Maximize2, Minimize2, Download, Eye, EyeOff } from 'lucide-react'
import { useArvoreStore } from '../store/useArvoreStore'
import { C } from '@/lib/designTokens'

interface TipoPeca {
  id: number
  nome: string
  titulo: string
}

interface ToolbarProps {
  tiposPeca: TipoPeca[]
  onExport: () => void
}

export function Toolbar({ tiposPeca, onExport }: ToolbarProps) {
  const {
    grupoId, tipoPecaId, searchTerm, showOrphans, data,
    setGrupoId, setTipoPecaId, setSearchTerm, setShowOrphans,
    expandAll, collapseAll,
  } = useArvoreStore()

  const orphanCount = data?.stats.total_orfas ?? 0

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }, [setSearchTerm])

  return (
    <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.gray200}`, background: '#fff' }}>
      {/* Título */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: C.text700, margin: 0 }}>
          Árvore de Decisão
        </h1>
        {data && (
          <span style={{ fontSize: 12, color: C.text400 }}>
            {data.stats.total_modulos} módulos · {data.stats.total_variaveis} variáveis · {data.stats.total_vinculos} vínculos
          </span>
        )}
      </div>

      {/* Filtros + Controles */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Grupo */}
        <GroupSelector
          selectedGroupId={grupoId}
          onGroupChange={(id) => setGrupoId(id)}
        />

        {/* Tipo de Peça */}
        <Select
          value={tipoPecaId ? String(tipoPecaId) : 'all'}
          onValueChange={(v) => setTipoPecaId(v === 'all' ? null : Number(v))}
        >
          <SelectTrigger style={{ width: 180 }}>
            <SelectValue placeholder="Tipo de Peça" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {tiposPeca.map((tp) => (
              <SelectItem key={tp.id} value={String(tp.id)}>{tp.titulo}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Busca */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 300 }}>
          <Search style={{ position: 'absolute', left: 8, top: 8, width: 16, height: 16, color: C.text400 }} />
          <Input
            placeholder="Buscar variável, módulo ou pergunta..."
            value={searchTerm}
            onChange={handleSearch}
            style={{ paddingLeft: 32 }}
          />
        </div>

        {/* Separador */}
        <div style={{ width: 1, height: 28, background: C.gray200 }} />

        {/* Toggle Órfãs */}
        <Button
          variant={showOrphans ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowOrphans(!showOrphans)}
        >
          {showOrphans ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          Órfãs
          <Badge variant="secondary" className="ml-1">{orphanCount}</Badge>
        </Button>

        {/* Expandir/Colapsar */}
        <Button variant="outline" size="sm" onClick={expandAll}>
          <Maximize2 className="h-4 w-4 mr-1" /> Expandir
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          <Minimize2 className="h-4 w-4 mr-1" /> Colapsar
        </Button>

        {/* Exportar */}
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="h-4 w-4 mr-1" /> PNG
        </Button>
      </div>

      {/* Legenda */}
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 11, color: C.text400 }}>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#22c55e', marginRight: 4 }} />Determinístico</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#8b5cf6', marginRight: 4 }} />LLM</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(250, 204, 21, 0.6)', marginRight: 4 }} />Condição</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(59, 130, 246, 0.4)', marginRight: 4 }} />Variável</span>
        <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '2px dashed rgba(251, 146, 60, 0.5)', marginRight: 4 }} />Órfã</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit Toolbar**

```bash
git add frontend-react/src/pages/admin/arvore-decisao/components/Toolbar.tsx
git commit -m "feat(arvore-decisao): Toolbar com filtros, busca, toggle órfãs e exportar"
```

---

### Task 10: Detail Panel

**Files:**
- Create: `frontend-react/src/pages/admin/arvore-decisao/components/DetailPanel.tsx`

- [ ] **Step 1: Criar DetailPanel**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/components/DetailPanel.tsx
/**
 * Painel lateral slide-in com detalhes do nó selecionado.
 * Mostra informações diferentes para módulos e variáveis.
 */

import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useArvoreStore } from '../store/useArvoreStore'
import { C } from '@/lib/designTokens'
import type { ASTRule } from '../types'

/** Renderiza regra AST em notação legível */
function RuleTree({ rule, depth = 0 }: { rule: ASTRule; depth?: number }) {
  const indent = '  '.repeat(depth)

  if (rule.type === 'condition') {
    const val = typeof rule.value === 'boolean' ? String(rule.value) :
      Array.isArray(rule.value) ? JSON.stringify(rule.value) :
      String(rule.value ?? '')
    return <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{indent}({rule.operator.toUpperCase()} {rule.variable} {val})</div>
  }

  if (rule.type === 'and' || rule.type === 'or') {
    return (
      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
        <div>{indent}({rule.type.toUpperCase()}</div>
        {rule.conditions.map((c, i) => <RuleTree key={i} rule={c} depth={depth + 1} />)}
        <div>{indent})</div>
      </div>
    )
  }

  if (rule.type === 'not') {
    return (
      <div style={{ fontFamily: 'monospace', fontSize: 12 }}>
        <div>{indent}(NOT</div>
        <RuleTree rule={rule.condition} depth={depth + 1} />
        <div>{indent})</div>
      </div>
    )
  }

  return null
}

export function DetailPanel() {
  const { detailPanel, closeDetailPanel, data } = useArvoreStore()

  if (!detailPanel) return null

  return (
    <div
      style={{
        position: 'fixed', right: 0, top: 0, bottom: 0,
        width: 380, background: '#fff', borderLeft: `1px solid ${C.gray200}`,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
        zIndex: 50, overflowY: 'auto', padding: 20,
      }}
    >
      <Button variant="ghost" size="sm" onClick={closeDetailPanel} style={{ position: 'absolute', right: 8, top: 8 }}>
        <X className="h-4 w-4" />
      </Button>

      {detailPanel.type === 'module' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text700, marginBottom: 4, paddingRight: 32 }}>
            {detailPanel.data.titulo}
          </h3>
          <div style={{ fontSize: 12, color: C.text400, marginBottom: 16 }}>
            ID: #{detailPanel.data.id} · {detailPanel.data.categoria}
          </div>

          {/* Modo ativação */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Ativação</SectionLabel>
            <Badge variant={detailPanel.data.modo_ativacao === 'deterministic' ? 'default' : 'secondary'}>
              {detailPanel.data.modo_ativacao}
            </Badge>
            {detailPanel.data.fallback_habilitado && (
              <Badge variant="outline" className="ml-2">fallback ativo</Badge>
            )}
          </div>

          {/* Regra primária visual */}
          {detailPanel.data.regra && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Regra Primária</SectionLabel>
              <div style={{ background: '#f8fafc', borderRadius: 8, padding: 12, border: `1px solid ${C.gray200}` }}>
                <RuleTree rule={detailPanel.data.regra} />
              </div>
            </div>
          )}

          {/* Regra primária JSON (colapsável) */}
          {detailPanel.data.regra && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ fontSize: 12, color: C.text400, cursor: 'pointer' }}>JSON da regra</summary>
              <pre style={{ fontSize: 11, background: '#f1f5f9', padding: 8, borderRadius: 6, overflow: 'auto', maxHeight: 200 }}>
                {JSON.stringify(detailPanel.data.regra, null, 2)}
              </pre>
            </details>
          )}

          {/* Regra secundária (fallback) */}
          {detailPanel.data.fallback_habilitado && detailPanel.data.regra_secundaria && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Regra Secundária (Fallback)</SectionLabel>
              <div style={{ background: '#fffbeb', borderRadius: 8, padding: 12, border: '1px solid rgba(250, 204, 21, 0.3)' }}>
                <RuleTree rule={detailPanel.data.regra_secundaria} />
              </div>
            </div>
          )}

          {/* Regras por tipo de peça */}
          {Object.keys(detailPanel.data.regras_tipo_peca).length > 0 && (
            <details style={{ marginBottom: 16 }}>
              <summary style={{ fontSize: 12, fontWeight: 600, color: C.text700, cursor: 'pointer' }}>
                Regras por Tipo de Peça ({Object.keys(detailPanel.data.regras_tipo_peca).length})
              </summary>
              {Object.entries(detailPanel.data.regras_tipo_peca).map(([tipo, regra]) => (
                <div key={tipo} style={{ marginTop: 8 }}>
                  <Badge variant="outline">{tipo}</Badge>
                  <div style={{ background: '#f8fafc', borderRadius: 6, padding: 8, marginTop: 4 }}>
                    <RuleTree rule={regra as ASTRule} />
                  </div>
                </div>
              ))}
            </details>
          )}

          {/* Variáveis usadas */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Variáveis usadas ({detailPanel.data.variaveis_usadas.length})</SectionLabel>
            {detailPanel.data.variaveis_usadas.map((slug) => (
              <div key={slug} style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer', padding: '2px 0' }}>
                {slug}
              </div>
            ))}
          </div>

          {/* Tipos de peça */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Tipos de peça</SectionLabel>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {detailPanel.data.tipos_peca.map((tp) => (
                <Badge key={tp} variant="outline">{tp}</Badge>
              ))}
            </div>
          </div>

          {/* Link externo */}
          <a href="/admin/prompts-modulos" style={{ fontSize: 12, color: '#3b82f6' }}>
            Abrir no Editor de Prompts →
          </a>
        </div>
      )}

      {detailPanel.type === 'variable' && (
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: C.text700, marginBottom: 4, paddingRight: 32, wordBreak: 'break-all' }}>
            {detailPanel.data.slug}
          </h3>
          <div style={{ fontSize: 12, color: C.text400, marginBottom: 16 }}>
            {detailPanel.data.tipo} · {detailPanel.data.fonte}
            {detailPanel.data.is_orfa && <Badge variant="destructive" className="ml-2">sem vínculo</Badge>}
          </div>

          {/* Pergunta */}
          {detailPanel.data.pergunta && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Pergunta vinculada</SectionLabel>
              <div style={{ fontSize: 13, color: C.text700, background: '#f8fafc', padding: 12, borderRadius: 8, fontStyle: 'italic' }}>
                "{detailPanel.data.pergunta}"
              </div>
            </div>
          )}

          {/* Dependência */}
          {detailPanel.data.depends_on && (
            <div style={{ marginBottom: 16 }}>
              <SectionLabel>Dependência</SectionLabel>
              <div style={{ fontSize: 12, color: C.text700 }}>
                Depende de <strong>{detailPanel.data.depends_on}</strong>
                {detailPanel.data.dependency_operator && ` (${detailPanel.data.dependency_operator} ${detailPanel.data.dependency_value})`}
              </div>
            </div>
          )}

          {/* Módulos que usam */}
          <div style={{ marginBottom: 16 }}>
            <SectionLabel>Módulos que usam ({detailPanel.data.modulos_ids.length})</SectionLabel>
            {detailPanel.data.modulos_ids.length === 0 ? (
              <div style={{ fontSize: 12, color: C.text400, fontStyle: 'italic' }}>Nenhum módulo usa esta variável</div>
            ) : (
              detailPanel.data.modulos_ids.map((id) => {
                const modulo = data?.modulos.find((m) => m.id === id)
                return (
                  <div key={id} style={{ fontSize: 12, color: '#3b82f6', cursor: 'pointer', padding: '2px 0' }}>
                    #{id} {modulo?.titulo ?? ''}
                  </div>
                )
              })
            )}
          </div>

          {/* Sugestão para órfãs */}
          {detailPanel.data.is_orfa && (
            <div style={{ background: 'rgba(251, 146, 60, 0.08)', border: '1px solid rgba(251, 146, 60, 0.3)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ea580c', marginBottom: 4 }}>Sugestão</div>
              <div style={{ fontSize: 12, color: C.text700 }}>
                Esta variável existe mas não é usada em nenhuma regra determinística. Considere criar uma regra ou removê-la.
              </div>
            </div>
          )}

          {/* Link externo */}
          <a href="/admin/variaveis" style={{ fontSize: 12, color: '#3b82f6' }}>
            Abrir no Editor de Variáveis →
          </a>
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, fontWeight: 600, color: C.text400, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{children}</div>
}
```

- [ ] **Step 2: Commit Detail Panel**

```bash
git add frontend-react/src/pages/admin/arvore-decisao/components/DetailPanel.tsx
git commit -m "feat(arvore-decisao): DetailPanel com informações de módulos e variáveis"
```

---

### Task 11: Hooks — Semantic Zoom, Graph Layout, Node Expansion

**Files:**
- Create: `frontend-react/src/pages/admin/arvore-decisao/hooks/useSemanticZoom.ts`
- Create: `frontend-react/src/pages/admin/arvore-decisao/hooks/useGraphLayout.ts`
- Create: `frontend-react/src/pages/admin/arvore-decisao/hooks/useNodeExpansion.ts`

- [ ] **Step 1: useSemanticZoom**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/hooks/useSemanticZoom.ts
/**
 * Hook para zoom semântico com 3 níveis e debounce.
 */

import { useCallback, useRef } from 'react'
import { useOnViewportChange } from '@xyflow/react'
import { useArvoreStore } from '../store/useArvoreStore'
import type { ZoomLevel } from '../types'

function getZoomLevel(zoom: number): ZoomLevel {
  if (zoom < 0.35) return 'macro'
  if (zoom < 0.75) return 'medium'
  return 'detail'
}

export function useSemanticZoom() {
  const { zoomLevel, setZoomLevel } = useArvoreStore()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const zoomLevelRef = useRef(zoomLevel)
  zoomLevelRef.current = zoomLevel

  const onViewportChange = useCallback(({ zoom }: { zoom: number }) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const newLevel = getZoomLevel(zoom)
      if (newLevel !== zoomLevelRef.current) {
        setZoomLevel(newLevel)
      }
    }, 150)
  }, [setZoomLevel])

  useOnViewportChange({ onChange: onViewportChange })

  return { zoomLevel }
}
```

- [ ] **Step 2: useGraphLayout**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/hooks/useGraphLayout.ts
/**
 * Hook para calcular layout automático do grafo usando dagre.
 */

import { useMemo } from 'react'
import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'
import { useArvoreStore } from '../store/useArvoreStore'
import { moduleRuleToNodes } from '../utils/ruleToNodes'
import { moduloMatchesSearch, variavelMatchesSearch } from '../utils/searchHighlight'
import type { ModuloDTO, VariavelDTO } from '../types'

const DAGRE_CONFIG = {
  rankdir: 'LR' as const,
  align: 'DL' as const,
  nodesep: 150,
  ranksep: 200,
}

/** Dimensões por tipo de nó */
const NODE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  swimlane: { width: 250, height: 60 },
  module: { width: 200, height: 56 },
  condition: { width: 80, height: 80 },
  connector: { width: 36, height: 36 },
  variable: { width: 180, height: 48 },
  'orphan-variable': { width: 180, height: 48 },
}

export function useGraphLayout() {
  const { data, zoomLevel, expandedModules, searchTerm, showOrphans } = useArvoreStore()

  const { nodes, edges } = useMemo(() => {
    if (!data) return { nodes: [], edges: [] }

    const allNodes: Node[] = []
    const allEdges: Edge[] = []

    // Agrupar módulos por categoria
    const categorias = new Map<string, ModuloDTO[]>()
    for (const m of data.modulos) {
      const cat = m.categoria
      if (!categorias.has(cat)) categorias.set(cat, [])
      categorias.get(cat)!.push(m)
    }

    // Criar nós de módulo
    for (const m of data.modulos) {
      const moduleId = `module-${m.id}`
      allNodes.push({
        id: moduleId,
        type: 'module',
        position: { x: 0, y: 0 },
        data: {
          id: m.id,
          titulo: m.titulo,
          modoAtivacao: m.modo_ativacao,
          variaveisCount: m.variaveis_usadas.length,
          isExpanded: expandedModules.has(m.id),
        },
        hidden: zoomLevel === 'macro',
      })

      // Se expandido, gerar árvore de decisão
      if (expandedModules.has(m.id)) {
        const { nodes: ruleNodes, edges: ruleEdges } = moduleRuleToNodes(m)
        allNodes.push(...ruleNodes)
        allEdges.push(...ruleEdges)
      }
    }

    // Criar nós de variável (não-órfãs, usadas por módulos expandidos)
    const varMap = new Map<string, VariavelDTO>()
    for (const v of data.variaveis) {
      if (!v.is_orfa) varMap.set(v.slug, v)
    }

    // Enriquecer nós de variável gerados por ruleToNodes com dados do backend
    for (const node of allNodes) {
      if (node.type === 'variable' && varMap.has(node.id.replace('var-', ''))) {
        const v = varMap.get(node.id.replace('var-', ''))!
        node.data = {
          slug: v.slug,
          label: v.label,
          tipo: v.tipo,
          isOrfa: false,
        }
      }
    }

    // Variáveis órfãs
    if (showOrphans) {
      for (const v of data.variaveis) {
        if (!v.is_orfa) continue
        allNodes.push({
          id: `orphan-${v.slug}`,
          type: 'orphan-variable',
          position: { x: 0, y: 0 },
          data: {
            slug: v.slug,
            label: v.label,
            tipo: v.tipo,
            isOrfa: true,
          },
        })
      }
    }

    // Edges de dependência entre variáveis
    for (const v of data.variaveis) {
      if (v.depends_on) {
        const sourceId = `var-${v.slug}`
        const targetId = `var-${v.depends_on}`
        if (allNodes.find((n) => n.id === sourceId) && allNodes.find((n) => n.id === targetId)) {
          allEdges.push({
            id: `dep-${v.slug}-${v.depends_on}`,
            source: sourceId,
            target: targetId,
            type: 'dependency',
          })
        }
      }
    }

    // Aplicar layout dagre
    const g = new dagre.graphlib.Graph()
    g.setDefaultEdgeLabel(() => ({}))
    g.setGraph(DAGRE_CONFIG)

    for (const node of allNodes) {
      if (node.hidden) continue
      const dim = NODE_DIMENSIONS[node.type ?? 'module'] ?? { width: 100, height: 40 }
      g.setNode(node.id, { width: dim.width, height: dim.height })
    }
    for (const edge of allEdges) {
      if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
        g.setEdge(edge.source, edge.target)
      }
    }

    dagre.layout(g)

    // Aplicar posições calculadas
    for (const node of allNodes) {
      if (node.hidden) continue
      const pos = g.node(node.id)
      if (pos) {
        const dim = NODE_DIMENSIONS[node.type ?? 'module'] ?? { width: 100, height: 40 }
        node.position = { x: pos.x - dim.width / 2, y: pos.y - dim.height / 2 }
      }
    }

    // Aplicar classes de highlight (busca)
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      for (const node of allNodes) {
        if (node.type === 'module') {
          const m = data.modulos.find((mod) => mod.id === (node.data as { id: number }).id)
          node.className = m && moduloMatchesSearch(m, searchTerm) ? 'node-match' : 'node-no-match'
        } else if (node.type === 'variable' || node.type === 'orphan-variable') {
          const slug = (node.data as { slug: string }).slug
          const v = data.variaveis.find((vr) => vr.slug === slug)
          node.className = v && variavelMatchesSearch(v, searchTerm) ? 'node-match' : 'node-no-match'
        }
      }
    }

    return { nodes: allNodes, edges: allEdges }
  }, [data, zoomLevel, expandedModules, searchTerm, showOrphans])

  return { nodes, edges }
}
```

- [ ] **Step 3: useNodeExpansion**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/hooks/useNodeExpansion.ts
/**
 * Hook para gerenciar expansão/colapso de módulos.
 */

import { useCallback } from 'react'
import type { NodeMouseHandler } from '@xyflow/react'
import { useArvoreStore } from '../store/useArvoreStore'

export function useNodeExpansion() {
  const { data, toggleModule, setDetailPanel } = useArvoreStore()

  /** Click simples: expande/colapsa árvore de decisão */
  const onNodeClick: NodeMouseHandler = useCallback((_event, node) => {
    if (node.type === 'module') {
      const id = (node.data as { id: number }).id
      toggleModule(id)
    }
  }, [toggleModule])

  /** Duplo click: abre detail panel */
  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    if (!data) return

    if (node.type === 'module') {
      const id = (node.data as { id: number }).id
      const modulo = data.modulos.find((m) => m.id === id)
      if (modulo) setDetailPanel({ type: 'module', data: modulo })
    } else if (node.type === 'variable' || node.type === 'orphan-variable') {
      const slug = (node.data as { slug: string }).slug
      const variavel = data.variaveis.find((v) => v.slug === slug)
      if (variavel) setDetailPanel({ type: 'variable', data: variavel })
    }
  }, [data, setDetailPanel])

  return { onNodeClick, onNodeDoubleClick }
}
```

- [ ] **Step 4: Commit hooks**

```bash
git add frontend-react/src/pages/admin/arvore-decisao/hooks/
git commit -m "feat(arvore-decisao): hooks de zoom semântico, layout dagre e expansão de nós"
```

---

### Task 12: Página Principal + Rota no SPA

**Files:**
- Create: `frontend-react/src/pages/admin/arvore-decisao/ArvoreDecisaoPage.tsx`
- Modify: `frontend-react/src/router.tsx` (adicionar rota)
- Modify: `frontend-react/src/components/layout/AdminSubNav.tsx` (adicionar link)

- [ ] **Step 1: Criar página principal**

```typescript
// frontend-react/src/pages/admin/arvore-decisao/ArvoreDecisaoPage.tsx
/**
 * Página principal da Árvore de Decisão.
 * Renderiza canvas React Flow com swimlanes, módulos e variáveis.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ReactFlow,
  MiniMap,
  Background,
  Controls,
  type NodeTypes,
  type EdgeTypes,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { toPng } from 'html-to-image'
import { createApiClient } from '@/lib/api'

import { SwimLaneNode } from './components/nodes/SwimLaneNode'
import { ModuleNode } from './components/nodes/ModuleNode'
import { ConditionNode } from './components/nodes/ConditionNode'
import { ConnectorNode } from './components/nodes/ConnectorNode'
import { VariableNode } from './components/nodes/VariableNode'
import { OrphanVariableNode } from './components/nodes/OrphanVariableNode'
import { YesNoEdge } from './components/edges/YesNoEdge'
import { DependencyEdge } from './components/edges/DependencyEdge'
import { SharedVarEdge } from './components/edges/SharedVarEdge'
import { Toolbar } from './components/Toolbar'
import { DetailPanel } from './components/DetailPanel'
import { useArvoreDecisaoData } from './hooks/useArvoreDecisaoData'
import { useSemanticZoom } from './hooks/useSemanticZoom'
import { useGraphLayout } from './hooks/useGraphLayout'
import { useNodeExpansion } from './hooks/useNodeExpansion'
import { useArvoreStore } from './store/useArvoreStore'
import { C } from '@/lib/designTokens'

const nodeTypes: NodeTypes = {
  swimlane: SwimLaneNode,
  module: ModuleNode,
  condition: ConditionNode,
  connector: ConnectorNode,
  variable: VariableNode,
  'orphan-variable': OrphanVariableNode,
}

const edgeTypes: EdgeTypes = {
  'yes-no': YesNoEdge,
  dependency: DependencyEdge,
  'shared-var': SharedVarEdge,
}

interface TipoPeca {
  id: number
  nome: string
  titulo: string
}

const promptsApi = createApiClient('/admin/api/prompts-modulos')

export function ArvoreDecisaoPage() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const { loading, error, data } = useArvoreStore()
  const [tiposPeca, setTiposPeca] = useState<TipoPeca[]>([])

  // Carregar tipos de peça
  useEffect(() => {
    async function loadTiposPeca() {
      try {
        const resp = await promptsApi.get<TipoPeca[]>('/tipos-peca')
        setTiposPeca(resp)
      } catch {
        // Tipos de peça opcionais
      }
    }
    void loadTiposPeca()
  }, [])

  // Hooks
  useArvoreDecisaoData()
  useSemanticZoom()
  const { nodes, edges } = useGraphLayout()
  const { onNodeClick, onNodeDoubleClick } = useNodeExpansion()

  // Exportar PNG
  const handleExport = useCallback(() => {
    if (!canvasRef.current) return
    toPng(canvasRef.current, { pixelRatio: 1 }).then((dataUrl) => {
      const link = document.createElement('a')
      link.download = 'arvore-decisao.png'
      link.href = dataUrl
      link.click()
    })
  }, [])

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: C.text400 }}>
        <p>Erro ao carregar árvore de decisão: {error}</p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <Toolbar tiposPeca={tiposPeca} onExport={handleExport} />

      <div style={{ flex: 1, position: 'relative' }} ref={canvasRef}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, background: 'rgba(255,255,255,0.7)' }}>
            <span style={{ color: C.text400 }}>Carregando...</span>
          </div>
        )}

        {data && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onNodeDoubleClick={onNodeDoubleClick}
            fitView
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
          >
            <Background />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              style={{ background: '#f8fafc' }}
            />
          </ReactFlow>
        )}

        {!data && !loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.text400 }}>
            Selecione um grupo para visualizar a árvore de decisão
          </div>
        )}
      </div>

      <DetailPanel />

      {/* CSS para highlight de busca */}
      <style>{`
        .node-match { outline: 2px solid #22c55e; box-shadow: 0 0 8px rgba(34, 197, 94, 0.5); border-radius: 8px; }
        .node-no-match { opacity: 0.2; }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 2: Adicionar rota no router.tsx**

No arquivo `frontend-react/src/router.tsx`:

1. Adicionar lazy import (junto com os outros):
```typescript
const ArvoreDecisaoPage = lazyWithRetry(() => import('@/pages/admin/arvore-decisao/ArvoreDecisaoPage').then(m => ({ default: m.ArvoreDecisaoPage as ComponentType<unknown> })))
```

2. Adicionar rota (junto com as outras admin routes):
```typescript
const arvoreDecisaoRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/admin/arvore-decisao',
  component: ArvoreDecisaoPage,
})
```

3. Adicionar ao `routeTree` — adicionar `arvoreDecisaoRoute` ao array de children do router.

- [ ] **Step 3: Adicionar link no AdminSubNav**

No arquivo `frontend-react/src/components/layout/AdminSubNav.tsx`, adicionar ao array `PROMPTS_ECOSYSTEM_ITEMS`:

```typescript
import { FileEdit, FileJson, Variable, Settings, Tags, Zap, FlaskConical, Filter, GitBranch } from 'lucide-react'

// Adicionar ao final do array:
{ to: '/admin/arvore-decisao', label: 'Árvore Decisão', icon: GitBranch },
```

- [ ] **Step 4: Build do frontend**

```bash
cd E:\Projetos\PGE\portal-pge\frontend-react && node node_modules/vite/bin/vite.js build
```
Expected: Build sem erros

- [ ] **Step 5: Commit página + rota**

```bash
git add frontend-react/src/pages/admin/arvore-decisao/ frontend-react/src/router.tsx frontend-react/src/components/layout/AdminSubNav.tsx
git add -f frontend-react/dist/
git commit -m "feat(arvore-decisao): página principal com React Flow, rota e link no menu admin"
```

---

## Chunk 5: Teste de Integração e Ajustes Finais

### Task 13: Teste manual end-to-end

- [ ] **Step 1: Iniciar servidor local**

```bash
cd E:\Projetos\PGE\portal-pge && uvicorn main:app --reload
```

- [ ] **Step 2: Abrir no browser e verificar**

Navegar para `http://localhost:8000/admin/arvore-decisao` e verificar:
- [ ] GroupSelector aparece e funciona
- [ ] Ao selecionar grupo, dados carregam
- [ ] Módulos aparecem como retângulos no canvas
- [ ] Click num módulo expande a árvore de decisão
- [ ] Duplo-click abre o detail panel
- [ ] Toggle de órfãs funciona
- [ ] Busca destaca nós
- [ ] Zoom semântico muda entre macro/médio/detalhe
- [ ] Minimap funciona
- [ ] Exportar PNG funciona
- [ ] Legenda visível

- [ ] **Step 3: Corrigir issues encontrados**

Ajustar quaisquer problemas visuais ou de integração encontrados no teste manual.

- [ ] **Step 4: Rodar todos os testes automatizados**

```bash
cd E:\Projetos\PGE\portal-pge && python -m pytest tests/gerador_pecas/test_arvore_decisao.py -v
```
Expected: PASS (todos os testes)

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "fix(arvore-decisao): ajustes de integração e testes end-to-end"
```
