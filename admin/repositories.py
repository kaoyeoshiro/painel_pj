# -*- coding: utf-8 -*-
"""
Repositorios compartilhados do modulo admin.

ConfiguracaoIA e PromptConfig sao usados por multiplos sistemas.
Centralizar as queries evita repeticao de db.query(ConfiguracaoIA)
espalhadas por 7+ routers.
"""

import logging
from datetime import datetime
from typing import Optional, Any

from fastapi import Depends
from sqlalchemy import func, and_, case, extract, text as sql_text, literal_column
from sqlalchemy.orm import Session, joinedload

from database.connection import get_db
from database.repository_base import BaseRepository
from admin.models import ConfiguracaoIA, PromptConfig
from admin.models_prompts import (
    PromptModulo,
    PromptModuloHistorico,
    ModuloTipoPeca,
    RegraDeterministicaTipoPeca,
    prompt_modulo_subcategorias,
)
from admin.models_prompt_groups import (
    PromptGroup,
    PromptSubgroup,
    PromptSubcategoria,
    CategoriaOrdem,
)
from auth.models import User

# Imports de modelos de feedback dos sistemas
from sistemas.assistencia_judiciaria.models import ConsultaProcesso, FeedbackAnalise
from sistemas.matriculas_confrontantes.models import Analise, FeedbackMatricula
from sistemas.gerador_pecas.models import GeracaoPeca, FeedbackPeca, VersaoPeca
from sistemas.pedido_calculo.models import GeracaoPedidoCalculo, FeedbackPedidoCalculo
from sistemas.prestacao_contas.models import GeracaoAnalise, FeedbackPrestacao
from sistemas.relatorio_cumprimento.models import (
    GeracaoRelatorioCumprimento,
    FeedbackRelatorioCumprimento,
)

logger = logging.getLogger(__name__)


class ConfiguracaoIARepository(BaseRepository[ConfiguracaoIA]):
    """Repositorio para configuracoes de IA."""

    model = ConfiguracaoIA

    def get_config(self, sistema: str, chave: str) -> ConfiguracaoIA | None:
        """Busca configuracao por sistema e chave."""
        return (
            self.query()
            .filter(
                ConfiguracaoIA.sistema == sistema,
                ConfiguracaoIA.chave == chave,
            )
            .first()
        )

    def get_valor(
        self, sistema: str, chave: str, default: str | None = None
    ) -> str | None:
        """Retorna apenas o valor de uma configuracao, com fallback."""
        config = self.get_config(sistema, chave)
        return config.valor if config else default

    def list_by_sistema(self, sistema: str) -> list[ConfiguracaoIA]:
        """Lista todas as configuracoes de um sistema."""
        return self.query().filter(ConfiguracaoIA.sistema == sistema).all()

    def list_with_filters(
        self,
        sistema: Optional[str] = None,
        chave: Optional[str] = None,
    ) -> list[ConfiguracaoIA]:
        """Lista configuracoes com filtros opcionais."""
        query = self.query()

        if sistema:
            query = query.filter(ConfiguracaoIA.sistema == sistema)
        if chave:
            query = query.filter(ConfiguracaoIA.chave == chave)

        return query.order_by(ConfiguracaoIA.sistema, ConfiguracaoIA.chave).all()

    def count_by_sistema(self, sistema: str) -> int:
        """Conta configuracoes de um sistema."""
        return self.query().filter(ConfiguracaoIA.sistema == sistema).count()

    def upsert_config(self, sistema: str, chave: str, valor: str) -> ConfiguracaoIA:
        """Cria ou atualiza uma configuracao."""
        config = self.get_config(sistema, chave)
        if config:
            config.valor = valor
        else:
            config = ConfiguracaoIA(sistema=sistema, chave=chave, valor=valor)
            self.add(config)
        return config


class PromptConfigRepository(BaseRepository[PromptConfig]):
    """Repositorio para configuracoes de prompts."""

    model = PromptConfig

    def get_active(self, sistema: str, tipo: str) -> PromptConfig | None:
        """Busca prompt ativo por sistema e tipo."""
        return (
            self.query()
            .filter(
                PromptConfig.sistema == sistema,
                PromptConfig.tipo == tipo,
                PromptConfig.is_active == True,
            )
            .first()
        )

    def list_by_sistema(self, sistema: str) -> list[PromptConfig]:
        """Lista todos os prompts de um sistema."""
        return self.query().filter(PromptConfig.sistema == sistema).all()

    def list_with_filters(
        self,
        sistema: Optional[str] = None,
        tipo: Optional[str] = None,
    ) -> list[PromptConfig]:
        """Lista prompts com filtros opcionais."""
        query = self.query()

        if sistema:
            query = query.filter(PromptConfig.sistema == sistema)
        if tipo:
            query = query.filter(PromptConfig.tipo == tipo)

        return query.order_by(PromptConfig.sistema, PromptConfig.tipo).all()

    def count_by_sistema(self, sistema: str) -> int:
        """Conta prompts de um sistema."""
        return self.query().filter(PromptConfig.sistema == sistema).count()

    def check_exists(self, sistema: str, tipo: str) -> bool:
        """Verifica se ja existe um prompt com sistema e tipo."""
        return (
            self.query()
            .filter(
                PromptConfig.sistema == sistema,
                PromptConfig.tipo == tipo,
            )
            .count()
            > 0
        )


