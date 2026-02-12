# sistemas/gerador_pecas/schemas_extraction.py
"""
Schemas Pydantic para funcionalidades de extracao baseada em IA.

Extraidos de router_extraction.py (Fase 2a do plano de refatoracao).

Schemas para:
- Perguntas de extracao (modo IA)
- Modelos de extracao (gerados por IA ou manuais)
- Variaveis normalizadas do sistema
- Uso de variaveis em prompts
- Ordenacao e agrupamento por dependencias
- Renomeacao de slugs
"""

from typing import List, Optional, Any, Dict
from datetime import datetime

from pydantic import BaseModel, Field


# ============================================================================
# PERGUNTAS DE EXTRACAO
# ============================================================================

class ExtractionQuestionBase(BaseModel):
    """Schema base para perguntas de extracao"""
    pergunta: str = Field(..., description="Pergunta em linguagem natural")
    nome_variavel_sugerido: Optional[str] = Field(None, description="Nome de variável sugerido (opcional)")
    tipo_sugerido: Optional[str] = Field(None, description="Tipo de dado sugerido (opcional)")
    opcoes_sugeridas: Optional[List[str]] = Field(None, description="Opções sugeridas para múltipla escolha (opcional)")
    descricao: Optional[str] = Field(None, description="Descrição adicional (opcional)")
    # Dependencias condicionais
    depends_on_variable: Optional[str] = Field(None, description="Slug da variável da qual esta pergunta depende")
    dependency_operator: Optional[str] = Field(None, description="Operador da dependência (equals, not_equals, exists, etc.)")
    dependency_value: Optional[Any] = Field(None, description="Valor da condição de dependência")
    dependency_inferred: bool = Field(False, description="Se a dependência foi inferida por IA")
    ativo: bool = Field(True, description="Se a pergunta está ativa")
    ordem: int = Field(0, description="Ordem de exibição")


class ExtractionQuestionCreate(ExtractionQuestionBase):
    """Schema para criacao de pergunta"""
    categoria_id: int = Field(..., description="ID da categoria de documento")


class ExtractionQuestionUpdate(BaseModel):
    """Schema para atualizacao de pergunta"""
    pergunta: Optional[str] = None
    nome_variavel_sugerido: Optional[str] = None
    tipo_sugerido: Optional[str] = None
    opcoes_sugeridas: Optional[List[str]] = None
    descricao: Optional[str] = None
    # Dependencias condicionais
    depends_on_variable: Optional[str] = None
    dependency_operator: Optional[str] = None
    dependency_value: Optional[Any] = None
    dependency_inferred: Optional[bool] = None
    ativo: Optional[bool] = None
    ordem: Optional[int] = None


class ExtractionQuestionResponse(ExtractionQuestionBase):
    """Schema de resposta para pergunta"""
    id: int
    categoria_id: int
    categoria_nome: Optional[str] = None
    criado_por: Optional[int] = None
    criado_em: datetime
    atualizado_em: datetime

    class Config:
        from_attributes = True


# ============================================================================
# MODELOS DE EXTRACAO
# ============================================================================

class ExtractionModelBase(BaseModel):
    """Schema base para modelo de extracao"""
    model_config = {"populate_by_name": True}

    modo: str = Field("manual", description="Modo: ai_generated ou manual")
    extraction_schema: dict = Field(..., alias="schema_json", description="Schema JSON de extração")
    mapeamento_variaveis: Optional[dict] = Field(None, description="Mapeamento de perguntas para variáveis")


class ExtractionModelCreate(ExtractionModelBase):
    """Schema para criacao de modelo"""
    categoria_id: int = Field(..., description="ID da categoria de documento")


class ExtractionModelResponse(ExtractionModelBase):
    """Schema de resposta para modelo"""
    id: int
    categoria_id: int
    categoria_nome: Optional[str] = None
    versao: int
    ativo: bool
    criado_por: Optional[int] = None
    criado_em: datetime

    class Config:
        from_attributes = True


