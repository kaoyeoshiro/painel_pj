# admin/schemas_gemini_logs.py
"""
Schemas Pydantic para API de logs de chamadas Gemini.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any


# ============================================
# Entrada de log individual
# ============================================

class LogEntry(BaseModel):
    id: int
    created_at: Optional[str]
    user_id: Optional[int]
    username: Optional[str]
    sistema: str
    modulo: Optional[str]
    model: str
    prompt_chars: int
    prompt_tokens_estimated: Optional[int]
    has_images: bool
    has_search: bool
    temperature: Optional[float]
    response_tokens: Optional[int]
    success: bool
    cached: bool
    error: Optional[str]
    time_prepare_ms: Optional[float]
    time_connect_ms: Optional[float]
    time_ttft_ms: Optional[float]
    time_generation_ms: Optional[float]
    time_total_ms: float
    retry_count: int


# ============================================
# Respostas de listagem e resumo
# ============================================

class LogsResponse(BaseModel):
    logs: List[Dict[str, Any]]
    total: int
    limit: int
    offset: int


class SummaryResponse(BaseModel):
    period_hours: int
    total_calls: int
    stats: Dict[str, Any]
    by_sistema: List[Dict[str, Any]]
    by_model: List[Dict[str, Any]]
    slowest_calls: List[Dict[str, Any]]
    recent_errors: List[Dict[str, Any]]


class SystemsResponse(BaseModel):
    systems: List[str]


class ModelsResponse(BaseModel):
    models: List[str]


class CleanupResponse(BaseModel):
    deleted_count: int
    message: str