class PromptModuloRepository(BaseRepository[PromptModulo]):
    """Repositorio para modulos de prompts."""

    model = PromptModulo

    def list_with_filters(
        self,
        categoria: Optional[str] = None,
        grupo_id: Optional[int] = None,
        subgrupo_id: Optional[int] = None,
        subcategorias: Optional[list[int]] = None,
        tipo_peca: Optional[str] = None,
        ativo: Optional[bool] = None,
        order_by_ordem: bool = False,
    ) -> list[PromptModulo]:
        """Lista modulos com filtros opcionais."""
        query = self.query()

        if categoria:
            query = query.filter(PromptModulo.categoria == categoria)
        if grupo_id:
            query = query.filter(PromptModulo.group_id == grupo_id)
        if subgrupo_id:
            query = query.filter(PromptModulo.subgroup_id == subgrupo_id)
        if ativo is not None:
            query = query.filter(PromptModulo.ativo == ativo)

        if subcategorias:
            subquery_ids = (
                self.db.query(prompt_modulo_subcategorias.c.modulo_id)
                .filter(prompt_modulo_subcategorias.c.subcategoria_id.in_(subcategorias))
                .distinct()
            )
            query = query.filter(PromptModulo.id.in_(subquery_ids))

        if tipo_peca:
            query = (
                query.join(
                    ModuloTipoPeca,
                    PromptModulo.id == ModuloTipoPeca.modulo_id,
                )
                .filter(ModuloTipoPeca.tipo_peca == tipo_peca)
            )

        if order_by_ordem:
            query = query.order_by(PromptModulo.ordem.asc())
        else:
            query = query.order_by(PromptModulo.titulo.asc())

        return query.all()

    def get_distinct_categorias(
        self, grupo_id: Optional[int] = None
    ) -> list[tuple[str]]:
        """Retorna categorias distintas, opcionalmente filtradas por grupo."""
        query = (
            self.db.query(PromptModulo.categoria)
            .distinct()
            .filter(PromptModulo.ativo == True)
        )

        if grupo_id:
            query = query.filter(PromptModulo.group_id == grupo_id)

        query = query.order_by(PromptModulo.categoria)
        return query.all()

    def get_tipos_peca_by_categoria(self, categoria: str) -> list[PromptModulo]:
        """Retorna tipos de peca (modulos marcados como tipo_peca=True) de uma categoria."""
        return (
            self.query()
            .filter(
                PromptModulo.categoria == categoria,
                PromptModulo.tipo_peca == True,
                PromptModulo.ativo == True,
            )
            .order_by(PromptModulo.ordem.asc())
            .all()
        )

    def get_conteudo_by_categoria(
        self, categoria: str, tipo_peca: Optional[str] = None
    ) -> list[PromptModulo]:
        """Retorna modulos de conteudo (nao tipo_peca) de uma categoria."""
        query = self.query().filter(
            PromptModulo.categoria == categoria,
            PromptModulo.tipo_peca == False,
            PromptModulo.ativo == True,
        )

        if tipo_peca:
            query = (
                query.join(
                    ModuloTipoPeca,
                    PromptModulo.id == ModuloTipoPeca.modulo_id,
                )
                .filter(ModuloTipoPeca.tipo_peca == tipo_peca)
            )

        return query.order_by(PromptModulo.ordem.asc()).all()

    def count_by_categoria(self, categoria: str) -> dict[str, Any]:
        """Conta tipos de peca e modulos de conteudo em uma categoria."""
        query = (
            self.db.query(
                func.count().filter(PromptModulo.tipo_peca == True).label("tipos_peca"),
                func.count().filter(PromptModulo.tipo_peca == False).label("conteudo"),
            )
            .filter(
                PromptModulo.categoria == categoria,
                PromptModulo.ativo == True,
            )
        )
        result = query.first()
        return {"tipos_peca": result.tipos_peca or 0, "conteudo": result.conteudo or 0}

    def check_exists_by_titulo(
        self, titulo: str, exclude_id: Optional[int] = None
    ) -> bool:
        """Verifica se ja existe modulo com o titulo (case-insensitive)."""
        query = self.query().filter(func.lower(PromptModulo.titulo) == titulo.lower())
        if exclude_id:
            query = query.filter(PromptModulo.id != exclude_id)
        return query.count() > 0

    def check_exists_by_slug(
        self, slug: str, exclude_id: Optional[int] = None
    ) -> bool:
        """Verifica se ja existe modulo com o slug."""
        query = self.query().filter(PromptModulo.slug == slug)
        if exclude_id:
            query = query.filter(PromptModulo.id != exclude_id)
        return query.count() > 0

    def get_all_active_ordered(self) -> list[PromptModulo]:
        """Retorna todos os modulos ativos ordenados por ordem."""
        return (
            self.query()
            .filter(PromptModulo.ativo == True)
            .order_by(PromptModulo.ordem.asc())
            .all()
        )

    def get_distinct_categorias_for_listing(
        self,
        group_id: Optional[int] = None,
        apenas_ativos: bool = True,
    ) -> list[str]:
        """Retorna categorias distintas para listagem (tipos validos)."""
        query = self.db.query(PromptModulo.categoria).distinct().filter(
            PromptModulo.categoria.isnot(None),
            PromptModulo.tipo.in_(["base", "peca", "conteudo"])
        )
        if apenas_ativos:
            query = query.filter(PromptModulo.ativo == True)
        if group_id:
            query = query.filter(PromptModulo.group_id == group_id)
        return [c[0] for c in query.all() if c[0]]

    def get_categorias_conteudo_by_group(self, group_id: int) -> list[str]:
        """Retorna categorias distintas de modulos de conteudo ativos de um grupo."""
        result = self.db.query(PromptModulo.categoria).distinct().filter(
            PromptModulo.group_id == group_id,
            PromptModulo.tipo == "conteudo",
            PromptModulo.ativo == True,
            PromptModulo.categoria.isnot(None),
            PromptModulo.categoria != ""
        ).all()
        return [c[0] for c in result if c[0]]

    def get_subcategoria_modulo_ids(self, subcategoria_ids: list[int]) -> list:
        """Retorna subquery de modulo_ids filtrados por subcategorias."""
        return self.db.query(
            prompt_modulo_subcategorias.c.modulo_id
        ).filter(
            prompt_modulo_subcategorias.c.subcategoria_id.in_(subcategoria_ids)
        ).distinct().subquery()

    def get_resumo_contagens_tipo_peca(
        self,
        group_id: Optional[int] = None,
    ) -> list:
        """Retorna contagens de ativos/inativos por tipo_peca para modulos de conteudo."""
        query = self.db.query(
            ModuloTipoPeca.tipo_peca,
            func.sum(case((ModuloTipoPeca.ativo == True, 1), else_=0)).label('ativos'),
            func.sum(case((ModuloTipoPeca.ativo == False, 1), else_=0)).label('inativos')
        ).join(
            PromptModulo,
            ModuloTipoPeca.modulo_id == PromptModulo.id
        ).filter(
            PromptModulo.tipo == "conteudo",
            PromptModulo.ativo == True
        )
        if group_id:
            query = query.filter(PromptModulo.group_id == group_id)
        return query.group_by(ModuloTipoPeca.tipo_peca).all()

class PromptModuloHistoricoRepository(BaseRepository[PromptModuloHistorico]):
    """Repositorio para historico de modulos de prompts."""

    model = PromptModuloHistorico

    def get_by_modulo_versao(
        self, modulo_id: int, versao: int
    ) -> PromptModuloHistorico | None:
        """Busca historico por modulo e versao."""
        return (
            self.query()
            .filter(
                PromptModuloHistorico.modulo_id == modulo_id,
                PromptModuloHistorico.versao == versao,
            )
            .first()
        )

    def list_by_modulo(
        self, modulo_id: int, limit: int = 10
    ) -> list[PromptModuloHistorico]:
        """Lista historico de um modulo, ordenado por versao (mais recente primeiro)."""
        return (
            self.query()
            .filter(PromptModuloHistorico.modulo_id == modulo_id)
            .order_by(PromptModuloHistorico.versao.desc())
            .limit(limit)
            .all()
        )

    def get_max_versao(self, modulo_id: int) -> int:
        """Retorna a versao maxima de um modulo (ou 0 se nao houver historico)."""
        result = (
            self.db.query(func.max(PromptModuloHistorico.versao))
            .filter(PromptModuloHistorico.modulo_id == modulo_id)
            .scalar()
        )
        return result if result is not None else 0

    def delete_by_modulo(self, modulo_id: int) -> None:
        """Deleta todo o historico de um modulo."""
        self.db.query(PromptModuloHistorico).filter(
            PromptModuloHistorico.modulo_id == modulo_id
        ).delete()


class PromptGroupRepository(BaseRepository[PromptGroup]):
    """Repositorio para grupos de prompts."""

    model = PromptGroup

    def list_with_filters(
        self,
        tipo: Optional[str] = None,
    ) -> list[PromptGroup]:
        """Lista grupos com filtros opcionais."""
        query = self.query()

        if tipo:
            query = query.filter(PromptGroup.tipo == tipo)

        return query.order_by(PromptGroup.nome).all()

    def get_by_slug(self, slug: str) -> PromptGroup | None:
        """Busca grupo por slug."""
        return self.query().filter(PromptGroup.slug == slug).first()

    def check_slug_exists(self, slug: str, exclude_id: Optional[int] = None) -> bool:
        """Verifica se slug ja existe."""
        query = self.query().filter(PromptGroup.slug == slug)
        if exclude_id:
            query = query.filter(PromptGroup.id != exclude_id)
        return query.count() > 0


