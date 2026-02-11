# sistemas/extrator_autos/services_download.py
"""
Utilidades de download e processamento de documentos processuais.

Funcoes para ordenar, filtrar, converter e empacotar documentos
baixados do TJ-MS. Adaptado do aplicativo desktop API-TJ (api.py).
"""

import asyncio
import io
import logging
import re
import zipfile
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import fitz  # PyMuPDF

from services.tjms.models import DocumentoMetadata

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Ordenacao e filtragem de documentos
# ------------------------------------------------------------------


def ordenar_documentos(documentos: List[DocumentoMetadata]) -> List[DocumentoMetadata]:
    """
    Ordena documentos cronologicamente (mais antigo primeiro).

    Chave de ordenacao: data_juntada ASC (None por ultimo), depois ordem ASC.
    Baseado em API-TJ _ordenar_docs (api.py:1074).
    """
    return sorted(
        documentos,
        key=lambda d: (
            d.data_juntada if d.data_juntada is not None else datetime.max,
            d.ordem,
        ),
    )


def filtrar_por_periodo(
    documentos: List[DocumentoMetadata],
    anos: Optional[List[int]] = None,
    mes: Optional[int] = None,
) -> List[DocumentoMetadata]:
    """
    Filtra documentos por ano e/ou mes.

    Baseado em API-TJ _doc_matches_year_month (api.py:1134-1223).
    Usa o campo data_juntada do DocumentoMetadata.

    Args:
        documentos: Lista de documentos para filtrar.
        anos: Lista de anos (ex: [2024, 2025]). None retorna todos.
        mes: Mes de 1 a 12. None retorna todos os meses dos anos selecionados.

    Returns:
        Lista filtrada de documentos.
    """
    if not anos:
        return list(documentos)

    resultado = []
    anos_set = set(anos)

    for doc in documentos:
        if doc.data_juntada is None:
            # Documentos sem data nao sao filtrados por periodo
            continue

        if doc.data_juntada.year not in anos_set:
            continue

        if mes is not None and doc.data_juntada.month != mes:
            continue

        resultado.append(doc)

    return resultado


# ------------------------------------------------------------------
# Conversao PDF/RTF para texto
# ------------------------------------------------------------------


def detectar_rtf(content_bytes: bytes) -> bool:
    """
    Detecta se o conteudo e RTF disfarçado de PDF.

    Baseado em API-TJ _is_rtf_content (api.py:774).
    Verifica magic bytes '{\\rtf' no inicio do arquivo.
    """
    if not content_bytes:
        return False

    # RTF sempre comeca com {\rtf
    if content_bytes.startswith(b"{\\rtf"):
        return True

    # Verifica nos primeiros 1000 bytes
    try:
        header = content_bytes[:1000].decode("latin-1", errors="ignore").lower()
        return "\\rtf" in header and "{" in header
    except Exception:
        return False


def extrair_texto_rtf(content_bytes: bytes) -> str:
    """
    Extrai texto de conteudo RTF removendo codigos de controle.

    Remove comandos RTF (\\comando), chaves e normaliza espacos.
    """
    if not content_bytes:
        return ""

    try:
        texto = content_bytes.decode("utf-8", errors="ignore")
    except Exception:
        texto = content_bytes.decode("latin-1", errors="ignore")

    # Remove comandos RTF (ex: \par, \b0, \fs24)
    texto = re.sub(r"\\[a-z]+\d*\s?", " ", texto)
    # Remove chaves
    texto = re.sub(r"[{}]", "", texto)
    # Normaliza espacos
    texto = re.sub(r"\s+", " ", texto)

    return texto.strip()


