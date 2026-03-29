"""Modelos SQLAlchemy para o Sistema de Revisao de Pecas.

Tabelas:
- itens_revisao: Fila de processos aguardando revisao humana
- revisao_chat_historico: Historico de chat por item (colaboracao assessor/revisor)
- assessores_disponiveis: Assessores habilitados para receber encaminhamentos
"""
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey,
    JSON, Boolean, Index
)
from sqlalchemy.orm import relationship

from database.connection import Base
from utils.timezone import get_utc_now


class ItemRevisao(Base):
    __tablename__ = "itens_revisao"

    id = Column(Integer, primary_key=True, index=True)
    numero_cnj = Column(String(25), nullable=False, index=True)
    source_session = Column(String(100), nullable=False)
    categoria = Column(String(50), nullable=False)
    resultado = Column(String(30), nullable=False)
    acao_sugerida = Column(String(50), nullable=False)
    tipo_peca = Column(String(50), nullable=True)
    conteudo_peca = Column(Text, nullable=True)
    resumo_revisor = Column(Text, nullable=False)
    classificacao_data = Column(JSON, nullable=True)
    status = Column(String(20), nullable=False, default="pendente", index=True)
    obs_status = Column(String(30), nullable=False, default="nao_aplicavel")
    conteudo_editado = Column(Text, nullable=True)
    observacao_pge = Column(Text, nullable=True)
    cdpendencia = Column(Integer, nullable=True)
    motivo_rejeicao = Column(Text, nullable=True)
    acao_corrigida = Column(String(50), nullable=True)
    usuario_revisor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    usuario_encaminhado_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)
    revisado_em = Column(DateTime(timezone=True), nullable=True)
    concluido_em = Column(DateTime(timezone=True), nullable=True)

    usuario_revisor = relationship("User", foreign_keys=[usuario_revisor_id])
    usuario_encaminhado = relationship("User", foreign_keys=[usuario_encaminhado_id])
    chat_historico = relationship(
        "RevisaoChatHistorico", back_populates="item_revisao",
        cascade="all, delete-orphan", order_by="RevisaoChatHistorico.criado_em"
    )

    __table_args__ = (
        Index("ix_itens_revisao_status_criado", "status", "criado_em"),
    )

    def __repr__(self):
        return f"<ItemRevisao(id={self.id}, cnj='{self.numero_cnj}', status='{self.status}')>"


class RevisaoChatHistorico(Base):
    __tablename__ = "revisao_chat_historico"

    id = Column(Integer, primary_key=True, index=True)
    item_revisao_id = Column(Integer, ForeignKey("itens_revisao.id"), nullable=False, index=True)
    role = Column(String(10), nullable=False)
    conteudo = Column(Text, nullable=False)
    conteudo_peca_snapshot = Column(Text, nullable=True)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)

    item_revisao = relationship("ItemRevisao", back_populates="chat_historico")

    def __repr__(self):
        return f"<RevisaoChatHistorico(id={self.id}, role='{self.role}')>"


class AssessorDisponivel(Base):
    __tablename__ = "assessores_disponiveis"

    id = Column(Integer, primary_key=True, index=True)
    usuario_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)
    ativo = Column(Boolean, default=True, nullable=False)
    criado_em = Column(DateTime(timezone=True), default=get_utc_now)

    usuario = relationship("User")

    def __repr__(self):
        return f"<AssessorDisponivel(id={self.id}, usuario_id={self.usuario_id}, ativo={self.ativo})>"
