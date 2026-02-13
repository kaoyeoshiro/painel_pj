# scripts/batch_detran_extrair.py
"""
Runner em lote para extrair Petição Inicial + Contestação dos processos DETRAN.

Usa o sistema extrator_autos com classificação BERT integrada (model_run_6).
Para cada processo:
  1. Consulta TJ-MS e obtém lista de documentos
  2. Resolve PI (PrimeiroDocumentoResolver, cat ID=1) e Contestação (BERT, cat ID=13)
  3. Baixa documentos selecionados
  4. Aplica BERT pós-download para confirmar contestações
  5. Se ambos encontrados, faz merge PI+Contestação e salva PDF

Uso:
  # Smoke test (3 primeiros CNJs)
  python scripts/batch_detran_extrair.py --smoke-test

  # Executar lote completo
  python scripts/batch_detran_extrair.py

  # Retomar do checkpoint
  python scripts/batch_detran_extrair.py --resume

  # Especificar range de CNJs
  python scripts/batch_detran_extrair.py --start 50 --limit 100
"""

import argparse
import asyncio
import csv
import json
import logging
import os
import sys
import time
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# =========================================================================
# Setup do projeto
# =========================================================================

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
os.chdir(PROJECT_ROOT)

from dotenv import load_dotenv
load_dotenv()

import pandas as pd
from sqlalchemy.orm import Session

from database.connection import SessionLocal
from services.tjms.client import TJMSClient, TJMSError
from services.tjms.models import (
    ConsultaOptions,
    DocumentoMetadata,
    DocumentoTJMS,
    DownloadOptions,
    TipoConsulta,
)
from sistemas.extrator_autos.services_bert_client import BertClassifierClient
from sistemas.extrator_autos.services_category_resolver import (
    DocumentoCandidate,
    ResolutionResult,
    _normalizar_label,
    resolve_all_categories,
)
from sistemas.extrator_autos.services_download import (
    mesclar_pdfs,
    ordenar_documentos,
    pdf_to_text,
)
from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento

# =========================================================================
# Constantes
# =========================================================================

PLANILHA_PATH = Path(
    r"E:\Projetos\Datasets\DETRAN\Ações 2025\acoes_2025_amostra_1000.xlsx"
)
OUTPUT_DIR = Path(r"E:\Projetos\Datasets\DETRAN\Ações 2025")
CHECKPOINT_PATH = OUTPUT_DIR / "batch_checkpoint.json"
STATUS_PATH = OUTPUT_DIR / "batch_status.csv"
LOG_PATH = OUTPUT_DIR / "batch_detran.log"

CATEGORIA_PI_ID = 1
CATEGORIA_CONTESTACAO_ID = 13

# Retry
MAX_RETRIES = 3
RETRY_BASE_DELAY = 5.0  # segundos

# Pausa entre processos (respeita TJ-MS)
PAUSA_ENTRE_PROCESSOS = 2.0

# =========================================================================
# Logging
# =========================================================================

logger = logging.getLogger("batch_detran")


def setup_logging(verbose: bool = False) -> None:
    """Configura logging para console + arquivo."""
    level = logging.DEBUG if verbose else logging.INFO
    fmt = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)

    logging.basicConfig(
        level=level,
        format=fmt,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(LOG_PATH, encoding="utf-8"),
        ],
    )
    # Reduz verbosidade de libs externas
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)


# =========================================================================
# Dataclasses de resultado
# =========================================================================

@dataclass
class ProcessoResult:
    """Resultado do processamento de um CNJ."""

    cnj: str
    status: str = "pendente"
    peticao_doc_id: Optional[str] = None
    contestacao_doc_id: Optional[str] = None
    contestacao_metodo: Optional[str] = None  # "codigo_direto" | "bert"
    contestacao_confidence: Optional[float] = None
    output_path: Optional[str] = None
    erro: Optional[str] = None
    detalhes: Optional[str] = None
    tempo_s: float = 0.0


# =========================================================================
# Leitura de planilha
# =========================================================================

