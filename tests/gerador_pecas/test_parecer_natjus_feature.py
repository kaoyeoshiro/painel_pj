import io
import json
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from starlette.datastructures import UploadFile
from starlette.requests import Request

from admin.models import ConfiguracaoIA
from sistemas.gerador_pecas import router as router_module
from sistemas.gerador_pecas import router_config_pecas as router_config_module
from sistemas.gerador_pecas.models_config_pecas import (
    CategoriaDocumento,
    TipoPeca,
    tipo_peca_categorias,
)
from sistemas.gerador_pecas.services_parecer_natjus import (
    CONFIG_KEY_DOCUMENT_CODES,
    CONFIG_KEY_REQUIRED_PIECE_TYPES,
    ParecerNatjusConfig,
    evaluate_parecer_status,
    load_parecer_natjus_config,
    normalize_piece_type,
)


def _doc(codigo):
    return SimpleNamespace(tipo_documento=str(codigo))


def _parse_sse_events(chunks):
    payload = "".join(chunk.decode() if isinstance(chunk, bytes) else chunk for chunk in chunks)
    events = []
    for part in payload.split("\n\n"):
        if part.startswith("data: "):
            events.append(json.loads(part[6:]))
    return events


def _mock_orquestrador_resultado_agente1():
    return SimpleNamespace(
        erro=None,
        documentos_analisados=1,
        total_documentos=1,
        resumo_consolidado="Resumo consolidado",
        dados_brutos=SimpleNamespace(documentos=[_doc(9999)]),
    )


class _FakeAgente1:
    def __init__(self, resultado):
        self._resultado = resultado

    async def coletar_e_resumir(self, _cnj):
        return self._resultado


class _FakeOrquestrador:
    def __init__(self, resultado_agente1):
        self.agente1 = _FakeAgente1(resultado_agente1)


class _FakeService:
    def __init__(self, *args, **kwargs):
        self.orquestrador = _FakeOrquestrador(_mock_orquestrador_resultado_agente1())


@pytest.fixture
def sqlite_session():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine)
    ConfiguracaoIA.__table__.create(bind=engine, checkfirst=True)
    CategoriaDocumento.__table__.create(bind=engine, checkfirst=True)
    TipoPeca.__table__.create(bind=engine, checkfirst=True)
    tipo_peca_categorias.create(bind=engine, checkfirst=True)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        tipo_peca_categorias.drop(bind=engine, checkfirst=True)
        TipoPeca.__table__.drop(bind=engine, checkfirst=True)
        CategoriaDocumento.__table__.drop(bind=engine, checkfirst=True)
        ConfiguracaoIA.__table__.drop(bind=engine, checkfirst=True)


def test_piece_nao_exige_parecer_nao_bloqueia():
    config = ParecerNatjusConfig(
        required_piece_types=("parecer",),
        document_codes=(207, 8451),
    )
    status = evaluate_parecer_status(
        tipo_peca="contestacao",
        documentos=[_doc(123)],
        config=config,
        has_user_upload=False,
    )
    assert status["parecer_required"] is False
    assert status["parecer_found"] is False
    assert status["config_error"] is False


def test_piece_exige_parecer_e_ja_existe_no_processo():
    config = ParecerNatjusConfig(
        required_piece_types=("contestacao",),
        document_codes=(207, 8451),
    )
    status = evaluate_parecer_status(
        tipo_peca="contestacao",
        documentos=[_doc(8451)],
        config=config,
        has_user_upload=False,
    )
    assert status["parecer_required"] is True
    assert status["parecer_found"] is True
    assert status["parecer_source"] == "process_docs"
    assert status["matched_document_codes"] == [8451]


def test_piece_requires_parecer_normaliza_acentos_e_variacoes():
    config = ParecerNatjusConfig(
        required_piece_types=("contestação",),
        document_codes=(207, 8451),
    )
    status = evaluate_parecer_status(
        tipo_peca="contestacao",
        documentos=[_doc(111)],
        config=config,
        has_user_upload=False,
    )
    assert normalize_piece_type("Contestação") == "contestacao"
    assert status["parecer_required"] is True


