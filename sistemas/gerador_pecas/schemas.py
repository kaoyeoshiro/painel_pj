# sistemas/gerador_pecas/schemas.py
"""
Schemas Pydantic do Gerador de Pecas.

Extraidos de router.py, router_config_pecas.py e router_admin.py
(Fase 2a do plano de refatoracao).
"""

from typing import Optional, List, Dict, Any
from datetime import datetime

from pydantic import BaseModel, Field, model_validator

from utils.feedback_helpers import validate_feedback_fields


# ============================================================================
# ROUTER.PY — PROCESSAMENTO E GERACAO
# ============================================================================

class ProcessarProcessoRequest(BaseModel):
    numero_cnj: str
    tipo_peca: Optional[str] = None
    resposta_usuario: Optional[str] = None
    observacao_usuario: Optional[str] = None  # Observacoes do usuario para incluir no prompt
    group_id: Optional[int] = None
    subcategoria_ids: Optional[List[int]] = None
    parecer_upload_id: Optional[str] = None
    parecer_user_choice_when_missing: Optional[str] = None  # "uploaded" | "continue_without"
    parecer_forced_to_semi_auto: Optional[bool] = False


class ExportarDocxRequest(BaseModel):
    """Request para exportar markdown para DOCX"""
    markdown: str  # Conteudo markdown da minuta
    numero_cnj: Optional[str] = None  # Numero do processo para nome do arquivo
    tipo_peca: Optional[str] = None  # Tipo da peca para nome do arquivo


class FeedbackRequest(BaseModel):
    geracao_id: int
    nota: int = Field(..., ge=1, le=5, description="Nota de 1 a 5 estrelas")
    avaliacao: Optional[str] = None  # Derivado de nota (backward compat)
    comentario: Optional[str] = None
    campos_incorretos: Optional[list] = None

    @model_validator(mode="before")
    @classmethod
    def _validate(cls, values):
        return validate_feedback_fields(values)


class EditarMinutaRequest(BaseModel):
    """Request para edicao de minuta via chat"""
    minuta_atual: str  # Markdown da minuta atual
    mensagem: str  # Pedido de alteracao do usuario
    historico: Optional[List[Dict]] = None  # Historico de mensagens anteriores
    tipo_peca: Optional[str] = None  # Tipo de peca atual (para busca de argumentos)


class BuscarArgumentosRequest(BaseModel):
    """Request para buscar argumentos na base de conhecimento"""
    query: str  # Texto de busca
    tipo_peca: Optional[str] = None  # Tipo de peca para filtrar regras especificas
    limit: int = 5  # Numero maximo de resultados


class SalvarMinutaRequest(BaseModel):
    """Request para salvar alteracoes na minuta"""
    minuta_markdown: str
    historico_chat: Optional[List[Dict]] = None


class SalvarMinutaComVersaoRequest(BaseModel):
    """Request para salvar alteracoes na minuta com suporte a versoes"""
    minuta_markdown: str
    historico_chat: Optional[List[Dict]] = None
    descricao_alteracao: Optional[str] = None  # Descricao da alteracao (mensagem do chat)


# ============================================================================
# ROUTER.PY — CURADORIA (MODO SEMI-AUTOMATICO)
# ============================================================================

class CurationPreviewRequest(BaseModel):
    """Request para preview de curadoria (Agentes 1+2)"""
    numero_cnj: str
    tipo_peca: str
    group_id: Optional[int] = None
    subcategoria_ids: Optional[List[int]] = None
    parecer_upload_id: Optional[str] = None
    parecer_user_choice_when_missing: Optional[str] = None  # "uploaded" | "continue_without"
    parecer_forced_to_semi_auto: Optional[bool] = False


class CurationSearchRequest(BaseModel):
    """Request para busca de argumentos adicionais"""
    query: str
    tipo_peca: Optional[str] = None
    modulos_excluir: Optional[List[int]] = None
    limit: int = 10
    metodo: str = "hibrido"  # "keyword", "vetorial" ou "hibrido"