class PromptSubgroupRepository(BaseRepository[PromptSubgroup]):
    """Repositorio para subgrupos de prompts."""

    model = PromptSubgroup

    def list_by_group(
        self,
        group_id: int,
        tipo: Optional[str] = None,
    ) -> list[PromptSubgroup]:
        """Lista subgrupos de um grupo, opcionalmente filtrados por tipo."""
        query = self.query().filter(PromptSubgroup.group_id == group_id)

        if tipo:
            query = query.filter(PromptSubgroup.tipo == tipo)

        return query.order_by(PromptSubgroup.nome).all()

    def check_nome_exists_in_group(
        self, group_id: int, nome: str, exclude_id: Optional[int] = None
    ) -> bool:
        """Verifica se nome ja existe em um grupo."""
        query = self.query().filter(
            PromptSubgroup.group_id == group_id,
            func.lower(PromptSubgroup.nome) == nome.lower(),
        )
        if exclude_id:
            query = query.filter(PromptSubgroup.id != exclude_id)
        return query.count() > 0

    def count_modulos_using_subgroup(self, subgroup_id: int) -> int:
        """Conta quantos modulos usam este subgrupo."""
        return (
            self.db.query(PromptModulo)
            .filter(PromptModulo.subgroup_id == subgroup_id)
            .count()
        )

    def clear_subgroup_references(self, subgroup_id: int) -> int:
        """Remove referencia de subgroup_id de todos os modulos que usam esse subgrupo.
        Retorna o numero de modulos atualizados."""
        count = self.db.query(PromptModulo).filter(
            PromptModulo.subgroup_id == subgroup_id
        ).update({PromptModulo.subgroup_id: None}, synchronize_session=False)
        return count

    def clear_subgroup_references_historico(self, subgroup_id: int) -> int:
        """Remove referencia de subgroup_id do historico de modulos."""
        count = self.db.query(PromptModuloHistorico).filter(
            PromptModuloHistorico.subgroup_id == subgroup_id
        ).update({PromptModuloHistorico.subgroup_id: None}, synchronize_session=False)
        return count


class PromptSubcategoriaRepository(BaseRepository[PromptSubcategoria]):
    """Repositorio para subcategorias de prompts."""

    model = PromptSubcategoria

    def list_all_with_group_info(self) -> list[dict[str, Any]]:
        """Lista todas as subcategorias com informacoes do grupo."""
        query = self.db.query(PromptSubcategoria).join(PromptGroup).all()

        result = []
        for sub in query:
            grupo = (
                self.db.query(PromptGroup)
                .filter(PromptGroup.id == sub.group_id)
                .first()
            )
            result.append(
                {
                    "id": sub.id,
                    "nome": sub.nome,
                    "descricao": sub.descricao,
                    "group_id": sub.group_id,
                    "grupo_nome": grupo.nome if grupo else None,
                    "grupo_tipo": grupo.tipo if grupo else None,
                }
            )
        return result

    def list_by_group(self, group_id: int) -> list[PromptSubcategoria]:
        """Lista subcategorias de um grupo."""
        return (
            self.query()
            .filter(PromptSubcategoria.group_id == group_id)
            .order_by(PromptSubcategoria.nome)
            .all()
        )

    def check_nome_exists_in_group(
        self, group_id: int, nome: str, exclude_id: Optional[int] = None
    ) -> bool:
        """Verifica se nome ja existe em um grupo."""
        query = self.query().filter(
            PromptSubcategoria.group_id == group_id,
            func.lower(PromptSubcategoria.nome) == nome.lower(),
        )
        if exclude_id:
            query = query.filter(PromptSubcategoria.id != exclude_id)
        return query.count() > 0

    def count_modulos_using_subcategoria(self, subcategoria_id: int) -> int:
        """Conta quantos modulos usam esta subcategoria."""
        return (
            self.db.query(PromptModulo)
            .filter(
                PromptModulo.id.in_(
                    self.db.query(prompt_modulo_subcategorias.c.modulo_id).filter(
                        prompt_modulo_subcategorias.c.subcategoria_id == subcategoria_id
                    )
                )
            )
            .count()
        )

    def list_by_ids(self, ids: list[int]) -> list[PromptSubcategoria]:
        """Lista subcategorias por lista de IDs."""
        return self.query().filter(PromptSubcategoria.id.in_(ids)).all()

    def list_all_with_group_join(
        self,
        apenas_ativas: bool = True,
    ) -> list[PromptSubcategoria]:
        """Lista todas as subcategorias com join no grupo, ordenadas por grupo e ordem."""
        query = self.db.query(PromptSubcategoria).join(PromptGroup)
        if apenas_ativas:
            query = query.filter(PromptSubcategoria.active == True)
        return query.order_by(PromptGroup.name, PromptSubcategoria.order, PromptSubcategoria.nome).all()


class ModuloTipoPecaRepository(BaseRepository[ModuloTipoPeca]):
    """Repositorio para associacoes modulo-tipo-peca."""

    model = ModuloTipoPeca

    def list_by_modulo(self, modulo_id: int) -> list[ModuloTipoPeca]:
        """Lista associacoes de um modulo."""
        return (
            self.query()
            .filter(ModuloTipoPeca.modulo_id == modulo_id)
            .order_by(ModuloTipoPeca.tipo_peca)
            .all()
        )

    def get_by_modulo_tipo(
        self, modulo_id: int, tipo_peca: str
    ) -> ModuloTipoPeca | None:
        """Busca associacao especifica."""
        return (
            self.query()
            .filter(
                ModuloTipoPeca.modulo_id == modulo_id,
                ModuloTipoPeca.tipo_peca == tipo_peca,
            )
            .first()
        )

    def delete_by_modulo(self, modulo_id: int) -> None:
        """Deleta todas as associacoes de um modulo."""
        self.db.query(ModuloTipoPeca).filter(
            ModuloTipoPeca.modulo_id == modulo_id
        ).delete()


class RegraDeterministicaTipoPecaRepository(
    BaseRepository[RegraDeterministicaTipoPeca]
):
    """Repositorio para regras deterministicas de tipo peca."""

    model = RegraDeterministicaTipoPeca

    def list_by_modulo(self, modulo_id: int) -> list[RegraDeterministicaTipoPeca]:
        """Lista regras de um modulo."""
        return (
            self.query()
            .filter(RegraDeterministicaTipoPeca.modulo_id == modulo_id)
            .order_by(RegraDeterministicaTipoPeca.prioridade.desc())
            .all()
        )

    def check_exists_for_tipo_peca(
        self, modulo_id: int, tipo_peca: str, exclude_id: Optional[int] = None
    ) -> bool:
        """Verifica se ja existe regra para o tipo de peca."""
        query = self.query().filter(
            RegraDeterministicaTipoPeca.modulo_id == modulo_id,
            RegraDeterministicaTipoPeca.tipo_peca == tipo_peca,
        )
        if exclude_id:
            query = query.filter(RegraDeterministicaTipoPeca.id != exclude_id)
        return query.count() > 0


class CategoriaOrdemRepository(BaseRepository[CategoriaOrdem]):
    """Repositorio para ordem de categorias."""

    model = CategoriaOrdem

    def list_by_group(self, group_id: int) -> list[CategoriaOrdem]:
        """Lista configuracoes de ordem de um grupo."""
        return (
            self.query()
            .filter(CategoriaOrdem.group_id == group_id)
            .order_by(CategoriaOrdem.ordem.asc())
            .all()
        )

    def get_by_group_categoria(
        self, group_id: int, categoria: str
    ) -> CategoriaOrdem | None:
        """Busca configuracao de ordem de uma categoria em um grupo."""
        return (
            self.query()
            .filter(
                CategoriaOrdem.group_id == group_id,
                CategoriaOrdem.categoria == categoria,
            )
            .first()
        )

    def check_exists(
        self, group_id: int, categoria: str, exclude_id: Optional[int] = None
    ) -> bool:
        """Verifica se ja existe configuracao para a categoria no grupo."""
        query = self.query().filter(
            CategoriaOrdem.group_id == group_id,
            CategoriaOrdem.categoria == categoria,
        )
        if exclude_id:
            query = query.filter(CategoriaOrdem.id != exclude_id)
        return query.count() > 0


