# tests/test_prestacao_stream.py
"""
Testes unitários para helpers de streaming SSE de prestação de contas.

Testa a formatação correta de eventos SSE, validação de JSON e campos obrigatórios.
"""

import pytest
import json
from sistemas.prestacao_contas.services_stream import (
    evento_inicio,
    evento_etapa,
    evento_progresso,
    evento_info,
    evento_aviso,
    evento_erro,
    evento_sucesso,
    evento_resultado,
    evento_solicitar_documentos,
    evento_fim,
    evento_erro_com_fim,
    evento_etapa_com_progresso,
)
from sistemas.prestacao_contas.schemas import EventoSSE

pytestmark = pytest.mark.unit


# =====================================================
# TESTES DE EVENTOS BÁSICOS
# =====================================================

def test_evento_inicio_campos_obrigatorios():
    """Evento de início deve ter tipo e mensagem"""
    evt = evento_inicio()

    assert evt.tipo == "inicio"
    assert evt.mensagem is not None
    assert "Iniciando" in evt.mensagem


def test_evento_inicio_customizado():
    """Evento de início deve aceitar mensagem customizada"""
    mensagem = "Começando processamento especial"
    evt = evento_inicio(mensagem)

    assert evt.tipo == "inicio"
    assert evt.mensagem == mensagem


def test_evento_inicio_json_valido():
    """Evento de início deve ser serializável para JSON"""
    evt = evento_inicio()
    json_str = evt.model_dump_json()

    # Deve ser JSON válido
    parsed = json.loads(json_str)
    assert parsed["tipo"] == "inicio"
    assert "mensagem" in parsed


# =====================================================
# TESTES DE ETAPAS
# =====================================================

def test_evento_etapa_campos_completos():
    """Evento de etapa deve ter todos os campos"""
    evt = evento_etapa(
        etapa=1,
        etapa_nome="Teste",
        mensagem="Processando etapa de teste",
        progresso=25
    )

    assert evt.tipo == "etapa"
    assert evt.etapa == 1
    assert evt.etapa_nome == "Teste"
    assert evt.mensagem == "Processando etapa de teste"
    assert evt.progresso == 25


def test_evento_etapa_sem_progresso():
    """Evento de etapa pode não ter progresso"""
    evt = evento_etapa(
        etapa=2,
        etapa_nome="Teste",
        mensagem="Etapa sem progresso"
    )

    assert evt.tipo == "etapa"
    assert evt.etapa == 2
    assert evt.progresso is None


def test_evento_etapa_json_valido():
    """Evento de etapa deve ser serializável"""
    evt = evento_etapa(
        etapa=3,
        etapa_nome="Download",
        mensagem="Baixando documentos",
        progresso=50
    )

    json_str = evt.model_dump_json()
    parsed = json.loads(json_str)

    assert parsed["tipo"] == "etapa"
    assert parsed["etapa"] == 3
    assert parsed["etapa_nome"] == "Download"
    assert parsed["progresso"] == 50


# =====================================================
# TESTES DE PROGRESSO
# =====================================================

def test_evento_progresso_campos_obrigatorios():
    """Evento de progresso deve ter etapa, mensagem e progresso"""
    evt = evento_progresso(
        etapa=1,
        mensagem="50% concluído",
        progresso=50
    )

    assert evt.tipo == "progresso"
    assert evt.etapa == 1
    assert evt.mensagem == "50% concluído"
    assert evt.progresso == 50


def test_evento_progresso_com_dados():
    """Evento de progresso pode incluir dados adicionais"""
    evt = evento_progresso(
        etapa=2,
        mensagem="Documento encontrado",
        progresso=75,
        dados={"documento_id": "123", "nome": "teste.pdf"}
    )

    assert evt.tipo == "progresso"
    assert evt.dados is not None
    assert evt.dados["documento_id"] == "123"


def test_evento_progresso_json_valido():
    """Evento de progresso com dados deve ser serializável"""
    evt = evento_progresso(
        etapa=1,
        mensagem="Processando",
        progresso=30,
        dados={"count": 5}
    )

    json_str = evt.model_dump_json()
    parsed = json.loads(json_str)

    assert parsed["tipo"] == "progresso"
    assert parsed["dados"]["count"] == 5