def ler_cnjs_planilha(path: Path) -> List[str]:
    """Lê CNJs da planilha e retorna lista deduplicada."""
    df = pd.read_excel(path)
    coluna_cnj = df.columns[0]  # "Nº Processo"
    cnjs = (
        df[coluna_cnj]
        .dropna()
        .astype(str)
        .str.strip()
        .unique()
        .tolist()
    )
    logger.info("Planilha lida: %d CNJs unicos de %d linhas", len(cnjs), len(df))
    return cnjs


# =========================================================================
# Checkpoint (retomada)
# =========================================================================

def salvar_checkpoint(processados: Set[str]) -> None:
    """Salva set de CNJs já processados para retomada."""
    data = {
        "processados": sorted(processados),
        "timestamp": datetime.now().isoformat(),
        "total": len(processados),
    }
    CHECKPOINT_PATH.write_text(json.dumps(data, indent=2), encoding="utf-8")


def carregar_checkpoint() -> Set[str]:
    """Carrega CNJs já processados do checkpoint."""
    if not CHECKPOINT_PATH.exists():
        return set()
    try:
        data = json.loads(CHECKPOINT_PATH.read_text(encoding="utf-8"))
        processados = set(data.get("processados", []))
        logger.info(
            "Checkpoint carregado: %d CNJs já processados (de %s)",
            len(processados),
            data.get("timestamp", "?"),
        )
        return processados
    except Exception as e:
        logger.warning("Erro ao ler checkpoint: %s", e)
        return set()


# =========================================================================
# Status CSV
# =========================================================================

def salvar_status_csv(resultados: List[ProcessoResult]) -> None:
    """Salva status de todos os processos em CSV."""
    STATUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(STATUS_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "cnj", "status", "peticao_doc_id", "contestacao_doc_id",
            "contestacao_metodo", "contestacao_confidence",
            "output_path", "erro", "detalhes", "tempo_s",
        ])
        writer.writeheader()
        for r in resultados:
            writer.writerow(asdict(r))
    logger.info("Status salvo em %s (%d processos)", STATUS_PATH, len(resultados))


# =========================================================================
# Retry com backoff
# =========================================================================

async def retry_async(coro_factory, descricao: str = "operacao"):
    """Executa coroutine com retry exponencial.

    Args:
        coro_factory: Callable que retorna coroutine (chamado a cada retry).
        descricao: Descrição para logging.
    """
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return await coro_factory()
        except Exception as e:
            if attempt == MAX_RETRIES:
                logger.error(
                    "%s falhou apos %d tentativas: %s",
                    descricao, MAX_RETRIES, e,
                )
                raise
            delay = RETRY_BASE_DELAY * (2 ** (attempt - 1))
            logger.warning(
                "%s falhou (tentativa %d/%d): %s. Retry em %.0fs...",
                descricao, attempt, MAX_RETRIES, e, delay,
            )
            await asyncio.sleep(delay)


# =========================================================================
# Pipeline principal: processar um CNJ
# =========================================================================

