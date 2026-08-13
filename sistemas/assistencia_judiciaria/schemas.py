# sistemas/assistencia_judiciaria/schemas.py
"""
Schemas Pydantic do sistema de Assistência Judiciária.

Contém todos os modelos de request usados no router.
"""

from pydantic import BaseModel, Field, model_validator
from typing import Optional

from sistemas.assistencia_judiciaria.core.logic import DEFAULT_MODEL
from utils.feedback_helpers import validate_feedback_fields


class ConsultationRequest(BaseModel):
    cnj: str
    model: str = DEFAULT_MODEL
    force: bool = False  # Forçar nova consulta mesmo se já existir cache


class FeedbackRequest(BaseModel):
    consulta_id: int
    nota: int = Field(..., ge=1, le=5, description="Nota de 1 a 5 estrelas")
    avaliacao: Optional[str] = None  # Derivado de nota (backward compat)
    comentario: Optional[str] = None
    campos_incorretos: Optional[list] = None

    @model_validator(mode="before")
    @classmethod
    def _validate(cls, values):
        return validate_feedback_fields(values)


class DocumentRequest(BaseModel):
    markdown_text: str
    cnj: str
    format: str  # 'docx' or 'pdf'


class SettingsRequest(BaseModel):
    openrouter_api_key: str = ""
    default_model: str = "google/gemini-3.6-flash"