# =====================================================
# TESTES DE EVENTOS INFORMATIVOS
# =====================================================

def test_evento_info_basico():
    """Evento info deve ter mensagem"""
    evt = evento_info("Informação importante")

    assert evt.tipo == "info"
    assert evt.mensagem == "Informação importante"
    assert evt.etapa is None


def test_evento_info_com_etapa():
    """Evento info pode ter etapa associada"""
    evt = evento_info("Detalhe da etapa 2", etapa=2)

    assert evt.tipo == "info"
    assert evt.etapa == 2


def test_evento_info_com_dados():
    """Evento info pode ter dados adicionais"""
    evt = evento_info(
        "Encontrados documentos",
        dados={"total": 10}
    )

    assert evt.tipo == "info"
    assert evt.dados["total"] == 10


# =====================================================
# TESTES DE AVISOS
# =====================================================

def test_evento_aviso_basico():
    """Evento de aviso deve ter mensagem"""
    evt = evento_aviso("Atenção: documento pode estar incompleto")

    assert evt.tipo == "aviso"
    assert "Atenção" in evt.mensagem


def test_evento_aviso_json_valido():
    """Evento de aviso deve ser serializável"""
    evt = evento_aviso("Aviso de teste")
    json_str = evt.model_dump_json()
    parsed = json.loads(json_str)

    assert parsed["tipo"] == "aviso"


# =====================================================
# TESTES DE ERROS
# =====================================================

def test_evento_erro_basico():
    """Evento de erro deve ter mensagem"""
    evt = evento_erro("Erro ao processar documento")

    assert evt.tipo == "erro"
    assert evt.mensagem == "Erro ao processar documento"


def test_evento_erro_com_etapa():
    """Evento de erro pode indicar etapa onde ocorreu"""
    evt = evento_erro("Falha no download", etapa=3)

    assert evt.tipo == "erro"
    assert evt.etapa == 3


def test_evento_erro_com_dados():
    """Evento de erro pode incluir dados de debug"""
    evt = evento_erro(
        "Timeout",
        dados={"timeout_seconds": 30, "url": "http://example.com"}
    )

    assert evt.tipo == "erro"
    assert evt.dados["timeout_seconds"] == 30


def test_evento_erro_json_valido():
    """Evento de erro deve ser serializável"""
    evt = evento_erro("Erro crítico", etapa=1, dados={"code": 500})
    json_str = evt.model_dump_json()
    parsed = json.loads(json_str)

    assert parsed["tipo"] == "erro"
    assert parsed["dados"]["code"] == 500


# =====================================================
# TESTES DE SUCESSO
# =====================================================

def test_evento_sucesso_basico():
    """Evento de sucesso deve ter mensagem"""
    evt = evento_sucesso("Processo concluído com sucesso")

    assert evt.tipo == "sucesso"
    assert "sucesso" in evt.mensagem.lower()


def test_evento_sucesso_com_dados():
    """Evento de sucesso pode ter dados do resultado"""
    evt = evento_sucesso(
        "Documentos processados",
        dados={"total": 5, "erros": 0}
    )

    assert evt.tipo == "sucesso"
    assert evt.dados["total"] == 5


# =====================================================
# TESTES DE RESULTADO
# =====================================================

def test_evento_resultado_campos_obrigatorios():
    """Evento de resultado deve ter mensagem e dados"""
    evt = evento_resultado(
        "Análise concluída",
        dados={
            "geracao_id": 123,
            "parecer": "favoravel",
            "valor_bloqueado": 5000.0
        }
    )

    assert evt.tipo == "resultado"
    assert evt.mensagem == "Análise concluída"
    assert evt.dados["geracao_id"] == 123
    assert evt.dados["parecer"] == "favoravel"


def test_evento_resultado_json_valido():
    """Evento de resultado deve ser serializável"""
    evt = evento_resultado(
        "Resultado final",
        dados={"id": 1, "status": "ok"}
    )

    json_str = evt.model_dump_json()
    parsed = json.loads(json_str)

    assert parsed["tipo"] == "resultado"
    assert parsed["dados"]["status"] == "ok"


# =====================================================
# TESTES DE SOLICITAÇÃO DE DOCUMENTOS
# =====================================================