class FeedbackRepository:
    """
    Repositorio para queries consolidadas de feedbacks de todos os sistemas.

    NAO herda de BaseRepository pois lida com multiplos modelos diferentes.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_excluded_user_ids(self) -> list[int]:
        """Retorna IDs de usuarios a serem excluidos (admin e teste)."""
        usuarios_excluir = (
            self.db.query(User.id)
            .filter(
                (User.role == "admin")
                | (User.username.ilike("%teste%"))
                | (User.username.ilike("%test%"))
            )
            .all()
        )
        return [u.id for u in usuarios_excluir]

    def count_consultas_aj(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta consultas de assistencia judiciaria."""
        query = self.db.query(ConsultaProcesso)
        if ids_excluir:
            query = query.filter(~ConsultaProcesso.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                ConsultaProcesso.consultado_em >= data_inicio,
                ConsultaProcesso.consultado_em < data_fim,
            )
        return query.count()

    def count_feedbacks_aj(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta feedbacks de assistencia judiciaria."""
        query = self.db.query(FeedbackAnalise)
        if ids_excluir:
            query = query.filter(~FeedbackAnalise.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackAnalise.criado_em >= data_inicio,
                FeedbackAnalise.criado_em < data_fim,
            )
        return query.count()

    def count_analises_mat(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta analises de matriculas."""
        query = self.db.query(Analise)
        if ids_excluir:
            query = query.filter(~Analise.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                Analise.analisado_em >= data_inicio,
                Analise.analisado_em < data_fim,
            )
        return query.count()

    def count_feedbacks_mat(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta feedbacks de matriculas."""
        query = self.db.query(FeedbackMatricula)
        if ids_excluir:
            query = query.filter(~FeedbackMatricula.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackMatricula.criado_em >= data_inicio,
                FeedbackMatricula.criado_em < data_fim,
            )
        return query.count()

    def count_geracoes_gp(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta geracoes de pecas."""
        query = self.db.query(GeracaoPeca)
        if ids_excluir:
            query = query.filter(~GeracaoPeca.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                GeracaoPeca.criado_em >= data_inicio,
                GeracaoPeca.criado_em < data_fim,
            )
        return query.count()

    def count_feedbacks_gp(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta feedbacks de gerador de pecas."""
        query = self.db.query(FeedbackPeca)
        if ids_excluir:
            query = query.filter(~FeedbackPeca.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackPeca.criado_em >= data_inicio,
                FeedbackPeca.criado_em < data_fim,
            )
        return query.count()

    def count_geracoes_pc(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta geracoes de pedido de calculo."""
        query = self.db.query(GeracaoPedidoCalculo)
        if ids_excluir:
            query = query.filter(~GeracaoPedidoCalculo.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                GeracaoPedidoCalculo.criado_em >= data_inicio,
                GeracaoPedidoCalculo.criado_em < data_fim,
            )
        return query.count()

    def count_feedbacks_pc(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta feedbacks de pedido de calculo."""
        query = self.db.query(FeedbackPedidoCalculo)
        if ids_excluir:
            query = query.filter(~FeedbackPedidoCalculo.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackPedidoCalculo.criado_em >= data_inicio,
                FeedbackPedidoCalculo.criado_em < data_fim,
            )
        return query.count()

    def count_geracoes_prest(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta geracoes de prestacao de contas."""
        query = self.db.query(GeracaoAnalise)
        if ids_excluir:
            query = query.filter(~GeracaoAnalise.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                GeracaoAnalise.criado_em >= data_inicio,
                GeracaoAnalise.criado_em < data_fim,
            )
        return query.count()

    def count_feedbacks_prest(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta feedbacks de prestacao de contas."""
        query = self.db.query(FeedbackPrestacao)
        if ids_excluir:
            query = query.filter(~FeedbackPrestacao.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackPrestacao.criado_em >= data_inicio,
                FeedbackPrestacao.criado_em < data_fim,
            )
        return query.count()

    def count_geracoes_rc(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta geracoes de relatorio de cumprimento."""
        query = self.db.query(GeracaoRelatorioCumprimento).filter(
            GeracaoRelatorioCumprimento.criado_em.isnot(None)
        )
        if ids_excluir:
            query = query.filter(~GeracaoRelatorioCumprimento.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                GeracaoRelatorioCumprimento.criado_em >= data_inicio,
                GeracaoRelatorioCumprimento.criado_em < data_fim,
            )
        return query.count()

    def count_feedbacks_rc(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta feedbacks de relatorio de cumprimento."""
        query = self.db.query(FeedbackRelatorioCumprimento)
        if ids_excluir:
            query = query.filter(
                ~FeedbackRelatorioCumprimento.usuario_id.in_(ids_excluir)
            )
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackRelatorioCumprimento.criado_em >= data_inicio,
                FeedbackRelatorioCumprimento.criado_em < data_fim,
            )
        return query.count()

    def get_avaliacoes_por_sistema(
        self,
        sistema: str,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> list[tuple[str, int]]:
        """
        Retorna contagem de avaliacoes por tipo (correto, parcial, incorreto).

        Returns:
            Lista de tuplas (avaliacao, count)
        """
        modelo_map = {
            "assistencia_judiciaria": FeedbackAnalise,
            "matriculas": FeedbackMatricula,
            "gerador_pecas": FeedbackPeca,
            "pedido_calculo": FeedbackPedidoCalculo,
            "prestacao_contas": FeedbackPrestacao,
            "relatorio_cumprimento": FeedbackRelatorioCumprimento,
        }

        modelo = modelo_map.get(sistema)
        if not modelo:
            return []

        query = self.db.query(
            modelo.avaliacao, func.count(modelo.id).label("count")
        )

        if ids_excluir:
            query = query.filter(~modelo.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                modelo.criado_em >= data_inicio,
                modelo.criado_em < data_fim,
            )

        return query.group_by(modelo.avaliacao).all()

    # =============================================
    # Dashboard: contagem de RC com status filtrado
    # =============================================

    def count_geracoes_rc_concluido(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> int:
        """Conta geracoes de relatorio de cumprimento com status='concluido'."""
        query = self.db.query(GeracaoRelatorioCumprimento).filter(
            GeracaoRelatorioCumprimento.status == 'concluido'
        )
        if ids_excluir:
            query = query.filter(~GeracaoRelatorioCumprimento.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                GeracaoRelatorioCumprimento.criado_em >= data_inicio,
                GeracaoRelatorioCumprimento.criado_em < data_fim,
            )
        return query.count()

    # =============================================
    # Dashboard: feedbacks recentes por data
    # =============================================

    def _feedbacks_recentes_por_data(
        self,
        modelo_feedback,
        campo_data,
        ids_excluir: list[int],
        data_inicio: datetime,
        data_fim: datetime,
    ) -> list:
        """Conta feedbacks agrupados por data para um modelo especifico."""
        query = self.db.query(
            func.date(campo_data).label('data'),
            func.count(modelo_feedback.id).label('count')
        ).filter(
            campo_data >= data_inicio,
            campo_data < data_fim
        )
        if ids_excluir:
            query = query.filter(~modelo_feedback.usuario_id.in_(ids_excluir))
        return query.group_by(func.date(campo_data)).all()

    def feedbacks_recentes_aj(self, ids_excluir, data_inicio, data_fim):
        """Feedbacks recentes de assistencia judiciaria por data."""
        return self._feedbacks_recentes_por_data(
            FeedbackAnalise, FeedbackAnalise.criado_em, ids_excluir, data_inicio, data_fim
        )

    def feedbacks_recentes_mat(self, ids_excluir, data_inicio, data_fim):
        """Feedbacks recentes de matriculas por data."""
        return self._feedbacks_recentes_por_data(
            FeedbackMatricula, FeedbackMatricula.criado_em, ids_excluir, data_inicio, data_fim
        )

    def feedbacks_recentes_gp(self, ids_excluir, data_inicio, data_fim):
        """Feedbacks recentes de gerador de pecas por data."""
        return self._feedbacks_recentes_por_data(
            FeedbackPeca, FeedbackPeca.criado_em, ids_excluir, data_inicio, data_fim
        )

    def feedbacks_recentes_pc(self, ids_excluir, data_inicio, data_fim):
        """Feedbacks recentes de pedido de calculo por data."""
        return self._feedbacks_recentes_por_data(
            FeedbackPedidoCalculo, FeedbackPedidoCalculo.criado_em, ids_excluir, data_inicio, data_fim
        )

    def feedbacks_recentes_prest(self, ids_excluir, data_inicio, data_fim):
        """Feedbacks recentes de prestacao de contas por data."""
        return self._feedbacks_recentes_por_data(
            FeedbackPrestacao, FeedbackPrestacao.criado_em, ids_excluir, data_inicio, data_fim
        )

    def feedbacks_recentes_rc(self, ids_excluir, data_inicio, data_fim):
        """Feedbacks recentes de relatorio de cumprimento por data."""
        return self._feedbacks_recentes_por_data(
            FeedbackRelatorioCumprimento, FeedbackRelatorioCumprimento.criado_em,
            ids_excluir, data_inicio, data_fim
        )

    # =============================================
    # Dashboard: feedbacks por usuario
    # =============================================

    def _feedbacks_por_usuario(
        self,
        modelo_feedback,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
    ) -> list:
        """Conta feedbacks por usuario para um modelo especifico."""
        query = self.db.query(
            User.username,
            User.full_name,
            func.count(modelo_feedback.id).label('total'),
            func.sum(case((modelo_feedback.avaliacao == 'correto', 1), else_=0)).label('corretos')
        ).join(modelo_feedback, modelo_feedback.usuario_id == User.id)
        if ids_excluir:
            query = query.filter(~User.id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                modelo_feedback.criado_em >= data_inicio,
                modelo_feedback.criado_em < data_fim
            )
        return query.group_by(User.id, User.username, User.full_name).all()

    def feedbacks_por_usuario_aj(self, ids_excluir, data_inicio=None, data_fim=None):
        """Feedbacks por usuario de assistencia judiciaria."""
        return self._feedbacks_por_usuario(FeedbackAnalise, ids_excluir, data_inicio, data_fim)

    def feedbacks_por_usuario_mat(self, ids_excluir, data_inicio=None, data_fim=None):
        """Feedbacks por usuario de matriculas."""
        return self._feedbacks_por_usuario(FeedbackMatricula, ids_excluir, data_inicio, data_fim)

    def feedbacks_por_usuario_gp(self, ids_excluir, data_inicio=None, data_fim=None):
        """Feedbacks por usuario de gerador de pecas."""
        return self._feedbacks_por_usuario(FeedbackPeca, ids_excluir, data_inicio, data_fim)

    def feedbacks_por_usuario_pc(self, ids_excluir, data_inicio=None, data_fim=None):
        """Feedbacks por usuario de pedido de calculo."""
        return self._feedbacks_por_usuario(FeedbackPedidoCalculo, ids_excluir, data_inicio, data_fim)

    def feedbacks_por_usuario_prest(self, ids_excluir, data_inicio=None, data_fim=None):
        """Feedbacks por usuario de prestacao de contas."""
        return self._feedbacks_por_usuario(FeedbackPrestacao, ids_excluir, data_inicio, data_fim)

    def feedbacks_por_usuario_rc(self, ids_excluir, data_inicio=None, data_fim=None):
        """Feedbacks por usuario de relatorio de cumprimento."""
        return self._feedbacks_por_usuario(FeedbackRelatorioCumprimento, ids_excluir, data_inicio, data_fim)

    # =============================================
    # Dashboard: pendentes (sem feedback)
    # =============================================

    def pendentes_aj(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        limit: int = 20,
    ) -> list:
        """Consultas de AJ sem feedback."""
        query = self.db.query(
            ConsultaProcesso.id,
            ConsultaProcesso.cnj_formatado,
            ConsultaProcesso.cnj,
            ConsultaProcesso.consultado_em,
            User.username,
            User.full_name
        ).outerjoin(
            FeedbackAnalise, FeedbackAnalise.consulta_id == ConsultaProcesso.id
        ).join(
            User, ConsultaProcesso.usuario_id == User.id
        ).filter(
            FeedbackAnalise.id == None,
            ConsultaProcesso.relatorio.isnot(None)
        )
        if ids_excluir:
            query = query.filter(~ConsultaProcesso.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                ConsultaProcesso.consultado_em >= data_inicio,
                ConsultaProcesso.consultado_em < data_fim
            )
        return query.order_by(ConsultaProcesso.consultado_em.desc()).limit(limit).all()

    def pendentes_mat(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        limit: int = 20,
    ) -> list:
        """Analises de matriculas sem feedback."""
        query = self.db.query(
            Analise.id,
            Analise.file_name,
            Analise.matricula_principal,
            Analise.analisado_em,
            User.username,
            User.full_name
        ).outerjoin(
            FeedbackMatricula, FeedbackMatricula.analise_id == Analise.id
        ).join(
            User, Analise.usuario_id == User.id
        ).filter(
            FeedbackMatricula.id == None,
            Analise.resultado_json.isnot(None)
        )
        if ids_excluir:
            query = query.filter(~Analise.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                Analise.analisado_em >= data_inicio,
                Analise.analisado_em < data_fim
            )
        return query.order_by(Analise.analisado_em.desc()).limit(limit).all()

    def pendentes_gp(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        limit: int = 20,
    ) -> list:
        """Geracoes de pecas sem feedback (com modo_ativacao via SQL raw)."""
        try:
            sql = """
                SELECT gp.id, gp.tipo_peca, gp.numero_cnj, gp.criado_em,
                       u.username, u.full_name, gp.modo_ativacao_agente2
                FROM geracoes_pecas gp
                LEFT JOIN feedbacks_pecas fp ON fp.geracao_id = gp.id
                JOIN users u ON gp.usuario_id = u.id
                WHERE fp.id IS NULL
                  AND gp.conteudo_gerado IS NOT NULL
            """
            params: dict[str, Any] = {}
            if ids_excluir:
                sql += " AND gp.usuario_id NOT IN :ids_excluir"
                params["ids_excluir"] = tuple(ids_excluir)
            if data_inicio and data_fim:
                sql += " AND gp.criado_em >= :data_inicio AND gp.criado_em < :data_fim"
                params["data_inicio"] = data_inicio
                params["data_fim"] = data_fim
            sql += " ORDER BY gp.criado_em DESC LIMIT :limit"
            params["limit"] = limit

            result = self.db.execute(sql_text(sql), params).fetchall()
            return [(r[0], r[1], r[2], r[3], r[4], r[5], r[6]) for r in result]
        except Exception:
            # Fallback: query sem modo_ativacao_agente2
            query = self.db.query(
                GeracaoPeca.id,
                GeracaoPeca.tipo_peca,
                GeracaoPeca.numero_cnj,
                GeracaoPeca.criado_em,
                User.username,
                User.full_name
            ).outerjoin(
                FeedbackPeca, FeedbackPeca.geracao_id == GeracaoPeca.id
            ).join(
                User, GeracaoPeca.usuario_id == User.id
            ).filter(
                FeedbackPeca.id == None,
                GeracaoPeca.conteudo_gerado.isnot(None)
            )
            if ids_excluir:
                query = query.filter(~GeracaoPeca.usuario_id.in_(ids_excluir))
            if data_inicio and data_fim:
                query = query.filter(
                    GeracaoPeca.criado_em >= data_inicio,
                    GeracaoPeca.criado_em < data_fim
                )
            result = query.order_by(GeracaoPeca.criado_em.desc()).limit(limit).all()
            return [(r[0], r[1], r[2], r[3], r[4], r[5], None) for r in result]

    def pendentes_pc(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        limit: int = 20,
    ) -> list:
        """Geracoes de pedido de calculo sem feedback."""
        query = self.db.query(
            GeracaoPedidoCalculo.id,
            GeracaoPedidoCalculo.numero_cnj_formatado,
            GeracaoPedidoCalculo.numero_cnj,
            GeracaoPedidoCalculo.criado_em,
            User.username,
            User.full_name
        ).outerjoin(
            FeedbackPedidoCalculo, FeedbackPedidoCalculo.geracao_id == GeracaoPedidoCalculo.id
        ).join(
            User, GeracaoPedidoCalculo.usuario_id == User.id
        ).filter(
            FeedbackPedidoCalculo.id == None,
            GeracaoPedidoCalculo.conteudo_gerado.isnot(None)
        )
        if ids_excluir:
            query = query.filter(~GeracaoPedidoCalculo.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                GeracaoPedidoCalculo.criado_em >= data_inicio,
                GeracaoPedidoCalculo.criado_em < data_fim
            )
        return query.order_by(GeracaoPedidoCalculo.criado_em.desc()).limit(limit).all()

    def pendentes_prest(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        limit: int = 20,
    ) -> list:
        """Geracoes de prestacao de contas sem feedback."""
        query = self.db.query(
            GeracaoAnalise.id,
            GeracaoAnalise.numero_cnj_formatado,
            GeracaoAnalise.numero_cnj,
            GeracaoAnalise.criado_em,
            User.username,
            User.full_name
        ).outerjoin(
            FeedbackPrestacao, FeedbackPrestacao.geracao_id == GeracaoAnalise.id
        ).join(
            User, GeracaoAnalise.usuario_id == User.id
        ).filter(
            FeedbackPrestacao.id == None,
            GeracaoAnalise.fundamentacao.isnot(None)
        )
        if ids_excluir:
            query = query.filter(~GeracaoAnalise.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                GeracaoAnalise.criado_em >= data_inicio,
                GeracaoAnalise.criado_em < data_fim
            )
        return query.order_by(GeracaoAnalise.criado_em.desc()).limit(limit).all()

    def pendentes_rc(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        limit: int = 20,
    ) -> list:
        """Geracoes de relatorio de cumprimento sem feedback."""
        query = self.db.query(
            GeracaoRelatorioCumprimento.id,
            GeracaoRelatorioCumprimento.numero_cumprimento_formatado,
            GeracaoRelatorioCumprimento.numero_cumprimento,
            GeracaoRelatorioCumprimento.criado_em,
            User.username,
            User.full_name
        ).outerjoin(
            FeedbackRelatorioCumprimento,
            FeedbackRelatorioCumprimento.geracao_id == GeracaoRelatorioCumprimento.id
        ).join(
            User, GeracaoRelatorioCumprimento.usuario_id == User.id
        ).filter(
            FeedbackRelatorioCumprimento.id == None,
            GeracaoRelatorioCumprimento.conteudo_gerado.isnot(None),
            GeracaoRelatorioCumprimento.status == 'concluido'
        )
        if ids_excluir:
            query = query.filter(~GeracaoRelatorioCumprimento.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                GeracaoRelatorioCumprimento.criado_em >= data_inicio,
                GeracaoRelatorioCumprimento.criado_em < data_fim
            )
        return query.order_by(GeracaoRelatorioCumprimento.criado_em.desc()).limit(limit).all()

    # =============================================
    # Dashboard: evolucao semanal
    # =============================================

    def evolucao_semanal(
        self,
        modelo_feedback,
        ids_excluir: list[int],
        data_inicio: datetime,
        data_fim: datetime,
    ) -> list:
        """Calcula taxa de acerto por semana para um modelo de feedback."""
        query = self.db.query(
            extract('isoyear', modelo_feedback.criado_em).label('ano'),
            extract('week', modelo_feedback.criado_em).label('semana'),
            func.count(modelo_feedback.id).label('total'),
            func.sum(case((modelo_feedback.avaliacao == 'correto', 1), else_=0)).label('corretos'),
            func.sum(case((modelo_feedback.avaliacao == 'parcial', 1), else_=0)).label('parciais'),
            func.sum(case((modelo_feedback.avaliacao == 'incorreto', 1), else_=0)).label('incorretos')
        ).filter(
            modelo_feedback.criado_em >= data_inicio,
            modelo_feedback.criado_em <= data_fim
        )
        if ids_excluir:
            query = query.filter(~modelo_feedback.usuario_id.in_(ids_excluir))
        return query.group_by(
            extract('isoyear', modelo_feedback.criado_em),
            extract('week', modelo_feedback.criado_em)
        ).order_by(
            extract('isoyear', modelo_feedback.criado_em),
            extract('week', modelo_feedback.criado_em)
        ).all()

    # =============================================
    # Listagem: feedbacks com detalhes (por sistema)
    # =============================================

    def listar_feedbacks_aj(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        avaliacao: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> list:
        """Lista feedbacks de assistencia judiciaria com dados de consulta e usuario."""
        query = self.db.query(
            FeedbackAnalise,
            ConsultaProcesso.cnj_formatado,
            ConsultaProcesso.cnj,
            ConsultaProcesso.modelo_usado,
            User.username,
            User.full_name
        ).join(
            ConsultaProcesso, FeedbackAnalise.consulta_id == ConsultaProcesso.id
        ).join(
            User, FeedbackAnalise.usuario_id == User.id
        )
        if ids_excluir:
            query = query.filter(~FeedbackAnalise.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackAnalise.criado_em >= data_inicio,
                FeedbackAnalise.criado_em < data_fim
            )
        if avaliacao:
            query = query.filter(FeedbackAnalise.avaliacao == avaliacao)
        if usuario_id:
            query = query.filter(FeedbackAnalise.usuario_id == usuario_id)
        return query.all()

    def listar_feedbacks_mat(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        avaliacao: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> list:
        """Lista feedbacks de matriculas com dados de analise e usuario."""
        query = self.db.query(
            FeedbackMatricula,
            Analise.file_name,
            Analise.matricula_principal,
            Analise.modelo_usado,
            User.username,
            User.full_name
        ).join(
            Analise, FeedbackMatricula.analise_id == Analise.id
        ).join(
            User, FeedbackMatricula.usuario_id == User.id
        )
        if ids_excluir:
            query = query.filter(~FeedbackMatricula.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackMatricula.criado_em >= data_inicio,
                FeedbackMatricula.criado_em < data_fim
            )
        if avaliacao:
            query = query.filter(FeedbackMatricula.avaliacao == avaliacao)
        if usuario_id:
            query = query.filter(FeedbackMatricula.usuario_id == usuario_id)
        return query.all()

    def listar_feedbacks_gp(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        avaliacao: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> list:
        """Lista feedbacks de gerador de pecas com dados de geracao e usuario."""
        query = self.db.query(
            FeedbackPeca,
            GeracaoPeca.tipo_peca,
            GeracaoPeca.numero_cnj,
            GeracaoPeca.modelo_usado,
            GeracaoPeca.id.label('geracao_id_ref'),
            User.username,
            User.full_name
        ).join(
            GeracaoPeca, FeedbackPeca.geracao_id == GeracaoPeca.id
        ).join(
            User, FeedbackPeca.usuario_id == User.id
        )
        if ids_excluir:
            query = query.filter(~FeedbackPeca.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackPeca.criado_em >= data_inicio,
                FeedbackPeca.criado_em < data_fim
            )
        if avaliacao:
            query = query.filter(FeedbackPeca.avaliacao == avaliacao)
        if usuario_id:
            query = query.filter(FeedbackPeca.usuario_id == usuario_id)
        return query.all()

    def listar_feedbacks_pc(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        avaliacao: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> list:
        """Lista feedbacks de pedido de calculo com dados de geracao e usuario."""
        query = self.db.query(
            FeedbackPedidoCalculo,
            GeracaoPedidoCalculo.numero_cnj_formatado,
            GeracaoPedidoCalculo.numero_cnj,
            GeracaoPedidoCalculo.modelo_usado,
            User.username,
            User.full_name
        ).join(
            GeracaoPedidoCalculo, FeedbackPedidoCalculo.geracao_id == GeracaoPedidoCalculo.id
        ).join(
            User, FeedbackPedidoCalculo.usuario_id == User.id
        )
        if ids_excluir:
            query = query.filter(~FeedbackPedidoCalculo.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackPedidoCalculo.criado_em >= data_inicio,
                FeedbackPedidoCalculo.criado_em < data_fim
            )
        if avaliacao:
            query = query.filter(FeedbackPedidoCalculo.avaliacao == avaliacao)
        if usuario_id:
            query = query.filter(FeedbackPedidoCalculo.usuario_id == usuario_id)
        return query.all()

    def listar_feedbacks_prest(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        avaliacao: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> list:
        """Lista feedbacks de prestacao de contas com dados de geracao e usuario."""
        query = self.db.query(
            FeedbackPrestacao,
            GeracaoAnalise.numero_cnj_formatado,
            GeracaoAnalise.numero_cnj,
            GeracaoAnalise.modelo_usado,
            User.username,
            User.full_name
        ).join(
            GeracaoAnalise, FeedbackPrestacao.geracao_id == GeracaoAnalise.id
        ).join(
            User, FeedbackPrestacao.usuario_id == User.id
        )
        if ids_excluir:
            query = query.filter(~FeedbackPrestacao.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackPrestacao.criado_em >= data_inicio,
                FeedbackPrestacao.criado_em < data_fim
            )
        if avaliacao:
            query = query.filter(FeedbackPrestacao.avaliacao == avaliacao)
        if usuario_id:
            query = query.filter(FeedbackPrestacao.usuario_id == usuario_id)
        return query.all()

    def listar_feedbacks_rc(
        self,
        ids_excluir: list[int],
        data_inicio: Optional[datetime] = None,
        data_fim: Optional[datetime] = None,
        avaliacao: Optional[str] = None,
        usuario_id: Optional[int] = None,
    ) -> list:
        """Lista feedbacks de relatorio de cumprimento com dados de geracao e usuario."""
        query = self.db.query(
            FeedbackRelatorioCumprimento,
            GeracaoRelatorioCumprimento.numero_cumprimento_formatado,
            GeracaoRelatorioCumprimento.numero_cumprimento,
            GeracaoRelatorioCumprimento.modelo_usado,
            User.username,
            User.full_name
        ).join(
            GeracaoRelatorioCumprimento,
            FeedbackRelatorioCumprimento.geracao_id == GeracaoRelatorioCumprimento.id
        ).join(
            User, FeedbackRelatorioCumprimento.usuario_id == User.id
        )
        if ids_excluir:
            query = query.filter(~FeedbackRelatorioCumprimento.usuario_id.in_(ids_excluir))
        if data_inicio and data_fim:
            query = query.filter(
                FeedbackRelatorioCumprimento.criado_em >= data_inicio,
                FeedbackRelatorioCumprimento.criado_em < data_fim
            )
        if avaliacao:
            query = query.filter(FeedbackRelatorioCumprimento.avaliacao == avaliacao)
        if usuario_id:
            query = query.filter(FeedbackRelatorioCumprimento.usuario_id == usuario_id)
        return query.all()

    # =============================================
    # Listagem: buscar config modelo matriculas
    # =============================================

    def get_modelo_matriculas_default(self) -> str:
        """Busca modelo padrao para matriculas a partir da configuracao."""
        config = self.db.query(ConfiguracaoIA).filter(
            ConfiguracaoIA.sistema == "matriculas",
            ConfiguracaoIA.chave == "modelo_relatorio"
        ).first()
        return config.valor if config else "gemini-3-flash-preview"

    # =============================================
    # Listagem: curadoria metadata via SQL raw
    # =============================================

    def get_curadoria_metadata_gp(self, geracao_id: int) -> tuple:
        """Busca dados de curadoria de uma geracao de peca via SQL raw (colunas podem nao existir)."""
        try:
            result = self.db.execute(sql_text("""
                SELECT modo_ativacao_agente2, modulos_ativados_det, modulos_ativados_llm, curadoria_metadata
                FROM geracoes_pecas WHERE id = :id
            """), {"id": geracao_id}).fetchone()
            if result:
                return result[0], result[1], result[2], result[3]
        except Exception:
            pass
        return None, None, None, None

    # =============================================
    # Detalhes: consultas por sistema
    # =============================================

    def detalhe_consulta_aj(self, consulta_id: int):
        """Busca detalhes de uma consulta de AJ com usuario."""
        return self.db.query(
            ConsultaProcesso,
            User.username,
            User.full_name
        ).join(
            User, ConsultaProcesso.usuario_id == User.id
        ).filter(
            ConsultaProcesso.id == consulta_id
        ).first()

    def detalhe_feedback_aj(self, consulta_id: int):
        """Busca feedback de uma consulta de AJ."""
        return self.db.query(FeedbackAnalise).filter(
            FeedbackAnalise.consulta_id == consulta_id
        ).first()

    def detalhe_analise_mat(self, consulta_id: int):
        """Busca detalhes de uma analise de matriculas com usuario."""
        return self.db.query(
            Analise,
            User.username,
            User.full_name
        ).join(
            User, Analise.usuario_id == User.id
        ).filter(
            Analise.id == consulta_id
        ).first()

    def detalhe_feedback_mat(self, consulta_id: int):
        """Busca feedback de uma analise de matriculas."""
        return self.db.query(FeedbackMatricula).filter(
            FeedbackMatricula.analise_id == consulta_id
        ).first()

    def detalhe_geracao_gp(self, consulta_id: int):
        """Busca detalhes de uma geracao de peca com usuario (colunas seguras)."""
        return self.db.query(
            GeracaoPeca.id,
            GeracaoPeca.numero_cnj,
            GeracaoPeca.numero_cnj_formatado,
            GeracaoPeca.tipo_peca,
            GeracaoPeca.dados_processo,
            GeracaoPeca.conteudo_gerado,
            GeracaoPeca.prompt_enviado,
            GeracaoPeca.resumo_consolidado,
            GeracaoPeca.historico_chat,
            GeracaoPeca.modelo_usado,
            GeracaoPeca.tempo_processamento,
            GeracaoPeca.criado_em,
            User.username,
            User.full_name
        ).join(
            User, GeracaoPeca.usuario_id == User.id
        ).filter(
            GeracaoPeca.id == consulta_id
        ).first()

    def detalhe_feedback_gp(self, consulta_id: int):
        """Busca feedback de uma geracao de peca."""
        return self.db.query(FeedbackPeca).filter(
            FeedbackPeca.geracao_id == consulta_id
        ).first()

    def detalhe_versoes_gp(self, consulta_id: int):
        """Busca versoes de uma geracao de peca."""
        return self.db.query(VersaoPeca).filter(
            VersaoPeca.geracao_id == consulta_id
        ).order_by(VersaoPeca.numero_versao).all()

    def detalhe_geracao_pc(self, consulta_id: int):
        """Busca detalhes de uma geracao de pedido de calculo com usuario."""
        return self.db.query(
            GeracaoPedidoCalculo,
            User.username,
            User.full_name
        ).join(
            User, GeracaoPedidoCalculo.usuario_id == User.id
        ).filter(
            GeracaoPedidoCalculo.id == consulta_id
        ).first()

    def detalhe_feedback_pc(self, consulta_id: int):
        """Busca feedback de uma geracao de pedido de calculo."""
        return self.db.query(FeedbackPedidoCalculo).filter(
            FeedbackPedidoCalculo.geracao_id == consulta_id
        ).first()

    def detalhe_geracao_prest(self, consulta_id: int):
        """Busca detalhes de uma geracao de prestacao de contas com usuario."""
        return self.db.query(
            GeracaoAnalise,
            User.username,
            User.full_name
        ).join(
            User, GeracaoAnalise.usuario_id == User.id
        ).filter(
            GeracaoAnalise.id == consulta_id
        ).first()

    def detalhe_feedback_prest(self, consulta_id: int):
        """Busca feedback de uma geracao de prestacao de contas."""
        return self.db.query(FeedbackPrestacao).filter(
            FeedbackPrestacao.geracao_id == consulta_id
        ).first()

    def detalhe_geracao_rc(self, consulta_id: int):
        """Busca detalhes de uma geracao de relatorio de cumprimento com usuario."""
        return self.db.query(
            GeracaoRelatorioCumprimento,
            User.username,
            User.full_name
        ).join(
            User, GeracaoRelatorioCumprimento.usuario_id == User.id
        ).filter(
            GeracaoRelatorioCumprimento.id == consulta_id
        ).first()

    def detalhe_feedback_rc(self, consulta_id: int):
        """Busca feedback de uma geracao de relatorio de cumprimento."""
        return self.db.query(FeedbackRelatorioCumprimento).filter(
            FeedbackRelatorioCumprimento.geracao_id == consulta_id
        ).first()

    # =============================================
    # Exportar: feedbacks por sistema
    # =============================================

    def exportar_feedbacks_aj(self) -> list:
        """Exporta feedbacks de assistencia judiciaria."""
        return self.db.query(
            FeedbackAnalise,
            ConsultaProcesso.cnj_formatado,
            ConsultaProcesso.cnj,
            User.username,
            User.full_name
        ).join(
            ConsultaProcesso, FeedbackAnalise.consulta_id == ConsultaProcesso.id
        ).join(
            User, FeedbackAnalise.usuario_id == User.id
        ).order_by(
            FeedbackAnalise.criado_em.desc()
        ).all()

    def exportar_feedbacks_mat(self) -> list:
        """Exporta feedbacks de matriculas."""
        return self.db.query(
            FeedbackMatricula,
            Analise.file_name,
            Analise.matricula_principal,
            User.username,
            User.full_name
        ).join(
            Analise, FeedbackMatricula.analise_id == Analise.id
        ).join(
            User, FeedbackMatricula.usuario_id == User.id
        ).order_by(
            FeedbackMatricula.criado_em.desc()
        ).all()

    def exportar_feedbacks_gp(self) -> list:
        """Exporta feedbacks de gerador de pecas."""
        return self.db.query(
            FeedbackPeca,
            GeracaoPeca.numero_cnj,
            GeracaoPeca.tipo_peca,
            User.username,
            User.full_name
        ).join(
            GeracaoPeca, FeedbackPeca.geracao_id == GeracaoPeca.id
        ).join(
            User, FeedbackPeca.usuario_id == User.id
        ).order_by(
            FeedbackPeca.criado_em.desc()
        ).all()

    def exportar_feedbacks_pc(self) -> list:
        """Exporta feedbacks de pedido de calculo."""
        return self.db.query(
            FeedbackPedidoCalculo,
            GeracaoPedidoCalculo.numero_cnj_formatado,
            GeracaoPedidoCalculo.numero_cnj,
            User.username,
            User.full_name
        ).join(
            GeracaoPedidoCalculo, FeedbackPedidoCalculo.geracao_id == GeracaoPedidoCalculo.id
        ).join(
            User, FeedbackPedidoCalculo.usuario_id == User.id
        ).order_by(
            FeedbackPedidoCalculo.criado_em.desc()
        ).all()


# ============================================
# Depends factories
# ============================================


def get_config_repo(
    db: Session = Depends(get_db),
) -> ConfiguracaoIARepository:
    """Factory para injecao do repositorio de configuracoes."""
    return ConfiguracaoIARepository(db)


def get_prompt_config_repo(
    db: Session = Depends(get_db),
) -> PromptConfigRepository:
    """Factory para injecao do repositorio de prompts."""
    return PromptConfigRepository(db)


def get_prompt_modulo_repo(
    db: Session = Depends(get_db),
) -> PromptModuloRepository:
    """Factory para injecao do repositorio de modulos de prompts."""
    return PromptModuloRepository(db)


def get_prompt_modulo_historico_repo(
    db: Session = Depends(get_db),
) -> PromptModuloHistoricoRepository:
    """Factory para injecao do repositorio de historico de modulos."""
    return PromptModuloHistoricoRepository(db)


def get_prompt_group_repo(
    db: Session = Depends(get_db),
) -> PromptGroupRepository:
    """Factory para injecao do repositorio de grupos de prompts."""
    return PromptGroupRepository(db)


def get_prompt_subgroup_repo(
    db: Session = Depends(get_db),
) -> PromptSubgroupRepository:
    """Factory para injecao do repositorio de subgrupos de prompts."""
    return PromptSubgroupRepository(db)


def get_prompt_subcategoria_repo(
    db: Session = Depends(get_db),
) -> PromptSubcategoriaRepository:
    """Factory para injecao do repositorio de subcategorias de prompts."""
    return PromptSubcategoriaRepository(db)


def get_modulo_tipo_peca_repo(
    db: Session = Depends(get_db),
) -> ModuloTipoPecaRepository:
    """Factory para injecao do repositorio de associacoes modulo-tipo-peca."""
    return ModuloTipoPecaRepository(db)


def get_regra_tipo_peca_repo(
    db: Session = Depends(get_db),
) -> RegraDeterministicaTipoPecaRepository:
    """Factory para injecao do repositorio de regras deterministicas."""
    return RegraDeterministicaTipoPecaRepository(db)


def get_categoria_ordem_repo(
    db: Session = Depends(get_db),
) -> CategoriaOrdemRepository:
    """Factory para injecao do repositorio de ordem de categorias."""
    return CategoriaOrdemRepository(db)


def get_feedback_repo(
    db: Session = Depends(get_db),
) -> FeedbackRepository:
    """Factory para injecao do repositorio de feedbacks consolidados."""
    return FeedbackRepository(db)