def test_alterar_codigos_via_config_muda_comportamento_sem_alterar_codigo():
    docs = [_doc(7777)]
    config_v1 = ParecerNatjusConfig(
        required_piece_types=("contestacao",),
        document_codes=(207, 8451),
    )
    config_v2 = ParecerNatjusConfig(
        required_piece_types=("contestacao",),
        document_codes=(7777,),
    )

    status_v1 = evaluate_parecer_status("contestacao", docs, config_v1, has_user_upload=False)
    status_v2 = evaluate_parecer_status("contestacao", docs, config_v2, has_user_upload=False)

    assert status_v1["parecer_found"] is False
    assert status_v2["parecer_found"] is True


def test_config_vazia_com_peca_exigente_retorna_erro_amigavel():
    config = ParecerNatjusConfig(
        required_piece_types=("contestacao",),
        document_codes=(),
    )
    status = evaluate_parecer_status(
        tipo_peca="contestacao",
        documentos=[],
        config=config,
        has_user_upload=False,
    )
    assert status["parecer_required"] is True
    assert status["parecer_found"] is False
    assert status["config_error"] is True
    assert "/api/gerador-pecas/config/admin" in (status["config_error_message"] or "")


def test_load_config_do_banco_reflete_codigos_dinamicos(sqlite_session):
    sqlite_session.add(
        ConfiguracaoIA(
            sistema="gerador_pecas",
            chave=CONFIG_KEY_REQUIRED_PIECE_TYPES,
            valor='["contestacao"]',
            tipo_valor="json",
            descricao="Tipos de peca exigentes",
        )
    )
    sqlite_session.add(
        ConfiguracaoIA(
            sistema="gerador_pecas",
            chave=CONFIG_KEY_DOCUMENT_CODES,
            valor="[207,8451]",
            tipo_valor="json",
            descricao="Codigos NATJus",
        )
    )
    sqlite_session.commit()

    config_v1 = load_parecer_natjus_config(sqlite_session, use_cache=False)
    assert list(config_v1.document_codes) == [207, 8451]

    cfg_codes = (
        sqlite_session.query(ConfiguracaoIA)
        .filter(
            ConfiguracaoIA.sistema == "gerador_pecas",
            ConfiguracaoIA.chave == CONFIG_KEY_DOCUMENT_CODES,
        )
        .first()
    )
    cfg_codes.valor = "[7777]"
    sqlite_session.commit()

    config_v2 = load_parecer_natjus_config(sqlite_session, use_cache=False)
    assert list(config_v2.document_codes) == [7777]


def test_load_config_com_cache_stale_vazio_faz_refresh_do_banco(sqlite_session, monkeypatch):
    sqlite_session.add(
        ConfiguracaoIA(
            sistema="gerador_pecas",
            chave=CONFIG_KEY_REQUIRED_PIECE_TYPES,
            valor='["Contestação"]',
            tipo_valor="json",
            descricao="Tipos de peca exigentes",
        )
    )
    sqlite_session.add(
        ConfiguracaoIA(
            sistema="gerador_pecas",
            chave=CONFIG_KEY_DOCUMENT_CODES,
            valor="[207,8451]",
            tipo_valor="json",
            descricao="Codigos NATJus",
        )
    )
    sqlite_session.commit()

    monkeypatch.setattr(
        "sistemas.gerador_pecas.services_parecer_natjus.config_cache.get_config",
        lambda *args, **kwargs: "[]",
    )

    config = load_parecer_natjus_config(sqlite_session, use_cache=True)
    assert list(config.required_piece_types) == ["contestacao"]
    assert list(config.document_codes) == [207, 8451]