async def pdf_to_text(
    pdf_bytes: bytes,
    timeout: float = 60.0,
) -> Optional[str]:
    """
    Converte PDF bytes para texto/markdown.

    Baseado em API-TJ _safe_pdf_to_markdown (api.py:828).
    Cadeia de fallback:
    1. pymupdf4llm.to_markdown (melhor formatacao)
    2. fitz.get_text('text') (texto simples)
    3. None se ambos falharem

    Usa asyncio.to_thread para nao bloquear o event loop.
    """
    if not pdf_bytes:
        return None

    # Verifica se e RTF disfarçado
    if detectar_rtf(pdf_bytes):
        return extrair_texto_rtf(pdf_bytes)

    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(_extract_text_sync, pdf_bytes),
            timeout=timeout,
        )
        return result
    except asyncio.TimeoutError:
        logger.warning("Timeout (%0.1fs) na extracao de texto do PDF", timeout)
        return None
    except Exception as exc:
        logger.error("Erro na extracao de texto: %s", exc)
        return None


def _extract_text_sync(pdf_bytes: bytes) -> Optional[str]:
    """
    Extracao sincrona de texto de PDF. Chamado via to_thread.

    Tenta pymupdf4llm primeiro, depois fallback para fitz basico.
    """
    # Tenta pymupdf4llm para markdown (melhor formatacao)
    try:
        import pymupdf4llm

        text = pymupdf4llm.to_markdown(doc=pdf_bytes)
        if text and text.strip():
            return text
    except ImportError:
        logger.debug("pymupdf4llm nao disponivel, usando fitz basico")
    except Exception as exc:
        logger.debug("pymupdf4llm falhou: %s, tentando fitz basico", exc)

    # Fallback: fitz.get_text('text')
    try:
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        pages_text = []
        for page in doc:
            page_text = page.get_text("text")
            if page_text:
                pages_text.append(page_text)
        doc.close()

        if pages_text:
            return "\n\n".join(pages_text)
    except Exception as exc:
        logger.debug("fitz.get_text falhou: %s", exc)

    return None


# ------------------------------------------------------------------
# Mesclagem de PDFs
# ------------------------------------------------------------------


async def mesclar_pdfs(pdf_items: List[Tuple[str, bytes]]) -> Optional[bytes]:
    """
    Mescla multiplos PDFs em um unico arquivo, na ordem recebida.

    Baseado em API-TJ mesclar_pdfs (api.py:1031).

    Args:
        pdf_items: Lista de tuplas (doc_id, pdf_bytes).

    Returns:
        Bytes do PDF mesclado, ou None se nenhuma pagina valida.
    """
    if not pdf_items:
        return None

    try:
        result = await asyncio.to_thread(_merge_pdfs_sync, pdf_items)
        return result
    except Exception as exc:
        logger.error("Erro ao mesclar PDFs: %s", exc)
        return None


def _merge_pdfs_sync(pdf_items: List[Tuple[str, bytes]]) -> Optional[bytes]:
    """Mesclagem sincrona de PDFs. Chamado via to_thread."""
    destino = fitz.open()
    skipped = 0

    for doc_id, pdf_bytes in pdf_items:
        # Ignora arquivos RTF disfarçados
        if detectar_rtf(pdf_bytes):
            logger.debug("Ignorando RTF na mesclagem: %s", doc_id)
            skipped += 1
            continue

        try:
            src = fitz.open(stream=pdf_bytes, filetype="pdf")
            destino.insert_pdf(src)
            src.close()
        except Exception as exc:
            logger.warning("Falha ao mesclar doc %s: %s", doc_id, exc)
            skipped += 1

    if skipped > 0:
        logger.info(
            "%d arquivo(s) ignorado(s) na mesclagem (RTF ou invalido)", skipped
        )

    if destino.page_count == 0:
        destino.close()
        return None

    # Salva em memoria com compressao deflate
    buffer = io.BytesIO()
    destino.save(buffer, deflate=True)
    destino.close()

    return buffer.getvalue()


# ------------------------------------------------------------------
# Criacao de ZIP
# ------------------------------------------------------------------


