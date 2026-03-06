# admin/schemas_prompts.py
"""
Schemas Pydantic para o modulo de prompts modulares.

Extraidos de router_prompts.py para separacao de responsabilidades (SRP).
Contem todos os modelos de request/response usados pelos endpoints de prompts.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator


# ==========================================
# Schemas: Modulos de Prompt
# ==========================================

class PromptModuloBase(BaseModel):
    tipo: str  # 'base', 'peca', 'conteudo'
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None  # Campo texto legado
    subcategoria_ids: Optional[List[int]] = []  # IDs das subcategorias (muitos-para-muitos)
    group_id: Optional[int] = None
    subgroup_id: Optional[int] = None
    nome: str
    titulo: str

    @field_validator("nome")
    @classmethod
    def nome_nao_vazio(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Nome do módulo não pode ser vazio")
        return v.strip()
    condicao_ativacao: Optional[str] = None  # Situação em que o prompt deve ser ativado (para Agente 2)
    conteudo: str  # Conteúdo do prompt (para Agente 3)
    # Modo de ativação: 'llm' (padrão) ou 'deterministic'
    modo_ativacao: Optional[str] = 'llm'
    # Regra determinística PRIMÁRIA (AST JSON) - apenas quando modo_ativacao = 'deterministic'
    regra_deterministica: Optional[dict] = None
    # Texto original da regra primária em linguagem natural
    regra_texto_original: Optional[str] = None
    # Regra determinística SECUNDÁRIA (fallback) - avaliada se primária não existe
    regra_deterministica_secundaria: Optional[dict] = None
    # Texto original da regra secundária em linguagem natural
    regra_secundaria_texto_original: Optional[str] = None
    # Se deve avaliar regra secundária quando primária não existe
    fallback_habilitado: Optional[bool] = False
    tags: Optional[List[str]] = []
    ativo: bool = True
    ordem: int = 0


class PromptModuloCreate(PromptModuloBase):
    pass


class PromptModuloUpdate(BaseModel):
    titulo: Optional[str] = None
    categoria: Optional[str] = None  # Campo texto para agrupamento visual
    subcategoria: Optional[str] = None  # Campo texto legado para organização
    group_id: Optional[int] = None
    subgroup_id: Optional[int] = None
    subcategoria_ids: Optional[List[int]] = None  # IDs das subcategorias (muitos-para-muitos)
    condicao_ativacao: Optional[str] = None  # Atualiza condição de ativação
    conteudo: Optional[str] = None
    # Modo de ativação: 'llm' ou 'deterministic'
    modo_ativacao: Optional[str] = None
    # Regra determinística PRIMÁRIA (AST JSON)
    regra_deterministica: Optional[dict] = None
    # Texto original da regra primária em linguagem natural
    regra_texto_original: Optional[str] = None
    # Regra determinística SECUNDÁRIA (fallback)
    regra_deterministica_secundaria: Optional[dict] = None
    # Texto original da regra secundária em linguagem natural
    regra_secundaria_texto_original: Optional[str] = None
    # Se deve avaliar regra secundária quando primária não existe
    fallback_habilitado: Optional[bool] = None
    tags: Optional[List[str]] = None
    ativo: Optional[bool] = None
    ordem: Optional[int] = None
    motivo: Optional[str] = None  # Opcional - motivo da alteração


class PromptModuloResponse(BaseModel):
    id: int
    tipo: str
    categoria: Optional[str] = None
    subcategoria: Optional[str] = None
    subcategoria_ids: List[int] = []
    subcategorias_nomes: List[str] = []  # Nomes das subcategorias para exibição
    group_id: Optional[int] = None
    subgroup_id: Optional[int] = None
    nome: str
    titulo: str
    condicao_ativacao: Optional[str] = None
    conteudo: str
    # Modo de ativação: 'llm' ou 'deterministic'
    modo_ativacao: Optional[str] = 'llm'
    # Regra determinística PRIMÁRIA (AST JSON)
    regra_deterministica: Optional[dict] = None
    # Texto original da regra primária em linguagem natural
    regra_texto_original: Optional[str] = None
    # Regra determinística SECUNDÁRIA (fallback)
    regra_deterministica_secundaria: Optional[dict] = None
    # Texto original da regra secundária em linguagem natural
    regra_secundaria_texto_original: Optional[str] = None
    # Se deve avaliar regra secundária quando primária não existe
    fallback_habilitado: Optional[bool] = False
    # Palavras-chave para ativação
    palavras_chave: Optional[List[str]] = []
    tags: Optional[List[str]] = []
    ativo: bool = True
    ordem: int = 0
    versao: int
    criado_por: Optional[int]
    criado_em: datetime
    atualizado_por: Optional[int]
    atualizado_em: Optional[datetime]

    class Config:
        from_attributes = True


class PromptHistoricoResponse(BaseModel):
    id: int
    modulo_id: int
    group_id: Optional[int] = None
    subgroup_id: Optional[int] = None
    versao: int
    condicao_ativacao: Optional[str]
    conteudo: str
    tags: Optional[List[str]]
    alterado_por: Optional[int]
    alterado_em: datetime
    motivo: Optional[str]
    diff_resumo: Optional[str]

    class Config:
        from_attributes = True


class DiffResponse(BaseModel):
    v1: int
    v2: int
    diff_html: str
    alteracoes: int


# ==========================================
# Schemas: Grupos e Subgrupos
# ==========================================

class PromptGroupBase(BaseModel):
    nome: str = Field(validation_alias="name")
    slug: str
    ativo: bool = Field(default=True, validation_alias="active")
    ordem: int = Field(default=0, validation_alias="order")


class PromptGroupCreate(PromptGroupBase):
    model_config = ConfigDict(populate_by_name=True)


class PromptGroupUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, validation_alias="name")
    slug: Optional[str] = None
    ativo: Optional[bool] = Field(default=None, validation_alias="active")
    ordem: Optional[int] = Field(default=None, validation_alias="order")

    model_config = ConfigDict(populate_by_name=True)


class PromptGroupResponse(PromptGroupBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class PromptSubgroupBase(BaseModel):
    group_id: int
    nome: str = Field(validation_alias="name")
    slug: str
    ativo: bool = Field(default=True, validation_alias="active")
    ordem: int = Field(default=0, validation_alias="order")


class PromptSubgroupCreate(BaseModel):
    """Schema para criacao de subgrupo (group_id vem da URL, nao do body)."""
    nome: str = Field(validation_alias="name")
    slug: str
    ativo: bool = Field(default=True, validation_alias="active")
    ordem: int = Field(default=0, validation_alias="order")

    model_config = ConfigDict(populate_by_name=True)


class PromptSubgroupUpdate(BaseModel):
    nome: Optional[str] = Field(default=None, validation_alias="name")
    slug: Optional[str] = None
    ativo: Optional[bool] = Field(default=None, validation_alias="active")
    ordem: Optional[int] = Field(default=None, validation_alias="order")

    model_config = ConfigDict(populate_by_name=True)


class PromptSubgroupResponse(PromptSubgroupBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ==========================================
# Schemas: Subcategorias
# ==========================================

class PromptSubcategoriaBase(BaseModel):
    nome: str
    slug: str
    descricao: Optional[str] = None
    active: bool = True
    order: int = 0


class PromptSubcategoriaCreate(PromptSubcategoriaBase):
    pass


class PromptSubcategoriaUpdate(BaseModel):
    nome: Optional[str] = None
    slug: Optional[str] = None
    descricao: Optional[str] = None
    active: Optional[bool] = None
    order: Optional[int] = None


class PromptSubcategoriaResponse(PromptSubcategoriaBase):
    id: int
    group_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Schemas: Exportacao e Importacao
# ==========================================

class ExportarSelecionadosRequest(BaseModel):
    """Schema para exportacao de modulos selecionados"""
    ids: List[int]


class ImportarModulosRequest(BaseModel):
    """Schema para importacao de modulos"""
    modulos: List[dict]
    sobrescrever_existentes: bool = False
    desativar_ausentes_do_grupo: bool = False


class ImportarModulosResponse(BaseModel):
    """Resposta da importacao"""
    total_recebidos: int
    criados: int
    atualizados: int
    ignorados: int
    desativados: int = 0
    grupos_criados: int = 0
    subgrupos_criados: int = 0
    subcategorias_criadas: int = 0
    erros: List[str]


# ==========================================
# Schemas: Associacao Modulos x Tipos de Peca
# ==========================================

class ModuloTipoPecaItem(BaseModel):
    """Item de associacao modulo-tipo de peca"""
    modulo_id: int
    ativo: bool = True


class ConfigurarModulosTipoPecaRequest(BaseModel):
    """Request para configurar modulos de um tipo de peca"""
    tipo_peca: str  # Ex: 'contestacao', 'recurso_apelacao'
    modulos: List[ModuloTipoPecaItem]  # Lista de módulos com status


class ModuloTipoPecaResponse(BaseModel):
    """Resposta com informacoes do modulo e status por tipo de peca"""
    modulo_id: int
    nome: str
    titulo: str
    categoria: Optional[str]
    subcategoria: Optional[str]
    ativo_global: bool  # Se o módulo está ativo globalmente
    ativo_tipo_peca: bool  # Se está ativo para este tipo de peça específico


# ==========================================
# Schemas: Regras Deterministicas por Tipo de Peca
# ==========================================

class RegraTipoPecaCreate(BaseModel):
    """Schema para criar/atualizar regra deterministica especifica por tipo de peca."""
    tipo_peca: str
    regra_deterministica: dict
    regra_texto_original: Optional[str] = None
    ativo: bool = True


class RegraTipoPecaResponse(BaseModel):
    """Schema de resposta para regra por tipo de peca."""
    id: int
    modulo_id: int
    tipo_peca: str
    regra_deterministica: dict
    regra_texto_original: Optional[str]
    ativo: bool
    criado_em: datetime
    atualizado_em: datetime

    class Config:
        from_attributes = True


# ==========================================
# Schemas: Ordem das Categorias
# ==========================================

class CategoriaOrdemBase(BaseModel):
    nome: str
    ordem: int = 0
    ativo: bool = True


class CategoriaOrdemCreate(CategoriaOrdemBase):
    pass


class CategoriaOrdemUpdate(BaseModel):
    ordem: Optional[int] = None
    ativo: Optional[bool] = None


class CategoriaOrdemResponse(CategoriaOrdemBase):
    id: int
    group_id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ==========================================
# Schemas: Reordenacao de Prompts (Drag & Drop)
# ==========================================

class ReordenarPromptItem(BaseModel):
    """Item para reordenacao de prompt"""
    id: int
    ordem: int


class ReordenarPromptsRequest(BaseModel):
    """Request para reordenar multiplos prompts"""
    prompts: List[ReordenarPromptItem]


class ReordenarCategoriasPromptsRequest(BaseModel):
    """Request para reordenar categorias e seus prompts"""
    group_id: int
    categorias: List[dict]  # [{nome, ordem, prompts: [{id, ordem}]}]