async def processar_cnj(
    cnj: str,
    tjms_client: TJMSClient,
    bert_client: BertClassifierClient,
    cat_pi: CategoriaDocumento,
    cat_contestacao: CategoriaDocumento,
    bert_service: Optional[BertClassifierClient],
) -> ProcessoResult:
    """Processa um CNJ completo: consulta → resolve → download → BERT → merge."""

    result = ProcessoResult(cnj=cnj)
    t0 = time.monotonic()

    try:
        # ---------------------------------------------------------------
        # 1. Consulta processo no TJ-MS
        # ---------------------------------------------------------------
        logger.info("[%s] Consultando TJ-MS...", cnj)

        processo = await retry_async(
            lambda: tjms_client.consultar_processo(
                cnj, ConsultaOptions(tipo=TipoConsulta.COMPLETA)
            ),
            descricao=f"Consulta TJ-MS {cnj}",
        )

        if not processo or not processo.documentos:
            result.status = "SEM_DOCUMENTOS"
            result.erro = "Processo sem documentos no TJ-MS"
            return result

        todos_docs = ordenar_documentos(processo.documentos)
        logger.info("[%s] %d documentos encontrados", cnj, len(todos_docs))

        # ---------------------------------------------------------------
        # 2. Identifica PI (heurística DETRAN/JEC)
        # ---------------------------------------------------------------
        # Em processos DETRAN/JEC, a PI geralmente é o primeiro Termo
        # (código 10), não um doc com código 9500/500. O primeiro 9500
        # que aparece meses depois costuma ser a contestação do réu.
        CODIGOS_PI_PADRAO = {500, 9500}
        CODIGO_TERMO = 10
        # Se o primeiro 9500/500 está além da 5a posição, é suspeito
        MAX_POS_PI_NORMAL = 4

        first_pi_doc = None
        first_pi_pos = None
        for idx, doc in enumerate(todos_docs):
            if (doc.tipo_codigo or 0) in CODIGOS_PI_PADRAO:
                first_pi_doc = doc
                first_pi_pos = idx
                break

        pi_doc = None
        pi_metodo = ""

        if first_pi_doc is not None and first_pi_pos <= MAX_POS_PI_NORMAL:
            # Caso normal: primeiro 9500/500 está no início → PI real
            pi_doc = first_pi_doc
            pi_metodo = "codigo_direto"
        else:
            # Fallback DETRAN/JEC: primeiro Termo (código 10) como PI
            first_termo = next(
                (d for d in todos_docs if (d.tipo_codigo or 0) == CODIGO_TERMO),
                None,
            )
            if first_termo:
                pi_doc = first_termo
                pi_metodo = "fallback_termo"
                logger.info(
                    "[%s] PI fallback: Termo (cod 10) doc=%s "
                    "(primeiro 9500/500 na pos %s — provavelmente é contestação)",
                    cnj,
                    first_termo.id,
                    first_pi_pos if first_pi_pos is not None else "nenhum",
                )
            elif first_pi_doc:
                # Sem Termo, usa o 9500/500 tardio como última opção
                pi_doc = first_pi_doc
                pi_metodo = "codigo_tardio"
                logger.warning(
                    "[%s] PI suspeita: doc=%s na pos %d (pode ser contestação)",
                    cnj,
                    first_pi_doc.id,
                    first_pi_pos,
                )

        if not pi_doc:
            result.status = "DESCARTADO_SEM_PI"
            result.erro = "PI não encontrada (sem 9500/500 nem Termo 10)"
            return result

        pi_doc_id = pi_doc.id
        result.peticao_doc_id = pi_doc_id
        logger.info(
            "[%s] PI identificada: doc_id=%s (metodo=%s)",
            cnj, pi_doc_id, pi_metodo,
        )

        # ---------------------------------------------------------------
        # 3. Resolve Contestação (excluindo doc PI para evitar overlap)
        # ---------------------------------------------------------------
        candidatos_cont = [
            DocumentoCandidate(
                id=doc.id,
                tipo_codigo=doc.tipo_codigo or 0,
                data_juntada=doc.data_juntada,
                ordem=doc.ordem,
                descricao=doc.descricao,
                texto=None,  # BERT pós-download
            )
            for doc in todos_docs
            if doc.id != pi_doc_id  # Exclui PI para não duplicar
        ]

        _, resolucoes = await resolve_all_categories(
            candidatos_cont, [cat_contestacao], bert_service=bert_service
        )

        res_cont = next(
            (r for r in resolucoes if r.categoria_id == CATEGORIA_CONTESTACAO_ID),
            None,
        )

        # ---------------------------------------------------------------
        # 4. Verifica Contestação (pré-BERT, PI já excluída)
        # ---------------------------------------------------------------
        if not res_cont or not res_cont.documento_ids:
            result.status = "DESCARTADO_SEM_CONTESTACAO"
            result.erro = "Nenhum candidato a contestação encontrado"
            result.detalhes = json.dumps(res_cont.detalhes if res_cont else {})
            return result

        # Identifica quais são diretos (8320) vs candidatos BERT
        cont_diretos: List[str] = []
        cont_bert_candidatos: List[str] = []

        if res_cont.bert_predictions:
            for pred in res_cont.bert_predictions:
                doc_id = pred["doc_id"]
                if pred.get("motivo") == "candidato_pendente_bert":
                    cont_bert_candidatos.append(doc_id)
                elif pred.get("match"):
                    cont_diretos.append(doc_id)
        # Docs que estão em documento_ids mas não em predictions → diretos (código 8320)
        pred_ids = {
            p["doc_id"] for p in (res_cont.bert_predictions or [])
        }
        for did in res_cont.documento_ids:
            if did not in pred_ids and did not in cont_diretos:
                cont_diretos.append(did)

        logger.info(
            "[%s] Contestação: %d direto(s), %d candidato(s) BERT",
            cnj, len(cont_diretos), len(cont_bert_candidatos),
        )

        # ---------------------------------------------------------------
        # 5. Download dos documentos
        # ---------------------------------------------------------------
        docs_para_baixar = set()
        docs_para_baixar.add(pi_doc_id)
        docs_para_baixar.update(cont_diretos)
        docs_para_baixar.update(cont_bert_candidatos)

        logger.info("[%s] Baixando %d documento(s)...", cnj, len(docs_para_baixar))

        docs_baixados = await retry_async(
            lambda: tjms_client.baixar_documentos(
                cnj, sorted(docs_para_baixar), DownloadOptions()
            ),
            descricao=f"Download docs {cnj}",
        )

        # Verifica se PI foi baixada com sucesso
        pi_doc = docs_baixados.get(pi_doc_id)
        if not pi_doc or not pi_doc.sucesso or not pi_doc.conteudo_bytes:
            result.status = "ERRO_DOWNLOAD_PI"
            result.erro = f"Falha ao baixar PI (doc_id={pi_doc_id})"
            return result

        # ---------------------------------------------------------------
        # 6. BERT pós-download para candidatos
        # ---------------------------------------------------------------
        contestacao_confirmada_id: Optional[str] = None
        contestacao_metodo: str = ""
        contestacao_confidence: Optional[float] = None

        # Prioridade 1: matches diretos (código 8320)
        for doc_id in cont_diretos:
            doc = docs_baixados.get(doc_id)
            if doc and doc.sucesso and doc.conteudo_bytes:
                contestacao_confirmada_id = doc_id
                contestacao_metodo = "codigo_direto"
                logger.info(
                    "[%s] Contestação confirmada (código direto): doc_id=%s",
                    cnj, doc_id,
                )
                break

        # Prioridade 2: classificação BERT dos candidatos
        if not contestacao_confirmada_id and cont_bert_candidatos and bert_service:
            model_run_id = (cat_contestacao.resolver_config or {}).get("model_run_id")
            model_name = f"model_run_{model_run_id}" if model_run_id else None
            label_esperada = _normalizar_label(
                (cat_contestacao.resolver_config or {}).get("label_match", "contestacao")
            )

            for doc_id in cont_bert_candidatos:
                doc = docs_baixados.get(doc_id)
                if not doc or not doc.sucesso or not doc.conteudo_bytes:
                    logger.debug("[%s] BERT: doc %s sem conteudo", cnj, doc_id)
                    continue

                # Extrai texto do PDF
                texto = await pdf_to_text(doc.conteudo_bytes)
                if not texto or len(texto.strip()) < 50:
                    logger.debug("[%s] BERT: doc %s texto insuficiente", cnj, doc_id)
                    continue

                # Classifica via BERT
                try:
                    resultado_bert = await bert_client.classify(
                        texto, model_name=model_name
                    )
                    pred_label = resultado_bert.get("predicted_label", "")
                    pred_norm = _normalizar_label(pred_label)
                    conf = resultado_bert.get("confidence", 0.0)

                    logger.info(
                        "[%s] BERT doc %s: label='%s' (%.1f%%) esperado='%s' => %s",
                        cnj, doc_id, pred_label, conf * 100,
                        label_esperada,
                        "MATCH" if pred_norm == label_esperada else "NO MATCH",
                    )

                    if pred_norm == label_esperada:
                        contestacao_confirmada_id = doc_id
                        contestacao_metodo = "bert"
                        contestacao_confidence = round(conf, 4)
                        break  # Pega a primeira contestação confirmada

                except Exception as e:
                    logger.error(
                        "[%s] BERT erro doc %s: %s", cnj, doc_id, e
                    )

        # Sem contestação confirmada → descartar
        if not contestacao_confirmada_id:
            result.status = "DESCARTADO_SEM_CONTESTACAO"
            result.erro = (
                f"Nenhuma contestação confirmada "
                f"({len(cont_diretos)} direto(s), "
                f"{len(cont_bert_candidatos)} BERT candidato(s))"
            )
            result.detalhes = json.dumps({
                "cont_diretos": cont_diretos,
                "cont_bert_candidatos": cont_bert_candidatos,
                "bert_disponivel": bert_service is not None,
            })
            return result

        result.contestacao_doc_id = contestacao_confirmada_id
        result.contestacao_metodo = contestacao_metodo
        result.contestacao_confidence = contestacao_confidence

        # ---------------------------------------------------------------
        # 7. Merge PI + Contestação
        # ---------------------------------------------------------------
        cont_doc = docs_baixados.get(contestacao_confirmada_id)
        if not cont_doc or not cont_doc.sucesso or not cont_doc.conteudo_bytes:
            result.status = "ERRO_DOWNLOAD_CONTESTACAO"
            result.erro = f"Contestação doc_id={contestacao_confirmada_id} sem conteudo"
            return result

        # Ordem: PI primeiro, Contestação depois
        pdf_items = [
            (pi_doc_id, pi_doc.conteudo_bytes),
            (contestacao_confirmada_id, cont_doc.conteudo_bytes),
        ]

        merged_bytes = await mesclar_pdfs(pdf_items)
        if not merged_bytes:
            result.status = "ERRO_MERGE"
            result.erro = "Falha ao mesclar PDFs (possivelmente RTF ou corrompido)"
            return result

        # ---------------------------------------------------------------
        # 8. Salvar arquivo
        # ---------------------------------------------------------------
        cnj_safe = cnj.replace(".", "-")
        output_subdir = OUTPUT_DIR / cnj_safe
        output_subdir.mkdir(parents=True, exist_ok=True)
        output_file = output_subdir / f"{cnj_safe}__PI+CONTESTACAO.pdf"

        output_file.write_bytes(merged_bytes)

        result.status = "OK"
        result.output_path = str(output_file)
        logger.info(
            "[%s] Salvo: %s (%.1f KB)",
            cnj, output_file.name, len(merged_bytes) / 1024,
        )

    except Exception as e:
        result.status = "ERRO"
        result.erro = str(e)
        logger.exception("[%s] Erro inesperado: %s", cnj, e)

    finally:
        result.tempo_s = round(time.monotonic() - t0, 1)

    return result


