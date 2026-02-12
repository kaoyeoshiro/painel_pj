"""
Módulo SSE comum para o Portal PGE.

Fornece abstrações reutilizáveis para Server-Sent Events (SSE):
- Formatação padronizada de eventos
- Heartbeat automático
- Tratamento de erro padrão

USO: Este módulo é para NOVA adoção — não obriga migração dos services existentes.
Para migrar um service existente:
1. Importe SSEEventFormatter
2. Substitua formatações inline pelos métodos do formatter
3. Use SSEHeartbeat para manter conexão viva

PADRÕES OBSERVADOS NO PROJETO:
- formato: `data: {json}\n\n` (campo "data:" seguido de JSON)
- ensure_ascii=False (preservar unicode)
- tipos comuns: "inicio", "info", "erro", "agente", "sucesso", "chunk"
- agente com campos: tipo="agente", agente=int, status=str, mensagem=str

Autor: LAB/PGE-MS
Data: 2026-02-12
"""
import json
import asyncio
from typing import Any, AsyncIterator


class SSEEventFormatter:
    """
    Formatador padronizado de eventos SSE.

    Implementa o padrão observado no projeto:
    - `data: {json}\n\n` (duas quebras de linha no final)
    - JSON com campo 'tipo' e campos adicionais
    - ensure_ascii=False para preservar caracteres unicode

    Exemplos:
        >>> formatter = SSEEventFormatter()
        >>> formatter.status("Processando documento...")
        'data: {"tipo": "status", "mensagem": "Processando documento..."}\n\n'

        >>> formatter.agent_status(1, "ativo", "Baixando arquivos...")
        'data: {"tipo": "agente", "agente": 1, "status": "ativo", "mensagem": "Baixando arquivos..."}\n\n'
    """

    @staticmethod
    def format(event_type: str, data: dict[str, Any]) -> str:
        """
        Formata evento SSE completo.

        Args:
            event_type: Tipo do evento (será incluído como 'tipo' no JSON)
            data: Dados adicionais do evento (serão mesclados com 'tipo')

        Returns:
            String formatada no padrão SSE do projeto

        Note:
            O campo 'tipo' sempre aparece primeiro no dict resultante.
        """
        payload = {"tipo": event_type, **data}
        return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

    @staticmethod
    def status(mensagem: str, step: str = "", progress: float | None = None) -> str:
        """
        Evento de status/progresso.

        Args:
            mensagem: Mensagem descritiva do status
            step: Etapa atual (opcional)
            progress: Progresso de 0.0 a 1.0 (opcional)

        Returns:
            Evento SSE formatado com tipo "status"

        Examples:
            >>> SSEEventFormatter.status("Processando...")
            'data: {"tipo": "status", "mensagem": "Processando..."}\n\n'

            >>> SSEEventFormatter.status("Baixando...", step="download", progress=0.5)
            'data: {"tipo": "status", "mensagem": "Baixando...", "step": "download", "progress": 0.5}\n\n'
        """
        data = {"mensagem": mensagem}
        if step:
            data["step"] = step
        if progress is not None:
            data["progress"] = progress
        return SSEEventFormatter.format("status", data)

    @staticmethod
    def info(mensagem: str) -> str:
        """
        Evento informativo (tipo comum no projeto).

        Args:
            mensagem: Mensagem informativa

        Returns:
            Evento SSE formatado com tipo "info"

        Examples:
            >>> SSEEventFormatter.info("Documento processado com sucesso")
            'data: {"tipo": "info", "mensagem": "Documento processado com sucesso"}\n\n'
        """
        return SSEEventFormatter.format("info", {"mensagem": mensagem})

    @staticmethod
    def inicio(mensagem: str) -> str:
        """
        Evento de início (tipo comum no projeto).

        Args:
            mensagem: Mensagem de início

        Returns:
            Evento SSE formatado com tipo "inicio"

        Examples:
            >>> SSEEventFormatter.inicio("Iniciando processamento...")
            'data: {"tipo": "inicio", "mensagem": "Iniciando processamento..."}\n\n'
        """
        return SSEEventFormatter.format("inicio", {"mensagem": mensagem})

    @staticmethod
    def agent_status(agente: int, status: str, mensagem: str) -> str:
        """
        Evento de status de agente (padrão específico do projeto).

        Args:
            agente: Número do agente (ex: 1, 2, 3)
            status: Status do agente ("ativo", "concluido", "erro")
            mensagem: Mensagem descritiva

        Returns:
            Evento SSE formatado com tipo "agente"

        Examples:
            >>> SSEEventFormatter.agent_status(1, "ativo", "Conectando ao TJ-MS...")
            'data: {"tipo": "agente", "agente": 1, "status": "ativo", "mensagem": "Conectando ao TJ-MS..."}\n\n'

            >>> SSEEventFormatter.agent_status(2, "concluido", "Análise finalizada")
            'data: {"tipo": "agente", "agente": 2, "status": "concluido", "mensagem": "Análise finalizada"}\n\n'
        """
        return SSEEventFormatter.format("agente", {
            "agente": agente,
            "status": status,
            "mensagem": mensagem
        })

    @staticmethod
    def error(mensagem: str, code: str = "INTERNAL_ERROR", details: str = "") -> str:
        """
        Evento de erro.

        Args:
            mensagem: Mensagem de erro principal
            code: Código do erro (opcional)
            details: Detalhes adicionais (opcional)

        Returns:
            Evento SSE formatado com tipo "erro"

        Note:
            O projeto usa "erro" (português) como tipo padrão de erro.

        Examples:
            >>> SSEEventFormatter.error("Falha na conexão")
            'data: {"tipo": "erro", "mensagem": "Falha na conexão", "code": "INTERNAL_ERROR"}\n\n'

            >>> SSEEventFormatter.error("Timeout", "TIMEOUT_ERROR", "30s excedidos")
            'data: {"tipo": "erro", "mensagem": "Timeout", "code": "TIMEOUT_ERROR", "details": "30s excedidos"}\n\n'
        """
        data = {"mensagem": mensagem, "code": code}
        if details:
            data["details"] = details
        return SSEEventFormatter.format("erro", data)

    @staticmethod
    def success(data: dict[str, Any] | None = None) -> str:
        """
        Evento de conclusão/sucesso.

        Args:
            data: Dados de resultado (opcional)

        Returns:
            Evento SSE formatado com tipo "sucesso"

        Examples:
            >>> SSEEventFormatter.success()
            'data: {"tipo": "sucesso"}\n\n'

            >>> SSEEventFormatter.success({"geracao_id": 123, "total": 5})
            'data: {"tipo": "sucesso", "geracao_id": 123, "total": 5}\n\n'
        """
        return SSEEventFormatter.format("sucesso", data or {})

    @staticmethod
    def chunk(content: str) -> str:
        """
        Evento de chunk de streaming (para geração de texto em tempo real).

        Args:
            content: Conteúdo do chunk

        Returns:
            Evento SSE formatado com tipo "chunk"

        Note:
            Usado em gerações de texto com LLM para enviar conteúdo
            progressivamente ao frontend.

        Examples:
            >>> SSEEventFormatter.chunk("Este é um ")
            'data: {"tipo": "chunk", "content": "Este é um "}\n\n'
        """
        return SSEEventFormatter.format("chunk", {"content": content})

    @staticmethod
    def heartbeat() -> str:
        """
        Evento de heartbeat para manter conexão.

        Returns:
            Comentário SSE (não processado pelo EventSource do navegador)

        Note:
            Usa o formato de comentário SSE (`: comentário\n\n`) que é
            ignorado pelo cliente mas mantém a conexão TCP ativa.

        Examples:
            >>> SSEEventFormatter.heartbeat()
            ': heartbeat\n\n'
        """
        return ": heartbeat\n\n"