def test_load_config_fallback_para_vinculos_tipo_peca_categoria(sqlite_session):
    categoria_parecer = CategoriaDocumento(
        nome="parecer",
        titulo="Parecer",
        codigos_documento=[207, 8451, 9636, 59, 8490],
        ativo=True,
    )
    tipo_contestacao = TipoPeca(
        nome="contestacao",
        titulo="Contestação",
        ativo=True,
    )
    tipo_contestacao.categorias_documento.append(categoria_parecer)
    sqlite_session.add(categoria_parecer)
    sqlite_session.add(tipo_contestacao)
    sqlite_session.commit()

    # Sem configuracoes_ia de parecer_*
    config = load_parecer_natjus_config(sqlite_session, use_cache=False)

    assert list(config.required_piece_types) == ["contestacao"]
    assert list(config.document_codes) == [59, 207, 8451, 8490, 9636]


@pytest.mark.asyncio
async def test_admin_config_endpoint_json_expoe_campos_novos(sqlite_session):
    sqlite_session.add(
        ConfiguracaoIA(
            sistema="gerador_pecas",
            chave=CONFIG_KEY_REQUIRED_PIECE_TYPES,
            valor='["contestacao"]',
            tipo_valor="json",
            descricao="Tipos de peca exigentes",
        )
    )
    sqlite_session.add(
        ConfiguracaoIA(
            sistema="gerador_pecas",
            chave=CONFIG_KEY_DOCUMENT_CODES,
            valor="[207,8451]",
            tipo_valor="json",
            descricao="Codigos NATJus",
        )
    )
    sqlite_session.commit()

    request = Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/api/gerador-pecas/config/admin",
            "headers": [(b"accept", b"application/json")],
        }
    )
    payload = await router_config_module.pagina_admin_config_pecas(
        request=request,
        format=None,
        db=sqlite_session,
    )

    assert payload["parecer_required_for_piece_types"] == ["contestacao"]
    assert payload["parecer_document_codes"] == [207, 8451]


@pytest.mark.asyncio
async def test_upload_parecer_aceita_apenas_pdf(tmp_path, monkeypatch):
    monkeypatch.setattr(router_module, "PARECER_UPLOAD_DIR", str(tmp_path))

    upload_txt = UploadFile(filename="parecer.txt", file=io.BytesIO(b"texto"))
    with pytest.raises(HTTPException) as exc:
        await router_module._salvar_upload_parecer_natjus(
            arquivo=upload_txt,
            numero_cnj="0804330-09.2024.8.12.0017",
            user_id=1,
            tipo_peca="contestacao",
        )
    assert exc.value.status_code == 400
    assert "PDF" in str(exc.value.detail)


@pytest.mark.asyncio
async def test_upload_parecer_persiste_e_associa_ao_processo(tmp_path, monkeypatch):
    monkeypatch.setattr(router_module, "PARECER_UPLOAD_DIR", str(tmp_path))

    upload_pdf = UploadFile(filename="parecer.pdf", file=io.BytesIO(b"%PDF-1.4\nconteudo"))
    metadata = await router_module._salvar_upload_parecer_natjus(
        arquivo=upload_pdf,
        numero_cnj="0804330-09.2024.8.12.0017",
        user_id=99,
        tipo_peca="contestacao",
    )
    assert metadata["upload_id"]

    loaded = router_module._carregar_upload_parecer_natjus(
        upload_id=metadata["upload_id"],
        numero_cnj="0804330-09.2024.8.12.0017",
        user_id=99,
    )
    assert loaded["filename"] == "parecer.pdf"
    assert loaded["numero_cnj"] == "08043300920248120017"
    assert loaded["content_bytes"].startswith(b"%PDF")

    status = evaluate_parecer_status(
        tipo_peca="contestacao",
        documentos=[],
        config=ParecerNatjusConfig(required_piece_types=("contestacao",), document_codes=(207,)),
        has_user_upload=True,
    )
    assert status["parecer_found"] is True
    assert status["parecer_source"] == "user_upload"