# =========================================================================
# Smoke test
# =========================================================================

async def smoke_test(
    cnjs: List[str],
    tjms_client: TJMSClient,
    bert_client: BertClassifierClient,
    cat_pi: CategoriaDocumento,
    cat_contestacao: CategoriaDocumento,
    bert_service: Optional[BertClassifierClient],
) -> bool:
    """Roda 3 CNJs como smoke test e verifica sanidade do pipeline."""

    test_cnjs = cnjs[:3]
    logger.info("=" * 60)
    logger.info("SMOKE TEST: processando %d CNJs", len(test_cnjs))
    logger.info("=" * 60)

    resultados = []
    for cnj in test_cnjs:
        r = await processar_cnj(
            cnj, tjms_client, bert_client,
            cat_pi, cat_contestacao, bert_service,
        )
        resultados.append(r)
        logger.info(
            "  [%s] status=%s | PI=%s | Cont=%s (%s, %.1f%%)",
            r.cnj, r.status,
            r.peticao_doc_id or "-",
            r.contestacao_doc_id or "-",
            r.contestacao_metodo or "-",
            (r.contestacao_confidence or 0) * 100,
        )
        await asyncio.sleep(1.0)

    # Resumo
    ok = sum(1 for r in resultados if r.status == "OK")
    sem_cont = sum(1 for r in resultados if "SEM_CONTESTACAO" in r.status)
    erros = sum(1 for r in resultados if r.status.startswith("ERRO"))

    logger.info("=" * 60)
    logger.info(
        "SMOKE TEST concluido: %d OK, %d sem contestacao, %d erros",
        ok, sem_cont, erros,
    )
    logger.info("=" * 60)

    if erros > 0:
        logger.error("Smoke test com erros — verifique antes de rodar o lote completo")
        return False

    if ok == 0 and sem_cont == len(test_cnjs):
        logger.warning(
            "Nenhum processo teve contestação — pode ser normal para esses CNJs, "
            "mas verifique se o BERT está classificando corretamente"
        )

    return True


