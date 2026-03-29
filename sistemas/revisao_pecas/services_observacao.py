# sistemas/revisao_pecas/services_observacao.py
"""Geracao de textos de observacao para lancamento no pge.net."""

MAX_OBS_CHARS = 3000


def gerar_texto_observacao(
    cenario: str,
    tipo_peca: str | None = None,
    nome_revisor: str = "",
    nome_assessor: str = "",
    acao_corrigida: str = "",
    motivo: str = "",
) -> str:
    """Gera texto de observacao formatado conforme o cenario de revisao.

    Args:
        cenario: Identificador do cenario (aprovado_sem_alteracao, aprovado_editado, etc.)
        tipo_peca: Tipo da peca juridica (contestacao, recurso, etc.)
        nome_revisor: Nome completo do procurador revisor
        nome_assessor: Nome do assessor para encaminhamento
        acao_corrigida: Acao correta quando a orientacao da IA foi rejeitada
        motivo: Motivo da rejeicao

    Returns:
        str: Texto de observacao truncado ao limite de MAX_OBS_CHARS
    """
    if cenario == "aprovado_sem_alteracao":
        texto = (
            f"[REVISADO] Peca de {tipo_peca or 'tipo nao informado'} gerada por IA "
            f"revisada e aprovada sem alteracoes pelo(a) Proc. {nome_revisor}. "
            f"Peca disponivel para insercao."
        )
    elif cenario == "aprovado_editado":
        texto = (
            f"[REVISADO] Peca de {tipo_peca or 'tipo nao informado'} gerada por IA "
            f"revisada e editada pelo(a) Proc. {nome_revisor}. "
            f"Peca disponivel para insercao."
        )
    elif cenario == "nada_a_fazer_confirmado":
        texto = (
            f"[REVISADO] Orientacao da IA — Nada a Fazer — revisada e confirmada "
            f"pelo(a) Proc. {nome_revisor}. Sem providencias necessarias."
        )
    elif cenario == "rejeitado":
        texto = (
            f"[REJEITADO] Orientacao da IA — Nada a Fazer — REJEITADA "
            f"pelo(a) Proc. {nome_revisor}. "
            f"Acao correta: {acao_corrigida}. Motivo: {motivo}"
        )
    elif cenario == "encaminhado":
        texto = (
            f"[REVISADO] Peca de {tipo_peca or 'tipo nao informado'} revisada "
            f"pelo(a) Proc. {nome_revisor} e encaminhada ao(a) assessor(a) "
            f"{nome_assessor} para insercao no processo."
        )
    else:
        texto = f"[REVISADO] Acao revisada pelo(a) Proc. {nome_revisor}."

    return _truncar_observacao(texto)


def _truncar_observacao(texto: str) -> str:
    """Trunca observacao ao limite maximo, preservando sentencas completas.

    Args:
        texto: Texto original da observacao

    Returns:
        str: Texto truncado respeitando o limite MAX_OBS_CHARS
    """
    if len(texto) <= MAX_OBS_CHARS:
        return texto
    truncado = texto[:MAX_OBS_CHARS]
    ultimo_ponto = truncado.rfind(".")
    if ultimo_ponto > 0:
        return truncado[: ultimo_ponto + 1]
    return truncado