class GenerateSchemaRequest(BaseModel):
    """Schema para requisicao de geracao de schema"""
    categoria_id: int = Field(..., description="ID da categoria de documento")


class GenerateSchemaResponse(BaseModel):
    """Schema de resposta para geracao de schema"""
    model_config = {"populate_by_name": True}

    success: bool
    extraction_schema: Optional[dict] = Field(None, alias="schema_json")
    mapeamento_variaveis: Optional[dict] = None
    variaveis_criadas: Optional[List[dict]] = None
    erro: Optional[str] = None


# ============================================================================
# SINCRONIZACAO DE JSON (SEM IA)
# ============================================================================

class SyncJsonResponse(BaseModel):
    """Schema de resposta para sincronizacao de JSON sem IA"""
    model_config = {"populate_by_name": True}

    success: bool
    extraction_schema: Optional[dict] = Field(None, alias="schema_json")
    variaveis_adicionadas: int = 0
    variaveis_adicionadas_lista: Optional[List[str]] = None
    variaveis_modificadas: int = 0
    variaveis_modificadas_lista: Optional[List[str]] = None
    variaveis_removidas: int = 0
    variaveis_removidas_lista: Optional[List[str]] = None
    houve_alteracao: bool = False
    mensagem: Optional[str] = None
    erro: Optional[str] = None
    perguntas_incompletas: Optional[List[dict]] = None


# ============================================================================
# VERIFICACAO DE CONSISTENCIA JSON VS PERGUNTAS
# ============================================================================

class VariavelSemPergunta(BaseModel):
    """Detalhe de uma variavel no JSON sem pergunta correspondente"""
    slug: str
    tipo: Optional[str] = None
    descricao: Optional[str] = None
    tem_variavel_bd: bool = False
    variavel_ativa: bool = False
    tem_pergunta_inativa: bool = False
    pergunta_inativa_id: Optional[int] = None


class ConsistenciaJsonResponse(BaseModel):
    """Schema de resposta para verificacao de consistencia JSON vs perguntas"""
    consistente: bool
    total_campos_json: int = 0
    total_perguntas_ativas: int = 0
    variaveis_sem_pergunta: List[VariavelSemPergunta] = []
    perguntas_sem_variavel_json: List[dict] = []
    mensagem: str = ""


class SincronizarPerguntasJsonResponse(BaseModel):
    """Schema de resposta para sincronizacao de perguntas com JSON"""
    success: bool
    perguntas_criadas: int = 0
    perguntas_reativadas: int = 0
    variaveis_criadas: int = 0
    variaveis_reativadas: int = 0
    detalhes: List[dict] = []
    mensagem: Optional[str] = None
    erro: Optional[str] = None


# ============================================================================
# APLICACAO DE JSON (JSON -> PERGUNTAS/VARIAVEIS)
# ============================================================================

class AplicarJsonRequest(BaseModel):
    """Schema de entrada para aplicacao de JSON"""
    json_content: str = Field(..., description="Conteúdo JSON a aplicar (string)")
    confirmar_remocao_variaveis_em_uso: bool = Field(
        False,
        description="Se True, força remoção de variáveis mesmo que estejam em uso como condição de ativação"
    )


class VariavelEmUsoDetalhe(BaseModel):
    """Detalhe de uma variavel em uso como condicao de ativacao"""
    slug: str
    label: str
    prompts: List[dict]  # [{id, nome, titulo, tipo_uso}]