async def criar_zip_resultado(
    arquivos: List[Dict[str, Any]],
    xml_completo: Optional[str] = None,
    numero_cnj: str = "",
) -> bytes:
    """
    Cria arquivo ZIP em memoria com todos os arquivos baixados.

    Args:
        arquivos: Lista de dicts com {"nome": str, "conteudo": bytes, "tipo": str}.
        xml_completo: Conteudo XML do processo (opcional).
        numero_cnj: Numero CNJ para nomear o arquivo XML.

    Returns:
        Bytes do arquivo ZIP.
    """
    return await asyncio.to_thread(
        _create_zip_sync, arquivos, xml_completo, numero_cnj
    )


def _create_zip_sync(
    arquivos: List[Dict[str, Any]],
    xml_completo: Optional[str],
    numero_cnj: str,
) -> bytes:
    """Criacao sincrona de ZIP. Chamado via to_thread."""
    buffer = io.BytesIO()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        nomes_usados: Dict[str, int] = {}

        for arquivo in arquivos:
            nome = arquivo.get("nome", "documento")
            conteudo = arquivo.get("conteudo", b"")

            if not conteudo:
                continue

            # Desambigua nomes duplicados
            nome = _desambiguar_nome(nome, nomes_usados)

            if isinstance(conteudo, str):
                conteudo = conteudo.encode("utf-8")

            zf.writestr(nome, conteudo)

        # Adiciona XML completo se fornecido
        if xml_completo:
            xml_nome = f"{numero_cnj}_processo_completo.xml" if numero_cnj else "processo_completo.xml"
            zf.writestr(xml_nome, xml_completo.encode("utf-8"))

    return buffer.getvalue()


def _desambiguar_nome(nome: str, nomes_usados: Dict[str, int]) -> str:
    """Adiciona sufixo numerico se o nome ja foi usado."""
    if nome not in nomes_usados:
        nomes_usados[nome] = 1
        return nome

    count = nomes_usados[nome]
    nomes_usados[nome] = count + 1

    # Insere contador antes da extensao
    base, _, ext = nome.rpartition(".")
    if base:
        return f"{base}_{count}.{ext}"
    return f"{nome}_{count}"


# ------------------------------------------------------------------
# Geracao de nomes de arquivo
# ------------------------------------------------------------------


def gerar_nome_arquivo(
    numero_cnj: str,
    tipo_codigo: int,
    tipo_descricao: str,
    data_juntada: Optional[datetime],
    indice: int,
    extensao: str,
) -> str:
    """
    Gera nome de arquivo para documento baixado.

    Padrao: {data}_{numero} - {descricao}-{indice}.{ext}
    Baseado no padrao de nomeacao do API-TJ.

    Args:
        numero_cnj: Numero CNJ do processo.
        tipo_codigo: Codigo do tipo de documento.
        tipo_descricao: Descricao do tipo de documento.
        data_juntada: Data de juntada do documento (pode ser None).
        indice: Indice sequencial do documento.
        extensao: Extensao do arquivo (ex: "pdf", "txt").

    Returns:
        Nome de arquivo sanitizado.
    """
    # Formata data
    if data_juntada:
        data_str = data_juntada.strftime("%Y%m%d")
    else:
        data_str = "00000000"

    # Sanitiza descricao
    descricao = _sanitizar_nome_arquivo(tipo_descricao or f"tipo_{tipo_codigo}")

    # Limita comprimento da descricao
    if len(descricao) > 60:
        descricao = descricao[:60]

    # Remove extensao duplicada se ja presente
    extensao = extensao.lstrip(".")

    nome = f"{data_str}_{numero_cnj} - {descricao}-{indice:03d}.{extensao}"

    return nome


def _sanitizar_nome_arquivo(nome: str) -> str:
    """
    Sanitiza string para uso como nome de arquivo.

    Remove caracteres invalidos e normaliza espacos.
    """
    # Substitui caracteres invalidos para nomes de arquivo
    nome = re.sub(r'[<>:"/\\|?*]', "-", nome)
    # Normaliza espacos
    nome = re.sub(r"\s+", " ", nome)
    return nome.strip()
