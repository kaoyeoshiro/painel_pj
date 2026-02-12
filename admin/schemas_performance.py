# admin/schemas_performance.py
"""
Schemas Pydantic para API de performance (logs, mapeamento de rotas, metricas frontend).
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# ============================================
# Respostas de logs e resumo
# ============================================

class LogsResponse(BaseModel):
    logs: List[Dict[str, Any]]
    total: int
    limit: int
    offset: int


class SummaryResponse(BaseModel):
    period_hours: int
    total_logs: int
    bottleneck_summary: Dict[str, int]  # {LLM: 45, DB: 30, PARSE: 15, OUTRO: 10}
    avg_times: Dict[str, float]  # {total: 500, llm: 300, db: 100, parse: 50}
    slowest_by_bottleneck: Dict[str, List[Dict]]  # Top 3 por tipo
    recent_errors: List[Dict[str, Any]]


class CleanupResponse(BaseModel):
    deleted_count: int
    message: str


# ============================================
# Mapeamento rota -> sistema (RouteSystemMap)
# ============================================

class RouteMapCreate(BaseModel):
    route_pattern: str = Field(..., min_length=1, max_length=500)
    system_name: str = Field(..., min_length=1, max_length=100)
    match_type: str = Field(default='prefix', pattern='^(exact|prefix|regex)$')
    priority: int = Field(default=0, ge=0, le=1000)


class RouteMapUpdate(BaseModel):
    route_pattern: Optional[str] = Field(None, min_length=1, max_length=500)
    system_name: Optional[str] = Field(None, min_length=1, max_length=100)
    match_type: Optional[str] = Field(None, pattern='^(exact|prefix|regex)$')
    priority: Optional[int] = Field(None, ge=0, le=1000)


class RouteMapResponse(BaseModel):
    id: int
    route_pattern: str
    system_name: str
    match_type: str
    priority: int
    created_at: Optional[str]
    updated_at: Optional[str]


class TopRoutesResponse(BaseModel):
    routes: List[Dict[str, Any]]


# ============================================
# Metricas de frontend
# ============================================

class FrontendMetricsRequest(BaseModel):
    """Metricas de performance coletadas no frontend."""
    route: str = Field(..., description="Rota onde a acao foi realizada")
    action: str = Field(..., description="Acao realizada (ex: editar_categoria)")
    click_to_loading_ms: float = Field(..., description="Tempo do click ate loading aparecer")
    click_to_request_ms: float = Field(..., description="Tempo do click ate request iniciar")
    request_duration_ms: float = Field(..., description="Duracao da request")
    click_to_modal_ms: float = Field(..., description="Tempo total do click ate modal abrir")
    timestamp: Optional[str] = Field(None, description="Timestamp ISO do evento")