class AplicarJsonResponse(BaseModel):
    """Schema de resposta para aplicacao de JSON nas perguntas/variaveis"""
    success: bool
    # Contadores
    perguntas_criadas: int = 0
    perguntas_atualizadas: int = 0
    perguntas_removidas: int = 0
    variaveis_criadas: int = 0
    variaveis_atualizadas: int = 0
    variaveis_removidas: int = 0
    # Detalhes
    criadas: List[str] = []
    atualizadas: List[str] = []
    removidas: List[str] = []
    # Feedback
    mensagem: Optional[str] = None
    erro: Optional[str] = None
    erros_validacao: Optional[List[dict]] = None
    # Tempo de execucao
    tempo_ms: Optional[int] = None
    # Confirmacao necessaria para variaveis em uso
    requer_confirmacao: bool = False
    variaveis_em_uso_condicoes: List[VariavelEmUsoDetalhe] = []


# ============================================================================
# CRIACAO EM LOTE DE PERGUNTAS (COM ANALISE DE DEPENDENCIAS POR IA)
# ============================================================================

class BulkQuestionInput(BaseModel):
    """Uma pergunta no formato de entrada para criacao em lote"""
    pergunta: str = Field(..., description="Texto da pergunta em linguagem natural")
    nome_variavel_sugerido: Optional[str] = Field(None, description="Nome sugerido para a variável")
    tipo_sugerido: Optional[str] = Field(None, description="Tipo sugerido (text, number, boolean, etc)")
    opcoes_sugeridas: Optional[List[str]] = Field(None, description="Opções para tipo choice")


class BulkQuestionsCreate(BaseModel):
    """Schema para criacao em lote de perguntas com analise de dependencias"""
    categoria_id: int = Field(..., description="ID da categoria de documento")
    perguntas: List[BulkQuestionInput] = Field(..., min_length=1, description="Lista de perguntas a criar")
    analisar_dependencias: bool = Field(True, description="Se deve usar IA para analisar dependências entre perguntas")


class BulkQuestionResult(BaseModel):
    """Resultado da criacao de uma pergunta no lote"""
    index: int
    pergunta_texto: str
    id: Optional[int] = None
    slug_sugerido: Optional[str] = None
    depends_on_variable: Optional[str] = None
    dependency_operator: Optional[str] = None
    dependency_value: Optional[Any] = None
    erro: Optional[str] = None


class BulkQuestionsResponse(BaseModel):
    """Resposta da criacao em lote de perguntas"""
    success: bool
    total_enviadas: int
    total_criadas: int
    total_com_dependencias: int
    perguntas: List[BulkQuestionResult]
    grafo_dependencias: Optional[dict] = None
    erro: Optional[str] = None


# ============================================================================
# VARIAVEIS NORMALIZADAS
# ============================================================================

class ExtractionVariableBase(BaseModel):
    """Schema base para variavel de extracao"""
    slug: str = Field(..., description="Identificador técnico único")
    label: str = Field(..., description="Nome de exibição")
    descricao: Optional[str] = Field(None, description="Descrição da variável")
    tipo: str = Field(..., description="Tipo de dado")
    opcoes: Optional[List[str]] = Field(None, description="Opções para tipo choice/list")
    # Fonte de verdade individual (override do grupo)
    fonte_verdade_codigo: Optional[str] = Field(None, description="Código específico de documento (ex: 9500)")
    fonte_verdade_tipo: Optional[str] = Field(None, description="Tipo de documento fonte de verdade para esta variável")
    fonte_verdade_override: bool = Field(False, description="Se usa fonte de verdade específica")


class ExtractionVariableCreate(ExtractionVariableBase):
    """Schema para criacao de variavel"""
    categoria_id: Optional[int] = Field(None, description="ID da categoria de documento")


class ExtractionVariableUpdate(BaseModel):
    """Schema para atualizacao de variavel"""
    label: Optional[str] = None
    descricao: Optional[str] = None
    tipo: Optional[str] = None
    opcoes: Optional[List[str]] = None
    fonte_verdade_codigo: Optional[str] = None
    fonte_verdade_tipo: Optional[str] = None
    fonte_verdade_override: Optional[bool] = None
    ativo: Optional[bool] = None