# =========================================================================
# Verificações pré-lote
# =========================================================================

async def verificar_bert(bert_client: BertClassifierClient) -> Optional[BertClassifierClient]:
    """Verifica se o BERT está funcionando e retorna o service ou None."""
    logger.info("Verificando disponibilidade do BERT...")

    health = await bert_client.check_health()
    logger.info("BERT health: %s", json.dumps(health, indent=2))

    if health.get("available"):
        logger.info(
            "BERT disponivel via %s (endpoint=%s)",
            health.get("mode"),
            health.get("endpoint", "local"),
        )
        return bert_client

    # Tenta carregar modelo local diretamente
    model_path = Path("bert_models/model_run_6/model.pt")
    if model_path.exists():
        logger.info(
            "Modelo local encontrado: %s (%.0f MB). "
            "Tentando classificação de teste...",
            model_path,
            model_path.stat().st_size / (1024 * 1024),
        )

        # Teste rápido com texto fictício
        try:
            test_result = await bert_client.classify(
                "Esta é a contestação da parte ré nos autos do processo.",
                model_name="model_run_6",
            )
            logger.info(
                "Teste BERT local: label='%s', confidence=%.2f, source=%s",
                test_result.get("predicted_label"),
                test_result.get("confidence", 0),
                test_result.get("source"),
            )
            if test_result.get("source") in ("http", "local"):
                logger.info("BERT local funcionando!")
                return bert_client
        except Exception as e:
            logger.error("Falha no teste BERT local: %s", e)

    logger.error(
        "BERT INDISPONIVEL! A classificação de contestação depende do BERT. "
        "Opções:\n"
        "  1. Iniciar o inference_server: python -m sistemas.bert_training.worker.inference_server\n"
        "  2. Verificar se torch/transformers estão instalados para modo local\n"
        "  3. Verificar se bert_models/model_run_6/model.pt existe"
    )
    return None


