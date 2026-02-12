# sistemas/gerador_pecas/services_stream.py
"""
Serviço de streaming para o Gerador de Peças.

Este módulo contém helpers de formatação de eventos SSE (Server-Sent Events)
para os endpoints de streaming do gerador de peças.

IMPORTANTE: Este módulo contém APENAS helpers de formatação.
A lógica dos generators permanece no router.py devido à complexidade
e acoplamento com orquestradores e dependências.
"""
import json
from typing import Any


class GeradorStreamHelper:
    """
    Helpers para formatação de eventos SSE do gerador de peças.

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
        Formata um evento SSE genérico.

        Args:
            event_type: Tipo do evento (usado no campo 'tipo')
            data: Dados adicionais do evento

        Returns:
            String formatada no padrão SSE: "data: {json}\\n\\n"

        Example:
            >>> helper = GeradorStreamHelper()
            >>> helper.format_event("custom", {"foo": "bar"})
            'data: {"tipo": "custom", "foo": "bar"}\\n\\n'
        """
        payload = {"tipo": event_type, **data}
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    @staticmethod
    def format_inicio(mensagem: str = "Iniciando processamento...", request_id: str | None = None) -> str:
        """
        Formata evento de início do processamento.

        Args:
            mensagem: Mensagem de início
            request_id: ID do request para rastreamento (opcional)

        Returns:
            String formatada no padrão SSE

        Example:
            >>> helper = GeradorStreamHelper()
            >>> helper.format_inicio()
            'data: {"tipo": "inicio", "mensagem": "Iniciando processamento..."}\\n\\n'
        """
        data = {"mensagem": mensagem}
        if request_id:
            data["request_id"] = request_id
        return GeradorStreamHelper.format_event("inicio", data)

    @staticmethod
    def format_info(mensagem: str) -> str:
        """
        Formata evento informativo.

        Args:
            mensagem: Mensagem informativa para exibir ao usuário

        Returns:
            String formatada no padrão SSE

        Example:
            >>> helper = GeradorStreamHelper()
            >>> helper.format_info("Processando documentos...")
            'data: {"tipo": "info", "mensagem": "Processando documentos..."}\\n\\n'
        """
        return GeradorStreamHelper.format_event("info", {"mensagem": mensagem})

    @staticmethod
    def format_erro(mensagem: str) -> str:
        """
        Formata evento de erro.

        Args:
            mensagem: Mensagem de erro para exibir ao usuário

        Returns:
            String formatada no padrão SSE

        Example:
            >>> helper = GeradorStreamHelper()
            >>> helper.format_erro("Timeout na API")
            'data: {"tipo": "erro", "mensagem": "Timeout na API"}\\n\\n'
        """
        return GeradorStreamHelper.format_event("erro", {"mensagem": mensagem})

    @staticmethod
    def format_agente(
        agente: int,
        status: str,
        mensagem: str
    ) -> str:
        """
        Formata evento de status de agente.

        Args:
            agente: Número do agente (1=Coletor TJ-MS, 2=Detector, 3=Gerador)
            status: Status atual ('ativo', 'concluido', 'erro')
            mensagem: Mensagem descritiva do status

        Returns:
            String formatada no padrão SSE

        Example:
            >>> helper = GeradorStreamHelper()
            >>> helper.format_agente(1, "ativo", "Baixando documentos...")
            'data: {"tipo": "agente", "agente": 1, "status": "ativo", "mensagem": "Baixando documentos..."}\\n\\n'
        """
        return GeradorStreamHelper.format_event("agente", {
            "agente": agente,
            "status": status,
            "mensagem": mensagem
        })

    @staticmethod
    def format_geracao_chunk(content: str) -> str:
        """
        Formata evento de chunk de texto gerado pela IA (streaming).

        Args:
            content: Chunk de texto gerado

        Returns:
            String formatada no padrão SSE

        Example:
            >>> helper = GeradorStreamHelper()
            >>> helper.format_geracao_chunk("Considerando que...")
            'data: {"tipo": "geracao_chunk", "content": "Considerando que..."}\\n\\n'
        """
        return GeradorStreamHelper.format_event("geracao_chunk", {"content": content})

    @staticmethod
    def format_sucesso(
        geracao_id: int,
        tipo_peca: str,
        minuta_markdown: str,
        performance: dict[str, Any] | None = None,
        **extras
    ) -> str:
        """
        Formata evento de sucesso com dados da geração concluída.

        Args:
            geracao_id: ID da geração no banco de dados
            tipo_peca: Tipo da peça gerada (ex: "contestação", "inicial")
            minuta_markdown: Conteúdo da minuta em Markdown
            performance: Métricas de performance (ttft_ms, total_ms, request_id)
            **extras: Dados adicionais (ex: modo='semi_automatico', modulos_curados=10)

        Returns:
            String formatada no padrão SSE

        Example:
            >>> helper = GeradorStreamHelper()
            >>> helper.format_sucesso(
            ...     geracao_id=123,
            ...     tipo_peca="contestação",
            ...     minuta_markdown="# Contestação\\n...",
            ...     performance={"ttft_ms": 500, "total_ms": 2000}
            ... )
            'data: {"tipo": "sucesso", "geracao_id": 123, ...}\\n\\n'
        """
        data = {
            "geracao_id": geracao_id,
            "tipo_peca": tipo_peca,
            "minuta_markdown": minuta_markdown,
        }
        if performance:
            data["performance"] = performance
        data.update(extras)
        return GeradorStreamHelper.format_event("sucesso", data)

    @staticmethod
    def format_parecer_natjus_ausente(
        tipo_peca: str,
        parecer_document_codes: list[int] | None = None,
        modo_atual: str = "automatico"
    ) -> str:
        """
        Formata evento de parecer NATJus ausente.

        Args:
            tipo_peca: Tipo da peça sendo gerada
            parecer_document_codes: Códigos de documento que representam parecer NATJus
            modo_atual: Modo de geração ('automatico' ou 'semi_automatico')

        Returns:
            String formatada no padrão SSE

        Example:
            >>> helper = GeradorStreamHelper()
            >>> helper.format_parecer_natjus_ausente("contestação", parecer_document_codes=[10000])
            'data: {"tipo": "parecer_natjus_ausente", ...}\\n\\n'
        """
        return GeradorStreamHelper.format_event("parecer_natjus_ausente", {
            "titulo": "Parecer NATJus não encontrado",
            "mensagem": "Não foi encontrado parecer NATJus no processo. Ele é essencial para a geração adequada desta peça.",
            "instrucao": "Anexe o parecer em PDF para prosseguir.",
            "tipo_peca": tipo_peca,
            "modo_atual": modo_atual,
            "parecer_required": True,
            "parecer_found": False,
            "parecer_document_codes": parecer_document_codes or []
        })


# Alias para facilitar importação
stream_helper = GeradorStreamHelper()