def test_selecionar_categoria_resumo_por_codigos_prioriza_maior_intersecao():
    categoria_alvo = SimpleNamespace(
        id=10,
        nome="Parecer Tecnico",
        codigos_documento=[207, 8451],
        formato_json='{"campo": {"type": "text"}}',
        is_residual=False,
    )
    categoria_secundaria = SimpleNamespace(
        id=11,
        nome="Categoria Generica",
        codigos_documento=[207],
        formato_json='{"campo": {"type": "text"}}',
        is_residual=False,
    )
    query_mock = MagicMock()
    query_mock.filter.return_value = query_mock
    query_mock.all.return_value = [categoria_secundaria, categoria_alvo]
    db = MagicMock()
    db.query.return_value = query_mock

    selecionada = router_module._selecionar_categoria_resumo_por_codigos(db, [207, 8451, 9636])
    assert selecionada.id == 10


@pytest.mark.asyncio
async def test_extrair_json_upload_parecer_natjus_usa_modelo_categoria(monkeypatch):
    categoria = SimpleNamespace(
        id=77,
        nome="Parecer Tecnico",
        codigos_documento=[207, 8451],
        formato_json='{"diagnostico": {"type": "text"}}',
        instrucoes_extracao="",
        is_residual=False,
        namespace="parecer_tecnico",
    )
    monkeypatch.setattr(
        router_module,
        "_selecionar_categoria_resumo_por_codigos",
        lambda db, codigos_documento: categoria,
    )

    import sistemas.gerador_pecas.extrator_resumo_json as extrator_json
    import services.gemini_service as gemini_client

    captured_prompt = {}

    def _fake_prompt(*args, **kwargs):
        return "PROMPT {texto_documento}"

    async def _fake_gemini(prompt, modelo, temperature, max_tokens):
        captured_prompt["prompt"] = prompt
        return '{"diagnostico": "Nao recomendado pelo NAT"}'

    monkeypatch.setattr(extrator_json, "gerar_prompt_extracao_json", _fake_prompt)
    monkeypatch.setattr(
        extrator_json,
        "parsear_resposta_json",
        lambda resposta: ({"diagnostico": "Nao recomendado pelo NAT"}, None),
    )
    monkeypatch.setattr(
        extrator_json,
        "normalizar_json_com_schema",
        lambda payload, schema: payload,
    )
    monkeypatch.setattr(
        extrator_json,
        "json_para_markdown",
        lambda payload: "**Diagnostico**: Nao recomendado pelo NAT",
    )
    monkeypatch.setattr(gemini_client, "chamar_gemini", _fake_gemini)

    resultado = await router_module._extrair_json_upload_parecer_natjus(
        db=MagicMock(),
        texto_parecer="Texto tecnico do parecer NATJus",
        parecer_document_codes=[207, 8451],
        upload_metadata={"upload_id": "up-1", "filename": "parecer.pdf"},
    )

    assert resultado["success"] is True
    assert resultado["categoria_id"] == 77
    assert resultado["categoria_namespace"] == "parecer_tecnico"
    assert resultado["dados_extracao"]["parecer_tecnico_diagnostico"] == "Nao recomendado pelo NAT"
    assert "Texto tecnico do parecer NATJus" in captured_prompt["prompt"]


@pytest.mark.asyncio
async def test_extrair_json_upload_parecer_natjus_fallback_sem_categoria(monkeypatch):
    monkeypatch.setattr(
        router_module,
        "_selecionar_categoria_resumo_por_codigos",
        lambda db, codigos_documento: None,
    )

    resultado = await router_module._extrair_json_upload_parecer_natjus(
        db=MagicMock(),
        texto_parecer="Conteudo do parecer",
        parecer_document_codes=[207],
        upload_metadata={"upload_id": "up-404", "filename": "parecer.pdf"},
    )

    assert resultado["success"] is False
    assert resultado["dados_extracao"] == {}
    assert resultado["error"] == "categoria_resumo_json_nao_encontrada"


