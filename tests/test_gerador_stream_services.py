# tests/test_gerador_stream_services.py
"""
Testes unitários para services_stream.py (helpers de formatação SSE).
"""
import json
import pytest
from sistemas.gerador_pecas.services_stream import GeradorStreamHelper, stream_helper


pytestmark = pytest.mark.unit


class TestGeradorStreamHelper:
    """Testes para helpers de formatação de eventos SSE."""

    def test_format_event_basico(self):
        """Testa formatação genérica de evento SSE."""
        result = GeradorStreamHelper.format_event("custom", {"foo": "bar", "num": 42})

        # Deve seguir padrão SSE: "data: {json}\n\n"
        assert result.startswith("data: {")
        assert result.endswith("}\n\n")

        # Parse do JSON
        json_str = result.replace("data: ", "").replace("\n\n", "")
        data = json.loads(json_str)

        assert data["tipo"] == "custom"
        assert data["foo"] == "bar"
        assert data["num"] == 42

    def test_format_event_ensure_ascii_false(self):
        """Testa que caracteres especiais não são escapados."""
        result = GeradorStreamHelper.format_event("info", {"mensagem": "Testando ação com acentuação"})

        # Deve preservar acentos (ensure_ascii=False)
        assert "ação" in result
        assert "acentuação" in result
        assert "\\u" not in result  # Não deve ter escape unicode

    def test_format_inicio_minimo(self):
        """Testa evento de início com valores padrão."""
        result = GeradorStreamHelper.format_inicio()

        data = self._parse_sse(result)
        assert data["tipo"] == "inicio"
        assert data["mensagem"] == "Iniciando processamento..."
        assert "request_id" not in data

    def test_format_inicio_com_request_id(self):
        """Testa evento de início com request_id."""
        result = GeradorStreamHelper.format_inicio(
            mensagem="Começando análise...",
            request_id="req-123"
        )

        data = self._parse_sse(result)
        assert data["tipo"] == "inicio"
        assert data["mensagem"] == "Começando análise..."
        assert data["request_id"] == "req-123"

    def test_format_info(self):
        """Testa evento informativo."""
        result = GeradorStreamHelper.format_info("Processando documentos...")

        data = self._parse_sse(result)
        assert data["tipo"] == "info"
        assert data["mensagem"] == "Processando documentos..."

    def test_format_erro(self):
        """Testa evento de erro."""
        result = GeradorStreamHelper.format_erro("Timeout na API do TJ-MS")

        data = self._parse_sse(result)
        assert data["tipo"] == "erro"
        assert data["mensagem"] == "Timeout na API do TJ-MS"

    def test_format_agente_ativo(self):
        """Testa evento de agente ativo."""
        result = GeradorStreamHelper.format_agente(1, "ativo", "Baixando documentos do TJ-MS...")

        data = self._parse_sse(result)
        assert data["tipo"] == "agente"
        assert data["agente"] == 1
        assert data["status"] == "ativo"
        assert data["mensagem"] == "Baixando documentos do TJ-MS..."

    def test_format_agente_concluido(self):
        """Testa evento de agente concluído."""
        result = GeradorStreamHelper.format_agente(2, "concluido", "15 módulos ativados")

        data = self._parse_sse(result)
        assert data["tipo"] == "agente"
        assert data["agente"] == 2
        assert data["status"] == "concluido"
        assert data["mensagem"] == "15 módulos ativados"

    def test_format_agente_erro(self):
        """Testa evento de agente com erro."""
        result = GeradorStreamHelper.format_agente(3, "erro", "Falha na geração")

        data = self._parse_sse(result)
        assert data["tipo"] == "agente"
        assert data["agente"] == 3
        assert data["status"] == "erro"
        assert data["mensagem"] == "Falha na geração"

    def test_format_geracao_chunk(self):
        """Testa evento de chunk de texto gerado."""
        result = GeradorStreamHelper.format_geracao_chunk("Considerando que...")

        data = self._parse_sse(result)
        assert data["tipo"] == "geracao_chunk"
        assert data["content"] == "Considerando que..."

    def test_format_geracao_chunk_multiline(self):
        """Testa chunk com múltiplas linhas."""
        chunk_text = "## Contestação\n\nO Estado de MS vem contestar...\n"
        result = GeradorStreamHelper.format_geracao_chunk(chunk_text)

        data = self._parse_sse(result)
        assert data["tipo"] == "geracao_chunk"
        assert data["content"] == chunk_text
        assert "\n" in data["content"]  # Preserva quebras de linha

    def test_format_sucesso_minimo(self):
        """Testa evento de sucesso com campos mínimos."""
        result = GeradorStreamHelper.format_sucesso(
            geracao_id=123,
            tipo_peca="contestação",
            minuta_markdown="# Contestação\n\nTexto da peça..."
        )

        data = self._parse_sse(result)
        assert data["tipo"] == "sucesso"
        assert data["geracao_id"] == 123
        assert data["tipo_peca"] == "contestação"
        assert data["minuta_markdown"] == "# Contestação\n\nTexto da peça..."
        assert "performance" not in data

    def test_format_sucesso_com_performance(self):
        """Testa evento de sucesso com métricas de performance."""
        result = GeradorStreamHelper.format_sucesso(
            geracao_id=456,
            tipo_peca="inicial",
            minuta_markdown="# Inicial\n...",
            performance={"ttft_ms": 500, "total_ms": 2000, "request_id": "req-789"}
        )

        data = self._parse_sse(result)
        assert data["tipo"] == "sucesso"
        assert data["geracao_id"] == 456
        assert data["performance"]["ttft_ms"] == 500
        assert data["performance"]["total_ms"] == 2000
        assert data["performance"]["request_id"] == "req-789"

    def test_format_sucesso_com_extras(self):
        """Testa evento de sucesso com campos extras."""
        result = GeradorStreamHelper.format_sucesso(
            geracao_id=789,
            tipo_peca="recursal",
            minuta_markdown="# Recurso\n...",
            modo="semi_automatico",
            modulos_curados=10,
            versao_prompt="2.0"
        )

        data = self._parse_sse(result)
        assert data["tipo"] == "sucesso"
        assert data["modo"] == "semi_automatico"
        assert data["modulos_curados"] == 10
        assert data["versao_prompt"] == "2.0"

    def test_format_parecer_natjus_ausente_minimo(self):
        """Testa evento de parecer ausente com campos mínimos."""
        result = GeradorStreamHelper.format_parecer_natjus_ausente("contestação")

        data = self._parse_sse(result)
        assert data["tipo"] == "parecer_natjus_ausente"
        assert data["titulo"] == "Parecer NATJus não encontrado"
        assert "essencial" in data["mensagem"]
        assert data["instrucao"] == "Anexe o parecer em PDF para prosseguir."
        assert data["tipo_peca"] == "contestação"
        assert data["modo_atual"] == "automatico"
        assert data["parecer_required"] is True
        assert data["parecer_found"] is False
        assert data["parecer_document_codes"] == []

    def test_format_parecer_natjus_ausente_completo(self):
        """Testa evento de parecer ausente com todos os campos."""
        result = GeradorStreamHelper.format_parecer_natjus_ausente(
            tipo_peca="inicial",
            parecer_document_codes=[10000, 10001],
            modo_atual="semi_automatico"
        )

        data = self._parse_sse(result)
        assert data["tipo"] == "parecer_natjus_ausente"
        assert data["tipo_peca"] == "inicial"
        assert data["parecer_document_codes"] == [10000, 10001]
        assert data["modo_atual"] == "semi_automatico"

    def test_format_event_json_valido(self):
        """Testa que todos os eventos geram JSON válido."""
        eventos = [
            GeradorStreamHelper.format_inicio(),
            GeradorStreamHelper.format_info("teste"),
            GeradorStreamHelper.format_erro("erro"),
            GeradorStreamHelper.format_agente(1, "ativo", "msg"),
            GeradorStreamHelper.format_geracao_chunk("texto"),
            GeradorStreamHelper.format_sucesso(1, "tipo", "markdown"),
            GeradorStreamHelper.format_parecer_natjus_ausente("tipo"),
        ]

        for evento in eventos:
            # Todos devem ter o formato correto
            assert evento.startswith("data: {")
            assert evento.endswith("}\n\n")

            # Todos devem ser JSON válido
            json_str = evento.replace("data: ", "").replace("\n\n", "")
            data = json.loads(json_str)  # Não deve lançar exceção
            assert "tipo" in data

    def test_stream_helper_alias(self):
        """Testa que o alias stream_helper funciona."""
        assert stream_helper is not None
        assert isinstance(stream_helper, GeradorStreamHelper)

        # Testa uso do alias
        result = stream_helper.format_info("Teste via alias")
        data = self._parse_sse(result)
        assert data["tipo"] == "info"
        assert data["mensagem"] == "Teste via alias"

    def test_format_event_valores_none(self):
        """Testa comportamento com valores None."""
        result = GeradorStreamHelper.format_event("test", {"valor": None, "outro": "ok"})

        data = self._parse_sse(result)
        assert data["tipo"] == "test"
        assert data["valor"] is None  # None deve ser preservado
        assert data["outro"] == "ok"

    def test_format_event_lista_vazia(self):
        """Testa comportamento com lista vazia."""
        result = GeradorStreamHelper.format_event("test", {"lista": []})

        data = self._parse_sse(result)
        assert data["tipo"] == "test"
        assert data["lista"] == []

    def test_format_event_dict_aninhado(self):
        """Testa evento com dict aninhado."""
        result = GeradorStreamHelper.format_event("test", {
            "nested": {"key": "value", "num": 42}
        })

        data = self._parse_sse(result)
        assert data["tipo"] == "test"
        assert data["nested"]["key"] == "value"
        assert data["nested"]["num"] == 42

    # ===== Testes format_agente_erro =====

    def test_format_agente_erro_retorna_tupla(self):
        """Testa que format_agente_erro retorna tupla com dois eventos."""
        resultado = GeradorStreamHelper.format_agente_erro(3, "Falha na geração")

        assert isinstance(resultado, tuple)
        assert len(resultado) == 2

        evt_agente, evt_erro = resultado

        # Primeiro evento: agente com status erro
        data_agente = self._parse_sse(evt_agente)
        assert data_agente["tipo"] == "agente"
        assert data_agente["agente"] == 3
        assert data_agente["status"] == "erro"
        assert data_agente["mensagem"] == "Falha na geração"

        # Segundo evento: erro genérico
        data_erro = self._parse_sse(evt_erro)
        assert data_erro["tipo"] == "erro"
        assert data_erro["mensagem"] == "Falha na geração"

    def test_format_agente_erro_todos_agentes(self):
        """Testa format_agente_erro para cada número de agente."""
        for agente in [1, 2, 3]:
            evt_agente, evt_erro = GeradorStreamHelper.format_agente_erro(agente, f"Erro agente {agente}")

            data_agente = self._parse_sse(evt_agente)
            assert data_agente["agente"] == agente
            assert data_agente["status"] == "erro"

            data_erro = self._parse_sse(evt_erro)
            assert data_erro["tipo"] == "erro"

    def test_format_agente_erro_mensagem_preservada(self):
        """Testa que a mesma mensagem aparece em ambos os eventos."""
        msg = "Timeout ao consultar TJ-MS após 30s"
        evt_agente, evt_erro = GeradorStreamHelper.format_agente_erro(1, msg)

        data_agente = self._parse_sse(evt_agente)
        data_erro = self._parse_sse(evt_erro)

        assert data_agente["mensagem"] == msg
        assert data_erro["mensagem"] == msg

    # ===== Testes format_raw =====

    def test_format_raw_dict_simples(self):
        """Testa format_raw com dict simples."""
        data = {"resultado": "ok", "total": 5}
        result = GeradorStreamHelper.format_raw(data)

        assert result.startswith("data: {")
        assert result.endswith("}\n\n")

        parsed = json.loads(result.replace("data: ", "").replace("\n\n", ""))
        assert parsed["resultado"] == "ok"
        assert parsed["total"] == 5

    def test_format_raw_sem_campo_tipo(self):
        """Testa que format_raw NAO injeta campo 'tipo' automaticamente."""
        data = {"foo": "bar"}
        result = GeradorStreamHelper.format_raw(data)

        parsed = json.loads(result.replace("data: ", "").replace("\n\n", ""))
        assert "tipo" not in parsed
        assert parsed["foo"] == "bar"

    def test_format_raw_preserva_unicode(self):
        """Testa que format_raw preserva caracteres unicode."""
        data = {"mensagem": "Ação com acentuação"}
        result = GeradorStreamHelper.format_raw(data)

        assert "Ação" in result
        assert "acentuação" in result
        assert "\\u" not in result

    def test_format_raw_com_tipo_existente(self):
        """Testa que format_raw preserva campo 'tipo' se já existir no dict."""
        data = {"tipo": "custom_event", "dados": [1, 2, 3]}
        result = GeradorStreamHelper.format_raw(data)

        parsed = json.loads(result.replace("data: ", "").replace("\n\n", ""))
        assert parsed["tipo"] == "custom_event"
        assert parsed["dados"] == [1, 2, 3]

    # ===== Helpers =====

    def _parse_sse(self, sse_event: str) -> dict:
        """
        Extrai e parseia o JSON de um evento SSE.

        Args:
            sse_event: String no formato "data: {json}\\n\\n"

        Returns:
            Dict parseado do JSON
        """
        json_str = sse_event.replace("data: ", "").replace("\n\n", "")
        return json.loads(json_str)