class SSEHeartbeat:
    """
    Gerenciador de heartbeat para SSE.

    Emite eventos periódicos para manter conexão TCP ativa e evitar timeout
    de proxies/load balancers.

    Uso típico:
        >>> async def my_stream():
        ...     heartbeat = SSEHeartbeat(interval_seconds=15.0)
        ...
        ...     async def generator():
        ...         task = asyncio.create_task(heartbeat.start())
        ...         try:
        ...             # Seu processamento aqui
        ...             yield "data: {...}\n\n"
        ...             # ...
        ...         finally:
        ...             heartbeat.stop()
        ...             await task
        ...
        ...     return StreamingResponse(generator(), media_type="text/event-stream")

    Note:
        Atualmente, a maioria dos endpoints do projeto NÃO usa heartbeat explícito
        pois o processamento é contínuo (sempre emitindo eventos). Este componente
        é útil para casos onde há longos períodos de silêncio entre eventos.
    """

    def __init__(self, interval_seconds: float = 15.0):
        """
        Inicializa gerenciador de heartbeat.

        Args:
            interval_seconds: Intervalo entre heartbeats (padrão: 15s)
        """
        self.interval = interval_seconds
        self._task: asyncio.Task | None = None
        self._should_stop = False

    async def start(self) -> AsyncIterator[str]:
        """
        Generator que emite heartbeats no intervalo configurado.

        Yields:
            str: Eventos de heartbeat no formato SSE

        Note:
            Este generator roda indefinidamente até stop() ser chamado.
            Use como task paralela ao processamento principal.
        """
        while not self._should_stop:
            await asyncio.sleep(self.interval)
            if not self._should_stop:
                yield SSEEventFormatter.heartbeat()

    def stop(self):
        """
        Para a emissão de heartbeats.

        Note:
            Deve ser chamado em finally para garantir limpeza.
        """
        self._should_stop = True
