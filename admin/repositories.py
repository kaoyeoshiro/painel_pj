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
from sqlalchemy import func, and_, case, extract, text as sql_text
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
