"""
Helpers compartilhados para padronizacao de feedback por estrelas (1-5).

Todas as 6 tabelas de feedback usam `nota` (int 1-5) como campo primario.
`avaliacao` (string) e derivada automaticamente para backward compatibility.
"""
from __future__ import annotations


def nota_para_avaliacao(nota: int) -> str:
    """Deriva avaliacao legada a partir de nota (backward compat).

    Mapeamento:
        5, 4 -> 'correto'
        3    -> 'parcial'
        2    -> 'incorreto'
        1    -> 'erro_ia'
    """
    if nota >= 4:
        return "correto"
    if nota == 3:
        return "parcial"
    if nota == 2:
        return "incorreto"
    return "erro_ia"


AVALIACAO_PARA_NOTA: dict[str, int] = {
    "correto": 5,
    "parcial": 3,
    "incorreto": 2,
    "erro_ia": 1,
}


def validate_feedback_fields(values: dict) -> dict:
    """Validator compartilhado para FeedbackRequest de todos os sistemas.

    - Derivacao bidirecional nota <-> avaliacao
    - Comentario obrigatorio se nota <= 3

    Usar via @model_validator(mode='before') nos schemas Pydantic.
    """
    nota = values.get("nota")
    avaliacao = values.get("avaliacao")
    comentario = values.get("comentario")

    # Derivacao bidirecional
    if nota and not avaliacao:
        values["avaliacao"] = nota_para_avaliacao(nota)
    elif avaliacao and not nota:
        values["nota"] = AVALIACAO_PARA_NOTA.get(avaliacao, 3)

    # Comentario obrigatorio se nota <= 3
    if nota and nota <= 3 and not (comentario and comentario.strip()):
        raise ValueError("Comentário é obrigatório para nota <= 3")

    return values
