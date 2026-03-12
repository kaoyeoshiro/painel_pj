# sistemas/gerador_pecas/schemas_arvore.py
"""DTOs para o endpoint de árvore de decisão."""

from typing import Literal
from pydantic import BaseModel


class SwimlaneDTO(BaseModel):
    """Raia agrupadora por categoria de módulo."""
    id: str
    label: str
    modulos_count: int
    variaveis_count: int
    pct_deterministico: float


class ModuloDTO(BaseModel):
    """Módulo de prompt com sua regra de ativação."""
    id: int
    titulo: str
    categoria: str
    modo_ativacao: Literal["deterministic", "llm"]
    regra: dict | None
    regra_secundaria: dict | None = None
    fallback_habilitado: bool
    variaveis_usadas: list[str]
    tipos_peca: list[str]
    regras_tipo_peca: dict[str, dict] = {}


class VariavelDTO(BaseModel):
    """Variável de extração ou processo com metadata."""
    slug: str
    label: str
    tipo: str
    fonte: Literal["extraction", "process"]
    pergunta: str | None
    is_orfa: bool
    modulos_ids: list[int]
    depends_on: str | None = None
    dependency_operator: str | None = None
    dependency_value: str | None = None


class StatsDTO(BaseModel):
    """Estatísticas agregadas do grafo."""
    total_modulos: int
    total_variaveis: int
    total_orfas: int
    total_vinculos: int


class ArvoreDecisaoResponse(BaseModel):
    """Resposta completa do endpoint de árvore de decisão."""
    swimlanes: list[SwimlaneDTO]
    modulos: list[ModuloDTO]
    variaveis: list[VariavelDTO]
    stats: StatsDTO
