"""
Testes para o módulo SSE comum (services/shared/sse.py).

Valida formatação de eventos, serialização JSON e gerenciamento de heartbeat.

Autor: LAB/PGE-MS
Data: 2026-02-12
"""
import json
import asyncio
import pytest
from services.shared.sse import SSEEventFormatter, SSEHeartbeat


pytestmark = pytest.mark.unit


class TestSSEEventFormatter:
    """Testes para SSEEventFormatter."""

    def test_format_basico(self):
        """Deve formatar evento SSE com tipo e dados."""
        result = SSEEventFormatter.format("test_type", {"key": "value"})

        assert result.startswith("data: ")
        assert result.endswith("\n\n")

        # Extrai JSON
        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "test_type"
        assert data["key"] == "value"

    def test_format_com_multiplos_campos(self):
        """Deve incluir múltiplos campos no JSON."""
        result = SSEEventFormatter.format("multi", {
            "campo1": "valor1",
            "campo2": 123,
            "campo3": True
        })

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "multi"
        assert data["campo1"] == "valor1"
        assert data["campo2"] == 123
        assert data["campo3"] is True

    def test_status_sem_progress(self):
        """Deve criar evento de status básico."""
        result = SSEEventFormatter.status("Processando...")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "status"
        assert data["mensagem"] == "Processando..."
        assert "step" not in data
        assert "progress" not in data

    def test_status_com_step(self):
        """Deve incluir step quando fornecido."""
        result = SSEEventFormatter.status("Baixando...", step="download")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "status"
        assert data["mensagem"] == "Baixando..."
        assert data["step"] == "download"

    def test_status_com_progress(self):
        """Deve incluir progress quando fornecido."""
        result = SSEEventFormatter.status("Metade completa", progress=0.5)

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "status"
        assert data["mensagem"] == "Metade completa"
        assert data["progress"] == 0.5

    def test_status_com_step_e_progress(self):
        """Deve incluir ambos step e progress."""
        result = SSEEventFormatter.status(
            "Processando documentos",
            step="processing",
            progress=0.75
        )

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["step"] == "processing"
        assert data["progress"] == 0.75

    def test_info(self):
        """Deve criar evento de info."""
        result = SSEEventFormatter.info("Documento processado")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "info"
        assert data["mensagem"] == "Documento processado"

    def test_inicio(self):
        """Deve criar evento de início."""
        result = SSEEventFormatter.inicio("Iniciando processamento...")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "inicio"
        assert data["mensagem"] == "Iniciando processamento..."

    def test_agent_status(self):
        """Deve criar evento de agente com campos corretos."""
        result = SSEEventFormatter.agent_status(1, "ativo", "Conectando...")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "agente"
        assert data["agente"] == 1
        assert data["status"] == "ativo"
        assert data["mensagem"] == "Conectando..."

    def test_agent_status_concluido(self):
        """Deve criar evento de agente concluído."""
        result = SSEEventFormatter.agent_status(2, "concluido", "Análise finalizada")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "agente"
        assert data["agente"] == 2
        assert data["status"] == "concluido"

    def test_agent_status_erro(self):
        """Deve criar evento de agente com erro."""
        result = SSEEventFormatter.agent_status(3, "erro", "Falha na conexão")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "agente"
        assert data["status"] == "erro"
        assert data["mensagem"] == "Falha na conexão"

    def test_error_basico(self):
        """Deve criar evento de erro básico."""
        result = SSEEventFormatter.error("Algo deu errado")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "erro"
        assert data["mensagem"] == "Algo deu errado"
        assert data["code"] == "INTERNAL_ERROR"
        assert "details" not in data

    def test_error_com_code_customizado(self):
        """Deve usar código de erro personalizado."""
        result = SSEEventFormatter.error("Timeout", code="TIMEOUT_ERROR")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "erro"
        assert data["code"] == "TIMEOUT_ERROR"

    def test_error_com_detalhes(self):
        """Deve incluir detalhes quando fornecidos."""
        result = SSEEventFormatter.error(
            "Falha na API",
            code="API_ERROR",
            details="Status 500 retornado"
        )

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "erro"
        assert data["mensagem"] == "Falha na API"
        assert data["code"] == "API_ERROR"
        assert data["details"] == "Status 500 retornado"

    def test_success_sem_dados(self):
        """Deve criar evento de sucesso vazio."""
        result = SSEEventFormatter.success()

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "sucesso"
        assert len(data) == 1  # Apenas 'tipo'

    def test_success_com_dados(self):
        """Deve incluir dados de resultado."""
        result = SSEEventFormatter.success({
            "geracao_id": 123,
            "total_processados": 5
        })

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "sucesso"
        assert data["geracao_id"] == 123
        assert data["total_processados"] == 5

    def test_chunk(self):
        """Deve criar evento de chunk de streaming."""
        result = SSEEventFormatter.chunk("Este é um chunk de texto")

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "chunk"
        assert data["content"] == "Este é um chunk de texto"

    def test_heartbeat_formato(self):
        """Deve criar comentário SSE para heartbeat."""
        result = SSEEventFormatter.heartbeat()

        assert result == ": heartbeat\n\n"
        assert result.startswith(":")
        assert result.endswith("\n\n")

    def test_json_valido_em_todos_eventos(self):
        """Todos os métodos devem gerar JSON válido."""
        eventos = [
            SSEEventFormatter.status("test"),
            SSEEventFormatter.info("test"),
            SSEEventFormatter.inicio("test"),
            SSEEventFormatter.agent_status(1, "ativo", "test"),
            SSEEventFormatter.error("test"),
            SSEEventFormatter.success(),
            SSEEventFormatter.chunk("test"),
        ]

        for evento in eventos:
            # Heartbeat não tem JSON, então pulamos
            if evento.startswith(":"):
                continue

            json_str = evento.replace("data: ", "").strip()
            data = json.loads(json_str)  # Não deve lançar exceção
            assert "tipo" in data

    def test_unicode_preservado(self):
        """Deve preservar caracteres unicode (ensure_ascii=False)."""
        result = SSEEventFormatter.info("Análise concluída com êxito")

        json_str = result.replace("data: ", "").strip()

        # Se ensure_ascii=True, teríamos \u00e1 ao invés de á
        assert "Análise" in json_str
        assert "concluída" in json_str
        assert "êxito" in json_str
        assert "\\u" not in json_str  # Não deve ter escape unicode

    def test_campo_tipo_sempre_primeiro(self):
        """O campo 'tipo' deve aparecer primeiro no JSON (convenção)."""
        result = SSEEventFormatter.format("test", {"z": 1, "a": 2})

        # Em Python 3.7+, dict mantém ordem de inserção
        # tipo deve ser o primeiro campo
        json_str = result.replace("data: ", "").strip()
        assert json_str.startswith('{"tipo": "test"')

    def test_evento_vazio_alem_de_tipo(self):
        """Deve permitir evento com apenas o campo tipo."""
        result = SSEEventFormatter.format("empty_event", {})

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data == {"tipo": "empty_event"}

    def test_valores_complexos_no_evento(self):
        """Deve serializar valores complexos (listas, dicts aninhados)."""
        result = SSEEventFormatter.format("complex", {
            "lista": [1, 2, 3],
            "objeto": {"nested": "value"},
            "nulo": None
        })

        json_str = result.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["lista"] == [1, 2, 3]
        assert data["objeto"]["nested"] == "value"
        assert data["nulo"] is None


