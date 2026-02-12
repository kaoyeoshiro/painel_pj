"""
Exemplo prático de uso do módulo SSE comum.

Este arquivo demonstra como usar SSEEventFormatter em um endpoint real.
NÃO é código de produção — apenas exemplo para referência.

Autor: LAB/PGE-MS
Data: 2026-02-12
"""
import asyncio
from typing import AsyncIterator
from services.shared import SSEEventFormatter


async def exemplo_stream_simples() -> AsyncIterator[str]:
    """
    Exemplo básico de streaming SSE.

    Simula processamento com eventos de status.
    """
    yield SSEEventFormatter.inicio("Iniciando processamento...")

    await asyncio.sleep(0.5)
    yield SSEEventFormatter.info("Preparando ambiente...")

    await asyncio.sleep(0.5)
    yield SSEEventFormatter.info("Carregando dados...")

    await asyncio.sleep(0.5)
    yield SSEEventFormatter.success({"total": 10, "processados": 10})


async def exemplo_stream_agentes() -> AsyncIterator[str]:
    """
    Exemplo com pipeline de agentes (padrão do gerador de peças).

    Simula múltiplos agentes processando sequencialmente.
    """
    yield SSEEventFormatter.inicio("Iniciando pipeline de agentes...")

    # Agente 1: Coleta de dados
    yield SSEEventFormatter.agent_status(1, "ativo", "Conectando ao TJ-MS...")
    await asyncio.sleep(0.5)

    yield SSEEventFormatter.info("Baixando documentos do processo...")
    await asyncio.sleep(0.5)

    yield SSEEventFormatter.agent_status(1, "concluido", "15 documentos baixados")

    # Agente 2: Análise
    yield SSEEventFormatter.agent_status(2, "ativo", "Analisando documentos...")
    await asyncio.sleep(0.5)

    yield SSEEventFormatter.info("Classificando documentos por tipo...")
    await asyncio.sleep(0.5)

    yield SSEEventFormatter.agent_status(2, "concluido", "Análise concluída")

    # Agente 3: Geração
    yield SSEEventFormatter.agent_status(3, "ativo", "Gerando peça processual...")
    await asyncio.sleep(0.5)

    # Streaming de chunks (simulando geração de texto)
    texto_chunks = [
        "Excelentíssimo Senhor ",
        "Doutor Juiz de Direito ",
        "da 1ª Vara Cível...\n\n"
    ]

    for chunk in texto_chunks:
        yield SSEEventFormatter.chunk(chunk)
        await asyncio.sleep(0.2)

    yield SSEEventFormatter.agent_status(3, "concluido", "Peça gerada com sucesso")

    # Resultado final
    yield SSEEventFormatter.success({
        "geracao_id": 123,
        "tamanho_bytes": 5432,
        "tempo_segundos": 3
    })


async def exemplo_stream_com_erro() -> AsyncIterator[str]:
    """
    Exemplo com tratamento de erro.

    Demonstra como emitir eventos de erro.
    """
    yield SSEEventFormatter.inicio("Processando documento...")

    try:
        yield SSEEventFormatter.info("Conectando ao servidor...")
        await asyncio.sleep(0.3)

        # Simula erro
        raise TimeoutError("Timeout após 30 segundos")

    except TimeoutError as e:
        yield SSEEventFormatter.error(
            str(e),
            code="TIMEOUT_ERROR",
            details="Servidor não respondeu no tempo limite"
        )


async def exemplo_stream_com_progresso() -> AsyncIterator[str]:
    """
    Exemplo com barra de progresso.

    Útil para processos longos com etapas quantificáveis.
    """
    yield SSEEventFormatter.inicio("Processando lote de documentos...")

    total = 10
    for i in range(total):
        progress = (i + 1) / total

        yield SSEEventFormatter.status(
            f"Processando documento {i+1}/{total}",
            step="processing",
            progress=progress
        )

        await asyncio.sleep(0.2)

    yield SSEEventFormatter.success({"total_processados": total})


async def exemplo_uso_em_endpoint():
    """
    Simula como seria usado em um endpoint FastAPI real.

    Este código não roda sozinho — apenas demonstra o padrão.
    """
    # ============================================================
    # EM UM ROUTER REAL:
    # ============================================================
    # from fastapi import APIRouter
    # from fastapi.responses import StreamingResponse
    #
    # router = APIRouter()
    #
    # @router.post("/processar")
    # async def processar_documento(request: ProcessarRequest):
    #     async def event_generator():
    #         yield SSEEventFormatter.inicio("Iniciando...")
    #
    #         try:
    #             resultado = await service.processar(request.documento_id)
    #             yield SSEEventFormatter.success({"id": resultado.id})
    #         except Exception as e:
    #             yield SSEEventFormatter.error(str(e))
    #
    #     return StreamingResponse(
    #         event_generator(),
    #         media_type="text/event-stream",
    #         headers={
    #             "Cache-Control": "no-cache",
    #             "Connection": "keep-alive",
    #             "X-Accel-Buffering": "no"
    #         }
    #     )
    pass


async def main():
    """Executa exemplos para demonstração."""
    print("=" * 60)
    print("EXEMPLO 1: Stream Simples")
    print("=" * 60)
    async for event in exemplo_stream_simples():
        print(event, end="")

    print("\n" + "=" * 60)
    print("EXEMPLO 2: Pipeline de Agentes")
    print("=" * 60)
    async for event in exemplo_stream_agentes():
        print(event, end="")

    print("\n" + "=" * 60)
    print("EXEMPLO 3: Stream com Erro")
    print("=" * 60)
    async for event in exemplo_stream_com_erro():
        print(event, end="")

    print("\n" + "=" * 60)
    print("EXEMPLO 4: Stream com Progresso")
    print("=" * 60)
    async for event in exemplo_stream_com_progresso():
        print(event, end="")

    print("\n" + "=" * 60)
    print("Exemplos concluídos!")
    print("=" * 60)


if __name__ == "__main__":
    # Para rodar este exemplo:
    # cd E:\Projetos\PGE\portal-pge
    # python services/shared/example_usage.py
    asyncio.run(main())
