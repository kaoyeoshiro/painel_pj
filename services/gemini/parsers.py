# services/gemini/parsers.py
"""
Parsers para extrair conteúdo das respostas da API Gemini.

Extraído de gemini_service.py para melhor organização.
"""

import logging
from typing import Dict

# Tenta usar logging estruturado se disponível
try:
    from utils.logging_config import get_logger
    logger = get_logger(__name__)
except ImportError:
    logger = logging.getLogger(__name__)


def extract_content(data: Dict) -> str:
    """Extrai conteúdo da resposta do Gemini"""
    candidates = data.get("candidates", [])
    if candidates:
        # Verifica se há bloqueio
        finish_reason = candidates[0].get("finishReason", "")
        if finish_reason in ("SAFETY", "RECITATION", "OTHER"):
            logger.warning(f"[Gemini] Resposta bloqueada: finishReason={finish_reason}")

        content = candidates[0].get("content", {})
        parts = content.get("parts", [])
        if parts:
            # Gemini 2.5 com thinking pode ter múltiplas parts
            # A primeira pode ser "thought" e a segunda o texto real
            for part in parts:
                text = part.get("text", "")
                if text:
                    return text
    else:
        # Log para diagnóstico de respostas vazias
        prompt_feedback = data.get("promptFeedback", {})
        if prompt_feedback:
            block_reason = prompt_feedback.get("blockReason", "")
            if block_reason:
                logger.warning(f"[Gemini] Prompt bloqueado: blockReason={block_reason}")
        else:
            logger.warning(f"[Gemini] Resposta sem candidates. Keys: {list(data.keys())}")
    return ""


def extract_tokens(data: Dict) -> int:
    """Extrai contagem de tokens da resposta"""
    usage = data.get("usageMetadata", {})
    return usage.get("totalTokenCount", 0)


def extract_grounding_metadata(data: Dict) -> str:
    """Extrai metadados de grounding (fontes consultadas)"""
    candidates = data.get("candidates", [])
    if not candidates:
        return ""

    grounding = candidates[0].get("groundingMetadata", {})
    if not grounding:
        return ""

    # Extrai URLs das fontes
    sources = grounding.get("webSearchQueries", [])
    chunks = grounding.get("groundingChunks", [])

    urls = []
    for chunk in chunks:
        web = chunk.get("web", {})
        if web.get("uri"):
            urls.append(web.get("uri"))

    if urls:
        return ", ".join(urls[:3])  # Máximo 3 URLs
    elif sources:
        return f"Buscas: {', '.join(sources[:3])}"

    return ""


__all__ = [
    "extract_content",
    "extract_tokens",
    "extract_grounding_metadata",
]
