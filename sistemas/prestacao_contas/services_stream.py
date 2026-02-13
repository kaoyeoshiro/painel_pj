# sistemas/prestacao_contas/services_stream.py
"""
Helpers para formatação de eventos SSE (Server-Sent Events)

Este módulo centraliza a criação de eventos SSE para endpoints
de streaming do sistema de prestação de contas.

Autor: LAB/PGE-MS
"""

from typing import Optional, Dict, Any, Literal
from sistemas.prestacao_contas.schemas import EventoSSE


# =====================================================
# HELPERS DE CRIAÇÃO DE EVENTOS SSE
# =====================================================

def evento_inicio(mensagem: str = "Iniciando análise de prestação de contas") -> EventoSSE:
    """
    Cria evento de início de processamento.

    Args:
        mensagem: Mensagem de início (padrão: "Iniciando análise de prestação de contas")

    Returns:
        EventoSSE com tipo="inicio"
    """
    return EventoSSE(tipo="inicio", mensagem=mensagem)


def evento_etapa(
    etapa: int,
    etapa_nome: str,
    mensagem: str,
    progresso: Optional[int] = None,
) -> EventoSSE:
    """
    Cria evento de início de etapa.

    Args:
        etapa: Número da etapa (1-5)
        etapa_nome: Nome descritivo da etapa
        mensagem: Mensagem de progresso
        progresso: Progresso percentual (0-100)

    Returns:
        EventoSSE com tipo="etapa"
    """
    return EventoSSE(
        tipo="etapa",
        etapa=etapa,
        etapa_nome=etapa_nome,
        mensagem=mensagem,
        progresso=progresso,
    )


def evento_progresso(
    etapa: int,
    mensagem: str,
    progresso: int,
    dados: Optional[Dict[str, Any]] = None,
) -> EventoSSE:
    """
    Cria evento de progresso dentro de uma etapa.

    Args:
        etapa: Número da etapa (1-5)
        mensagem: Mensagem de progresso
        progresso: Progresso percentual (0-100)
        dados: Dados adicionais (opcional)

    Returns:
        EventoSSE com tipo="progresso"
    """
    return EventoSSE(
        tipo="progresso",
        etapa=etapa,
        mensagem=mensagem,
        progresso=progresso,
        dados=dados,
    )


def evento_info(
    mensagem: str,
    etapa: Optional[int] = None,
    dados: Optional[Dict[str, Any]] = None,
) -> EventoSSE:
    """
    Cria evento informativo.

    Args:
        mensagem: Mensagem informativa
        etapa: Número da etapa (opcional)
        dados: Dados adicionais (opcional)

    Returns:
        EventoSSE com tipo="info"
    """
    return EventoSSE(
        tipo="info",
        etapa=etapa,
        mensagem=mensagem,
        dados=dados,
    )


def evento_aviso(
    mensagem: str,
    etapa: Optional[int] = None,
    dados: Optional[Dict[str, Any]] = None,
) -> EventoSSE:
    """
    Cria evento de aviso.

    Args:
        mensagem: Mensagem de aviso
        etapa: Número da etapa (opcional)
        dados: Dados adicionais (opcional)

    Returns:
        EventoSSE com tipo="aviso"
    """
    return EventoSSE(
        tipo="aviso",
        etapa=etapa,
        mensagem=mensagem,
        dados=dados,
    )


def evento_erro(
    mensagem: str,
    etapa: Optional[int] = None,
    dados: Optional[Dict[str, Any]] = None,
) -> EventoSSE:
    """
    Cria evento de erro.

    Args:
        mensagem: Mensagem de erro
        etapa: Número da etapa (opcional)
        dados: Dados adicionais (opcional)

    Returns:
        EventoSSE com tipo="erro"
    """
    return EventoSSE(
        tipo="erro",
        etapa=etapa,
        mensagem=mensagem,
        dados=dados,
    )


def evento_sucesso(
    mensagem: str,
    etapa: Optional[int] = None,
    dados: Optional[Dict[str, Any]] = None,
) -> EventoSSE:
    """
    Cria evento de sucesso.

    Args:
        mensagem: Mensagem de sucesso
        etapa: Número da etapa (opcional)
        dados: Dados adicionais (opcional)

    Returns:
        EventoSSE com tipo="sucesso"
    """
    return EventoSSE(
        tipo="sucesso",
        etapa=etapa,
        mensagem=mensagem,
        dados=dados,
    )


def evento_resultado(
    mensagem: str,
    dados: Dict[str, Any],
) -> EventoSSE:
    """
    Cria evento com resultado final.

    Args:
        mensagem: Mensagem de resultado
        dados: Dados do resultado (geracao_id, parecer, etc)

    Returns:
        EventoSSE com tipo="resultado"
    """
    return EventoSSE(
        tipo="resultado",
        mensagem=mensagem,
        dados=dados,
    )


def evento_solicitar_documentos(
    mensagem: str,
    dados: Dict[str, Any],
) -> EventoSSE:
    """
    Cria evento solicitando documentos faltantes ao usuário.

    Args:
        mensagem: Mensagem explicativa sobre os documentos faltantes
        dados: Dados da solicitação (geracao_id, documentos_faltantes, etc)

    Returns:
        EventoSSE com tipo="solicitar_documentos"
    """
    return EventoSSE(
        tipo="solicitar_documentos",
        mensagem=mensagem,
        dados=dados,
    )


def evento_fim(
    mensagem: str = "Processamento finalizado",
    dados: Optional[Dict[str, Any]] = None,
) -> EventoSSE:
    """
    Cria evento de fim de processamento.

    Args:
        mensagem: Mensagem de finalização
        dados: Dados adicionais (opcional)

    Returns:
        EventoSSE com tipo="fim"
    """
    return EventoSSE(
        tipo="fim",
        mensagem=mensagem,
        dados=dados,
    )


# =====================================================
# HELPERS PARA PADRÕES ESPECÍFICOS
# =====================================================

def evento_erro_com_fim(
    mensagem_erro: str,
    etapa: Optional[int] = None,
) -> tuple[EventoSSE, EventoSSE]:
    """
    Cria par de eventos (erro + fim) para encerrar processamento com erro.

    Args:
        mensagem_erro: Mensagem de erro
        etapa: Número da etapa onde ocorreu o erro

    Returns:
        Tupla com (evento_erro, evento_fim)
    """
    evt_erro = evento_erro(mensagem_erro, etapa=etapa)
    evt_fim = evento_fim("Processamento finalizado com erro")
    return evt_erro, evt_fim


def evento_etapa_com_progresso(
    etapa: int,
    etapa_nome: str,
    mensagem: str,
    progresso: int,
) -> EventoSSE:
    """
    Alias para evento_etapa com progresso obrigatório.

    Args:
        etapa: Número da etapa (1-5)
        etapa_nome: Nome descritivo da etapa
        mensagem: Mensagem de progresso
        progresso: Progresso percentual (0-100)

    Returns:
        EventoSSE com tipo="etapa"
    """
    return evento_etapa(
        etapa=etapa,
        etapa_nome=etapa_nome,
        mensagem=mensagem,
        progresso=progresso,
    )
