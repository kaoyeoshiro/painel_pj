# sistemas/gerador_pecas/router.py
"""
Router do sistema Gerador de Peças Jurídicas
"""

import os
import re
import json
import uuid
import asyncio
import logging
import traceback  # Movido do lazy import (múltiplas linhas)
import base64  # Movido do lazy import (linha 1643, 2780)
import aiohttp  # Movido do lazy import (linha 2700, 2779)
import xml.etree.ElementTree as ET  # Movido do lazy import (linha 2782)
from datetime import datetime
from collections import defaultdict  # Movido do lazy import (linha 2647)
from fastapi import APIRouter, HTTPException, BackgroundTasks, Depends, Query, UploadFile, File, Form, status, Request
from fastapi.responses import FileResponse, StreamingResponse
from typing import Optional, List, Dict, Any, AsyncGenerator
import fitz  # PyMuPDF para extração de texto de PDFs
fitz.TOOLS.mupdf_warnings(False)  # Suprime warnings de imagens JPEG2000 corrompidas
from sqlalchemy.orm import Session

from auth.dependencies import get_current_active_user, get_current_user_from_token_or_query
from auth.models import User
from database.connection import get_db
from utils.timezone import to_iso_utc, get_utc_now, now_local
from services.text_normalizer import text_normalizer
from services.performance_tracker import (
    create_tracker, get_tracker, mark, record_chunk, PerformanceTracker
)
from services.config_cache import config_cache
from admin.services_request_perf import log_request_perf

# SECURITY: Rate Limiting para endpoints de IA
from utils.rate_limit import limiter, LIMITS, get_user_identifier
# SECURITY: Quota de IA por usuario/dia
from utils.quota_manager import check_ai_quota
from sistemas.gerador_pecas.models import GeracaoPeca, FeedbackPeca, VersaoPeca
from sistemas.gerador_pecas.repositories import (
    CategoriaResumoJSONRepository,
    FeedbackPecaRepository,
    GeracaoPecaRepository,
    PromptGroupReadRepository,
    PromptModuloReadRepository,
    PromptSubcategoriaReadRepository,
    PromptSubgroupReadRepository,
    get_geracao_repo, get_feedback_repo,
)
from sistemas.gerador_pecas.services import GeradorPecasService
from sistemas.gerador_pecas.schemas import (
    ProcessarProcessoRequest, ExportarDocxRequest, FeedbackRequest,
    EditarMinutaRequest, BuscarArgumentosRequest,
    SalvarMinutaRequest, SalvarMinutaComVersaoRequest,
    CurationPreviewRequest, CurationSearchRequest, CurationGenerateRequest,
)
from sistemas.gerador_pecas.orquestrador_agentes import consolidar_dados_extracao
from sistemas.gerador_pecas.versoes import (
    criar_versao_inicial,
    criar_nova_versao,
    obter_versoes,
    obter_versao_detalhada,
    comparar_versoes,
    restaurar_versao
)
from admin.models_prompt_groups import PromptGroup
from admin.repositories import ConfiguracaoIARepository, get_config_repo
from sistemas.gerador_pecas.services_parecer_natjus import (
    build_parecer_audit_payload,
    evaluate_parecer_status,
    load_parecer_natjus_config,
    piece_requires_parecer,
)
from app.services.gerador_pecas.stream_helper import stream_helper

router = APIRouter(tags=["Gerador de Peças"])
logger = logging.getLogger(__name__)

# Diretório temporário para arquivos DOCX
TEMP_DIR = os.path.join(os.path.dirname(__file__), 'temp_docs')
os.makedirs(TEMP_DIR, exist_ok=True)

# Diretório persistente para uploads manuais de parecer NATJus
PARECER_UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads_parecer_natjus")
os.makedirs(PARECER_UPLOAD_DIR, exist_ok=True)


def _limpar_cnj(numero_cnj: str) -> str:
    """
    Limpa número CNJ removendo formatação e sufixos.
    
    Exemplos:
        - 0804330-09.2024.8.12.0017 -> 08043300920248120017
        - 0804330-09.2024.8.12.0017/50003 -> 08043300920248120017
    """
    # Remove sufixo após barra (ex: /50003)
    if '/' in numero_cnj:
        numero_cnj = numero_cnj.split('/')[0]
    # Remove caracteres não-dígitos
    return re.sub(r'\D', '', numero_cnj)

def _listar_grupos_permitidos(current_user: User, db: Session) -> List[PromptGroup]:
    group_repo = PromptGroupReadRepository(db)

    if current_user.role == "admin":
        return group_repo.list_active_ordered()

    group_ids = set(current_user.allowed_group_ids or [])
    if current_user.default_group_id:
        group_ids.add(current_user.default_group_id)

    if not group_ids:
        return []

    return group_repo.list_active_by_ids(list(group_ids))


def _resolver_grupo_e_subcategorias(
    current_user: User,
    db: Session,
    group_id: Optional[int],
    subcategoria_ids: Optional[List[int]]
):
    grupos = _listar_grupos_permitidos(current_user, db)
    if not grupos:
        raise HTTPException(status_code=400, detail="Usuario sem grupo de prompts.")

    if group_id is None:
        if len(grupos) == 1:
            grupo = grupos[0]
        else:
            raise HTTPException(status_code=400, detail="Selecione o grupo de prompts.")
    else:
        group_repo = PromptGroupReadRepository(db)
        grupo = group_repo.get_active_by_id(group_id)
        if not grupo:
            raise HTTPException(status_code=400, detail="Grupo invalido ou inativo.")
        if current_user.role != "admin":
            allowed_ids = {g.id for g in grupos}
            if group_id not in allowed_ids:
                raise HTTPException(status_code=403, detail="Usuario sem acesso ao grupo selecionado.")

    subcategoria_ids_normalized = []
    if subcategoria_ids:
        for item in subcategoria_ids:
            try:
                value = int(item)
            except (TypeError, ValueError):
                raise HTTPException(status_code=400, detail="Subcategorias invalidas.")
            if value not in subcategoria_ids_normalized:
                subcategoria_ids_normalized.append(value)

        if subcategoria_ids_normalized:
            subcategoria_repo = PromptSubcategoriaReadRepository(db)
            subcategorias = subcategoria_repo.list_active_by_ids_and_group(
                subcategoria_ids_normalized,
                grupo.id,
            )
            if len(subcategorias) != len(subcategoria_ids_normalized):
                raise HTTPException(status_code=400, detail="Subcategorias invalidas para o grupo selecionado.")

    return grupo, subcategoria_ids_normalized


def _parse_subcategoria_ids_form(subcategoria_ids_raw: Optional[str]) -> Optional[List[int]]:
    if not subcategoria_ids_raw:
        return None

    try:
        payload = json.loads(subcategoria_ids_raw)
        if isinstance(payload, list):
            return payload
    except Exception:
        pass

    try:
        return [int(value) for value in subcategoria_ids_raw.split(",") if value.strip()]
    except ValueError:
        raise HTTPException(status_code=400, detail="Subcategorias invalidas.")


def _parecer_upload_file_path(upload_id: str) -> str:
    return os.path.join(PARECER_UPLOAD_DIR, f"{upload_id}.pdf")


def _parecer_upload_meta_path(upload_id: str) -> str:
    return os.path.join(PARECER_UPLOAD_DIR, f"{upload_id}.json")


async def _salvar_upload_parecer_natjus(
    *,
    arquivo: UploadFile,
    numero_cnj: str,
    user_id: int,
    tipo_peca: Optional[str] = None,
) -> Dict[str, Any]:
    nome_arquivo = (arquivo.filename or "").strip()
    if not nome_arquivo.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo invalido. Anexe apenas PDF (.pdf).",
        )

    conteudo = await arquivo.read()
    if not conteudo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Arquivo PDF vazio. Selecione um arquivo valido.",
        )

    upload_id = uuid.uuid4().hex
    file_path = _parecer_upload_file_path(upload_id)
    meta_path = _parecer_upload_meta_path(upload_id)
    numero_cnj_limpo = _limpar_cnj(numero_cnj)

    with open(file_path, "wb") as f:
        f.write(conteudo)

    metadata = {
        "upload_id": upload_id,
        "numero_cnj": numero_cnj_limpo,
        "tipo_peca": tipo_peca,
        "user_id": int(user_id),
        "filename": nome_arquivo,
        "size_bytes": len(conteudo),
        "created_at": get_utc_now().isoformat(),
    }

    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, ensure_ascii=False)

    return metadata


def _carregar_upload_parecer_natjus(
    *,
    upload_id: str,
    numero_cnj: str,
    user_id: int,
) -> Dict[str, Any]:
    if not upload_id:
        raise HTTPException(status_code=400, detail="Upload de parecer invalido.")

    file_path = _parecer_upload_file_path(upload_id)
    meta_path = _parecer_upload_meta_path(upload_id)

    if not os.path.exists(file_path) or not os.path.exists(meta_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Upload de parecer NATJus nao encontrado.",
        )

    with open(meta_path, "r", encoding="utf-8") as f:
        metadata = json.load(f)

    numero_cnj_limpo = _limpar_cnj(numero_cnj)
    if metadata.get("numero_cnj") != numero_cnj_limpo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload de parecer nao corresponde ao processo informado.",
        )

    if int(metadata.get("user_id") or 0) != int(user_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Upload de parecer pertence a outro usuario.",
        )

    with open(file_path, "rb") as f:
        conteudo = f.read()

    metadata["content_bytes"] = conteudo
    return metadata


def _coletar_codigos_documento(valor: Any) -> List[int]:
    if valor is None:
        return []

    if isinstance(valor, str):
        texto = valor.strip()
        if not texto:
            return []
        try:
            parsed = json.loads(texto)
        except json.JSONDecodeError:
            parsed = [item.strip() for item in texto.split(",") if item.strip()]
        itens = parsed if isinstance(parsed, list) else [parsed]
    elif isinstance(valor, (list, tuple, set)):
        itens = list(valor)
    else:
        itens = [valor]

    codigos: List[int] = []
    for item in itens:
        try:
            codigo = int(str(item).strip())
        except (TypeError, ValueError):
            continue
        if codigo not in codigos:
            codigos.append(codigo)
    return codigos


def _selecionar_categoria_resumo_por_codigos(db: Session, codigos_documento: List[int]):
    codigos_alvo = set(_coletar_codigos_documento(codigos_documento))
    if not codigos_alvo:
        return None

    categoria_repo = CategoriaResumoJSONRepository(db)
    categorias = categoria_repo.list_active()

    melhor_categoria = None
    melhor_score = (-1, -1, -1, -1, -1, -1000000)

    for categoria in categorias:
        codigos_categoria = set(_coletar_codigos_documento(categoria.codigos_documento))
        if not codigos_categoria:
            continue

        overlap = len(codigos_alvo.intersection(codigos_categoria))
        if overlap == 0:
            continue

        exact_match = 1 if codigos_categoria == codigos_alvo else 0
        subset_match = 1 if codigos_categoria.issubset(codigos_alvo) else 0
        non_residual = 1 if not getattr(categoria, "is_residual", False) else 0
        has_formato = 1 if bool(categoria.formato_json) else 0
        distance = -abs(len(codigos_categoria) - len(codigos_alvo))

        score = (
            overlap,
            exact_match,
            subset_match,
            non_residual,
            has_formato,
            distance,
        )
        if score > melhor_score:
            melhor_score = score
            melhor_categoria = categoria

    return melhor_categoria


