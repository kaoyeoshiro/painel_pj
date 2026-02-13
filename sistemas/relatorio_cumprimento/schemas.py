# sistemas/relatorio_cumprimento/schemas.py
"""
Schemas Pydantic do sistema de Relatório de Cumprimento de Sentença.

Contém todos os modelos de request usados no router.
"""

from typing import Optional

from pydantic import BaseModel, Field, model_validator

from utils.feedback_helpers import validate_feedback_fields


class ProcessarRequest(BaseModel):
    """Request para processar processo de cumprimento"""
    numero_cnj: str
    sobrescrever_existente: bool = False


class ExportarDocxRequest(BaseModel):
    """Request para exportar markdown para DOCX"""
    markdown: str
    numero_processo: Optional[str] = None


class EditarRelatorioRequest(BaseModel):
    """Request para editar relatório via chat"""
    geracao_id: int
    mensagem_usuario: str


class FeedbackRequest(BaseModel):
    """Request para enviar feedback sobre o relatório gerado"""
    geracao_id: int
    nota: int = Field(..., ge=1, le=5, description="Nota de 1 a 5 estrelas")
    avaliacao: Optional[str] = None  # Derivado de nota (backward compat)
    comentario: Optional[str] = None
    campos_incorretos: Optional[list] = None

    @model_validator(mode="before")
    @classmethod
    def _validate(cls, values):
        return validate_feedback_fields(values)