def carregar_categorias(db: Session) -> Tuple[CategoriaDocumento, CategoriaDocumento]:
    """Carrega categorias PI e Contestação do banco."""
    cat_pi = db.query(CategoriaDocumento).filter(
        CategoriaDocumento.id == CATEGORIA_PI_ID,
        CategoriaDocumento.ativo == True,
    ).first()

    cat_contestacao = db.query(CategoriaDocumento).filter(
        CategoriaDocumento.id == CATEGORIA_CONTESTACAO_ID,
        CategoriaDocumento.ativo == True,
    ).first()

    if not cat_pi:
        raise RuntimeError(
            f"Categoria PI (id={CATEGORIA_PI_ID}) não encontrada ou inativa no banco!"
        )
    if not cat_contestacao:
        raise RuntimeError(
            f"Categoria Contestação (id={CATEGORIA_CONTESTACAO_ID}) não encontrada ou inativa no banco!"
        )

    # Valida configuração BERT da contestação
    rc = cat_contestacao.resolver_config or {}
    if rc.get("type") != "bert":
        logger.warning(
            "Categoria Contestação não usa resolver BERT (type=%s). "
            "Apenas matches diretos (código 8320) serão usados.",
            rc.get("type"),
        )
    else:
        logger.info(
            "Contestação BERT config: model_run_id=%s, label_match='%s', "
            "%d códigos diretos, %d códigos BERT",
            rc.get("model_run_id"),
            rc.get("label_match"),
            len(rc.get("codigos_diretos", [])),
            len(rc.get("codigos_bert", [])),
        )

    logger.info(
        "PI config: codigos=%s, is_primeiro_documento=%s",
        cat_pi.get_codigos(), cat_pi.is_primeiro_documento,
    )

    return cat_pi, cat_contestacao


# =========================================================================
# Main
# =========================================================================