class TestSSEHeartbeat:
    """Testes para SSEHeartbeat."""

    async def test_heartbeat_emite_no_intervalo(self):
        """Deve emitir heartbeats no intervalo configurado."""
        heartbeat = SSEHeartbeat(interval_seconds=0.1)  # 100ms para teste rápido

        eventos = []
        async def collector():
            async for event in heartbeat.start():
                eventos.append(event)
                if len(eventos) >= 3:
                    heartbeat.stop()
                    break

        await collector()

        assert len(eventos) == 3
        for evento in eventos:
            assert evento == ": heartbeat\n\n"

    async def test_heartbeat_para_com_stop(self):
        """Deve parar de emitir quando stop() é chamado."""
        heartbeat = SSEHeartbeat(interval_seconds=0.05)

        eventos = []
        async def collector():
            async for event in heartbeat.start():
                eventos.append(event)

        task = asyncio.create_task(collector())

        # Aguarda alguns heartbeats
        await asyncio.sleep(0.15)
        heartbeat.stop()

        # Aguarda task finalizar
        await asyncio.sleep(0.1)
        task.cancel()

        # Deve ter emitido pelo menos 1 heartbeat
        assert len(eventos) >= 1
        # Mas não deve continuar emitindo após stop()
        count_inicial = len(eventos)
        await asyncio.sleep(0.15)
        assert len(eventos) == count_inicial  # Não aumentou

    async def test_heartbeat_intervalo_customizado(self):
        """Deve respeitar intervalo customizado."""
        heartbeat = SSEHeartbeat(interval_seconds=0.2)

        eventos = []
        start = asyncio.get_event_loop().time()

        async def collector():
            async for event in heartbeat.start():
                eventos.append(asyncio.get_event_loop().time())
                if len(eventos) >= 2:
                    heartbeat.stop()
                    break

        await collector()

        # Diferença entre primeiro e segundo heartbeat deve ser ~0.2s
        if len(eventos) >= 2:
            diff = eventos[1] - eventos[0]
            assert 0.15 < diff < 0.25  # Tolerância de 50ms

    async def test_heartbeat_stop_idempotente(self):
        """Chamar stop() múltiplas vezes não deve causar erro."""
        heartbeat = SSEHeartbeat(interval_seconds=0.1)

        task = asyncio.create_task(heartbeat.start().__anext__())
        await asyncio.sleep(0.05)

        heartbeat.stop()
        heartbeat.stop()  # Segunda chamada
        heartbeat.stop()  # Terceira chamada

        # Não deve lançar exceção
        task.cancel()

    async def test_heartbeat_formato_evento(self):
        """Eventos de heartbeat devem estar no formato correto."""
        heartbeat = SSEHeartbeat(interval_seconds=0.05)

        evento = None
        async def get_first():
            nonlocal evento
            async for e in heartbeat.start():
                evento = e
                heartbeat.stop()
                break

        await get_first()

        assert evento == ": heartbeat\n\n"
        assert evento.startswith(":")
        assert evento.endswith("\n\n")

    async def test_heartbeat_nao_bloqueia_loop(self):
        """Heartbeat não deve bloquear o event loop."""
        heartbeat = SSEHeartbeat(interval_seconds=0.1)

        outras_operacoes = []

        async def outras_tasks():
            for i in range(5):
                await asyncio.sleep(0.05)
                outras_operacoes.append(i)

        async def collect_heartbeat():
            count = 0
            async for _ in heartbeat.start():
                count += 1
                if count >= 2:
                    heartbeat.stop()
                    break

        # Roda ambas as tasks em paralelo
        await asyncio.gather(
            collect_heartbeat(),
            outras_tasks()
        )

        # outras_tasks deve ter completado mesmo com heartbeat rodando
        assert len(outras_operacoes) == 5