@pytest.mark.asyncio
async def test_processar_stream_expoe_sinal_quando_parecer_exigido_ausente(monkeypatch):
    monkeypatch.setattr(router_module, "_resolver_grupo_e_subcategorias", lambda *args, **kwargs: (SimpleNamespace(id=1), []))
    monkeypatch.setattr(router_module.config_cache, "get_auto_detection_enabled", lambda db: True)
    monkeypatch.setattr(router_module.config_cache, "get_config", lambda *args, **kwargs: "modelo-teste")
    monkeypatch.setattr(router_module, "GeradorPecasService", _FakeService)

    class _FakeFiltro:
        def __init__(self, db):
            pass

        def tem_configuracao(self):
            return False

    monkeypatch.setattr("sistemas.gerador_pecas.filtro_categorias.FiltroCategoriasDocumento", _FakeFiltro)

    monkeypatch.setattr(
        router_module,
        "load_parecer_natjus_config",
        lambda db, use_cache=True: ParecerNatjusConfig(
            required_piece_types=("contestacao",),
            document_codes=(207,),
        ),
    )

    req = router_module.ProcessarProcessoRequest(
        numero_cnj="0804330-09.2024.8.12.0017",
        tipo_peca="contestacao",
        group_id=1,
    )
    user = SimpleNamespace(
        id=1,
        username="tester",
        role="admin",
        allowed_group_ids=[1],
        default_group_id=1,
    )
    db = MagicMock()

    response = await router_module.processar_processo_stream(req=req, current_user=user, db=db)
    chunks = []
    async for chunk in response.body_iterator:
        chunks.append(chunk)
    events = _parse_sse_events(chunks)

    assert any(evt.get("tipo") == "parecer_natjus_ausente" for evt in events)
    evt_missing = next(evt for evt in events if evt.get("tipo") == "parecer_natjus_ausente")
    assert evt_missing.get("parecer_required") is True
    assert evt_missing.get("parecer_found") is False
    assert evt_missing.get("parecer_document_codes") == [207]


@pytest.mark.asyncio
async def test_processar_stream_bloqueia_com_erro_quando_config_codigos_vazia(monkeypatch):
    monkeypatch.setattr(router_module, "_resolver_grupo_e_subcategorias", lambda *args, **kwargs: (SimpleNamespace(id=1), []))
    monkeypatch.setattr(router_module.config_cache, "get_auto_detection_enabled", lambda db: True)
    monkeypatch.setattr(router_module.config_cache, "get_config", lambda *args, **kwargs: "modelo-teste")
    monkeypatch.setattr(router_module, "GeradorPecasService", _FakeService)

    class _FakeFiltro:
        def __init__(self, db):
            pass

        def tem_configuracao(self):
            return False

    monkeypatch.setattr("sistemas.gerador_pecas.filtro_categorias.FiltroCategoriasDocumento", _FakeFiltro)

    monkeypatch.setattr(
        router_module,
        "load_parecer_natjus_config",
        lambda db, use_cache=True: ParecerNatjusConfig(
            required_piece_types=("contestacao",),
            document_codes=(),
        ),
    )

    req = router_module.ProcessarProcessoRequest(
        numero_cnj="0804330-09.2024.8.12.0017",
        tipo_peca="contestacao",
        group_id=1,
    )
    user = SimpleNamespace(
        id=1,
        username="tester",
        role="admin",
        allowed_group_ids=[1],
        default_group_id=1,
    )
    db = MagicMock()

    response = await router_module.processar_processo_stream(req=req, current_user=user, db=db)
    chunks = []
    async for chunk in response.body_iterator:
        chunks.append(chunk)
    events = _parse_sse_events(chunks)

    assert any(evt.get("tipo") == "erro" for evt in events)
    evt_erro = next(evt for evt in events if evt.get("tipo") == "erro")
    assert "Configuracao invalida" in (evt_erro.get("mensagem") or "")