class ExtractionVariableResponse(ExtractionVariableBase):
    """Schema de resposta para variavel"""
    id: int
    categoria_id: Optional[int] = None
    categoria_nome: Optional[str] = None
    source_question_id: Optional[int] = None
    ativo: bool
    criado_em: datetime
    atualizado_em: datetime
    # Campos de USO - separados para JSON e Prompts
    uso_count: int = Field(0, description="[DEPRECATED] Use uso_count_prompts. Quantidade de prompts que usam esta variável")
    uso_count_prompts: int = Field(0, description="Quantidade de prompts que usam esta variável como condição")
    em_uso_json: bool = Field(False, description="Se está presente no JSON da categoria (verificação real)")
    prompts_usando: Optional[List[str]] = Field(None, description="Lista de nomes de prompts que usam esta variável")
    # Campos de dependencia para visualizacao
    is_conditional: bool = Field(False, description="Se a variável é condicional")
    depends_on_variable: Optional[str] = Field(None, description="Slug da variável da qual depende")
    depth: int = Field(0, description="Profundidade na árvore de dependências (para recuo)")
    ordem: int = Field(0, description="Ordem da pergunta de origem")

    class Config:
        from_attributes = True


class VariableUsageResponse(BaseModel):
    """Schema de resposta para uso de variavel em prompt"""
    prompt_id: int
    prompt_nome: str
    prompt_titulo: str
    modo_ativacao: Optional[str] = None
    effective_activation_mode: Optional[str] = None  # REGRA DE OURO: modo efetivo real
    criado_em: datetime

    class Config:
        from_attributes = True


class VariableDetailResponse(ExtractionVariableResponse):
    """Schema de resposta detalhada para variavel com usos"""
    prompt_usages: List[VariableUsageResponse] = Field([], description="Lista de prompts que usam esta variável")


# ============================================================================
# ORDENACAO DE PERGUNTAS
# ============================================================================

class PerguntaOrdenarItem(BaseModel):
    """Item para ordenacao de pergunta"""
    id: Optional[int] = None
    pergunta: str
    tipo_sugerido: Optional[str] = None
    nome_variavel_sugerido: Optional[str] = None
    depends_on_variable: Optional[str] = None  # Slug da variavel da qual depende


class OrdenarPerguntasRequest(BaseModel):
    """Request para ordenar perguntas com IA"""
    categoria_nome: str
    perguntas: List[PerguntaOrdenarItem]


class PosicionarPerguntaRequest(BaseModel):
    """Request para posicionar uma nova pergunta"""
    categoria_nome: str
    nova_pergunta: PerguntaOrdenarItem
    perguntas_existentes: List[dict]


# ============================================================================
# ATUALIZACAO DE ORDEM EM LOTE
# ============================================================================

class OrdemPerguntaItem(BaseModel):
    """Item para atualizacao de ordem de uma pergunta"""
    id: int = Field(..., description="ID da pergunta")
    ordem: int = Field(..., description="Nova ordem (0-indexed)")


class AtualizarOrdemLoteRequest(BaseModel):
    """Request para atualizar ordem de multiplas perguntas de uma vez"""
    categoria_id: int = Field(..., description="ID da categoria (para validação)")
    perguntas: List[OrdemPerguntaItem] = Field(..., min_length=1, description="Lista de perguntas com nova ordem")


class AtualizarOrdemLoteResponse(BaseModel):
    """Response da atualizacao em lote"""
    success: bool
    atualizadas: int
    message: str


# ============================================================================
# AGRUPAMENTO POR DEPENDENCIAS
# ============================================================================

class AgruparPorDependenciasRequest(BaseModel):
    """Request para agrupar perguntas por dependencias"""
    categoria_id: int = Field(..., description="ID da categoria")


