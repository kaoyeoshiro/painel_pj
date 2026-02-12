# sistemas/assistencia_judiciaria/schemas.py
"""
Schemas Pydantic do sistema de Assistência Judiciária.

Contém todos os modelos de request usados no router.
"""

from pydantic import BaseModel
from typing import Optional

from sistemas.assistencia_judiciaria.core.logic import DEFAULT_MODEL


class ConsultationRequest(BaseModel):
    cnj: str
    model: str = DEFAULT_MODEL
    force: bool = False  # Forçar nova consulta mesmo se já existir cache


class FeedbackRequest(BaseModel):
    consulta_id: int
    avaliacao: str  # 'correto', 'parcial', 'incorreto', 'erro_ia'
    comentario: Optional[str] = None
    campos_incorretos: Optional[list] = None


class DocumentRequest(BaseModel):
    markdown_text: str
    cnj: str
    format: str  # 'docx' or 'pdf'


class SettingsRequest(BaseModel):
    openrouter_api_key: str = ""
    default_model: str = "google/gemini-3-flash-preview"
