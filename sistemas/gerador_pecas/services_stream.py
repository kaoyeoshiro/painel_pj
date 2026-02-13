# sistemas/gerador_pecas/services_stream.py
"""
Serviço de streaming para o Gerador de Peças.

Centraliza TODA a formatação de eventos SSE (Server-Sent Events)
para os endpoints de streaming do gerador de peças.

Delega formatação base ao SSEEventFormatter compartilhado.
Métodos específicos do domínio (ex: parecer NATJus) estendem o formatador base.

Os generators permanecem no router.py, mas TODOS os yields passam por este helper,
eliminando json.dumps inline e padronizando o formato dos eventos.
"""
import json
from typing import Any

from app.services.shared.sse import SSEEventFormatter


class GeradorStreamHelper:
    """
    Helpers para formatação de eventos SSE do gerador de peças.

    Delega formatação base ao SSEEventFormatter e adiciona eventos
    específicos do domínio (parecer_natjus_ausente, geracao_chunk com tipo customizado).

    Tipos de eventos suportados:
    - inicio: Marca o início do processamento
    - info: Mensagens informativas durante o processamento
    - erro: Erros que interrompem o processamento
    - agente: Status de execução de agentes (1, 2 ou 3)
    - geracao_chunk: Chunks de texto gerado pela IA (streaming)
    - sucesso: Evento final com dados da geração concluída
    - parecer_natjus_ausente: Notificação sobre ausência de parecer NATJus
    """

    @staticmethod
    def format_event(event_type: str, data: dict[str, Any]) -> str:
        """
        Formata um evento SSE genérico via SSEEventFormatter.

        Args:
            event_type: Tipo do evento (usado no campo 'tipo')
            data: Dados adicionais do evento

        Returns:
            String formatada no padrão SSE: "data: {json}\\n\\n"
        """
        return SSEEventFormatter.format(event_type, data)

    @staticmethod
    def format_raw(data: dict[str, Any]) -> str:
        """
        Formata um dict arbitrário como evento SSE (sem campo 'tipo' adicional).

        Usado para payloads que já possuem estrutura própria (ex: fallback sem orquestrador).

        Args:
            data: Dicionário a ser serializado como JSON

        Returns:
            String formatada no padrão SSE: "data: {json}\\n\\n"
        """
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    @staticmethod
    def format_inicio(mensagem: str = "Iniciando processamento...", request_id: str | None = None) -> str:
        """
        Formata evento de início do processamento.

        Args:
            mensagem: Mensagem de início
            request_id: ID do request para rastreamento (opcional)
        """
        if request_id:
            return SSEEventFormatter.format("inicio", {"mensagem": mensagem, "request_id": request_id})
        return SSEEventFormatter.inicio(mensagem)

    @staticmethod
    def format_info(mensagem: str) -> str:
        """Formata evento informativo."""
        return SSEEventFormatter.info(mensagem)

    @staticmethod
    def format_erro(mensagem: str) -> str:
        """Formata evento de erro."""
        return SSEEventFormatter.error(mensagem)

    @staticmethod
    def format_agente(agente: int, status: str, mensagem: str) -> str:
        """
        Formata evento de status de agente.

        Args:
            agente: Número do agente (1=Coletor TJ-MS, 2=Detector, 3=Gerador)
            status: Status atual ('ativo', 'concluido', 'erro')
            mensagem: Mensagem descritiva do status
        """
        return SSEEventFormatter.agent_status(agente, status, mensagem)

    @staticmethod
    def format_agente_erro(agente: int, mensagem: str) -> tuple[str, str]:
        """
        Formata par de eventos para erro de agente: agente-erro + erro genérico.

        Padrão recorrente no router: quando um agente falha, emite-se DOIS eventos
        sequenciais — um de agente com status 'erro' e um de erro genérico.

        Args:
            agente: Número do agente (1, 2 ou 3)
            mensagem: Mensagem de erro

        Returns:
            Tupla (evento_agente_erro, evento_erro) para yield sequencial
        """
        return (
            SSEEventFormatter.agent_status(agente, "erro", mensagem),
            SSEEventFormatter.error(mensagem),
        )

    @staticmethod
    def format_geracao_chunk(content: str) -> str:
        """
        Formata evento de chunk de texto gerado pela IA (streaming).

        Usa tipo 'geracao_chunk' (específico do gerador, diferente do 'chunk' genérico).

        Args:
            content: Chunk de texto gerado
        """
        return SSEEventFormatter.format("geracao_chunk", {"content": content})

    @staticmethod
    def format_sucesso(
        geracao_id: int,
        tipo_peca: str,
        minuta_markdown: str,
        performance: dict[str, Any] | None = None,
        **extras,
    ) -> str:
        """
        Formata evento de sucesso com dados da geração concluída.

        Args:
            geracao_id: ID da geração no banco de dados
            tipo_peca: Tipo da peça gerada (ex: "contestação", "inicial")
            minuta_markdown: Conteúdo da minuta em Markdown
            performance: Métricas de performance (ttft_ms, total_ms, request_id)
            **extras: Dados adicionais (ex: modo='semi_automatico', modulos_curados=10)
        """
        data: dict[str, Any] = {
            "geracao_id": geracao_id,
            "tipo_peca": tipo_peca,
            "minuta_markdown": minuta_markdown,
        }
        if performance:
            data["performance"] = performance
        data.update(extras)
        return SSEEventFormatter.format("sucesso", data)

    @staticmethod
    def format_parecer_natjus_ausente(
        tipo_peca: str,
        parecer_document_codes: list[int] | None = None,
        modo_atual: str = "automatico",
    ) -> str:
        """
        Formata evento de parecer NATJus ausente (específico do domínio).

        Args:
            tipo_peca: Tipo da peça sendo gerada
            parecer_document_codes: Códigos de documento que representam parecer NATJus
            modo_atual: Modo de geração ('automatico' ou 'semi_automatico')
        """
        return SSEEventFormatter.format("parecer_natjus_ausente", {
            "titulo": "Parecer NATJus não encontrado",
            "mensagem": "Não foi encontrado parecer NATJus no processo. Ele é essencial para a geração adequada desta peça.",
            "instrucao": "Anexe o parecer em PDF para prosseguir.",
            "tipo_peca": tipo_peca,
            "modo_atual": modo_atual,
            "parecer_required": True,
            "parecer_found": False,
            "parecer_document_codes": parecer_document_codes or [],
        })


# Alias para facilitar importação
stream_helper = GeradorStreamHelper()