class AgruparPorDependenciasResponse(BaseModel):
    """Response do agrupamento por dependencias"""
    success: bool
    nova_ordem: List[Dict[str, Any]] = Field(default_factory=list, description="Nova ordem das perguntas")
    ciclos_detectados: List[str] = Field(default_factory=list, description="Avisos de ciclos detectados")
    atualizadas: int = Field(0, description="Número de perguntas reordenadas")
    message: str


# ============================================================================
# RENOMEACAO DE SLUG
# ============================================================================

class RenomearSlugRequest(BaseModel):
    """Schema para requisicao de renomeacao de slug"""
    novo_slug: str = Field(..., description="Novo slug desejado")
    normalizar: bool = Field(True, description="Se deve normalizar o slug (remover acentos, etc)")


class RenomearSlugResponse(BaseModel):
    """Schema de resposta para renomeacao de slug"""
    success: bool
    old_slug: str
    new_slug: str
    error: Optional[str] = None
    categoria_json_atualizada: bool = False
    perguntas_atualizadas: int = 0
    prompts_atualizados: int = 0
    regras_tipo_peca_atualizadas: int = 0
    prompt_usages_atualizados: int = 0
    variaveis_dependentes_atualizadas: int = 0
    perguntas_dependentes_atualizadas: int = 0
    detalhes: List[str] = []


class ConsistenciaSlugResponse(BaseModel):
    """Schema de resposta para verificacao de consistencia de slugs"""
    consistente: bool
    categoria_id: Optional[int] = None
    categoria_nome: Optional[str] = None
    total_slugs_json: int = 0
    total_variaveis_ativas: int = 0
    slugs_orfaos_json: List[str] = []
    slugs_orfaos_variaveis: List[str] = []
    mensagem: str = ""
    erro: Optional[str] = None


class ReferenciasSlugResponse(BaseModel):
    """Schema de resposta para referencias de um slug"""
    slug: str
    total_prompts: int = 0
    total_regras_tipo_peca: int = 0
    prompts: List[dict] = []
    regras_tipo_peca: List[dict] = []


# ============================================================================
# REGRAS DETERMINISTICAS (IA)
# ============================================================================

class GenerateDeterministicRuleRequest(BaseModel):
    """Schema para requisicao de geracao de regra deterministica"""
    condicao_texto: str = Field(..., description="Condição em linguagem natural")
    contexto: Optional[str] = Field(None, description="Contexto adicional (tipo de peça, grupo, etc)")


class SugestaoVariavel(BaseModel):
    """Sugestao para criar variavel faltante"""
    slug: str = Field(..., description="Slug da variável sugerida")
    label_sugerido: str = Field(..., description="Label sugerido para a variável")
    tipo_sugerido: str = Field(..., description="Tipo sugerido (text, boolean, number, etc)")


class GenerateDeterministicRuleResponse(BaseModel):
    """Schema de resposta para geracao de regra deterministica"""
    success: bool
    regra: Optional[dict] = Field(None, description="AST JSON da regra")
    variaveis_usadas: Optional[List[str]] = Field(None, description="Lista de variáveis usadas na regra")
    regra_texto_original: Optional[str] = Field(None, description="Texto original da condição")
    erro: Optional[str] = None
    detalhes: Optional[List[str]] = Field(None, description="Detalhes do erro")
    variaveis_faltantes: Optional[List[str]] = Field(None, description="Variáveis mencionadas que não existem")
    sugestoes_variaveis: Optional[List[SugestaoVariavel]] = Field(None, description="Sugestões para criar variáveis faltantes")


class ValidateDeterministicRuleRequest(BaseModel):
    """Schema para validacao de regra deterministica"""
    regra: dict = Field(..., description="AST JSON da regra")


class ValidateDeterministicRuleResponse(BaseModel):
    """Schema de resposta para validacao de regra"""
    valid: bool
    errors: List[str] = []
    warnings: List[str] = []
    variaveis_faltantes: List[str] = []