class TestSSEIntegracao:
    """Testes de integração entre componentes SSE."""

    def test_todos_eventos_tem_formato_consistente(self):
        """Todos os tipos de evento devem ter formato consistente."""
        eventos = [
            SSEEventFormatter.status("test"),
            SSEEventFormatter.info("test"),
            SSEEventFormatter.inicio("test"),
            SSEEventFormatter.agent_status(1, "ativo", "test"),
            SSEEventFormatter.error("test"),
            SSEEventFormatter.success({"key": "value"}),
            SSEEventFormatter.chunk("test"),
        ]

        for evento in eventos:
            # Todos devem começar com "data: "
            assert evento.startswith("data: ")
            # Todos devem terminar com dupla quebra de linha
            assert evento.endswith("\n\n")
            # JSON deve ser válido
            json_str = evento.replace("data: ", "").strip()
            data = json.loads(json_str)
            # Todos devem ter campo 'tipo'
            assert "tipo" in data

    def test_heartbeat_diferente_de_eventos(self):
        """Heartbeat deve ter formato diferente (comentário)."""
        heartbeat = SSEEventFormatter.heartbeat()
        evento_normal = SSEEventFormatter.info("test")

        # Heartbeat é comentário, evento é data
        assert heartbeat.startswith(":")
        assert evento_normal.startswith("data: ")

        # Ambos terminam com dupla quebra
        assert heartbeat.endswith("\n\n")
        assert evento_normal.endswith("\n\n")

    def test_migração_exemplo_gerador_pecas(self):
        """
        Exemplo de migração do padrão existente para o novo módulo.

        Este teste documenta como converter código existente.
        """
        # ANTES (padrão existente no projeto):
        # yield f"data: {json.dumps({'tipo': 'info', 'mensagem': 'Processando...'}, ensure_ascii=False)}\n\n"

        # DEPOIS (usando módulo SSE):
        resultado = SSEEventFormatter.info("Processando...")

        # Deve produzir o mesmo resultado
        assert "data: " in resultado
        assert '"tipo": "info"' in resultado
        assert '"mensagem": "Processando..."' in resultado
        assert resultado.endswith("\n\n")

    def test_migração_exemplo_agente(self):
        """Exemplo de migração do padrão de agente."""
        # ANTES:
        # yield f"data: {json.dumps({'tipo': 'agente', 'agente': 1, 'status': 'ativo', 'mensagem': 'Baixando...'})}\n\n"

        # DEPOIS:
        resultado = SSEEventFormatter.agent_status(1, "ativo", "Baixando...")

        json_str = resultado.replace("data: ", "").strip()
        data = json.loads(json_str)

        assert data["tipo"] == "agente"
        assert data["agente"] == 1
        assert data["status"] == "ativo"
        assert data["mensagem"] == "Baixando..."
