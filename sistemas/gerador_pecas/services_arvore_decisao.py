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

        # 6. Buscar variáveis de extração do grupo
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