def test_evento_solicitar_documentos_campos():
    """Evento de solicitação deve ter mensagem e dados"""
    evt = evento_solicitar_documentos(
        "Documentos necessários para continuar",
        dados={
            "geracao_id": 456,
            "documentos_faltantes": ["extrato_subconta", "nota_fiscal"]
        }
    )

    assert evt.tipo == "solicitar_documentos"
    assert evt.mensagem is not None
    assert evt.dados["geracao_id"] == 456
    assert len(evt.dados["documentos_faltantes"]) == 2


def test_evento_solicitar_documentos_json_valido():
    """Evento de solicitação deve ser serializável"""
    evt = evento_solicitar_documentos(
        "Aguardando documentos",
        dados={"geracao_id": 1, "documentos_faltantes": []}
    )

    json_str = evt.model_dump_json()
    parsed = json.loads(json_str)

    assert parsed["tipo"] == "solicitar_documentos"


# =====================================================
# TESTES DE FIM
# =====================================================

def test_evento_fim_padrao():
    """Evento de fim deve ter mensagem padrão"""
    evt = evento_fim()

    assert evt.tipo == "fim"
    assert "finalizado" in evt.mensagem.lower()


def test_evento_fim_customizado():
    """Evento de fim pode ter mensagem customizada"""
    evt = evento_fim("Processamento encerrado com sucesso")

    assert evt.tipo == "fim"
    assert evt.mensagem == "Processamento encerrado com sucesso"


def test_evento_fim_com_dados():
    """Evento de fim pode ter dados de resumo"""
    evt = evento_fim(
        "Pipeline concluído",
        dados={"tempo_total_ms": 5000, "etapas_concluidas": 5}
    )

    assert evt.tipo == "fim"
    assert evt.dados["tempo_total_ms"] == 5000


# =====================================================
# TESTES DE HELPERS COMPOSTOS
# =====================================================

def test_evento_erro_com_fim_retorna_tupla():
    """Helper erro_com_fim deve retornar tupla de 2 eventos"""
    evt_erro, evt_fim = evento_erro_com_fim("Erro crítico", etapa=2)

    assert isinstance(evt_erro, EventoSSE)
    assert isinstance(evt_fim, EventoSSE)
    assert evt_erro.tipo == "erro"
    assert evt_fim.tipo == "fim"


def test_evento_erro_com_fim_mensagens_corretas():
    """Helper erro_com_fim deve ter mensagens apropriadas"""
    evt_erro, evt_fim = evento_erro_com_fim("Falha na conexão")

    assert evt_erro.mensagem == "Falha na conexão"
    assert "erro" in evt_fim.mensagem.lower()


def test_evento_etapa_com_progresso_alias():
    """Helper etapa_com_progresso deve ser alias de evento_etapa"""
    evt = evento_etapa_com_progresso(
        etapa=1,
        etapa_nome="Teste",
        mensagem="Testando",
        progresso=50
    )

    assert evt.tipo == "etapa"
    assert evt.progresso == 50


# =====================================================
# TESTES DE VALIDAÇÃO DO SCHEMA EventoSSE
# =====================================================

def test_todos_tipos_eventos_validos():
    """Todos os tipos de eventos devem ser aceitos pelo schema"""
    tipos_validos = [
        "inicio", "etapa", "progresso", "info", "aviso",
        "erro", "sucesso", "resultado", "fim", "solicitar_documentos"
    ]

    for tipo in tipos_validos:
        evt = EventoSSE(tipo=tipo, mensagem=f"Teste {tipo}")
        assert evt.tipo == tipo


def test_evento_tipo_invalido_falha():
    """Schema deve rejeitar tipos inválidos"""
    with pytest.raises(Exception):  # Pydantic ValidationError
        EventoSSE(tipo="tipo_invalido", mensagem="Teste")


def test_evento_sem_mensagem_aceito():
    """Evento pode não ter mensagem (campo opcional)"""
    evt = EventoSSE(tipo="inicio")
    assert evt.mensagem is None


def test_serialization_ensure_ascii():
    """Eventos com caracteres especiais devem ser serializáveis"""
    evt = evento_info("Mensagem com acentuação: São Paulo, ação, ñ")
    json_str = evt.model_dump_json()

    # Deve ser JSON válido
    parsed = json.loads(json_str)
    assert "São Paulo" in parsed["mensagem"]