class CurationGenerateRequest(BaseModel):
    """Request para gerar peca com modulos curados"""
    numero_cnj: str
    tipo_peca: str
    modulos_ids_curados: List[int]  # IDs dos modulos selecionados pelo usuario
    modulos_manuais_ids: Optional[List[int]] = None  # IDs dos modulos adicionados manualmente
    modulos_preview_ids: Optional[List[int]] = None  # IDs originais do preview (Agente 2)
    modulos_excluidos_ids: Optional[List[int]] = None  # IDs dos modulos excluidos pelo usuario
    modulos_ordem: Optional[Dict[str, List[int]]] = None  # Ordem de modulos por secao
    categorias_ordem: Optional[List[str]] = None  # Ordem das categorias/secoes
    preview_timestamp: Optional[str] = None  # Timestamp de quando o preview foi gerado
    observacao_usuario: Optional[str] = None
    group_id: Optional[int] = None
    subcategoria_ids: Optional[List[int]] = None
    # Dados do Agente 1 (para evitar reprocessamento)
    resumo_consolidado: Optional[str] = None
    dados_extracao: Optional[Dict] = None
    # Decision traces do preview (para auditoria causal)
    decision_traces: Optional[Dict] = None
    variaveis_snapshot: Optional[Dict] = None
    parecer_context: Optional[Dict[str, Any]] = None


# ============================================================================
# ROUTER_CONFIG_PECAS.PY — CONFIGURACAO DE PECAS
# ============================================================================

class CategoriaDocumentoBase(BaseModel):
    nome: str
    titulo: str
    descricao: Optional[str] = None
    codigos_documento: List[int] = []
    ativo: bool = True
    ordem: int = 0
    cor: Optional[str] = None
    is_primeiro_documento: bool = False  # Se True, pega so o primeiro documento cronologico


class CategoriaDocumentoResponse(CategoriaDocumentoBase):
    id: int
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None

    class Config:
        from_attributes = True


class TipoPecaBase(BaseModel):
    nome: str
    titulo: str
    descricao: Optional[str] = None
    icone: Optional[str] = None
    ativo: bool = True
    ordem: int = 0
    is_padrao: bool = False
    configuracoes: Optional[dict] = None


class TipoPecaCreate(TipoPecaBase):
    categorias_ids: List[int] = []


class TipoPecaResponse(TipoPecaBase):
    id: int
    criado_em: Optional[datetime] = None
    atualizado_em: Optional[datetime] = None
    categorias_documento: List[CategoriaDocumentoResponse] = []

    class Config:
        from_attributes = True


class AssociacaoCategoriasRequest(BaseModel):
    categorias_ids: List[int]


class ParecerNatjusAdminConfigUpdateRequest(BaseModel):
    parecer_required_for_piece_types: List[str] = []
    parecer_document_codes: List[int] = []


# ============================================================================
# ROUTER_ADMIN.PY — ADMINISTRACAO
# ============================================================================

class GeracaoDetalhadaResponse(BaseModel):
    id: int
    numero_cnj: str
    numero_cnj_formatado: Optional[str]
    tipo_peca: Optional[str]
    modelo_usado: Optional[str]
    tempo_processamento: Optional[int]
    prompt_enviado: Optional[str]
    resumo_consolidado: Optional[str]
    conteudo_gerado: Optional[str] = None  # Markdown string
    historico_chat: Optional[List[Any]] = None  # Historico de edicoes via chat
    modo_ativacao_agente2: Optional[str] = None  # 'fast_path', 'misto', 'llm', 'semi_automatico'
    modulos_ativados_det: Optional[int] = None  # Ativados por regra deterministica
    modulos_ativados_llm: Optional[int] = None  # Ativados por LLM
    criado_em: datetime

    class Config:
        from_attributes = True
