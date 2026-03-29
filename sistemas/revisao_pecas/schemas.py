# sistemas/revisao_pecas/schemas.py
"""Schemas Pydantic para o sistema de revisao de pecas."""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
from utils.sanitize import validate_no_html


class ClassificacaoData(BaseModel):
    acao_detalhada: str = ""
    fundamentacao: str = ""
    confianca: Literal["alta", "media", "baixa"] = "alta"
    urgencia: Literal["rotina", "prazo_correndo", "urgente"] = "rotina"
    documentos_necessarios: list[str] = Field(default_factory=list)


class IngerirItemRequest(BaseModel):
    numero_cnj: str = Field(..., min_length=20, max_length=25)
    source_session: str = Field(..., max_length=100)
    categoria: str = Field(..., max_length=50)
    resultado: str = Field(..., max_length=30)
    acao_sugerida: str = Field(..., max_length=50)
    tipo_peca: str | None = None
    conteudo_peca: str | None = None
    resumo_revisor: str = Field(..., min_length=10)
    classificacao_data: ClassificacaoData = Field(default_factory=ClassificacaoData)
    cdpendencia: int | None = None
    usuario_revisor_id: int | None = None

    @field_validator("resumo_revisor")
    @classmethod
    def sanitizar_resumo(cls, v: str) -> str:
        return validate_no_html(v, "resumo_revisor")


class IngerirLoteRequest(BaseModel):
    itens: list[IngerirItemRequest] = Field(..., min_length=1, max_length=500)


class ItemRevisaoResponse(BaseModel):
    id: int
    numero_cnj: str
    source_session: str
    categoria: str
    resultado: str
    acao_sugerida: str
    tipo_peca: str | None = None
    resumo_revisor: str
    classificacao_data: dict | None = None
    status: str
    obs_status: str
    conteudo_peca: str | None = None
    conteudo_editado: str | None = None
    observacao_pge: str | None = None
    motivo_rejeicao: str | None = None
    acao_corrigida: str | None = None
    cdpendencia: int | None = None
    usuario_revisor_id: int | None = None
    usuario_encaminhado_id: int | None = None
    revisor_nome: str | None = None
    encaminhado_nome: str | None = None
    criado_em: datetime
    revisado_em: datetime | None = None
    concluido_em: datetime | None = None

    class Config:
        from_attributes = True


class ItemRevisaoListResponse(BaseModel):
    itens: list[ItemRevisaoResponse]
    total: int
    pagina: int
    por_pagina: int


class EstatisticasResponse(BaseModel):
    total: int = 0
    pendentes: int = 0
    em_revisao: int = 0
    aprovados: int = 0
    encaminhados: int = 0
    rejeitados: int = 0
    concluidos: int = 0
    aguardando_insercao: int = 0


class AprovarRequest(BaseModel):
    conteudo_final: str | None = None
    observacao_pge: str | None = None


class RejeitarRequest(BaseModel):
    motivo_rejeicao: str = Field(..., min_length=5)
    acao_corrigida: str = Field(..., max_length=50)

    @field_validator("motivo_rejeicao")
    @classmethod
    def sanitizar_motivo(cls, v: str) -> str:
        return validate_no_html(v, "motivo_rejeicao")


class EncaminharRequest(BaseModel):
    assessor_id: int


class EncaminharLoteRequest(BaseModel):
    item_ids: list[int] = Field(..., min_length=1)
    assessor_ids: list[int] = Field(..., min_length=1)
    modo: Literal["manual", "aleatorio"] = "aleatorio"


class SalvarConteudoRequest(BaseModel):
    conteudo: str


class ChatMensagemRequest(BaseModel):
    mensagem: str = Field(..., min_length=1, max_length=2000)
    conteudo_atual: str = Field(..., min_length=1)


class ChatHistoricoResponse(BaseModel):
    id: int
    role: str
    conteudo: str
    conteudo_peca_snapshot: str | None = None
    criado_em: datetime

    class Config:
        from_attributes = True


class AssessorResponse(BaseModel):
    id: int
    usuario_id: int
    nome: str
    ativo: bool
    criado_em: datetime

    class Config:
        from_attributes = True


class AdicionarAssessorRequest(BaseModel):
    usuario_id: int


class AtivarDesativarRequest(BaseModel):
    ativo: bool


class ObservacaoPendenteResponse(BaseModel):
    item_id: int
    numero_cnj: str
    cdpendencia: int
    observacao_pge: str
    status: str

    class Config:
        from_attributes = True


class ConfirmarObservacaoRequest(BaseModel):
    sucesso: bool = True
    erro_mensagem: str | None = None
