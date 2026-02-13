# sistemas/pedido_calculo/schemas.py
"""
Schemas Pydantic do sistema de Pedido de Cálculo.

Contém todos os modelos de request/response usados nos routers
(router.py e router_admin.py).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, model_validator

from utils.feedback_helpers import validate_feedback_fields


# ============================================
# Request Models (router.py)
# ============================================

class ProcessarXMLRequest(BaseModel):
    """Request para processar XML do processo"""
    xml_texto: str


class BaixarDocumentosRequest(BaseModel):
    """Request para baixar documentos"""
    numero_processo: str
    ids_sentencas: List[str] = []
    ids_acordaos: List[str] = []
    ids_certidoes: List[str] = []
    ids_cumprimento: List[str] = []


class ExtrairInformacoesRequest(BaseModel):
    """Request para extrair informações dos documentos"""
    textos_documentos: Dict[str, str]


class GerarPedidoRequest(BaseModel):
    """Request para gerar pedido de cálculo"""
    dados_agente1: Dict
    dados_agente2: Dict


class ProcessarStreamRequest(BaseModel):
    """Request para processar via stream"""
    numero_cnj: str
    sobrescrever_existente: bool = False  # Se True, sobrescreve registro anterior do mesmo processo


class ExportarDocxRequest(BaseModel):
    """Request para exportar markdown para DOCX"""
    markdown: str
    numero_processo: Optional[str] = None


class FeedbackRequest(BaseModel):
    """Request para enviar feedback sobre o pedido gerado"""
    geracao_id: int
    nota: int = Field(..., ge=1, le=5, description="Nota de 1 a 5 estrelas")
    avaliacao: Optional[str] = None  # Derivado de nota (backward compat)
    comentario: Optional[str] = None
    campos_incorretos: Optional[list] = None

    @model_validator(mode="before")
    @classmethod
    def _validate(cls, values):
        return validate_feedback_fields(values)


class EditarPedidoRequest(BaseModel):
    """Request para editar pedido via chat"""
    pedido_markdown: str
    mensagem_usuario: str
    historico_chat: List[Dict] = []
    dados_basicos: Dict = {}
    dados_extracao: Dict = {}


class PromptConfigRequest(BaseModel):
    """Request para atualizar prompt"""
    conteudo: str
    descricao: Optional[str] = None


class ConfiguracaoRequest(BaseModel):
    """Request para atualizar configuração"""
    valor: str
    descricao: Optional[str] = None


# ============================================
# Response Models (router_admin.py)
# ============================================

class LogChamadaResponse(BaseModel):
    id: int
    etapa: str
    descricao: Optional[str]
    documento_id: Optional[str]
    prompt_enviado: Optional[str]
    documento_texto: Optional[str]
    resposta_ia: Optional[str]
    resposta_parseada: Optional[Dict[str, Any]]
    modelo_usado: Optional[str]
    tokens_entrada: Optional[int]
    tokens_saida: Optional[int]
    tempo_ms: Optional[int]
    sucesso: bool
    erro: Optional[str]
    criado_em: datetime

    class Config:
        from_attributes = True


class GeracaoDetalhadaResponse(BaseModel):
    id: int
    numero_cnj: str
    numero_cnj_formatado: Optional[str]
    dados_processo: Optional[Dict[str, Any]]
    dados_agente1: Optional[Dict[str, Any]]
    dados_agente2: Optional[Dict[str, Any]]
    documentos_baixados: Optional[List[Dict[str, Any]]]
    conteudo_gerado: Optional[str]
    modelo_usado: Optional[str]
    tempo_processamento: Optional[int]
    criado_em: datetime
    logs_ia: List[LogChamadaResponse] = []

    class Config:
        from_attributes = True


class GeracaoResumoResponse(BaseModel):
    id: int
    numero_cnj: str
    numero_cnj_formatado: Optional[str]
    modelo_usado: Optional[str]
    tempo_processamento: Optional[int]
    criado_em: datetime
    total_logs: int = 0
    tem_erro: bool = False

    class Config:
        from_attributes = True