def _normalizar_json_com_namespace(categoria: Any, payload: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        return {}

    namespace = ""
    try:
        namespace = categoria.namespace or ""
    except Exception:
        namespace = ""

    namespace_prefix = f"{namespace}_" if namespace else ""
    normalizado: Dict[str, Any] = {}

    for chave, valor in payload.items():
        chave_str = str(chave)
        if namespace_prefix and chave_str.startswith(namespace_prefix):
            slug = chave_str
        elif namespace:
            slug = f"{namespace}_{chave_str}"
        else:
            slug = chave_str
        normalizado[slug] = valor

    return normalizado


def _mesclar_dados_extracao(destino: Dict[str, Any], origem: Dict[str, Any]) -> None:
    for chave, valor in (origem or {}).items():
        if chave not in destino:
            destino[chave] = valor
            continue

        existente = destino[chave]
        if isinstance(existente, bool) and isinstance(valor, bool):
            destino[chave] = existente or valor
        elif isinstance(existente, list) and isinstance(valor, list):
            merged = []
            for item in existente + valor:
                if item not in merged:
                    merged.append(item)
            destino[chave] = merged
        elif existente in (None, "", []):
            destino[chave] = valor


async def _extrair_json_upload_parecer_natjus(
    *,
    db: Session,
    texto_parecer: str,
    parecer_document_codes: List[int],
    upload_metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    resultado: Dict[str, Any] = {
        "success": False,
        "markdown": None,
        "dados_extracao": {},
        "json_normalizado": None,
        "categoria_id": None,
        "categoria_nome": None,
        "categoria_namespace": None,
        "error": None,
    }

    texto_limpo = (texto_parecer or "").strip()
    if not texto_limpo:
        resultado["error"] = "texto_upload_vazio"
        return resultado

    codigos = _coletar_codigos_documento(parecer_document_codes)
    if not codigos:
        resultado["error"] = "parecer_document_codes_empty"
        return resultado

    categoria = _selecionar_categoria_resumo_por_codigos(db, codigos)
    if not categoria:
        resultado["error"] = "categoria_resumo_json_nao_encontrada"
        logger.warning(
            "[PARECER-NATJUS] Nao foi encontrada categoria de resumo JSON para codigos=%s",
            codigos,
        )
        return resultado

    if not categoria.formato_json:
        resultado["error"] = "categoria_sem_formato_json"
        logger.warning(
            "[PARECER-NATJUS] Categoria de resumo JSON sem formato_json: categoria_id=%s nome=%s",
            categoria.id,
            categoria.nome,
        )
        return resultado

    try:
        from sistemas.gerador_pecas.extrator_resumo_json import (
            FormatoResumo,
            gerar_prompt_extracao_json,
            parsear_resposta_json,
            normalizar_json_com_schema,
            json_para_markdown,
        )
        from services.gemini_service import chamar_gemini as chamar_gemini_async

        formato = FormatoResumo(
            categoria_id=categoria.id,
            categoria_nome=categoria.nome,
            formato_json=categoria.formato_json,
            instrucoes_extracao=categoria.instrucoes_extracao,
            is_residual=bool(getattr(categoria, "is_residual", False)),
        )

        nome_arquivo = (upload_metadata or {}).get("filename") or "parecer_natjus_upload.pdf"
        prompt = gerar_prompt_extracao_json(
            formato,
            f"Parecer NATJus anexado pelo usuario: {nome_arquivo}",
            db,
        )
        prompt_final = prompt.replace("{texto_documento}", texto_limpo[:30000])

        resposta = await chamar_gemini_async(
            prompt=prompt_final,
            modelo="gemini-2.5-flash-lite",
            temperature=0.1,
            max_tokens=8000,
        )

        json_extraido, erro_parse = parsear_resposta_json(resposta)
        if erro_parse:
            resultado["error"] = f"erro_parse_json:{erro_parse}"
            logger.warning(
                "[PARECER-NATJUS] Erro ao parsear JSON do upload: upload_id=%s detalhe=%s",
                (upload_metadata or {}).get("upload_id"),
                erro_parse,
            )
            return resultado

        json_normalizado = normalizar_json_com_schema(json_extraido, categoria.formato_json)
        markdown = json_para_markdown(json_normalizado)
        dados_namespaced = _normalizar_json_com_namespace(categoria, json_normalizado)

        resultado.update(
            {
                "success": True,
                "markdown": markdown,
                "dados_extracao": dados_namespaced,
                "json_normalizado": json_normalizado,
                "categoria_id": categoria.id,
                "categoria_nome": categoria.nome,
                "categoria_namespace": categoria.namespace,
                "error": None,
            }
        )
        return resultado

    except Exception as exc:
        resultado["error"] = f"erro_extracao_json:{exc}"
        logger.exception(
            "[PARECER-NATJUS] Falha ao extrair JSON do upload manual: upload_id=%s",
            (upload_metadata or {}).get("upload_id"),
        )
        return resultado


# Limite máximo para texto bruto de parecer NATJus em fallback (chars).
# Quando a extração JSON falha, NÃO enviar o documento inteiro como texto bruto.
# Enviar apenas um snippet mínimo para que a IA saiba que o parecer existe.
_MAX_PARECER_FALLBACK_CHARS = 3000

def _anexar_upload_parecer_ao_resumo(
    resumo_consolidado: str,
    upload_metadata: Dict[str, Any],
    texto_parecer: str,
    json_normalizado: Optional[Dict[str, Any]] = None,
) -> str:
    if json_normalizado:
        # Formato padrao: JSON de variaveis estruturadas (mesmo padrao do resto do pipeline)
        conteudo = f"```json\n{json.dumps(json_normalizado, ensure_ascii=False, indent=2)}\n```"
        origem_extracao = "json_modelo_categoria"
    else:
        # GUARDRAIL: Quando JSON estruturado não está disponível, NÃO enviar texto
        # integral do NATJus. Limitar a snippet mínimo para referência.
        texto_limpo = (texto_parecer or "").strip()
        if len(texto_limpo) > _MAX_PARECER_FALLBACK_CHARS:
            logger.warning(
                "[PARECER-NATJUS] Fallback texto bruto ativado: tamanho_original=%d "
                "truncado_para=%d upload_id=%s. Extração JSON falhou.",
                len(texto_limpo),
                _MAX_PARECER_FALLBACK_CHARS,
                upload_metadata.get("upload_id"),
            )
            texto_limpo = (
                texto_limpo[:_MAX_PARECER_FALLBACK_CHARS]
                + "\n\n[... TEXTO DO PARECER NATJUS TRUNCADO - extração JSON falhou. "
                "Apenas snippet inicial incluído para referência. "
                "Consultar documento original para análise completa. ...]"
            )
        if not texto_limpo:
            texto_limpo = "[Nao foi possivel extrair texto do PDF anexado.]"
        conteudo = texto_limpo
        origem_extracao = "texto_bruto_pdf"

    bloco_upload = (
        "\n\n---\n"
        "## PARECER NATJUS ANEXADO PELO USUARIO\n"
        f"**Arquivo**: {upload_metadata.get('filename')}\n"
        f"**Upload ID**: {upload_metadata.get('upload_id')}\n\n"
        f"**Origem da extracao**: {origem_extracao}\n\n"
        f"{conteudo}\n"
    )
    return f"{resumo_consolidado}{bloco_upload}"
# Armazena estado de processamento em memória (para SSE)
_processamento_status = {}


@router.get("/tipos-peca")
async def listar_tipos_peca(
    group_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Lista os tipos de peças disponíveis baseado nos prompts modulares ativos.
    Retorna apenas os tipos de peça que têm prompt configurado no banco.

    Se group_id for informado, filtra/resolve prompts do grupo (com heranca).
    Retorna também `permite_auto` que indica se a detecção automática está habilitada.
    Quando `permite_auto=false`, o usuário DEVE selecionar um tipo de peça manualmente.
    """
    from sistemas.gerador_pecas.services_prompt_loader import listar_tipos_peca as loader_listar_tipos

    tipos = loader_listar_tipos(db, group_id)

    # Verifica flag de detecção automática
    permite_auto = config_cache.get_auto_detection_enabled(db)

    return {
        "tipos": tipos,
        "permite_auto": permite_auto
    }


@router.post("/buscar-argumentos")
async def buscar_argumentos(
    req: BuscarArgumentosRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Busca argumentos jurídicos relevantes na base de conhecimento.

    Usado pelo chatbot de edição para encontrar módulos de conteúdo
    que podem ser inseridos na minuta baseado na mensagem do usuário.

    Busca em:
    - Título do módulo
    - Condição de ativação
    - Regras determinísticas
    - Categoria/subcategoria
    """
    from sistemas.gerador_pecas.services_busca_argumentos import buscar_argumentos_relevantes

    print(f"\n{'='*60}")
    print(f"[ENDPOINT] 🔎 Busca de argumentos solicitada")
    print(f"[ENDPOINT] 👤 Usuário: {current_user.username}")
    print(f"{'='*60}")

    argumentos = buscar_argumentos_relevantes(
        db=db,
        query=req.query,
        tipo_peca=req.tipo_peca,
        limit=req.limit
    )

    print(f"[ENDPOINT] ✅ Retornando {len(argumentos)} argumento(s)\n")

    return {
        "query": req.query,
        "tipo_peca": req.tipo_peca,
        "total": len(argumentos),
        "argumentos": argumentos
    }


@router.get("/grupos-disponiveis")
async def listar_grupos_disponiveis(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    grupos = _listar_grupos_permitidos(current_user, db)
    default_group_id = current_user.default_group_id
    if default_group_id and not any(g.id == default_group_id for g in grupos):
        default_group_id = grupos[0].id if len(grupos) == 1 else None

    return {
        "grupos": [
            {"id": grupo.id, "nome": grupo.name, "slug": grupo.slug}
            for grupo in grupos
        ],
        "default_group_id": default_group_id,
        "requires_selection": len(grupos) > 1
    }


@router.get("/grupos/{group_id}/subgrupos")
async def listar_subgrupos_por_grupo(
    group_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Lista subgrupos operacionais de um grupo.

    Subgrupos sao recortes operacionais (ex: Conhecimento, Cumprimento).
    """
    grupo, _ = _resolver_grupo_e_subcategorias(current_user, db, group_id, [])

    subgroup_repo = PromptSubgroupReadRepository(db)
    subgrupos = subgroup_repo.list_active_by_group(grupo.id)

    return {
        "subgrupos": [
            {"id": subgrupo.id, "nome": subgrupo.name, "slug": subgrupo.slug}
            for subgrupo in subgrupos
        ]
    }


@router.get("/grupos/{group_id}/subcategorias")
async def listar_subcategorias_por_grupo(
    group_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Lista subcategorias ativas de um grupo para filtragem na geração.
    """
    grupo, _ = _resolver_grupo_e_subcategorias(current_user, db, group_id, [])

    subcategoria_repo = PromptSubcategoriaReadRepository(db)
    from admin.models_prompt_groups import PromptSubcategoria
    subcategorias = (
        subcategoria_repo.query()
        .filter(
            PromptSubcategoria.group_id == grupo.id,
            PromptSubcategoria.active == True,
        )
        .order_by(PromptSubcategoria.order, PromptSubcategoria.nome)
        .all()
    )

    return [
        {"id": s.id, "nome": s.nome}
        for s in subcategorias
    ]


@router.post("/parecer/upload")
async def upload_parecer_natjus_pdf(
    arquivo: UploadFile = File(..., description="Arquivo PDF do parecer NATJus"),
    numero_cnj: str = Form(..., description="Numero CNJ associado ao parecer"),
    tipo_peca: Optional[str] = Form(None, description="Tipo da peca (opcional)"),
    current_user: User = Depends(get_current_active_user),
):
    """
    Salva upload manual do parecer NATJus para uso na geração.
    """
    metadata = await _salvar_upload_parecer_natjus(
        arquivo=arquivo,
        numero_cnj=numero_cnj,
        user_id=current_user.id,
        tipo_peca=tipo_peca,
    )

    logger.info(
        "[PARECER-NATJUS] Upload salvo: upload_id=%s user_id=%s cnj=%s filename=%s size=%s",
        metadata.get("upload_id"),
        current_user.id,
        metadata.get("numero_cnj"),
        metadata.get("filename"),
        metadata.get("size_bytes"),
    )

    return {
        "upload_id": metadata["upload_id"],
        "filename": metadata["filename"],
        "size_bytes": metadata["size_bytes"],
        "numero_cnj": metadata["numero_cnj"],
        "tipo_peca": metadata.get("tipo_peca"),
        "message": "Parecer NATJus anexado com sucesso.",
    }


@router.post("/processar")
async def processar_processo(
    req: ProcessarProcessoRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Processa um processo e gera a peça jurídica
    
    Returns:
        - Se status == "pergunta": {"pergunta": "...", "opcoes": [...]}
        - Se status == "sucesso": {"url_download": "...", "tipo_peca": "...", "conteudo_json": {...}}
        - Se status == "erro": {"mensagem": "..."}
    """
    try:
        # Normaliza o CNJ
        cnj_limpo = _limpar_cnj(req.numero_cnj)

        grupo, subcategoria_ids = _resolver_grupo_e_subcategorias(
            current_user,
            db,
            req.group_id,
            req.subcategoria_ids
        )
        
        # Busca configurações de IA
        config_repo = ConfiguracaoIARepository(db)
        modelo = config_repo.get_valor(
            "gerador_pecas",
            "modelo_geracao",
            default="anthropic/claude-3.5-sonnet",
        )
        
        # Inicializa o serviço
        service = GeradorPecasService(
            modelo=modelo,
            db=db,
            group_id=grupo.id,
            subcategoria_ids=subcategoria_ids
        )
        
        # Processa o processo
        resultado = await service.processar_processo(
            numero_cnj=cnj_limpo,
            numero_cnj_formatado=cnj_limpo,
            tipo_peca=req.tipo_peca,
            resposta_usuario=req.resposta_usuario,
            usuario_id=current_user.id
        )
        
        return resultado

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/processar-stream")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def processar_processo_stream(
    request: Request,
    req: ProcessarProcessoRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Processa um processo com streaming SSE para atualização em tempo real.
    Retorna eventos conforme cada agente processa.

    Se tipo_peca não for especificado e a flag `enable_auto_piece_detection` estiver habilitada,
    o Agente 2 detecta automaticamente qual tipo de peça é mais adequado.

    Se a flag estiver desabilitada, tipo_peca é OBRIGATÓRIO.
    """
    # SECURITY: Verifica cota de IA
    await check_ai_quota(current_user)

    # Verifica se detecção automática está habilitada (com cache)
    permite_auto = config_cache.get_auto_detection_enabled(db)

    # Validação: se auto-detecção está desabilitada, tipo_peca é obrigatório
    if not permite_auto and not req.tipo_peca:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de peça é obrigatório. Selecione o tipo de peça antes de gerar."
        )

    grupo, subcategoria_ids = _resolver_grupo_e_subcategorias(
        current_user,
        db,
        req.group_id,
        req.subcategoria_ids
    )
    group_id = grupo.id

    # Cria tracker de performance para esta request
    tracker = create_tracker(
        request_id=str(uuid.uuid4())[:8],
        sistema="gerador_pecas",
        route="/processar-stream"
    )
    tracker.mark("auth_done")

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            cnj_limpo = _limpar_cnj(req.numero_cnj)
            tracker.set_metadata("numero_cnj", cnj_limpo)
            parecer_upload_metadata: Optional[Dict[str, Any]] = None
            parecer_upload_texto: str = ""
            parecer_upload_extracao: Dict[str, Any] = {
                "success": False,
                "dados_extracao": {},
                "error": None,
            }
            parecer_status: Dict[str, Any] = {
                "parecer_required": False,
                "parecer_found": False,
                "parecer_source": "none",
            }
            parecer_audit_payload: Dict[str, Any] = build_parecer_audit_payload(
                parecer_status
            )

            # Evento inicial
            yield stream_helper.format_inicio(request_id=tracker.request_id)

            if req.parecer_upload_id:
                try:
                    parecer_upload_metadata = _carregar_upload_parecer_natjus(
                        upload_id=req.parecer_upload_id,
                        numero_cnj=cnj_limpo,
                        user_id=current_user.id,
                    )
                    parecer_upload_texto = _extrair_texto_pdf(
                        parecer_upload_metadata.get("content_bytes", b"")
                    )
                    tracker.set_metadata("parecer_upload_id", req.parecer_upload_id)
                    nome_upload = parecer_upload_metadata.get("filename")
                    yield stream_helper.format_info(f'Parecer NATJus carregado do upload: {nome_upload}')
                except HTTPException as upload_error:
                    mensagem_upload = (
                        upload_error.detail
                        if isinstance(upload_error.detail, str)
                        else "Erro ao carregar upload de parecer NATJus."
                    )
                    yield stream_helper.format_erro(mensagem_upload)
                    return
            
            # Busca configurações (com cache)
            tracker.mark("load_config_start")
            modelo = config_cache.get_config(
                "gerador_pecas",
                "modelo_geracao",
                db,
                default="google/gemini-2.5-pro-preview-05-06"
            )
            tracker.mark("load_config_done", modelo=modelo)
            tracker.set_metadata("modelo", modelo)

            # Inicializa o serviço
            service = GeradorPecasService(
                modelo=modelo,
                db=db,
                group_id=group_id,
                subcategoria_ids=subcategoria_ids
            )
            
            # Se tem orquestrador, processa com eventos
            if service.orquestrador:
                orq = service.orquestrador
                from sistemas.gerador_pecas.filtro_categorias import FiltroCategoriasDocumento
                filtro = FiltroCategoriasDocumento(db)
                
                # Determina tipo de peça inicial (se fornecido manualmente)
                tipo_peca_inicial = req.tipo_peca or req.resposta_usuario
                print(f"[ROUTER] tipo_peca_inicial: {tipo_peca_inicial}")
                print(f"[ROUTER] group_id: {group_id}, subcategoria_ids: {subcategoria_ids}")

                # Se tipo de peça foi escolhido manualmente, configura filtro de categorias ANTES do Agente 1
                if tipo_peca_inicial:
                    try:
                        if filtro.tem_configuracao():
                            codigos = filtro.get_codigos_permitidos(tipo_peca_inicial)
                            codigos_primeiro = filtro.get_codigos_primeiro_documento(tipo_peca_inicial)
                            if codigos:
                                orq.agente1.atualizar_codigos_permitidos(codigos, codigos_primeiro)
                                yield stream_helper.format_info(f'Filtro ativado: {len(codigos)} categorias para {tipo_peca_inicial}')
                    except Exception as e:
                        print(f"[ROUTER] ERRO ao carregar filtro de categorias: {e}")
                        print(f"[ROUTER] Traceback: {traceback.format_exc()}")
                
                # === EARLY PARECER CHECK (pré-Agent 1) ===
                parecer_config_early = load_parecer_natjus_config(db, use_cache=False)
                if piece_requires_parecer(tipo_peca_inicial, parecer_config_early) and not req.parecer_upload_id and req.parecer_user_choice_when_missing != "continue_without":
                    yield stream_helper.format_info('Verificando documentos do processo...')
                    try:
                        docs_metadata = await orq.agente1.consultar_codigos_documentos(cnj_limpo)
                        parecer_status_early = evaluate_parecer_status(
                            tipo_peca=tipo_peca_inicial,
                            documentos=docs_metadata,
                            config=parecer_config_early,
                            has_user_upload=False,
                        )
                        if parecer_status_early.get("parecer_required") and not parecer_status_early.get("parecer_found"):
                            logger.warning(
                                "[PARECER-NATJUS] Early check: parecer ausente (pre-Agent 1): cnj=%s tipo_peca=%s",
                                cnj_limpo, tipo_peca_inicial,
                            )
                            yield stream_helper.format_parecer_natjus_ausente(
                                tipo_peca=tipo_peca_inicial,
                                parecer_document_codes=parecer_status_early.get('parecer_document_codes', []),
                            )
                            return
                    except Exception as e:
                        logger.warning("[PARECER-NATJUS] Early check falhou, continuando com pipeline normal: %s", e)

                # Agente 1: Coletor TJ-MS
                print(f"[ROUTER] >>> Iniciando Agente 1...")
                tracker.mark("agente1_start")
                yield stream_helper.format_agente(1, "ativo", "Baixando documentos do TJ-MS...")

                resultado_agente1 = await orq.agente1.coletar_e_resumir(cnj_limpo)

                tracker.mark("agente1_done", docs=resultado_agente1.documentos_analisados)
                print(f"[ROUTER] <<< Agente 1 finalizado")
                print(f"[ROUTER] Agente 1 - erro: {resultado_agente1.erro}")
                print(f"[ROUTER] Agente 1 - total_documentos: {resultado_agente1.total_documentos}")
                print(f"[ROUTER] Agente 1 - documentos_analisados: {resultado_agente1.documentos_analisados}")
                print(f"[ROUTER] Agente 1 - resumo tamanho: {len(resultado_agente1.resumo_consolidado)} chars")

                if resultado_agente1.erro:
                    print(f"[ROUTER] Agente 1 retornou erro: {resultado_agente1.erro}")
                    evt_agente, evt_erro = stream_helper.format_agente_erro(1, resultado_agente1.erro)
                    yield evt_agente
                    yield evt_erro
                    return

                yield stream_helper.format_agente(1, "concluido", f'{resultado_agente1.documentos_analisados} documentos processados')
                
                # Usa o tipo de peça inicial (já determinado acima)
                tipo_peca = tipo_peca_inicial
                
                # Agente 2: Detector de Módulos (e tipo de peça se necessário)
                # Variável para controlar se foi modo automático
                modo_automatico = False
                resumo_para_geracao = resultado_agente1.resumo_consolidado
                
                if not tipo_peca:
                    modo_automatico = True
                    yield stream_helper.format_agente(2, "ativo", "Detectando tipo de peça automaticamente...")
                    
                    # Detecta o tipo de peça via IA
                    deteccao_tipo = await orq.agente2.detectar_tipo_peca(resultado_agente1.resumo_consolidado)
                    tipo_peca = deteccao_tipo.get("tipo_peca")
                    
                    if tipo_peca:
                        confianca = deteccao_tipo.get("confianca", "media")
                        justificativa = deteccao_tipo.get("justificativa", "")
                        yield stream_helper.format_info(f'Tipo detectado: {tipo_peca} (confiança: {confianca})')
                    else:
                        # Fallback se não conseguiu detectar
                        tipo_peca = "contestacao"
                        yield stream_helper.format_info('Não foi possível detectar automaticamente. Usando: contestação')
                
                # No modo automático, após detectar o tipo, filtra os resumos
                if modo_automatico and tipo_peca:
                    try:
                        codigos_tipo = filtro.get_codigos_permitidos(tipo_peca) if filtro.tem_configuracao() else None
                        if codigos_tipo:
                            yield stream_helper.format_info(f'Filtrando resumos para {tipo_peca}: {len(codigos_tipo)} categorias')
                            
                            # Usa o método do agente para filtrar e remontar o resumo
                            resumo_para_geracao = orq.agente1.filtrar_e_remontar_resumo(
                                resultado_agente1,
                                codigos_tipo
                            )
                    except Exception as e:
                        print(f"Aviso: Erro ao filtrar resumos no modo automático: {e}")
                        # Continua com o resumo completo

                parecer_config = load_parecer_natjus_config(db, use_cache=False)
                if parecer_upload_metadata:
                    parecer_upload_extracao = await _extrair_json_upload_parecer_natjus(
                        db=db,
                        texto_parecer=parecer_upload_texto,
                        parecer_document_codes=list(parecer_config.document_codes),
                        upload_metadata=parecer_upload_metadata,
                    )
                    if parecer_upload_extracao.get("success"):
                        yield stream_helper.format_info('Parecer NATJus do upload processado em JSON tecnico (categorias-resumo-json).')
                        tracker.set_metadata("natjus_extraction_success", True)
                        logger.info(
                            "[PARECER-NATJUS] Extração JSON bem-sucedida: upload_id=%s "
                            "categoria=%s tamanho_texto=%d",
                            parecer_upload_metadata.get("upload_id"),
                            parecer_upload_extracao.get("categoria_nome"),
                            len(parecer_upload_texto or ""),
                        )
                    else:
                        tracker.set_metadata("natjus_extraction_success", False)
                        tracker.set_metadata("natjus_extraction_error", parecer_upload_extracao.get("error"))
                        logger.warning(
                            "[PARECER-NATJUS] Upload sem JSON estruturado; usando fallback limitado. "
                            "upload_id=%s erro=%s tamanho_texto=%d",
                            parecer_upload_metadata.get("upload_id"),
                            parecer_upload_extracao.get("error"),
                            len(parecer_upload_texto or ""),
                        )
                    resumo_para_geracao = _anexar_upload_parecer_ao_resumo(
                        resumo_para_geracao,
                        parecer_upload_metadata,
                        parecer_upload_texto,
                        json_normalizado=parecer_upload_extracao.get("json_normalizado"),
                    )

                documentos_agente1 = []
                if resultado_agente1.dados_brutos and resultado_agente1.dados_brutos.documentos:
                    documentos_agente1 = resultado_agente1.dados_brutos.documentos

                parecer_status = evaluate_parecer_status(
                    tipo_peca=tipo_peca,
                    documentos=documentos_agente1,
                    config=parecer_config,
                    has_user_upload=bool(parecer_upload_metadata),
                )
                parecer_audit_payload = build_parecer_audit_payload(
                    parecer_status,
                    user_choice_when_missing=req.parecer_user_choice_when_missing,
                    mode_forced_to_semi_auto=bool(req.parecer_forced_to_semi_auto),
                )

                tracker.set_metadata("parecer_required", parecer_status.get("parecer_required"))
                tracker.set_metadata("parecer_found", parecer_status.get("parecer_found"))
                tracker.set_metadata("parecer_source", parecer_status.get("parecer_source"))

                if parecer_status.get("config_error"):
                    config_error_message = parecer_status.get("config_error_message")
                    logger.error(
                        "[PARECER-NATJUS] Erro de configuracao: cnj=%s tipo_peca=%s detail=%s",
                        cnj_limpo,
                        tipo_peca,
                        config_error_message,
                    )
                    yield stream_helper.format_erro(config_error_message)
                    return

                if parecer_status.get("parecer_required") and not parecer_status.get("parecer_found") and req.parecer_user_choice_when_missing != "continue_without":
                    logger.warning(
                        "[PARECER-NATJUS] Parecer ausente: cnj=%s tipo_peca=%s codes=%s",
                        cnj_limpo,
                        tipo_peca,
                        parecer_status.get("parecer_document_codes"),
                    )
                    yield stream_helper.format_parecer_natjus_ausente(
                        tipo_peca=tipo_peca,
                        parecer_document_codes=parecer_status.get('parecer_document_codes', []),
                    )
                    return

                tracker.mark("agente2_start")
                yield stream_helper.format_agente(2, "ativo", "Analisando e ativando prompts...")

                # Extrai dados das variáveis dos resumos JSON para avaliação determinística
                dados_extracao = consolidar_dados_extracao(resultado_agente1)
                dados_extracao["_parecer_natjus"] = parecer_audit_payload
                if parecer_upload_extracao.get("dados_extracao"):
                    _mesclar_dados_extracao(
                        dados_extracao,
                        parecer_upload_extracao.get("dados_extracao", {}),
                    )
                if parecer_upload_metadata:
                    extraction_mode = (
                        "json_modelo_categoria"
                        if parecer_upload_extracao.get("success")
                        else "texto_bruto_pdf"
                    )
                    dados_extracao["parecer_natjus_upload"] = {
                        "upload_id": parecer_upload_metadata.get("upload_id"),
                        "filename": parecer_upload_metadata.get("filename"),
                        "source": "user_upload",
                        "extraction_mode": extraction_mode,
                        "categoria_resumo_json_id": parecer_upload_extracao.get("categoria_id"),
                        "categoria_resumo_json_nome": parecer_upload_extracao.get("categoria_nome"),
                        "categoria_resumo_json_namespace": parecer_upload_extracao.get("categoria_namespace"),
                        "json_extraction_error": parecer_upload_extracao.get("error"),
                    }
                print(f"[ROUTER] dados_extracao consolidados: {len(dados_extracao)} variáveis")

                # Passa dados de extração para permitir fast path determinístico
                resultado_agente2 = await orq._executar_agente2(
                    resumo_para_geracao,
                    tipo_peca,
                    dados_processo=resultado_agente1.dados_brutos,
                    dados_extracao=dados_extracao,
                    numero_processo=cnj_limpo
                )

                tracker.mark("agente2_done", modulos=len(resultado_agente2.modulos_ids) if not resultado_agente2.erro else 0)

                if resultado_agente2.erro:
                    evt_agente, evt_erro = stream_helper.format_agente_erro(2, resultado_agente2.erro)
                    yield evt_agente
                    yield evt_erro
                    return

                yield stream_helper.format_agente(2, "concluido", f'{len(resultado_agente2.modulos_ids)} módulos ativados')

                # Agente 3: Gerador (COM STREAMING REAL)
                tracker.mark("prompt_build_start")

                # Telemetria: tamanho do payload do Agente 3
                _resumo_size = len(resumo_para_geracao)
                logger.info(
                    "[PIPELINE] agent3_payload_size: cnj=%s tamanho=%d",
                    cnj_limpo, _resumo_size,
                )
                tracker.set_metadata("agent3_resumo_size", _resumo_size)

                yield stream_helper.format_agente(3, "ativo", "Gerando peça jurídica com IA...")

                # Log se há observação do usuário
                if req.observacao_usuario:
                    yield stream_helper.format_info('Observações do usuário serão consideradas na geração')

                # Usa versão STREAMING do Agente 3 para TTFT rápido
                tracker.mark("prompt_build_done")
                tracker.mark("llm_call_start")
                resultado_agente3 = None
                first_chunk_received = False
                async for event in orq._executar_agente3_stream(
                    resumo_consolidado=resumo_para_geracao,
                    prompt_sistema=resultado_agente2.prompt_sistema,
                    prompt_peca=resultado_agente2.prompt_peca,
                    prompt_conteudo=resultado_agente2.prompt_conteudo,
                    tipo_peca=tipo_peca,
                    observacao_usuario=req.observacao_usuario
                ):
                    if event["tipo"] == "chunk":
                        # Registra primeiro token (TTFT)
                        if not first_chunk_received:
                            tracker.mark("first_token")
                            first_chunk_received = True

                        # Registra chunk para estatisticas de streaming
                        tracker.record_chunk(event['content'])

                        # Envia chunk de texto para o frontend em tempo real
                        yield stream_helper.format_geracao_chunk(event['content'])

                    elif event["tipo"] == "done":
                        tracker.mark("last_token")
                        resultado_agente3 = event["resultado"]

                    elif event["tipo"] == "error":
                        tracker.mark("last_token")
                        resultado_agente3 = event["resultado"]
                        evt_agente, evt_erro = stream_helper.format_agente_erro(3, event['error'])
                        yield evt_agente
                        yield evt_erro
                        return

                if resultado_agente3 and resultado_agente3.erro:
                    evt_agente, evt_erro = stream_helper.format_agente_erro(3, resultado_agente3.erro)
                    yield evt_agente
                    yield evt_erro
                    return

                # BUGFIX: Verifica se conteúdo foi gerado (pode estar vazio se streaming falhou silenciosamente)
                if not resultado_agente3 or not resultado_agente3.conteudo_markdown or not resultado_agente3.conteudo_markdown.strip():
                    erro_msg = "A geração não retornou conteúdo. Possível timeout ou erro na API de IA. Tente novamente."
                    print(f"[AGENTE3] ERRO: Conteúdo vazio após streaming!")
                    print(f"[AGENTE3]    - resultado_agente3 exists: {resultado_agente3 is not None}")
                    if resultado_agente3:
                        print(f"[AGENTE3]    - conteudo_markdown length: {len(resultado_agente3.conteudo_markdown) if resultado_agente3.conteudo_markdown else 'None'}")
                    evt_agente, evt_erro = stream_helper.format_agente_erro(3, erro_msg)
                    yield evt_agente
                    yield evt_erro
                    return

                yield stream_helper.format_agente(3, "concluido", "Peça gerada com sucesso!")

                # Prepara lista de documentos processados para salvar
                tracker.mark("postprocess_start")
                documentos_processados = None
                if resultado_agente1.dados_brutos and resultado_agente1.dados_brutos.documentos:
                    documentos_processados = []
                    for doc in resultado_agente1.dados_brutos.documentos:
                        if not doc.irrelevante:
                            documentos_processados.append({
                                "id": doc.id,
                                "ids": doc.ids_agrupados if doc.ids_agrupados else [doc.id],
                                "descricao": doc.descricao,
                                "descricao_ia": doc.descricao_ia,
                                "tipo_documento": doc.tipo_documento,
                                "data_juntada": to_iso_utc(doc.data_juntada),
                                "data_formatada": doc.data_formatada,
                                "processo_origem": doc.processo_origem
                            })
                if parecer_upload_metadata:
                    if documentos_processados is None:
                        documentos_processados = []
                    extraction_mode = (
                        "json_modelo_categoria"
                        if parecer_upload_extracao.get("success")
                        else "texto_bruto_pdf"
                    )
                    documentos_processados.append({
                        "id": f"upload_{parecer_upload_metadata.get('upload_id')}",
                        "ids": [f"upload_{parecer_upload_metadata.get('upload_id')}"],
                        "descricao": "Parecer NATJus anexado pelo usuario",
                        "descricao_ia": "Parecer NATJus (upload manual)",
                        "tipo_documento": "UPLOAD_PARECER_NATJUS",
                        "data_juntada": to_iso_utc(get_utc_now()),
                        "data_formatada": now_local().strftime("%d/%m/%Y %H:%M"),
                        "processo_origem": False,
                        "source": "user_upload",
                        "upload_id": parecer_upload_metadata.get("upload_id"),
                        "filename": parecer_upload_metadata.get("filename"),
                        "extraction_mode": extraction_mode,
                        "categoria_resumo_json_id": parecer_upload_extracao.get("categoria_id"),
                        "categoria_resumo_json_nome": parecer_upload_extracao.get("categoria_nome"),
                    })
                tracker.mark("postprocess_done")

                # Salva no banco (usa resumo filtrado se disponível)
                tracker.mark("db_save_start")
                geracao = GeracaoPeca(
                    numero_cnj=cnj_limpo,
                    numero_cnj_formatado=cnj_limpo,
                    tipo_peca=tipo_peca,
                    dados_processo=dados_extracao,  # Persiste variáveis extraídas para auditoria
                    conteudo_gerado=resultado_agente3.conteudo_markdown,
                    prompt_enviado=resultado_agente3.prompt_enviado,
                    resumo_consolidado=resumo_para_geracao,
                    documentos_processados=documentos_processados,
                    modelo_usado=modelo,
                    usuario_id=current_user.id
                )

                # Campos de modo de ativação (podem não existir no banco se migration pendente)
                try:
                    geracao.modo_ativacao_agente2 = resultado_agente2.modo_ativacao
                    geracao.modulos_ativados_det = resultado_agente2.modulos_ativados_det
                    geracao.modulos_ativados_llm = resultado_agente2.modulos_ativados_llm
                except AttributeError:
                    pass

                # Salva activation trace para auditoria de ativação de módulos
                try:
                    from sistemas.gerador_pecas.services_activation_trace import (
                        build_activation_trace, save_activation_trace
                    )
                    trace_data = build_activation_trace(
                        decision_traces=resultado_agente2.decision_traces,
                        variaveis_snapshot=resultado_agente2.variaveis_snapshot,
                        modo_ativacao=resultado_agente2.modo_ativacao,
                        db=db,
                        modulos_avaliados_ids=resultado_agente2.modulos_ids,
                    )
                    save_activation_trace(geracao, trace_data)
                except Exception as e_trace:
                    logger.warning(f"[ACTIVATION-TRACE] Falha ao construir trace: {e_trace}")

                try:
                    db.add(geracao)
                    db.flush()  # Flush para obter o ID sem commit

                    # Cria versão inicial na mesma transação (evita commit duplo)
                    versao = VersaoPeca(
                        geracao_id=geracao.id,
                        numero_versao=1,
                        conteudo=resultado_agente3.conteudo_markdown,
                        origem='geracao_inicial',
                        descricao_alteracao='Versão inicial gerada pela IA',
                        diff_anterior=None
                    )
                    db.add(versao)

                    db.commit()
                    db.refresh(geracao)
                except Exception as e:
                    # Se falhou por colunas inexistentes, tenta sem os campos extras
                    if 'modo_ativacao_agente2' in str(e) or 'modulos_ativados' in str(e) or 'activation_trace' in str(e):
                        db.rollback()
                        geracao.modo_ativacao_agente2 = None
                        geracao.modulos_ativados_det = None
                        geracao.modulos_ativados_llm = None
                        geracao.activation_trace = None
                        from sqlalchemy import inspect
                        state = inspect(geracao)
                        for attr in ['modo_ativacao_agente2', 'modulos_ativados_det', 'modulos_ativados_llm', 'activation_trace']:
                            if attr in state.dict:
                                del state.dict[attr]
                        db.add(geracao)
                        db.flush()

                        versao = VersaoPeca(
                            geracao_id=geracao.id,
                            numero_versao=1,
                            conteudo=resultado_agente3.conteudo_markdown,
                            origem='geracao_inicial',
                            descricao_alteracao='Versão inicial gerada pela IA',
                            diff_anterior=None
                        )
                        db.add(versao)

                        db.commit()
                        db.refresh(geracao)
                    else:
                        raise

                tracker.mark("db_save_done")

                # Resultado final
                tracker.mark("response_sent")
                tracker.set_metadata("tipo_peca", tipo_peca)
                tracker.set_metadata("modelo", modelo)
                tracker.log_summary()

                # Inclui metricas de performance no evento final
                perf_report = tracker.get_report()

                # Salva log de performance detalhado no banco
                try:
                    log_request_perf(
                        report=perf_report,
                        db=db,
                        user_id=current_user.id if current_user else None,
                        username=current_user.username if current_user else None,
                        success=True
                    )
                except Exception as e:
                    print(f"[PERF] Erro ao salvar log: {e}")

                yield stream_helper.format_sucesso(
                    geracao_id=geracao.id,
                    tipo_peca=tipo_peca,
                    minuta_markdown=resultado_agente3.conteudo_markdown,
                    performance={
                        'ttft_ms': perf_report['metrics'].get('ttft_ms'),
                        'total_ms': perf_report['total_ms'],
                        'request_id': tracker.request_id,
                    },
                )
            else:
                # Fallback sem orquestrador
                yield stream_helper.format_info('Usando modo simplificado...')
                resultado = await service.processar_processo(
                    numero_cnj=cnj_limpo,
                    numero_cnj_formatado=cnj_limpo,
                    tipo_peca=req.tipo_peca,
                    resposta_usuario=req.resposta_usuario,
                    usuario_id=current_user.id
                )
                yield stream_helper.format_raw(resultado)
                
        except asyncio.TimeoutError:
            traceback.print_exc()
            yield stream_helper.format_erro('A solicitação demorou mais que o esperado. Tente com um pedido menor ou divida em partes.')
        except Exception as e:
            traceback.print_exc()
            # Mensagem mais amigável para erros comuns
            erro_str = str(e)
            if 'timeout' in erro_str.lower() or 'timed out' in erro_str.lower():
                mensagem_erro = 'A geração demorou mais que o esperado. Tente novamente ou use um pedido mais simples.'
            elif 'token' in erro_str.lower() and ('limit' in erro_str.lower() or 'exceeded' in erro_str.lower()):
                mensagem_erro = 'O conteúdo é muito extenso. Tente dividir em partes menores ou reduzir as observações.'
            elif 'connection' in erro_str.lower() or 'network' in erro_str.lower():
                mensagem_erro = 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.'
            else:
                mensagem_erro = f'Erro ao processar: {erro_str}'
            yield stream_helper.format_erro(mensagem_erro)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


def _normalizar_texto(texto: str) -> str:
    """
    Normaliza texto extraído de PDF.

    NOTA: Esta função agora usa o serviço centralizado text_normalizer.
    """
    result = text_normalizer.normalize(texto)
    return result.text


def _extrair_texto_pdf(pdf_bytes: bytes) -> str:
    """
    Extrai texto de um arquivo PDF usando PyMuPDF e normaliza.
    
    Args:
        pdf_bytes: Bytes do arquivo PDF
        
    Returns:
        Texto extraído e normalizado do PDF
    """
    texto_completo = []
    try:
        pdf = fitz.open(stream=pdf_bytes, filetype="pdf")
        for pagina in pdf:
            texto = pagina.get_text()
            if texto.strip():
                texto_completo.append(texto)
        pdf.close()
    except Exception as e:
        print(f"Erro ao extrair texto do PDF: {e}")
    
    # Junta todas as páginas e normaliza
    texto_bruto = "\n".join(texto_completo)
    return _normalizar_texto(texto_bruto)


@router.post("/processar-pdfs-stream")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def processar_pdfs_stream(
    request: Request,
    arquivos: List[UploadFile] = File(..., description="Arquivos PDF a serem analisados"),
    tipo_peca: Optional[str] = Form(None, description="Tipo de peça a gerar"),
    observacao_usuario: Optional[str] = Form(None, description="Observações do usuário para a IA"),
    group_id: Optional[int] = Form(None, description="Grupo de prompts"),
    subcategoria_ids_json: Optional[str] = Form(None, description="Subcategorias selecionadas (JSON)"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Processa arquivos PDF anexados e gera a peça jurídica.

    Esta rota permite gerar peças a partir de PDFs enviados diretamente,
    sem necessidade de informar um número de processo do TJ-MS.

    Fluxo com classificação de documentos:
    1. Classifica cada PDF em uma categoria (via IA)
    2. Extrai JSON estruturado de cada documento conforme sua categoria
    3. Seleciona documentos primários/secundários para o tipo de peça
    4. Monta resumo consolidado com dados estruturados
    5. Executa Agente 2 (detector de módulos) e Agente 3 (gerador)

    Se a flag `enable_auto_piece_detection` estiver desabilitada, tipo_peca é OBRIGATÓRIO.

    Returns:
        Stream SSE com progresso da geração
    """
    # SECURITY: Verifica cota de IA
    await check_ai_quota(current_user)

    # Verifica se detecção automática está habilitada
    permite_auto = config_cache.get_auto_detection_enabled(db)

    # Validação: se auto-detecção está desabilitada, tipo_peca é obrigatório
    if not permite_auto and not tipo_peca:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de peça é obrigatório. Selecione o tipo de peça antes de gerar."
        )

    subcategoria_ids = _parse_subcategoria_ids_form(subcategoria_ids_json)
    grupo, subcategoria_ids = _resolver_grupo_e_subcategorias(
        current_user,
        db,
        group_id,
        subcategoria_ids
    )
    group_id = grupo.id

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            # Evento inicial
            yield stream_helper.format_inicio(mensagem="Processando arquivos PDF...")

            # ==================================================================
            # ESTÁGIO 1: LEITURA E CLASSIFICAÇÃO DE DOCUMENTOS
            # ==================================================================
            yield stream_helper.format_agente(1, "ativo", f'Lendo {len(arquivos)} arquivo(s)...')

            # Lê bytes de todos os PDFs
            documentos_bytes = []
            for i, arquivo in enumerate(arquivos):
                if not arquivo.filename.lower().endswith('.pdf'):
                    yield stream_helper.format_info(f'Ignorando arquivo não-PDF: {arquivo.filename}')
                    continue

                conteudo = await arquivo.read()
                documentos_bytes.append({
                    "nome": arquivo.filename,
                    "id": f"pdf_{i+1}",
                    "bytes": conteudo,
                    "ordem": i + 1
                })
                yield stream_helper.format_info(f'Lido: {arquivo.filename} ({len(conteudo)} bytes)')

            if not documentos_bytes:
                yield stream_helper.format_erro('Nenhum arquivo PDF válido encontrado.')
                return

            # Classifica cada documento
            yield stream_helper.format_info('Classificando documentos por categoria...')

            from sistemas.gerador_pecas.document_classifier import DocumentClassifier
            from sistemas.gerador_pecas.document_selector import DocumentSelector

            classificador = DocumentClassifier(db)
            classificacoes = await classificador.classificar_lote(documentos_bytes)

            # Exibe resultado da classificação
            for clf in classificacoes:
                status = "fallback" if clf.fallback_aplicado else f"conf: {clf.confianca:.0%}"
                source_label = {"text": "TEXTO", "ocr_text": "OCR", "full_image": "IMAGEM"}.get(clf.source.value, clf.source.value)
                yield stream_helper.format_info(f'• {clf.arquivo_nome}: {clf.categoria_nome} ({status}) [{source_label}]')

            # ==================================================================
            # ESTÁGIO 2: SELEÇÃO DE DOCUMENTOS (após saber tipo de peça)
            # ==================================================================
            tipo_peca_final = tipo_peca

            # Se não tem tipo de peça, detecta automaticamente
            if not tipo_peca_final:
                yield stream_helper.format_info('Detectando tipo de peça automaticamente...')

                # Busca configurações do modelo de geração
                modelo = config_cache.get_config(
                    "gerador_pecas",
                    "modelo_geracao",
                    db,
                    default="google/gemini-2.5-pro-preview-05-06",
                )

                # Inicializa serviço para usar o detector do agente 2
                service = GeradorPecasService(
                    modelo=modelo,
                    db=db,
                    group_id=group_id,
                    subcategoria_ids=subcategoria_ids
                )

                if service.orquestrador:
                    # Monta resumo simples para detecção de tipo
                    texto_resumo = "\n\n".join([
                        f"Documento: {clf.arquivo_nome}\nCategoria: {clf.categoria_nome}\nJustificativa: {clf.justificativa}"
                        for clf in classificacoes
                    ])
                    deteccao = await service.orquestrador.agente2.detectar_tipo_peca(texto_resumo)
                    tipo_peca_final = deteccao.get("tipo_peca") or "contestacao"
                    confianca_tipo = deteccao.get("confianca", "media")
                    yield stream_helper.format_info(f'Tipo detectado: {tipo_peca_final} (confiança: {confianca_tipo})')
                else:
                    tipo_peca_final = "contestacao"
                    yield stream_helper.format_info('Usando tipo padrão: contestação')

            # Seleciona documentos primários e secundários
            seletor = DocumentSelector(db)
            selecao = seletor.selecionar_documentos(classificacoes, tipo_peca_final)

            yield stream_helper.format_info(f'Seleção: {len(selecao.documentos_primarios)} primário(s), {len(selecao.documentos_secundarios)} secundário(s)')

            # ==================================================================
            # ESTÁGIO 3: EXTRAÇÃO DE JSON POR CATEGORIA
            # ==================================================================
            yield stream_helper.format_info('Extraindo dados estruturados dos documentos...')

            from sistemas.gerador_pecas.extrator_resumo_json import (
                FormatoResumo, gerar_prompt_extracao_json, gerar_prompt_extracao_json_imagem,
                parsear_resposta_json, normalizar_json_com_schema, json_para_markdown
            )
            from services.gemini_service import chamar_gemini as chamar_gemini_async, chamar_gemini_com_imagens as chamar_gemini_com_imagens_async

            # Mapeia classificações por arquivo_id para acesso rápido
            clf_por_id = {clf.arquivo_id: clf for clf in classificacoes}
            doc_bytes_por_id = {d["id"]: d for d in documentos_bytes}

            # Processa documentos primários e secundários
            documentos_processados = []
            dados_extracao_consolidados = {}
            resumos_markdown = []
            categoria_repo = CategoriaResumoJSONRepository(db)

            todos_docs_selecionados = selecao.get_todos_selecionados()

            for sel_doc in todos_docs_selecionados:
                clf = sel_doc.classificacao
                doc_data = doc_bytes_por_id.get(clf.arquivo_id)

                if not doc_data:
                    continue

                # Busca categoria e formato JSON
                categoria = categoria_repo.get_active_by_id(clf.categoria_id)

                if not categoria or not categoria.formato_json:
                    # Sem formato JSON configurado - usa texto bruto
                    texto = _extrair_texto_pdf(doc_data["bytes"])
                    resumos_markdown.append(f"### {clf.arquivo_nome} ({clf.categoria_nome})\n\n{texto[:5000]}...")
                    documentos_processados.append({
                        "nome": clf.arquivo_nome,
                        "ordem": doc_data["ordem"],
                        "categoria": clf.categoria_nome,
                        "categoria_id": clf.categoria_id,
                        "confianca": clf.confianca,
                        "source": clf.source.value,
                        "role": sel_doc.role.value
                    })
                    continue

                # Monta formato para extração
                formato = FormatoResumo(
                    categoria_id=categoria.id,
                    categoria_nome=categoria.nome,
                    formato_json=categoria.formato_json,
                    instrucoes_extracao=categoria.instrucoes_extracao,
                    is_residual=categoria.is_residual
                )

                # Extrai conteúdo do PDF para extração JSON
                from sistemas.gerador_pecas.document_classifier import extrair_conteudo_pdf
                conteudo_pdf = extrair_conteudo_pdf(doc_data["bytes"])

                # Prepara chamada de extração baseado no tipo de conteúdo
                yield stream_helper.format_info(f'Extraindo JSON de: {clf.arquivo_nome}...')

                try:
                    if conteudo_pdf.tem_texto and conteudo_pdf.texto_qualidade == "good":
                        # Extração via texto
                        prompt = gerar_prompt_extracao_json(formato, f"Documento: {clf.arquivo_nome}", db)
                        prompt_final = prompt.replace("{texto_documento}", conteudo_pdf.texto[:30000])

                        resposta = await chamar_gemini_async(
                            prompt=prompt_final,
                            modelo="gemini-2.5-flash-lite",
                            temperature=0.1,
                            max_tokens=8000
                        )
                    else:
                        # Extração via imagens
                        prompt = gerar_prompt_extracao_json_imagem(formato, db)

                        # Converte imagens para base64
                        imagens_b64 = [base64.b64encode(img).decode() for img in conteudo_pdf.imagens[:5]]

                        resposta = await chamar_gemini_com_imagens_async(
                            prompt=prompt,
                            imagens_base64=imagens_b64,
                            modelo="gemini-2.5-flash-lite",
                            temperature=0.1,
                            max_tokens=8000
                        )

                    # Parseia resposta JSON
                    json_extraido, erro_parse = parsear_resposta_json(resposta)

                    if erro_parse:
                        print(f"[PDF] Erro ao parsear JSON de {clf.arquivo_nome}: {erro_parse}")
                        texto = _extrair_texto_pdf(doc_data["bytes"])
                        resumos_markdown.append(f"### {clf.arquivo_nome} ({clf.categoria_nome})\n\n{texto[:5000]}...")
                    else:
                        # Normaliza JSON com schema
                        json_normalizado = normalizar_json_com_schema(json_extraido, categoria.formato_json)

                        # Converte para markdown para resumo
                        md = json_para_markdown(json_normalizado)
                        resumos_markdown.append(f"### {clf.arquivo_nome} ({clf.categoria_nome})\n\n{md}")

                        # Consolida dados de extração
                        # NOTA: Se a chave já começa com o namespace (ex: peticao_inicial_),
                        # não duplica o prefixo para evitar peticao_inicial_peticao_inicial_xxx
                        namespace = categoria.namespace or categoria.nome.lower()
                        namespace_prefix = f"{namespace}_" if namespace else ""
                        
                        for chave, valor in json_normalizado.items():
                            # Verifica se a chave já começa com o namespace para evitar duplicação
                            if namespace_prefix and chave.startswith(namespace_prefix):
                                slug = chave  # Já tem o prefixo, usa como está
                            elif namespace:
                                slug = f"{namespace}_{chave}"
                            else:
                                slug = chave

                            if slug not in dados_extracao_consolidados:
                                dados_extracao_consolidados[slug] = valor
                            else:
                                # Lógica de consolidação
                                existente = dados_extracao_consolidados[slug]
                                if isinstance(existente, bool) and isinstance(valor, bool):
                                    dados_extracao_consolidados[slug] = existente or valor
                                elif isinstance(existente, list) and isinstance(valor, list):
                                    dados_extracao_consolidados[slug] = list(set(existente + valor))

                except Exception as e:
                    print(f"[PDF] Erro na extração de {clf.arquivo_nome}: {e}")
                    texto = _extrair_texto_pdf(doc_data["bytes"])
                    resumos_markdown.append(f"### {clf.arquivo_nome} ({clf.categoria_nome})\n\n{texto[:5000]}...")

                documentos_processados.append({
                    "nome": clf.arquivo_nome,
                    "ordem": doc_data["ordem"],
                    "categoria": clf.categoria_nome,
                    "categoria_id": clf.categoria_id,
                    "confianca": clf.confianca,
                    "source": clf.source.value,
                    "role": sel_doc.role.value,
                    "justificativa": clf.justificativa
                })

            yield stream_helper.format_agente(1, "concluido", f'{len(documentos_processados)} documento(s) processado(s) com extração JSON')

            # ==================================================================
            # ESTÁGIO 4: BUSCAR NAT NO PROCESSO DE ORIGEM (SE AGRAVO)
            # ==================================================================
            # Quando os PDFs indicam agravo e não há NAT entre os documentos,
            # busca automaticamente o NAT no processo de origem (1º grau)
            nat_source = None
            try:
                from sistemas.gerador_pecas.services_nat_origem import buscar_nat_para_pdfs_anexados

                nat_result = await buscar_nat_para_pdfs_anexados(
                    dados_consolidados=dados_extracao_consolidados,
                    documentos_processados=documentos_processados,
                    db_session=db
                )

                if nat_result.busca_realizada:
                    yield stream_helper.format_info(f'[NAT-ORIGEM] Buscando Parecer NAT no processo de origem: {nat_result.numero_processo_origem}...')

                if nat_result.nat_encontrado and nat_result.nat_source == "origem":
                    # NAT encontrado no processo de origem - adiciona ao resumo
                    nat_source = "origem"
                    yield stream_helper.format_info('[NAT-ORIGEM] Parecer NAT encontrado no processo de origem!')

                    # Adiciona resumo do NAT aos resumos markdown
                    if nat_result.resumo_markdown:
                        resumos_markdown.append(nat_result.resumo_markdown)

                    # Adiciona documento NAT aos processados
                    documentos_processados.append({
                        "nome": f"Parecer NAT (Processo de Origem)",
                        "ordem": len(documentos_processados) + 1,
                        "categoria": "Parecer NAT",
                        "categoria_id": None,
                        "confianca": 1.0,
                        "source": "origem",
                        "role": "secondary",
                        "processo_origem": nat_result.numero_processo_origem,
                        "nat_source": "origem"
                    })

                    # Consolida dados JSON do NAT
                    if nat_result.dados_json:
                        namespace_prefix = "parecer_nat_"
                        for chave, valor in nat_result.dados_json.items():
                            slug = f"{namespace_prefix}{chave}" if not chave.startswith(namespace_prefix) else chave
                            if slug not in dados_extracao_consolidados:
                                dados_extracao_consolidados[slug] = valor
                            elif isinstance(valor, bool) and isinstance(dados_extracao_consolidados[slug], bool):
                                dados_extracao_consolidados[slug] = dados_extracao_consolidados[slug] or valor

                elif nat_result.nat_encontrado and nat_result.nat_source == "pdfs_anexados":
                    nat_source = "pdfs_anexados"
                    yield stream_helper.format_info('[NAT-ORIGEM] Parecer NAT já presente nos PDFs anexados')

                elif nat_result.busca_realizada and not nat_result.nat_encontrado:
                    yield stream_helper.format_info(f'[NAT-ORIGEM] {nat_result.motivo}')

            except Exception as e:
                print(f"[NAT-ORIGEM] Erro na busca de NAT para PDFs: {e}")
                traceback.print_exc()
                # Não interrompe o fluxo - apenas loga o erro
                yield stream_helper.format_info(f'[NAT-ORIGEM] Busca de NAT não disponível: {str(e)}')

            # ==================================================================
            # ESTÁGIO 5: MONTAR RESUMO CONSOLIDADO
            # ==================================================================
            resumo_consolidado = _montar_resumo_pdfs_classificados(
                documentos_processados,
                resumos_markdown,
                selecao
            )

            # Adiciona informação de nat_source ao resumo se aplicável
            if nat_source:
                resumo_consolidado = f"**nat_source**: {nat_source}\n\n" + resumo_consolidado

            # ==================================================================
            # ESTÁGIO 6: AGENTE 2 E 3 (mesmo fluxo anterior)
            # ==================================================================
            modelo = config_cache.get_config(
                "gerador_pecas",
                "modelo_geracao",
                db,
                default="google/gemini-2.5-pro-preview-05-06",
            )

            service = GeradorPecasService(
                modelo=modelo,
                db=db,
                group_id=group_id,
                subcategoria_ids=subcategoria_ids
            )

            if service.orquestrador:
                orq = service.orquestrador

                yield stream_helper.format_agente(2, "ativo", "Analisando e ativando prompts...")

                # Log detalhado das variáveis extraídas para debug
                if dados_extracao_consolidados:
                    print(f"[PDF-ROUTER] Variáveis extraídas para avaliação determinística:")
                    for slug, valor in dados_extracao_consolidados.items():
                        print(f"[PDF-ROUTER]   - {slug}: {valor}")
                    print(f"[PDF-ROUTER] Tipo de peça para avaliação: {tipo_peca_final}")
                else:
                    print(f"[PDF-ROUTER] AVISO: Nenhuma variável extraída dos PDFs!")

                # AGORA temos dados de extração estruturados!
                resultado_agente2 = await orq._executar_agente2(
                    resumo_consolidado,
                    tipo_peca_final,
                    dados_processo=None,
                    dados_extracao=dados_extracao_consolidados if dados_extracao_consolidados else None
                )

                if resultado_agente2.erro:
                    evt_agente, evt_erro = stream_helper.format_agente_erro(2, resultado_agente2.erro)
                    yield evt_agente
                    yield evt_erro
                    return

                # Info sobre modo de ativação
                modo_info = resultado_agente2.modo_ativacao or "llm"
                det_count = resultado_agente2.modulos_ativados_det or 0
                llm_count = resultado_agente2.modulos_ativados_llm or 0
                yield stream_helper.format_agente(2, "concluido", f'{len(resultado_agente2.modulos_ids)} módulos ({det_count} det, {llm_count} LLM)')

                # Agente 3: Gerador
                yield stream_helper.format_agente(3, "ativo", "Gerando peça jurídica com IA...")

                if observacao_usuario:
                    yield stream_helper.format_info('Observações do usuário serão consideradas na geração')

                # Usa versão STREAMING do Agente 3 para TTFT rápido
                resultado_agente3 = None
                async for event in orq._executar_agente3_stream(
                    resumo_consolidado=resumo_consolidado,
                    prompt_sistema=resultado_agente2.prompt_sistema,
                    prompt_peca=resultado_agente2.prompt_peca,
                    prompt_conteudo=resultado_agente2.prompt_conteudo,
                    tipo_peca=tipo_peca_final,
                    observacao_usuario=observacao_usuario
                ):
                    if event["tipo"] == "chunk":
                        # Envia chunk de texto para o frontend em tempo real
                        yield stream_helper.format_geracao_chunk(event['content'])

                    elif event["tipo"] == "done":
                        resultado_agente3 = event["resultado"]

                    elif event["tipo"] == "error":
                        resultado_agente3 = event["resultado"]
                        evt_agente, evt_erro = stream_helper.format_agente_erro(3, event['error'])
                        yield evt_agente
                        yield evt_erro
                        return

                if resultado_agente3 and resultado_agente3.erro:
                    evt_agente, evt_erro = stream_helper.format_agente_erro(3, resultado_agente3.erro)
                    yield evt_agente
                    yield evt_erro
                    return

                # BUGFIX: Verifica se conteúdo foi gerado (pode estar vazio se streaming falhou silenciosamente)
                if not resultado_agente3 or not resultado_agente3.conteudo_markdown or not resultado_agente3.conteudo_markdown.strip():
                    erro_msg = "A geração não retornou conteúdo. Possível timeout ou erro na API de IA. Tente novamente."
                    print(f"[AGENTE3] ERRO: Conteúdo vazio após streaming (curadoria)!")
                    evt_agente, evt_erro = stream_helper.format_agente_erro(3, erro_msg)
                    yield evt_agente
                    yield evt_erro
                    return

                yield stream_helper.format_agente(3, "concluido", "Peça gerada com sucesso!")

                # Salva no banco
                geracao = GeracaoPeca(
                    numero_cnj="PDF_UPLOAD",
                    numero_cnj_formatado="PDFs Anexados",
                    tipo_peca=tipo_peca_final,
                    dados_processo=dados_extracao_consolidados,  # Persiste variáveis extraídas para auditoria
                    conteudo_gerado=resultado_agente3.conteudo_markdown,
                    prompt_enviado=resultado_agente3.prompt_enviado,
                    resumo_consolidado=resumo_consolidado,
                    documentos_processados=documentos_processados,
                    modelo_usado=modelo,
                    usuario_id=current_user.id
                )

                # Campos de modo de ativação
                try:
                    geracao.modo_ativacao_agente2 = resultado_agente2.modo_ativacao
                    geracao.modulos_ativados_det = resultado_agente2.modulos_ativados_det
                    geracao.modulos_ativados_llm = resultado_agente2.modulos_ativados_llm
                except AttributeError:
                    pass

                # Salva activation trace para auditoria de ativação de módulos
                try:
                    from sistemas.gerador_pecas.services_activation_trace import (
                        build_activation_trace, save_activation_trace
                    )
                    trace_data = build_activation_trace(
                        decision_traces=resultado_agente2.decision_traces,
                        variaveis_snapshot=resultado_agente2.variaveis_snapshot,
                        modo_ativacao=resultado_agente2.modo_ativacao,
                        db=db,
                        modulos_avaliados_ids=resultado_agente2.modulos_ids,
                    )
                    save_activation_trace(geracao, trace_data)
                except Exception as e_trace:
                    logger.warning(f"[ACTIVATION-TRACE] Falha ao construir trace (PDF): {e_trace}")

                db.add(geracao)
                db.commit()
                db.refresh(geracao)

                criar_versao_inicial(db, geracao.id, resultado_agente3.conteudo_markdown)

                yield stream_helper.format_sucesso(geracao.id, tipo_peca_final, resultado_agente3.conteudo_markdown)
            else:
                yield stream_helper.format_erro('Orquestrador de agentes não disponível')

        except asyncio.TimeoutError:
            traceback.print_exc()
            yield stream_helper.format_erro('A solicitação demorou mais que o esperado. Tente com menos arquivos ou documentos menores.')
        except Exception as e:
            traceback.print_exc()
            # Mensagem mais amigável para erros comuns
            erro_str = str(e)
            if 'timeout' in erro_str.lower() or 'timed out' in erro_str.lower():
                mensagem_erro = 'A geração demorou mais que o esperado. Tente novamente ou use menos arquivos.'
            elif 'token' in erro_str.lower() and ('limit' in erro_str.lower() or 'exceeded' in erro_str.lower()):
                mensagem_erro = 'O conteúdo dos PDFs é muito extenso. Tente com menos arquivos ou documentos menores.'
            elif 'connection' in erro_str.lower() or 'network' in erro_str.lower():
                mensagem_erro = 'Erro de conexão com o servidor. Verifique sua internet e tente novamente.'
            else:
                mensagem_erro = f'Erro ao processar: {erro_str}'
            yield stream_helper.format_erro(mensagem_erro)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


def _montar_resumo_pdfs_classificados(
    documentos: List[Dict],
    resumos_markdown: List[str],
    selecao
) -> str:
    """
    Monta resumo consolidado a partir de documentos classificados e JSONs extraídos.
    """
    partes = []

    partes.append("# RESUMO CONSOLIDADO DOS DOCUMENTOS")
    partes.append(f"**Origem**: Arquivos PDF anexados (com classificação por categoria)")
    partes.append(f"**Data da Análise**: {now_local().strftime('%d/%m/%Y %H:%M')}")
    partes.append(f"**Total de Documentos**: {len(documentos)}")
    partes.append(f"**Tipo de Peça**: {selecao.tipo_peca}")
    partes.append(f"**Seleção**: {selecao.razao_geral}")
    partes.append("\n---\n")

    # Documentos primários
    if selecao.documentos_primarios:
        partes.append("## DOCUMENTOS PRIMÁRIOS (fonte principal)\n")
        for sel_doc in selecao.documentos_primarios:
            clf = sel_doc.classificacao
            partes.append(f"- **{clf.arquivo_nome}** → {clf.categoria_nome} (conf: {clf.confianca:.0%})")
        partes.append("")

    # Documentos secundários
    if selecao.documentos_secundarios:
        partes.append("## DOCUMENTOS SECUNDÁRIOS (fontes auxiliares)\n")
        for sel_doc in selecao.documentos_secundarios:
            clf = sel_doc.classificacao
            partes.append(f"- **{clf.arquivo_nome}** → {clf.categoria_nome} (conf: {clf.confianca:.0%})")
        partes.append("")

    partes.append("---\n")
    partes.append("## CONTEÚDO EXTRAÍDO\n")

    # Adiciona resumos markdown
    for resumo in resumos_markdown:
        partes.append(resumo)
        partes.append("\n---\n")

    partes.append("*Este resumo foi gerado a partir de arquivos PDF classificados automaticamente.*")

    return "\n".join(partes)


def _montar_resumo_pdfs(documentos: List[Dict]) -> str:
    """
    Monta o resumo consolidado a partir dos textos dos PDFs.
    
    Args:
        documentos: Lista de dicts com 'nome', 'texto' e 'ordem'
        
    Returns:
        Resumo consolidado em formato similar ao do Agente 1
    """
    partes = []
    
    partes.append("# RESUMO CONSOLIDADO DOS DOCUMENTOS")
    partes.append(f"**Origem**: Arquivos PDF anexados")
    partes.append(f"**Data da Análise**: {now_local().strftime('%d/%m/%Y %H:%M')}")
    partes.append(f"**Total de Documentos**: {len(documentos)}")
    partes.append("\n---\n")
    partes.append("## DOCUMENTOS ANALISADOS\n")
    
    for doc in documentos:
        partes.append(f"### {doc['ordem']}. {doc['nome']}")
        partes.append(f"\n{doc['texto']}\n")
        partes.append("---\n")
    
    partes.append("\n---")
    partes.append("*Este resumo foi gerado a partir de arquivos PDF anexados.*")
    
    return "\n".join(partes)


@router.post("/editar-minuta")
async def editar_minuta(
    req: EditarMinutaRequest,
    current_user: User = Depends(get_current_active_user),
    config_repo: ConfiguracaoIARepository = Depends(get_config_repo),
):
    """
    Processa pedido de edição da minuta via chat.
    Usa o mesmo modelo de IA configurado para geração.
    Retorna a minuta atualizada em markdown.
    """
    try:
        # Logging de tamanho para diagnóstico
        minuta_len = len(req.minuta_atual) if req.minuta_atual else 0
        mensagem_len = len(req.mensagem) if req.mensagem else 0
        historico_len = len(req.historico) if req.historico else 0
        logger.info(
            "[EDITAR-MINUTA] Tamanho da minuta: %s chars, mensagem: %s chars, historico: %s msgs",
            minuta_len, mensagem_len, historico_len
        )

        modelo = config_repo.get_valor(
            "gerador_pecas", "modelo_geracao", default="anthropic/claude-3.5-sonnet"
        )

        service = GeradorPecasService(
            modelo=modelo,
            db=config_repo.db
        )
        
        # Processa a edição
        resultado = await service.editar_minuta(
            minuta_atual=req.minuta_atual,
            mensagem_usuario=req.mensagem,
            historico=req.historico
        )
        
        return resultado
        
    except asyncio.TimeoutError:
        traceback.print_exc()
        return {
            "status": "erro",
            "mensagem": "A edição demorou mais que o esperado. Tente um pedido de alteração mais simples."
        }
    except Exception as e:
        traceback.print_exc()
        erro_str = str(e)
        # Mensagem mais amigável para erros comuns
        if 'timeout' in erro_str.lower() or 'timed out' in erro_str.lower():
            mensagem_erro = 'A edição demorou mais que o esperado. Tente um pedido mais simples.'
        elif 'token' in erro_str.lower() and ('limit' in erro_str.lower() or 'exceeded' in erro_str.lower()):
            mensagem_erro = 'A minuta ou o pedido são muito extensos. Tente uma alteração menor.'
        else:
            mensagem_erro = f'Erro ao processar edição: {erro_str}'
        
        return {
            "status": "erro",
            "mensagem": mensagem_erro
        }


@router.post("/editar-minuta-stream")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def editar_minuta_stream(
    request: Request,
    req: EditarMinutaRequest,
    current_user: User = Depends(get_current_active_user),
    config_repo: ConfiguracaoIARepository = Depends(get_config_repo),
):
    """
    Processa edição da minuta via chat com streaming real.

    PERFORMANCE: Usa streamGenerateContent do Gemini para enviar
    tokens assim que são gerados, reduzindo TTFT de 15-60s para 1-3s.

    Retorna um stream SSE com eventos:
    - event: start - início do streaming
    - event: chunk - cada chunk de texto gerado
    - event: done - conclusão do streaming
    - event: error - erro durante o processo
    """
    # SECURITY: Verifica cota de IA
    await check_ai_quota(current_user)

    from fastapi.responses import StreamingResponse
    from services.gemini_service import stream_to_sse
    import json

    try:
        tipo_peca = req.tipo_peca

        modelo = config_repo.get_valor(
            "gerador_pecas", "modelo_geracao", default="anthropic/claude-3.5-sonnet"
        )

        service = GeradorPecasService(
            modelo=modelo,
            db=config_repo.db
        )

        # Generator de streaming (com busca de argumentos integrada)
        text_generator = service.editar_minuta_stream(
            minuta_atual=req.minuta_atual,
            mensagem_usuario=req.mensagem,
            historico=req.historico,
            tipo_peca=tipo_peca
        )

        # Converte para SSE com heartbeats
        sse_generator = stream_to_sse(
            text_generator,
            event_type="chunk",
            include_heartbeat=True,
            heartbeat_interval=15.0
        )

        return StreamingResponse(
            sse_generator,
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no"  # Desabilita buffering no nginx
            }
        )

    except Exception as e:
        traceback.print_exc()

        # Retorna erro como SSE para compatibilidade
        async def error_generator():
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

        return StreamingResponse(
            error_generator(),
            media_type="text/event-stream"
        )


@router.post("/exportar-docx")
async def exportar_docx(
    req: ExportarDocxRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    Exporta markdown para DOCX usando template personalizado.
    
    Converte o conteúdo markdown da minuta para um documento Word (.docx)
    preservando toda a formatação: negrito, itálico, títulos, listas, citações.
    
    O documento é gerado com:
    - Margens ABNT (3cm esq/sup, 2cm dir/inf)
    - Fonte Arial 12pt
    - Recuo de primeira linha 1.25cm
    - Espaçamento 1.5
    - Citações com recuo de 4cm e fonte 11pt
    
    Returns:
        JSON com URL para download do documento
    """
    try:
        from sistemas.gerador_pecas.docx_converter import markdown_to_docx
        
        # Gera nome único para o arquivo
        file_id = str(uuid.uuid4())
        
        # Monta nome amigável: tipo_peca_numero_processo.docx
        tipo_map = {
            'contestacao': 'contestacao',
            'recurso_apelacao': 'apelacao',
            'contrarrazoes': 'contrarrazoes',
            'parecer': 'parecer'
        }
        tipo_nome = tipo_map.get(req.tipo_peca, req.tipo_peca) if req.tipo_peca else 'peca'

        # Número do processo (formatado ou limpo)
        if req.numero_cnj:
            # Remove caracteres especiais mas mantém o número completo
            numero_processo = _limpar_cnj(req.numero_cnj)
        else:
            numero_processo = file_id[:8]

        filename = f"{tipo_nome}_{numero_processo}.docx"
        filepath = os.path.join(TEMP_DIR, filename)
        
        # Converte markdown para DOCX
        success = markdown_to_docx(req.markdown, filepath)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Erro ao converter documento para DOCX"
            )
        
        return {
            "status": "sucesso",
            "url_download": f"/gerador-pecas/api/download/{filename}",
            "filename": filename
        }
        
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Módulo de conversão não disponível: {str(e)}"
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao exportar documento: {str(e)}"
        )


@router.get("/download/{filename}")
async def download_documento(
    filename: str,
    current_user: User = Depends(get_current_user_from_token_or_query)
):
    """Download do documento gerado (aceita token via header, cookie ou query param)"""
    
    filepath = os.path.join(TEMP_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(
            status_code=404,
            detail="Documento não encontrado ou expirado"
        )
    
    download_name = filename
    
    return FileResponse(
        filepath,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=download_name
    )


@router.get("/historico")
async def listar_historico(
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPecaRepository = Depends(get_geracao_repo),
):
    """
    Lista o histórico de gerações do usuário.
    """
    try:
        geracoes = repo.find_by_user(current_user.id)

        return [
            {
                "id": g.id,
                "cnj": g.numero_cnj_formatado or g.numero_cnj,
                "tipo_peca": g.tipo_peca,
                "data": to_iso_utc(g.criado_em)
            }
            for g in geracoes
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/historico/{geracao_id}")
async def excluir_historico(
    geracao_id: int,
    current_user: User = Depends(get_current_active_user),
    geracao_repo: GeracaoPecaRepository = Depends(get_geracao_repo),
    feedback_repo: FeedbackPecaRepository = Depends(get_feedback_repo),
):
    """Remove uma geração do histórico do usuário - PRESERVA feedbacks."""
    try:
        geracao = geracao_repo.find_by_id_and_user(geracao_id, current_user.id)

        if not geracao:
            raise HTTPException(status_code=404, detail="Geração não encontrada")

        # Verifica se tem feedback associado - se tiver, não permite excluir
        feedback = feedback_repo.find_by_geracao(geracao_id)
        if feedback:
            raise HTTPException(
                status_code=400,
                detail="Não é possível excluir geração que possui feedback registrado"
            )

        geracao_repo.delete(geracao)
        geracao_repo.commit()

        return {"success": True, "message": "Geração removida do histórico"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historico/{geracao_id}")
async def obter_geracao(
    geracao_id: int,
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPecaRepository = Depends(get_geracao_repo),
):
    """
    Obtém detalhes completos de uma geração específica.
    Permite reabrir uma peça antiga no editor.
    """
    try:
        geracao = repo.find_by_id_and_user(geracao_id, current_user.id)

        if not geracao:
            raise HTTPException(status_code=404, detail="Geração não encontrada")
        
        # Detecta se o conteúdo é markdown (string) ou JSON (dict)
        # Novas gerações são markdown, antigas são JSON
        is_markdown = isinstance(geracao.conteudo_gerado, str)
        
        return {
            "id": geracao.id,
            "cnj": geracao.numero_cnj_formatado or geracao.numero_cnj,
            "tipo_peca": geracao.tipo_peca,
            "data": to_iso_utc(geracao.criado_em),
            "minuta_markdown": geracao.conteudo_gerado if is_markdown else None,
            "conteudo_json": geracao.conteudo_gerado if not is_markdown else None,
            "resumo_consolidado": geracao.resumo_consolidado,
            "modelo_usado": geracao.modelo_usado,
            "tempo_processamento": geracao.tempo_processamento,
            "historico_chat": geracao.historico_chat or [],
            "has_markdown": is_markdown
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/historico/{geracao_id}")
async def salvar_geracao(
    geracao_id: int,
    req: SalvarMinutaComVersaoRequest,
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPecaRepository = Depends(get_geracao_repo),
):
    """
    Salva alterações feitas na minuta via chat.
    Atualiza o conteudo_gerado com o novo markdown, o histórico de chat,
    e cria uma nova versão no histórico de versões.
    """
    try:
        geracao = repo.find_by_id_and_user(geracao_id, current_user.id)

        if not geracao:
            raise HTTPException(status_code=404, detail="Geração não encontrada")

        # Verifica se houve alteração no conteúdo
        conteudo_anterior = geracao.conteudo_gerado or ""
        conteudo_novo = req.minuta_markdown

        versao_criada = None

        # Se o conteúdo mudou, cria uma nova versão
        if conteudo_anterior != conteudo_novo:
            # Obtém a última mensagem do usuário do histórico como descrição
            descricao = req.descricao_alteracao
            if not descricao and req.historico_chat:
                # Pega a última mensagem do usuário
                for msg in reversed(req.historico_chat):
                    if msg.get("role") == "user":
                        descricao = msg.get("content", "")[:200]  # Limita tamanho
                        break

            # Verifica se já existe alguma versão para esta geração
            # (versoes.py usa db diretamente — sera migrado na Fase 4)
            from sistemas.gerador_pecas.repositories import VersaoPecaRepository
            versao_repo = VersaoPecaRepository(repo.db)
            if not versao_repo.has_versions(geracao_id):
                criar_versao_inicial(repo.db, geracao_id, conteudo_anterior)

            # Cria a nova versão
            nova_versao, diff = criar_nova_versao(
                db=repo.db,
                geracao_id=geracao_id,
                conteudo_novo=conteudo_novo,
                descricao=descricao,
                origem='edicao_chat'
            )

            if nova_versao:
                versao_criada = {
                    "id": nova_versao.id,
                    "numero_versao": nova_versao.numero_versao,
                    "resumo_diff": diff.get("resumo", "")
                }

        # Atualiza o conteúdo com o novo markdown
        geracao.conteudo_gerado = req.minuta_markdown

        # Atualiza o histórico de chat se fornecido
        if req.historico_chat is not None:
            geracao.historico_chat = req.historico_chat

        repo.commit()

        response = {"success": True, "message": "Minuta salva com sucesso"}
        if versao_criada:
            response["versao"] = versao_criada

        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# ============================================
# Endpoint: Activation Trace (Ativação de Módulos)
# ============================================

@router.get("/historico/{geracao_id}/activation-trace")
async def obter_activation_trace_usuario(
    geracao_id: int,
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPecaRepository = Depends(get_geracao_repo),
    db: Session = Depends(get_db),
):
    """
    Obtém o rastreamento de ativação de módulos de uma geração do próprio usuário.

    Retorna informações sobre POR QUE cada módulo foi ativado ou não.
    """
    geracao = repo.find_by_id_and_user(geracao_id, current_user.id)
    if not geracao:
        raise HTTPException(status_code=404, detail="Geração não encontrada")

    # Tenta obter activation_trace salvo
    trace_data = None
    try:
        trace_data = geracao.activation_trace
    except Exception:
        pass

    if not trace_data:
        # Tenta extrair traces da curadoria_metadata (retrocompatibilidade)
        curadoria_meta = None
        try:
            curadoria_meta = geracao.curadoria_metadata
        except Exception:
            pass

        if curadoria_meta:
            decision_traces = curadoria_meta.get('decision_traces')
            variaveis_snapshot = curadoria_meta.get('variaveis_snapshot')

            if decision_traces:
                try:
                    from sistemas.gerador_pecas.services_activation_trace import build_activation_trace
                    modo = None
                    try:
                        modo = geracao.modo_ativacao_agente2
                    except Exception:
                        pass
                    trace_data = build_activation_trace(
                        decision_traces=decision_traces,
                        variaveis_snapshot=variaveis_snapshot or {},
                        modo_ativacao=modo or 'unknown',
                        db=db,
                    )
                except Exception:
                    pass

    if not trace_data:
        modo = None
        try:
            modo = geracao.modo_ativacao_agente2
        except Exception:
            pass
        return {
            "geracao_id": geracao_id,
            "modo_ativacao": modo,
            "summary": None,
            "variaveis_snapshot": None,
            "modulos": [],
        }

    modulos = trace_data.get("modulos", [])
    total_ativados = trace_data.get("total_ativados", 0)
    total_avaliados = trace_data.get("total_avaliados", 0)

    return {
        "geracao_id": geracao_id,
        "modo_ativacao": trace_data.get("modo_ativacao"),
        "summary": {
            "total_avaliados": total_avaliados,
            "total_ativados": total_ativados,
            "total_nao_ativados": total_avaliados - total_ativados,
            "total_det": trace_data.get("total_det", 0),
            "total_llm": trace_data.get("total_llm", 0),
        },
        "variaveis_snapshot": trace_data.get("variaveis_snapshot"),
        "modulos": modulos,
    }


# ============================================
# Endpoints de Versões (Histórico de Alterações)
# ============================================

@router.get("/historico/{geracao_id}/versoes")
async def listar_versoes(
    geracao_id: int,
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPecaRepository = Depends(get_geracao_repo),
):
    """
    Lista todas as versões de uma peça específica.
    Retorna lista ordenada da mais recente para a mais antiga.
    """
    try:
        geracao = repo.find_by_id_and_user(geracao_id, current_user.id)

        if not geracao:
            raise HTTPException(status_code=404, detail="Geração não encontrada")

        versoes = obter_versoes(repo.db, geracao_id)

        return {
            "geracao_id": geracao_id,
            "total_versoes": len(versoes),
            "versoes": versoes
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historico/{geracao_id}/versoes/comparar")
async def comparar_versoes_endpoint(
    geracao_id: int,
    v1: int = Query(..., description="ID da primeira versão"),
    v2: int = Query(..., description="ID da segunda versão"),
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPecaRepository = Depends(get_geracao_repo),
):
    """
    Compara duas versões específicas e retorna o diff entre elas.
    """
    try:
        geracao = repo.find_by_id_and_user(geracao_id, current_user.id)

        if not geracao:
            raise HTTPException(status_code=404, detail="Geração não encontrada")

        resultado = comparar_versoes(repo.db, v1, v2)

        if not resultado:
            raise HTTPException(status_code=404, detail="Uma ou ambas as versões não foram encontradas")

        return resultado
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historico/{geracao_id}/versoes/{versao_id}")
async def obter_versao(
    geracao_id: int,
    versao_id: int,
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPecaRepository = Depends(get_geracao_repo),
):
    """
    Obtém detalhes completos de uma versão específica, incluindo diff.
    """
    try:
        geracao = repo.find_by_id_and_user(geracao_id, current_user.id)

        if not geracao:
            raise HTTPException(status_code=404, detail="Geração não encontrada")

        versao = obter_versao_detalhada(repo.db, versao_id)

        if not versao or versao["geracao_id"] != geracao_id:
            raise HTTPException(status_code=404, detail="Versão não encontrada")

        return versao
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/historico/{geracao_id}/versoes/{versao_id}/restaurar")
async def restaurar_versao_endpoint(
    geracao_id: int,
    versao_id: int,
    current_user: User = Depends(get_current_active_user),
    repo: GeracaoPecaRepository = Depends(get_geracao_repo),
):
    """
    Restaura uma versão anterior, criando uma nova versão com o conteúdo antigo.
    A versão atual não é perdida - fica registrada no histórico.
    """
    try:
        geracao = repo.find_by_id_and_user(geracao_id, current_user.id)

        if not geracao:
            raise HTTPException(status_code=404, detail="Geração não encontrada")

        nova_versao, status = restaurar_versao(repo.db, geracao_id, versao_id)

        if status == "not_found":
            raise HTTPException(status_code=404, detail="Versão não encontrada")

        if status == "same_content":
            raise HTTPException(status_code=409, detail="Voce ja esta nesta versao. O conteudo atual e identico ao da versao selecionada.")

        return {
            "success": True,
            "message": f"Versão restaurada com sucesso",
            "nova_versao": {
                "id": nova_versao.id,
                "numero_versao": nova_versao.numero_versao
            },
            "conteudo": nova_versao.conteudo,
            "minuta_markdown": nova_versao.conteudo,
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Endpoints de Feedback
# ============================================

@router.post("/feedback")
async def enviar_feedback(
    req: FeedbackRequest,
    current_user: User = Depends(get_current_active_user),
    geracao_repo: GeracaoPecaRepository = Depends(get_geracao_repo),
    feedback_repo: FeedbackPecaRepository = Depends(get_feedback_repo),
):
    """Envia feedback sobre a peça gerada."""
    try:
        geracao = geracao_repo.get_by_id(req.geracao_id)

        if not geracao:
            raise HTTPException(status_code=404, detail="Geração não encontrada")

        # Upsert: atualiza se ja existe, cria se nao
        feedback_existente = feedback_repo.find_by_geracao(req.geracao_id)

        if feedback_existente:
            feedback_existente.nota = req.nota
            feedback_existente.avaliacao = req.avaliacao
            feedback_existente.comentario = req.comentario
            feedback_existente.campos_incorretos = req.campos_incorretos
            feedback_repo.commit()
        else:
            feedback = FeedbackPeca(
                geracao_id=req.geracao_id,
                usuario_id=current_user.id,
                nota=req.nota,
                avaliacao=req.avaliacao,
                comentario=req.comentario,
                campos_incorretos=req.campos_incorretos,
            )
            feedback_repo.add(feedback)
            feedback_repo.commit()

        return {"success": True, "message": "Feedback registrado com sucesso"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/feedback/{geracao_id}")
async def obter_feedback(
    geracao_id: int,
    current_user: User = Depends(get_current_active_user),
    repo: FeedbackPecaRepository = Depends(get_feedback_repo),
):
    """Obtém o feedback de uma geração específica."""
    try:
        feedback = repo.find_by_geracao(geracao_id)

        if not feedback:
            return {"has_feedback": False}

        return {
            "has_feedback": True,
            "avaliacao": feedback.avaliacao,
            "nota": feedback.nota,
            "comentario": feedback.comentario,
            "campos_incorretos": feedback.campos_incorretos,
            "criado_em": to_iso_utc(feedback.criado_em)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Endpoints de Autos do Processo (Visualização de PDFs)
# ============================================

def _agrupar_documentos_por_descricao(docs: List) -> List:
    """
    Agrupa documentos com mesma descrição juntados no mesmo minuto.
    Retorna lista de documentos agrupados (cada item pode ter múltiplos IDs).
    """
    grupos = defaultdict(list)
    
    for doc in docs:
        # Chave: descrição + data arredondada para o minuto
        descricao = doc.descricao or doc.categoria_nome or 'desconhecido'
        if doc.data_juntada:
            data_key = doc.data_juntada.strftime('%Y%m%d%H%M')
        else:
            data_key = 'sem_data'
        
        chave = (descricao, data_key)
        grupos[chave].append(doc)
    
    # Monta resultado agrupado
    resultado = []
    for (descricao, data_key), docs_grupo in grupos.items():
        # Ordena por ID para consistência
        docs_grupo.sort(key=lambda d: d.id)
        
        doc_principal = docs_grupo[0]
        ids_todos = [d.id for d in docs_grupo]
        
        resultado.append({
            "ids": ids_todos,  # Lista de IDs para merge
            "id": ids_todos[0],  # ID principal (retrocompatibilidade)
            "descricao": descricao,
            "tipo_documento": doc_principal.tipo_documento,
            "data_juntada": doc_principal.data_juntada,
            "data_formatada": doc_principal.data_formatada,
            "total_partes": len(ids_todos)
        })
    
    # Ordena por data cronológica
    resultado.sort(key=lambda d: d["data_juntada"] or datetime.min)
    
    return resultado


@router.get("/autos/{numero_cnj}")
async def listar_documentos_processo(
    numero_cnj: str,
    token: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user_from_token_or_query),
    repo: GeracaoPecaRepository = Depends(get_geracao_repo),
):
    """
    Lista todos os documentos de um processo para visualização.
    Retorna lista ordenada cronologicamente com descrição do XML.
    Documentos com mesma descrição e data (até 1 min) são agrupados.
    Se houver processamento anterior, usa descrição identificada pela IA.
    """
    from sistemas.gerador_pecas.agente_tjms import (
        consultar_processo_async,
        extrair_documentos_xml,
        documento_permitido
    )

    try:
        cnj_limpo = _limpar_cnj(numero_cnj)

        # Busca documentos processados salvos no banco (se existir)
        geracao = repo.find_latest_with_docs(cnj_limpo)
        
        # Mapa de ID -> descricao_ia do processamento anterior
        descricoes_ia_map = {}
        if geracao and geracao.documentos_processados:
            for doc_salvo in geracao.documentos_processados:
                if doc_salvo.get("descricao_ia"):
                    # Mapeia todos os IDs do documento agrupado
                    for doc_id in doc_salvo.get("ids", [doc_salvo.get("id")]):
                        descricoes_ia_map[doc_id] = doc_salvo["descricao_ia"]
        
        async with aiohttp.ClientSession() as session:
            xml_response = await consultar_processo_async(session, cnj_limpo)
            docs = extrair_documentos_xml(xml_response)
        
        # Filtra documentos permitidos
        docs_filtrados = [d for d in docs if documento_permitido(int(d.tipo_documento or 0))]
        
        # Agrupa documentos com mesma descrição/data
        docs_agrupados = _agrupar_documentos_por_descricao(docs_filtrados)
        
        # Retorna lista com informações para exibição
        resultado = []
        for i, doc in enumerate(docs_agrupados, 1):
            # Verifica se há descrição da IA para este documento
            descricao_exibir = doc["descricao"]
            doc_id_principal = doc["ids"][0] if doc["ids"] else doc["id"]
            if doc_id_principal in descricoes_ia_map:
                descricao_exibir = descricoes_ia_map[doc_id_principal]
            
            resultado.append({
                "id": doc["id"],
                "ids": doc["ids"],  # Lista de IDs para merge
                "ordem": i,
                "descricao": descricao_exibir,
                "descricao_original": doc["descricao"],  # Mantém original para referência
                "tipo_documento": doc["tipo_documento"],
                "data_juntada": doc["data_juntada"].isoformat() if doc["data_juntada"] else None,
                "data_formatada": doc["data_formatada"],
                "total_partes": doc["total_partes"]
            })
        
        return {
            "numero_cnj": numero_cnj,
            "total_documentos": len(resultado),
            "documentos": resultado,
            "tem_descricoes_ia": len(descricoes_ia_map) > 0
        }
        
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/autos/{numero_cnj}/documento/{doc_id}")
async def baixar_documento_processo(
    numero_cnj: str,
    doc_id: str,
    ids: Optional[str] = Query(None, description="Lista de IDs separados por vírgula para merge"),
    token: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user_from_token_or_query)
):
    """
    Baixa um ou mais documentos do processo do TJ-MS.
    Se ids contiver múltiplos IDs (separados por vírgula), faz merge dos PDFs.
    Retorna o PDF diretamente para visualização no navegador.
    """
    from sistemas.gerador_pecas.agente_tjms import baixar_documentos_async
    try:
        cnj_limpo = _limpar_cnj(numero_cnj)
        
        # Parse lista de IDs (se fornecida)
        if ids:
            lista_ids = [id.strip() for id in ids.split(',') if id.strip()]
        else:
            lista_ids = [doc_id]
        
        async with aiohttp.ClientSession() as session:
            xml_response = await baixar_documentos_async(session, cnj_limpo, lista_ids)
        
        # Extrai conteúdo base64 de todos os documentos
        root = ET.fromstring(xml_response)  # nosec B314 - XML vem de API SOAP interna (TJ-MS)
        pdfs_bytes = []
        
        for elem in root.iter():
            tag_no_ns = elem.tag.split('}')[-1].lower() if '}' in elem.tag else elem.tag.lower()
            if tag_no_ns == 'documento':
                doc_id_found = elem.attrib.get("idDocumento") or elem.attrib.get("id")
                if doc_id_found in lista_ids:
                    # Busca conteúdo base64
                    conteudo_base64 = elem.attrib.get("conteudo")
                    if not conteudo_base64:
                        for child in elem:
                            child_tag = child.tag.split('}')[-1].lower()
                            if child_tag == 'conteudo' and child.text:
                                conteudo_base64 = child.text.strip()
                                break
                    
                    if conteudo_base64:
                        pdfs_bytes.append((doc_id_found, base64.b64decode(conteudo_base64)))
        
        if not pdfs_bytes:
            raise HTTPException(status_code=404, detail="Documento não encontrado")
        
        # Se só tem um PDF, retorna direto
        if len(pdfs_bytes) == 1:
            pdf_bytes = pdfs_bytes[0][1]
        else:
            # Faz merge dos PDFs usando PyMuPDF
            # Ordena os PDFs pela ordem dos IDs na lista original
            id_order = {id: i for i, id in enumerate(lista_ids)}
            pdfs_bytes.sort(key=lambda x: id_order.get(x[0], 999))
            
            # Merge
            merged_pdf = fitz.open()
            for doc_id_item, pdf_data in pdfs_bytes:
                try:
                    pdf_doc = fitz.open(stream=pdf_data, filetype="pdf")
                    merged_pdf.insert_pdf(pdf_doc)
                    pdf_doc.close()
                except Exception as e:
                    print(f"Erro ao processar PDF {doc_id_item}: {e}")
                    continue
            
            pdf_bytes = merged_pdf.tobytes()
            merged_pdf.close()
        
        # Retorna como PDF para visualização inline
        return StreamingResponse(
            iter([pdf_bytes]),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f"inline; filename=doc_{doc_id}.pdf",
                "Cache-Control": "private, max-age=3600"  # Cache de 1h
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# Endpoints do Modo Semi-Automatico (Curadoria)
# ============================================

@router.post("/curadoria/preview")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def curation_preview(
    request: Request,
    req: CurationPreviewRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Executa Agentes 1 e 2 e retorna resultado para curadoria.

    Este endpoint permite o modo semi-automatico:
    1. Executa Agente 1 (coleta documentos do TJ-MS)
    2. Executa Agente 2 (detecta modulos relevantes)
    3. Retorna modulos organizados por secao para curadoria manual
    4. NAO executa Agente 3 (usuario fara curadoria antes)

    O usuario pode entao:
    - Revisar os modulos detectados
    - Adicionar/remover modulos
    - Reorganizar modulos entre secoes
    - Buscar argumentos adicionais
    - Gerar a peca com o endpoint /curadoria/gerar
    """
    # SECURITY: Verifica cota de IA
    await check_ai_quota(current_user)

    from sistemas.gerador_pecas.services import GeradorPecasService
    from sistemas.gerador_pecas.services_curadoria import ServicoCuradoria
    from sistemas.gerador_pecas.orquestrador_agentes import consolidar_dados_extracao

    try:
        grupo, subcategoria_ids = _resolver_grupo_e_subcategorias(
            current_user, db, req.group_id, req.subcategoria_ids
        )

        cnj_limpo = _limpar_cnj(req.numero_cnj)
        parecer_upload_metadata: Optional[Dict[str, Any]] = None
        parecer_upload_texto: str = ""
        parecer_upload_extracao: Dict[str, Any] = {
            "success": False,
            "dados_extracao": {},
            "error": None,
        }
        if req.parecer_upload_id:
            parecer_upload_metadata = _carregar_upload_parecer_natjus(
                upload_id=req.parecer_upload_id,
                numero_cnj=cnj_limpo,
                user_id=current_user.id,
            )
            parecer_upload_texto = _extrair_texto_pdf(
                parecer_upload_metadata.get("content_bytes", b"")
            )

        # Busca modelo configurado
        modelo = config_cache.get_config(
            "gerador_pecas", "modelo_geracao", db,
            default="google/gemini-2.5-pro-preview-05-06"
        )

        # Inicializa servico
        service = GeradorPecasService(
            modelo=modelo,
            db=db,
            group_id=grupo.id,
            subcategoria_ids=subcategoria_ids
        )

        if not service.orquestrador:
            raise HTTPException(status_code=500, detail="Orquestrador nao disponivel")

        orq = service.orquestrador

        # Configura filtro de categorias para o tipo de peca
        try:
            from sistemas.gerador_pecas.filtro_categorias import FiltroCategoriasDocumento
            filtro = FiltroCategoriasDocumento(db)
            if filtro.tem_configuracao():
                codigos = filtro.get_codigos_permitidos(req.tipo_peca)
                codigos_primeiro = filtro.get_codigos_primeiro_documento(req.tipo_peca)
                if codigos:
                    orq.agente1.atualizar_codigos_permitidos(codigos, codigos_primeiro)
        except Exception as e:
            print(f"[CURADORIA] Aviso: filtro de categorias: {e}")

        # === EARLY PARECER CHECK (pré-Agent 1, curadoria) ===
        parecer_config_early = load_parecer_natjus_config(db, use_cache=False)
        if (
            piece_requires_parecer(req.tipo_peca, parecer_config_early)
            and req.parecer_user_choice_when_missing != "continue_without"
            and not req.parecer_upload_id
        ):
            try:
                docs_metadata = await orq.agente1.consultar_codigos_documentos(cnj_limpo)
                parecer_status_early = evaluate_parecer_status(
                    tipo_peca=req.tipo_peca,
                    documentos=docs_metadata,
                    config=parecer_config_early,
                    has_user_upload=False,
                )
                if parecer_status_early.get("parecer_required") and not parecer_status_early.get("parecer_found"):
                    logger.warning(
                        "[PARECER-NATJUS] Early check curadoria: parecer ausente (pre-Agent 1): cnj=%s tipo_peca=%s",
                        cnj_limpo, req.tipo_peca,
                    )
                    raise HTTPException(
                        status_code=409,
                        detail={
                            "error_code": "PARECER_NATJUS_MISSING",
                            "title": "Parecer NATJus não encontrado",
                            "message": "Não foi encontrado parecer NATJus no processo. Ele é essencial para a geração adequada desta peça.",
                            "instruction": "Anexe o parecer em PDF para prosseguir.",
                            "modo_atual": "semi_automatico",
                            "tipo_peca": req.tipo_peca,
                            "parecer_document_codes": parecer_status_early.get("parecer_document_codes", []),
                        },
                    )
            except HTTPException:
                raise
            except Exception as e:
                logger.warning("[PARECER-NATJUS] Early check curadoria falhou, continuando: %s", e)

        # ====== AGENTE 1: Coletor TJ-MS ======
        print(f"\n[CURADORIA] Iniciando Agente 1 para CNJ {cnj_limpo}...")
        resultado_agente1 = await orq.agente1.coletar_e_resumir(cnj_limpo)

        if resultado_agente1.erro:
            raise HTTPException(status_code=400, detail=resultado_agente1.erro)

        print(f"[CURADORIA] Agente 1 concluido: {resultado_agente1.documentos_analisados} docs")

        parecer_config = load_parecer_natjus_config(db, use_cache=False)
        if parecer_upload_metadata:
            parecer_upload_extracao = await _extrair_json_upload_parecer_natjus(
                db=db,
                texto_parecer=parecer_upload_texto,
                parecer_document_codes=list(parecer_config.document_codes),
                upload_metadata=parecer_upload_metadata,
            )
            if parecer_upload_extracao.get("success"):
                print("[CURADORIA] Parecer upload processado com JSON tecnico.")
            else:
                logger.warning(
                    "[PARECER-NATJUS] Curadoria sem JSON estruturado no upload. upload_id=%s erro=%s",
                    parecer_upload_metadata.get("upload_id"),
                    parecer_upload_extracao.get("error"),
                )
            resultado_agente1.resumo_consolidado = _anexar_upload_parecer_ao_resumo(
                resultado_agente1.resumo_consolidado,
                parecer_upload_metadata,
                parecer_upload_texto,
                json_normalizado=parecer_upload_extracao.get("json_normalizado"),
            )

        documentos_agente1 = []
        if resultado_agente1.dados_brutos and resultado_agente1.dados_brutos.documentos:
            documentos_agente1 = resultado_agente1.dados_brutos.documentos

        parecer_status = evaluate_parecer_status(
            tipo_peca=req.tipo_peca,
            documentos=documentos_agente1,
            config=parecer_config,
            has_user_upload=bool(parecer_upload_metadata),
        )

        if parecer_status.get("config_error"):
            logger.error(
                "[PARECER-NATJUS] Erro de configuracao no preview de curadoria: cnj=%s tipo_peca=%s detail=%s",
                cnj_limpo,
                req.tipo_peca,
                parecer_status.get("config_error_message"),
            )
            raise HTTPException(
                status_code=400,
                detail=parecer_status.get("config_error_message"),
            )

        if (
            parecer_status.get("parecer_required")
            and not parecer_status.get("parecer_found")
            and req.parecer_user_choice_when_missing != "continue_without"
        ):
            raise HTTPException(
                status_code=409,
                detail={
                    "error_code": "PARECER_NATJUS_MISSING",
                    "title": "Parecer NATJus não encontrado",
                    "message": "Não foi encontrado parecer NATJus no processo. Ele é essencial para a geração adequada desta peça.",
                    "instruction": "Anexe o parecer em PDF para prosseguir.",
                    "modo_atual": "semi_automatico",
                    "tipo_peca": req.tipo_peca,
                    "parecer_document_codes": parecer_status.get("parecer_document_codes", []),
                },
            )

        parecer_context = build_parecer_audit_payload(
            parecer_status,
            user_choice_when_missing=req.parecer_user_choice_when_missing,
            mode_forced_to_semi_auto=bool(req.parecer_forced_to_semi_auto),
        )

        # Consolida dados extraidos
        dados_extracao = consolidar_dados_extracao(resultado_agente1)
        dados_extracao["_parecer_natjus"] = parecer_context
        if parecer_upload_extracao.get("dados_extracao"):
            _mesclar_dados_extracao(
                dados_extracao,
                parecer_upload_extracao.get("dados_extracao", {}),
            )
        if parecer_upload_metadata:
            extraction_mode = (
                "json_modelo_categoria"
                if parecer_upload_extracao.get("success")
                else "texto_bruto_pdf"
            )
            dados_extracao["parecer_natjus_upload"] = {
                "upload_id": parecer_upload_metadata.get("upload_id"),
                "filename": parecer_upload_metadata.get("filename"),
                "source": "user_upload",
                "extraction_mode": extraction_mode,
                "categoria_resumo_json_id": parecer_upload_extracao.get("categoria_id"),
                "categoria_resumo_json_nome": parecer_upload_extracao.get("categoria_nome"),
                "categoria_resumo_json_namespace": parecer_upload_extracao.get("categoria_namespace"),
                "json_extraction_error": parecer_upload_extracao.get("error"),
            }

        # VALIDADOR DESATIVADO - usar extração bruta da IA
        # Ref: investigação processo 08053502820258120008
        # from sistemas.gerador_pecas.services_extraction_validator import validar_extracao
        # texto_pedidos = dados_extracao.get('peticao_inicial_pedidos', '')
        # dados_extracao = validar_extracao(
        #     dados_extracao,
        #     texto_pedidos,
        #     texto_completo=resultado_agente1.resumo_consolidado
        # )

        # ====== AGENTE 2: Detector de Modulos ======
        print(f"[CURADORIA] Iniciando Agente 2...")
        resultado_agente2 = await orq._executar_agente2(
            resultado_agente1.resumo_consolidado,
            req.tipo_peca,
            dados_processo=resultado_agente1.dados_brutos,
            dados_extracao=dados_extracao,
            numero_processo=cnj_limpo
        )

        if resultado_agente2.erro:
            raise HTTPException(status_code=400, detail=resultado_agente2.erro)

        print(f"[CURADORIA] Agente 2 concluido: {len(resultado_agente2.modulos_ids)} modulos")
        print(f"[CURADORIA] Modo: {resultado_agente2.modo_ativacao}")
        print(f"[CURADORIA] DET: {resultado_agente2.modulos_ativados_det}, LLM: {resultado_agente2.modulos_ativados_llm}")

        # ====== MONTA RESULTADO PARA CURADORIA ======
        servico_curadoria = ServicoCuradoria(db)
        resultado_curadoria = servico_curadoria.criar_resultado_curadoria(
            numero_processo=cnj_limpo,
            tipo_peca=req.tipo_peca,
            modulos_ids=resultado_agente2.modulos_ids,
            ids_det=resultado_agente2.ids_det,
            ids_llm=resultado_agente2.ids_llm,
            resumo_consolidado=resultado_agente1.resumo_consolidado,
            dados_processo=resultado_agente1.dados_brutos.dados_processo.to_json() if resultado_agente1.dados_brutos and resultado_agente1.dados_brutos.dados_processo else None,
            dados_extracao=dados_extracao,
            group_id=grupo.id
        )

        # Serializa decision_traces com chaves string (JSON não suporta int keys)
        traces_serialized = {
            str(k): v for k, v in resultado_agente2.decision_traces.items()
        } if resultado_agente2.decision_traces else {}

        return {
            "success": True,
            "modo_ativacao": resultado_agente2.modo_ativacao,
            "curadoria": resultado_curadoria.to_dict(),
            "decision_traces": traces_serialized,
            "variaveis_snapshot": resultado_agente2.variaveis_snapshot,
            "parecer_context": parecer_context,
        }

    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/curadoria/buscar")
async def curation_search(
    req: CurationSearchRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Busca argumentos adicionais para a curadoria.

    Permite buscar argumentos que nao foram detectados automaticamente,
    usando busca por palavras-chave, semantica (vetorial) ou hibrida.

    Os argumentos encontrados podem ser adicionados a curadoria
    e serao marcados como (VALIDADO) no prompt final.
    """
    from sistemas.gerador_pecas.services_curadoria import ServicoCuradoria

    try:
        print(f"\n[CURADORIA-BUSCA] Query: '{req.query}'")
        print(f"[CURADORIA-BUSCA] Metodo: {req.metodo}")
        print(f"[CURADORIA-BUSCA] Excluir: {req.modulos_excluir}")

        servico_curadoria = ServicoCuradoria(db)
        resultados = await servico_curadoria.buscar_argumentos_adicionais(
            query=req.query,
            tipo_peca=req.tipo_peca,
            modulos_excluir=req.modulos_excluir,
            limit=req.limit,
            metodo=req.metodo
        )

        print(f"[CURADORIA-BUSCA] Encontrados: {len(resultados)} argumentos")

        return {
            "success": True,
            "query": req.query,
            "metodo": req.metodo,
            "total": len(resultados),
            "argumentos": [r.to_dict() for r in resultados]
        }

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/curadoria/gerar-stream")
@limiter.limit(LIMITS["ai"], key_func=get_user_identifier)
async def curation_generate_stream(
    request: Request,
    req: CurationGenerateRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Gera a peca juridica com os modulos curados pelo usuario (streaming).

    Este endpoint:
    1. Recebe os IDs dos modulos selecionados pelo usuario
    2. Monta o prompt de conteudo com os modulos curados
    3. Executa apenas o Agente 3 (gerador) com streaming
    4. Modulos adicionados manualmente sao marcados como (VALIDADO)

    O Agente 3 permanece INALTERADO - apenas recebe o prompt curado.
    """
    # SECURITY: Verifica cota de IA
    await check_ai_quota(current_user)

    from sistemas.gerador_pecas.services import GeradorPecasService
    from sistemas.gerador_pecas.services_curadoria import ServicoCuradoria, OrigemAtivacao

    grupo, subcategoria_ids = _resolver_grupo_e_subcategorias(
        current_user, db, req.group_id, req.subcategoria_ids
    )

    tracker = create_tracker(
        request_id=str(uuid.uuid4())[:8],
        sistema="gerador_pecas",
        route="/curadoria/gerar-stream"
    )

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            cnj_limpo = _limpar_cnj(req.numero_cnj)
            tracker.set_metadata("numero_cnj", cnj_limpo)
            tracker.set_metadata("modo", "semi_automatico")

            yield stream_helper.format_inicio(mensagem="Iniciando geracao com modulos curados...")

            # Busca modelo configurado
            modelo = config_cache.get_config(
                "gerador_pecas", "modelo_geracao", db,
                default="google/gemini-2.5-pro-preview-05-06"
            )
            tracker.set_metadata("modelo", modelo)

            # Se nao tem resumo_consolidado, precisa executar Agente 1
            resumo_consolidado = req.resumo_consolidado
            dados_extracao = req.dados_extracao or {}
            parecer_context = req.parecer_context or dados_extracao.get("_parecer_natjus")
            if not isinstance(parecer_context, dict):
                parecer_context = build_parecer_audit_payload(
                    {"parecer_required": False, "parecer_found": False, "parecer_source": "none"}
                )
            dados_extracao["_parecer_natjus"] = parecer_context
            tracker.set_metadata("parecer_required", parecer_context.get("parecer_required"))
            tracker.set_metadata("parecer_found", parecer_context.get("parecer_found"))
            tracker.set_metadata("parecer_source", parecer_context.get("parecer_source"))

            if not resumo_consolidado:
                yield stream_helper.format_agente(1, "ativo", "Coletando documentos...")

                service = GeradorPecasService(
                    modelo=modelo,
                    db=db,
                    group_id=grupo.id,
                    subcategoria_ids=subcategoria_ids
                )

                if not service.orquestrador:
                    yield stream_helper.format_erro('Orquestrador nao disponivel')
                    return

                orq = service.orquestrador

                # Configura filtro
                try:
                    from sistemas.gerador_pecas.filtro_categorias import FiltroCategoriasDocumento
                    filtro = FiltroCategoriasDocumento(db)
                    if filtro.tem_configuracao():
                        codigos = filtro.get_codigos_permitidos(req.tipo_peca)
                        codigos_primeiro = filtro.get_codigos_primeiro_documento(req.tipo_peca)
                        if codigos:
                            orq.agente1.atualizar_codigos_permitidos(codigos, codigos_primeiro)
                except Exception:
                    pass

                resultado_agente1 = await orq.agente1.coletar_e_resumir(cnj_limpo)

                if resultado_agente1.erro:
                    yield stream_helper.format_erro(resultado_agente1.erro)
                    return

                resumo_consolidado = resultado_agente1.resumo_consolidado
                dados_extracao = consolidar_dados_extracao(resultado_agente1)
                if "_parecer_natjus" not in dados_extracao:
                    dados_extracao["_parecer_natjus"] = parecer_context

                yield stream_helper.format_agente(1, "concluido", f'{resultado_agente1.documentos_analisados} docs')

            # ====== MONTA PROMPT CURADO ======
            yield stream_helper.format_info(f'Montando prompt com {len(req.modulos_ids_curados)} modulos curados...')

            # Carrega prompts base e de peca via loader centralizado
            from sistemas.gerador_pecas.services_prompt_loader import carregar_prompt_sistema, carregar_prompt_peca

            prompt_sistema = carregar_prompt_sistema(db, grupo.id)
            prompt_peca = carregar_prompt_peca(db, req.tipo_peca, grupo.id)

            # Carrega modulos de conteudo selecionados
            prompt_modulo_repo = PromptModuloReadRepository(db)
            modulos_conteudo = prompt_modulo_repo.list_active_conteudo_by_ids(
                req.modulos_ids_curados,
                group_id=grupo.id if grupo.id else None,
            )

            # Monta prompt de conteudo curado com tag HUMAN_VALIDATED obrigatória
            # MODO SEMI-AUTOMÁTICO: Todos os argumentos selecionados recebem tag [HUMAN_VALIDATED]
            # A IA DEVE utilizar integralmente estes argumentos na peça final, sem juízo de valor
            partes_conteudo = ["## ARGUMENTOS E TESES APLICAVEIS (HUMAN_VALIDATED)\n"]
            partes_conteudo.append("> **INSTRUÇÃO OBRIGATÓRIA**: Os argumentos marcados com [HUMAN_VALIDATED] foram\n")
            partes_conteudo.append("> validados pelo usuário e DEVEM ser incluídos integralmente na peça final.\n")
            partes_conteudo.append("> Não aplique juízo de valor ou modifique o conteúdo - apenas sanitização técnica se necessária.\n")

            # Agrupa por categoria respeitando ordem personalizada
            modulos_por_cat = {}
            for m in modulos_conteudo:
                cat = m.categoria or "Outros"
                if cat not in modulos_por_cat:
                    modulos_por_cat[cat] = []
                modulos_por_cat[cat].append(m)

            # Aplica ordem personalizada se fornecida
            if req.modulos_ordem:
                for cat, ids_ordenados in req.modulos_ordem.items():
                    if cat in modulos_por_cat:
                        modulos_cat = {m.id: m for m in modulos_por_cat[cat]}
                        modulos_ordenados = []
                        for mid in ids_ordenados:
                            if mid in modulos_cat:
                                modulos_ordenados.append(modulos_cat[mid])
                        # Adiciona os que nao estavam na ordem
                        for m in modulos_por_cat[cat]:
                            if m not in modulos_ordenados:
                                modulos_ordenados.append(m)
                        modulos_por_cat[cat] = modulos_ordenados

            # Ordena categorias - usa ordem do frontend se fornecida, senão usa padrão
            from sistemas.gerador_pecas.orquestrador_agentes import ORDEM_CATEGORIAS_PADRAO
            if req.categorias_ordem:
                # Usa ordem definida pelo usuário no frontend
                cats_ordenadas = []
                for cat in req.categorias_ordem:
                    if cat in modulos_por_cat:
                        cats_ordenadas.append(cat)
                # Adiciona categorias que existem mas não estavam na ordem
                for cat in modulos_por_cat.keys():
                    if cat not in cats_ordenadas:
                        cats_ordenadas.append(cat)
                print(f"[CURADORIA] Usando ordem de categorias do frontend: {cats_ordenadas}")
            else:
                # Fallback para ordem padrão
                cats_ordenadas = sorted(
                    modulos_por_cat.keys(),
                    key=lambda c: ORDEM_CATEGORIAS_PADRAO.get(c, 99)
                )
                print(f"[CURADORIA] Usando ordem de categorias padrão: {cats_ordenadas}")

            # IDs dos módulos adicionados manualmente
            modulos_manuais_set = set(req.modulos_manuais_ids or [])
            total_manuais = 0

            for cat in cats_ordenadas:
                modulos_cat = modulos_por_cat[cat]
                if not modulos_cat:
                    continue

                partes_conteudo.append(f"\n### === {cat.upper()} ===\n")

                for modulo in modulos_cat:
                    subcat = f" ({modulo.subcategoria})" if modulo.subcategoria else ""
                    # HUMAN_VALIDATED: Tag obrigatória para modo semi-automático
                    # Indica que o usuário validou este argumento - IA DEVE incluí-lo integralmente
                    is_manual = modulo.id in modulos_manuais_set
                    if is_manual:
                        total_manuais += 1
                        print(f"[CURADORIA] Modulo HUMAN_VALIDATED (manual): [{cat}] {modulo.titulo} (ID: {modulo.id})")
                        # Módulo adicionado manualmente pelo usuário
                        partes_conteudo.append(f"#### {modulo.titulo}{subcat} [HUMAN_VALIDATED:MANUAL]\n")
                    else:
                        # Módulo vindo do preview, confirmado pelo usuário
                        print(f"[CURADORIA] Modulo HUMAN_VALIDATED (preview): [{cat}] {modulo.titulo} (ID: {modulo.id})")
                        partes_conteudo.append(f"#### {modulo.titulo}{subcat} [HUMAN_VALIDATED]\n")
                    partes_conteudo.append(f"{modulo.conteudo}\n")

            print(f"[CURADORIA] Total de modulos: {len(req.modulos_ids_curados)}, manuais: {total_manuais}")

            prompt_conteudo = "\n".join(partes_conteudo)

            # ====== AGENTE 3: GERACAO (STREAMING) ======
            yield stream_helper.format_agente(3, "ativo", "Gerando peca juridica...")

            if req.observacao_usuario:
                yield stream_helper.format_info('Observacoes do usuario serao consideradas')

            # Inicializa servico para usar _executar_agente3_stream
            service = GeradorPecasService(
                modelo=modelo,
                db=db,
                group_id=grupo.id,
                subcategoria_ids=subcategoria_ids
            )

            if not service.orquestrador:
                yield stream_helper.format_erro('Orquestrador nao disponivel')
                return

            orq = service.orquestrador

            # Streaming do Agente 3
            tracker.mark("llm_call_start")
            resultado_agente3 = None
            first_chunk = False

            async for event in orq._executar_agente3_stream(
                resumo_consolidado=resumo_consolidado,
                prompt_sistema=prompt_sistema,
                prompt_peca=prompt_peca,
                prompt_conteudo=prompt_conteudo,
                tipo_peca=req.tipo_peca,
                observacao_usuario=req.observacao_usuario
            ):
                if event["tipo"] == "chunk":
                    if not first_chunk:
                        tracker.mark("first_token")
                        first_chunk = True
                    tracker.record_chunk(event['content'])
                    yield stream_helper.format_geracao_chunk(event['content'])
                elif event["tipo"] == "done":
                    tracker.mark("last_token")
                    resultado_agente3 = event["resultado"]
                elif event["tipo"] == "error":
                    tracker.mark("last_token")
                    resultado_agente3 = event["resultado"]
                    yield stream_helper.format_erro(event['error'])
                    return

            if resultado_agente3 and resultado_agente3.erro:
                yield stream_helper.format_erro(resultado_agente3.erro)
                return

            # BUGFIX: Verifica se conteúdo foi gerado (pode estar vazio se streaming falhou silenciosamente)
            if not resultado_agente3 or not resultado_agente3.conteudo_markdown or not resultado_agente3.conteudo_markdown.strip():
                erro_msg = "A geração não retornou conteúdo. Possível timeout ou erro na API de IA. Tente novamente."
                print(f"[AGENTE3-CURADO] ERRO: Conteúdo vazio após streaming!")
                print(f"[AGENTE3-CURADO]    - resultado_agente3 exists: {resultado_agente3 is not None}")
                if resultado_agente3:
                    print(f"[AGENTE3-CURADO]    - conteudo_markdown length: {len(resultado_agente3.conteudo_markdown) if resultado_agente3.conteudo_markdown else 'None'}")
                evt_agente, evt_erro = stream_helper.format_agente_erro(3, erro_msg)
                yield evt_agente
                yield evt_erro
                return

            yield stream_helper.format_agente(3, "concluido", "Peca gerada!")

            # ====== SALVA NO BANCO ======
            tracker.mark("db_save_start")

            geracao = GeracaoPeca(
                numero_cnj=cnj_limpo,
                numero_cnj_formatado=cnj_limpo,
                tipo_peca=req.tipo_peca,
                dados_processo=dados_extracao,
                conteudo_gerado=resultado_agente3.conteudo_markdown,
                prompt_enviado=resultado_agente3.prompt_enviado,
                resumo_consolidado=resumo_consolidado,
                modelo_usado=modelo,
                usuario_id=current_user.id
            )

            try:
                geracao.modo_ativacao_agente2 = "semi_automatico"
                geracao.modulos_ativados_det = len(req.modulos_ids_curados) - total_manuais
                geracao.modulos_ativados_llm = total_manuais  # Usa LLM para armazenar manuais no modo semi-auto

                # Salva metadados completos de curadoria para auditoria
                # Monta lista de módulos com origem detalhada para cada um
                modulos_detalhados = []
                preview_set = set(req.modulos_preview_ids or [])
                manuais_set = set(req.modulos_manuais_ids or [])
                for mid in req.modulos_ids_curados:
                    modulo_info = {"id": mid}
                    if mid in manuais_set:
                        modulo_info["origem"] = "manual"  # Adicionado manualmente pelo usuário
                        modulo_info["status"] = "[VALIDADO-MANUAL]"
                    elif mid in preview_set:
                        modulo_info["origem"] = "preview"  # Veio do preview (Agente 2)
                        modulo_info["status"] = "[VALIDADO]"
                    else:
                        modulo_info["origem"] = "desconhecido"
                        modulo_info["status"] = "[VALIDADO]"
                    modulos_detalhados.append(modulo_info)

                geracao.curadoria_metadata = {
                    "modulos_preview_ids": req.modulos_preview_ids or [],
                    "modulos_curados_ids": req.modulos_ids_curados,
                    "modulos_manuais_ids": req.modulos_manuais_ids or [],
                    "modulos_excluidos_ids": req.modulos_excluidos_ids or [],
                    "modulos_detalhados": modulos_detalhados,  # Lista com origem e status de cada módulo
                    "categorias_ordem": req.categorias_ordem or [],
                    "preview_timestamp": req.preview_timestamp,
                    "total_preview": len(req.modulos_preview_ids or []),
                    "total_curados": len(req.modulos_ids_curados),
                    "total_manuais": total_manuais,
                    "total_excluidos": len(req.modulos_excluidos_ids or []),
                    "decision_traces": req.decision_traces or {},
                    "variaveis_snapshot": req.variaveis_snapshot or {},
                    "parecer_context": parecer_context,
                }
                # Salva activation trace para auditoria de ativação de módulos
                try:
                    from sistemas.gerador_pecas.services_activation_trace import (
                        build_activation_trace_for_curadoria, save_activation_trace
                    )
                    trace_data = build_activation_trace_for_curadoria(
                        decision_traces=req.decision_traces or {},
                        variaveis_snapshot=req.variaveis_snapshot or {},
                        modulos_curados_ids=req.modulos_ids_curados,
                        modulos_preview_ids=req.modulos_preview_ids or [],
                        modulos_manuais_ids=req.modulos_manuais_ids or [],
                        db=db,
                    )
                    save_activation_trace(geracao, trace_data)
                except Exception as e_trace:
                    print(f"[CURADORIA] Aviso: falha ao construir activation trace: {e_trace}")

                print(f"[CURADORIA] Metadados salvos: preview={len(req.modulos_preview_ids or [])}, curados={len(req.modulos_ids_curados)}, manuais={total_manuais}, excluidos={len(req.modulos_excluidos_ids or [])}")
            except AttributeError as e:
                print(f"[CURADORIA] Aviso: campo nao disponivel no modelo: {e}")

            try:
                db.add(geracao)
                db.flush()

                versao = VersaoPeca(
                    geracao_id=geracao.id,
                    numero_versao=1,
                    conteudo=resultado_agente3.conteudo_markdown,
                    origem='geracao_curada',
                    descricao_alteracao='Versao inicial gerada com modulos curados pelo usuario',
                    diff_anterior=None
                )
                db.add(versao)
                db.commit()
                db.refresh(geracao)
            except Exception as e:
                # Se erro for por colunas inexistentes, tenta salvar sem os campos de curadoria
                if 'modo_ativacao_agente2' in str(e) or 'modulos_ativados' in str(e) or 'curadoria_metadata' in str(e) or 'activation_trace' in str(e):
                    db.rollback()
                    print(f"[CURADORIA] Colunas de curadoria nao existem no banco, salvando sem metadados: {e}")
                    # Remove atributos que causam erro
                    from sqlalchemy import inspect
                    state = inspect(geracao)
                    for attr in ['modo_ativacao_agente2', 'modulos_ativados_det', 'modulos_ativados_llm', 'curadoria_metadata', 'activation_trace']:
                        if attr in state.dict:
                            del state.dict[attr]
                    db.add(geracao)
                    db.flush()
                    versao = VersaoPeca(
                        geracao_id=geracao.id,
                        numero_versao=1,
                        conteudo=resultado_agente3.conteudo_markdown,
                        origem='geracao_curada',
                        descricao_alteracao='Versao inicial gerada com modulos curados pelo usuario',
                        diff_anterior=None
                    )
                    db.add(versao)
                    db.commit()
                    db.refresh(geracao)
                else:
                    db.rollback()
                    print(f"[CURADORIA] Erro ao salvar: {e}")
                    raise

            tracker.mark("db_save_done")
            tracker.mark("response_sent")
            tracker.set_metadata("tipo_peca", req.tipo_peca)
            tracker.log_summary()

            perf_report = tracker.get_report()

            try:
                log_request_perf(
                    report=perf_report,
                    db=db,
                    user_id=current_user.id,
                    username=current_user.username,
                    success=True
                )
            except Exception:
                pass

            yield stream_helper.format_sucesso(
                geracao_id=geracao.id,
                tipo_peca=req.tipo_peca,
                minuta_markdown=resultado_agente3.conteudo_markdown,
                performance={
                    'ttft_ms': perf_report['metrics'].get('ttft_ms'),
                    'total_ms': perf_report['total_ms'],
                },
                modo='semi_automatico',
                modulos_curados=len(req.modulos_ids_curados),
            )

        except Exception as e:
            traceback.print_exc()
            yield stream_helper.format_erro(str(e))

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