async def main(args: argparse.Namespace) -> None:
    """Executa o pipeline em lote."""

    setup_logging(verbose=args.verbose)
    logger.info("=" * 60)
    logger.info("BATCH DETRAN — Extração PI + Contestação")
    logger.info("=" * 60)

    # Carrega CNJs
    cnjs = ler_cnjs_planilha(PLANILHA_PATH)

    # Aplica range
    if args.start:
        cnjs = cnjs[args.start:]
    if args.limit:
        cnjs = cnjs[:args.limit]

    # Resume: filtra CNJs já processados
    processados: Set[str] = set()
    resultados_anteriores: List[ProcessoResult] = []

    if args.resume:
        processados = carregar_checkpoint()
        # Carrega resultados anteriores do CSV
        if STATUS_PATH.exists():
            try:
                df_status = pd.read_csv(STATUS_PATH)
                for _, row in df_status.iterrows():
                    if row["cnj"] in processados:
                        resultados_anteriores.append(ProcessoResult(
                            cnj=row["cnj"],
                            status=str(row.get("status", "")),
                            peticao_doc_id=str(row.get("peticao_doc_id", "")) if pd.notna(row.get("peticao_doc_id")) else None,
                            contestacao_doc_id=str(row.get("contestacao_doc_id", "")) if pd.notna(row.get("contestacao_doc_id")) else None,
                            contestacao_metodo=str(row.get("contestacao_metodo", "")) if pd.notna(row.get("contestacao_metodo")) else None,
                            contestacao_confidence=float(row["contestacao_confidence"]) if pd.notna(row.get("contestacao_confidence")) else None,
                            output_path=str(row.get("output_path", "")) if pd.notna(row.get("output_path")) else None,
                            erro=str(row.get("erro", "")) if pd.notna(row.get("erro")) else None,
                            detalhes=str(row.get("detalhes", "")) if pd.notna(row.get("detalhes")) else None,
                            tempo_s=float(row.get("tempo_s", 0)),
                        ))
            except Exception as e:
                logger.warning("Erro ao ler status anterior: %s", e)

        cnjs_pendentes = [c for c in cnjs if c not in processados]
        logger.info(
            "Resume: %d já processados, %d pendentes",
            len(processados), len(cnjs_pendentes),
        )
        cnjs = cnjs_pendentes

    if not cnjs:
        logger.info("Nenhum CNJ pendente para processar!")
        return

    logger.info("Total de CNJs a processar: %d", len(cnjs))

    # Cria sessão de banco
    db = SessionLocal()

    try:
        # Carrega categorias
        cat_pi, cat_contestacao = carregar_categorias(db)

        # Inicializa clientes
        tjms_client = TJMSClient()
        bert_client = BertClassifierClient()

        # Verifica BERT
        bert_service = await verificar_bert(bert_client)

        if not bert_service and not args.force_no_bert:
            logger.error(
                "BERT indisponível. Use --force-no-bert para continuar "
                "apenas com matches diretos (código 8320)."
            )
            return

        # Smoke test
        if args.smoke_test or args.smoke_test_only:
            sucesso = await smoke_test(
                cnjs, tjms_client, bert_client,
                cat_pi, cat_contestacao, bert_service,
            )
            if not sucesso and not args.force:
                logger.error("Smoke test falhou. Use --force para ignorar.")
                return
            if args.smoke_test_only:
                logger.info("Modo --smoke-test-only: encerrando apos smoke test.")
                return

        # ---------------------------------------------------------------
        # Loop principal
        # ---------------------------------------------------------------
        resultados = list(resultados_anteriores)
        total = len(cnjs)
        t0_lote = time.monotonic()

        # Contadores
        n_ok = 0
        n_sem_cont = 0
        n_sem_pi = 0
        n_erros = 0
        n_sem_docs = 0

        # Detector de falhas consecutivas do BERT
        falhas_bert_consecutivas = 0
        MAX_FALHAS_BERT = 10

        for idx, cnj in enumerate(cnjs):
            logger.info(
                "--- [%d/%d] %s ---", idx + 1, total, cnj
            )

            r = await processar_cnj(
                cnj, tjms_client, bert_client,
                cat_pi, cat_contestacao, bert_service,
            )
            resultados.append(r)
            processados.add(cnj)

            # Contadores
            if r.status == "OK":
                n_ok += 1
                falhas_bert_consecutivas = 0
            elif "SEM_CONTESTACAO" in r.status:
                n_sem_cont += 1
                # Verifica se é falha BERT
                if r.detalhes:
                    try:
                        det = json.loads(r.detalhes)
                        if det.get("cont_bert_candidatos") and not det.get("bert_disponivel"):
                            falhas_bert_consecutivas += 1
                    except (json.JSONDecodeError, TypeError):
                        pass
            elif "SEM_PI" in r.status:
                n_sem_pi += 1
            elif "SEM_DOCUMENTOS" in r.status:
                n_sem_docs += 1
            else:
                n_erros += 1

            # Alerta de falha BERT consecutiva
            if falhas_bert_consecutivas >= MAX_FALHAS_BERT:
                logger.error(
                    "ALERTA: %d descartes consecutivos possivelmente "
                    "por BERT indisponível! Parando para verificação.",
                    falhas_bert_consecutivas,
                )
                break

            # Checkpoint a cada 10 processos
            if (idx + 1) % 10 == 0:
                salvar_checkpoint(processados)
                salvar_status_csv(resultados)

                elapsed = time.monotonic() - t0_lote
                rate = (idx + 1) / elapsed * 60  # processos/min
                remaining = (total - idx - 1) / rate if rate > 0 else 0
                logger.info(
                    "Progresso: %d/%d (%.0f%%) | OK=%d SemCont=%d SemPI=%d SemDocs=%d Erros=%d | "
                    "%.1f proc/min | ETA ~%.0f min",
                    idx + 1, total, (idx + 1) / total * 100,
                    n_ok, n_sem_cont, n_sem_pi, n_sem_docs, n_erros,
                    rate, remaining,
                )

            # Pausa entre processos
            if idx < total - 1:
                await asyncio.sleep(PAUSA_ENTRE_PROCESSOS)

        # ---------------------------------------------------------------
        # Resultado final
        # ---------------------------------------------------------------
        salvar_checkpoint(processados)
        salvar_status_csv(resultados)

        elapsed_total = time.monotonic() - t0_lote

        logger.info("=" * 60)
        logger.info("LOTE CONCLUÍDO")
        logger.info("=" * 60)
        logger.info("Total processados: %d", len(resultados))
        logger.info("  OK (PI+Contestação): %d", n_ok)
        logger.info("  Sem contestação:     %d", n_sem_cont)
        logger.info("  Sem PI:              %d", n_sem_pi)
        logger.info("  Sem documentos:      %d", n_sem_docs)
        logger.info("  Erros:               %d", n_erros)
        logger.info("Tempo total: %.1f min", elapsed_total / 60)
        logger.info("Status: %s", STATUS_PATH)
        logger.info("Checkpoint: %s", CHECKPOINT_PATH)
        logger.info("Output: %s", OUTPUT_DIR)
        logger.info("=" * 60)

    finally:
        db.close()


def parse_args() -> argparse.Namespace:
    """Parse argumentos de linha de comando."""
    parser = argparse.ArgumentParser(
        description="Extrair PI + Contestação dos processos DETRAN em lote."
    )
    parser.add_argument(
        "--smoke-test", action="store_true",
        help="Roda 3 CNJs como smoke test antes do lote",
    )
    parser.add_argument(
        "--smoke-test-only", action="store_true",
        help="Roda apenas o smoke test (sem lote)",
    )
    parser.add_argument(
        "--resume", action="store_true",
        help="Retoma do último checkpoint",
    )
    parser.add_argument(
        "--start", type=int, default=None,
        help="Índice inicial na lista de CNJs (0-based)",
    )
    parser.add_argument(
        "--limit", type=int, default=None,
        help="Número máximo de CNJs a processar",
    )
    parser.add_argument(
        "--force", action="store_true",
        help="Continua mesmo se smoke test falhar",
    )
    parser.add_argument(
        "--force-no-bert", action="store_true",
        help="Continua sem BERT (apenas matches diretos 8320)",
    )
    parser.add_argument(
        "--verbose", "-v", action="store_true",
        help="Logging detalhado (DEBUG)",
    )
    return parser.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(main(args))
