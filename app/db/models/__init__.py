"""
Registro central de models ORM no namespace novo.

Importa módulos legados para manter compatibilidade durante migração.
"""

from importlib import import_module


def _import_if_exists(module_path: str):
    """
    Importa módulo se existir, ignorando ImportError para manter compatibilidade.
    """
    try:
        return import_module(module_path)
    except ImportError:
        return None


# Admin/Auth
admin_models = _import_if_exists("admin.models")
auth_models = _import_if_exists("auth.models")

# Sistemas
assistencia_models = _import_if_exists("sistemas.assistencia_judiciaria.models")
bert_training_models = _import_if_exists("sistemas.bert_training.models")
classificador_models = _import_if_exists("sistemas.classificador_documentos.models")
extrator_autos_models = _import_if_exists("sistemas.extrator_autos.models")
gerador_pecas_models = _import_if_exists("sistemas.gerador_pecas.models")
matriculas_models = _import_if_exists("sistemas.matriculas_confrontantes.models")
pedido_calculo_models = _import_if_exists("sistemas.pedido_calculo.models")
prestacao_contas_models = _import_if_exists("sistemas.prestacao_contas.models")
relatorio_cumprimento_models = _import_if_exists("sistemas.relatorio_cumprimento.models")

__all__ = [
    "admin_models",
    "auth_models",
    "assistencia_models",
    "bert_training_models",
    "classificador_models",
    "extrator_autos_models",
    "gerador_pecas_models",
    "matriculas_models",
    "pedido_calculo_models",
    "prestacao_contas_models",
    "relatorio_cumprimento_models",
]
