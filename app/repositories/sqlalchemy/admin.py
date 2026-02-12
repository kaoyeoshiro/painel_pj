"""
Compat layer para repositórios de admin no namespace novo.
"""

from admin.repositories import (
    CategoriaOrdemRepository,
    ConfiguracaoIARepository,
    FeedbackRepository,
    ModuloTipoPecaRepository,
    PromptConfigRepository,
    PromptGroupRepository,
    PromptModuloHistoricoRepository,
    PromptModuloRepository,
    PromptSubcategoriaRepository,
    PromptSubgroupRepository,
    RegraDeterministicaTipoPecaRepository,
    get_categoria_ordem_repo,
    get_config_repo,
    get_feedback_repo,
    get_modulo_tipo_peca_repo,
    get_prompt_config_repo,
    get_prompt_group_repo,
    get_prompt_modulo_historico_repo,
    get_prompt_modulo_repo,
    get_prompt_subcategoria_repo,
    get_prompt_subgroup_repo,
    get_regra_tipo_peca_repo,
)

__all__ = [
    "ConfiguracaoIARepository",
    "PromptConfigRepository",
    "PromptModuloRepository",
    "PromptModuloHistoricoRepository",
    "PromptGroupRepository",
    "PromptSubgroupRepository",
    "PromptSubcategoriaRepository",
    "ModuloTipoPecaRepository",
    "RegraDeterministicaTipoPecaRepository",
    "CategoriaOrdemRepository",
    "FeedbackRepository",
    "get_config_repo",
    "get_prompt_config_repo",
    "get_prompt_modulo_repo",
    "get_prompt_modulo_historico_repo",
    "get_prompt_group_repo",
    "get_prompt_subgroup_repo",
    "get_prompt_subcategoria_repo",
    "get_modulo_tipo_peca_repo",
    "get_regra_tipo_peca_repo",
    "get_categoria_ordem_repo",
    "get_feedback_repo",
]