class EvaluateDeterministicRuleRequest(BaseModel):
    """Schema para avaliacao de regra deterministica"""
    regra: dict = Field(..., description="AST JSON da regra")
    dados: dict = Field(..., description="Dados para avaliação")


class EvaluateDeterministicRuleResponse(BaseModel):
    """Schema de resposta para avaliacao de regra"""
    resultado: bool
    erro: Optional[str] = None


# ============================================================================
# DEPENDENCIAS ENTRE PERGUNTAS
# ============================================================================

class DependencyConfig(BaseModel):
    """Schema para configuracao de dependencia"""
    depends_on: str = Field(..., description="Slug da variável da qual depende")
    operator: str = Field("equals", description="Operador: equals, not_equals, in_list, exists, etc.")
    value: Optional[Any] = Field(None, description="Valor esperado para a condição")


class SetDependencyRequest(BaseModel):
    """Schema para definir dependencia em uma pergunta"""
    depends_on_variable: str = Field(..., description="Slug da variável da qual depende")
    dependency_operator: str = Field("equals", description="Operador de comparação")
    dependency_value: Optional[Any] = Field(None, description="Valor esperado")


class InferDependenciesRequest(BaseModel):
    """Schema para requisicao de inferencia de dependencias"""
    categoria_id: int = Field(..., description="ID da categoria")


class InferDependenciesResponse(BaseModel):
    """Schema de resposta para inferencia de dependencias"""
    success: bool
    dependencias_inferidas: List[dict] = []
    grafo: Optional[dict] = None
    erro: Optional[str] = None


class ApplyDependenciesRequest(BaseModel):
    """Schema para aplicacao de dependencias inferidas"""
    categoria_id: int = Field(..., description="ID da categoria")
    dependencias: List[dict] = Field(..., description="Lista de dependências a aplicar")


class ApplyDependenciesResponse(BaseModel):
    """Schema de resposta para aplicacao de dependencias"""
    success: bool
    perguntas_atualizadas: List[dict] = []
    erro: Optional[str] = None


class DependencyGraphResponse(BaseModel):
    """Schema de resposta para grafo de dependencias"""
    nodes: List[dict] = []
    edges: List[dict] = []
    hierarchy: dict = {}
    root_questions: List[dict] = []


class DependentQuestionsResponse(BaseModel):
    """Schema de resposta para perguntas dependentes"""
    perguntas: List[dict] = []


# ============================================================================
# SINCRONIZACAO DE TIPOS
# ============================================================================

class SyncPerguntaTipo(BaseModel):
    """Dados para sincronizar tipo de uma pergunta"""
    pergunta_id: int = Field(..., description="ID da pergunta")
    tipo: str = Field(..., description="Tipo inferido pela IA")
    opcoes: Optional[List[str]] = Field(None, description="Opções se tipo for choice/list")


class SyncTiposRequest(BaseModel):
    """Request para sincronizar tipos das perguntas com o schema gerado"""
    categoria_id: int = Field(..., description="ID da categoria")
    mapeamento_variaveis: dict = Field(..., description="Mapeamento de pergunta_id para info da variável")


class SyncTiposResponse(BaseModel):
    """Response da sincronizacao de tipos"""
    success: bool = True
    perguntas_atualizadas: int = 0
    detalhes: List[dict] = []
    erro: Optional[str] = None


# ============================================================================
# RESTAURACAO DE SLUGS
# ============================================================================

class RestaurarSlugsRequest(BaseModel):
    """Request para restaurar slugs de variaveis."""
    categoria_id: int
    json_backup: dict = Field(..., description="JSON com slugs corretos como chaves")


class RestaurarSlugsResponse(BaseModel):
    """Response da restauracao de slugs."""
    success: bool
    variaveis_atualizadas: int = 0
    variaveis_removidas: int = 0
    perguntas_sincronizadas: int = 0
    detalhes: List[dict] = []
    erro: Optional[str] = None
