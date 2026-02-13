# services/gemini/payloads.py
"""
Construção de payloads para chamadas à API Gemini.

Extraído de gemini_service.py para melhor organização.
"""

from typing import Any, Dict, List


def build_payload(
    prompt: str,
    system_prompt: str = "",
    max_tokens: int = None,
    temperature: float = 0.3,
    thinking_level: str = None,
    model: str = None
) -> Dict[str, Any]:
    """
    Monta o payload para chamada de texto.

    Args:
        thinking_level: Nível de raciocínio do Gemini 3. Valores válidos:
            - None: Usa padrão do modelo (high/dynamic)
            - "minimal": Quase sem thinking (melhor para chat/alta vazão) - só Flash
            - "low": Mínimo thinking (bom para classificação simples)
            - "medium": Balanceado - só Flash
            - "high": Máximo raciocínio (padrão)
        model: Nome do modelo (usado para validar thinking_level)
    """
    generation_config = {"temperature": temperature}

    # Só adiciona maxOutputTokens se especificado (None = usa máximo do modelo)
    if max_tokens is not None:
        generation_config["maxOutputTokens"] = max_tokens

    # Configura nível de thinking para Gemini 3
    # - Gemini 3 Flash: suporta "minimal", "low", "medium", "high"
    # - Gemini 3 Pro: suporta apenas "low", "high"
    # - Gemini 2.x: não suporta thinkingConfig
    if thinking_level and model:
        model_lower = model.lower()
        if "gemini-3" in model_lower:
            if "flash" in model_lower:
                # Flash aceita todos os níveis
                valid_levels = ("minimal", "low", "medium", "high")
            else:
                # Pro aceita apenas low e high
                valid_levels = ("low", "high")

            if thinking_level in valid_levels:
                generation_config["thinkingConfig"] = {
                    "thinkingLevel": thinking_level
                }
            # Se nível inválido para o modelo, simplesmente ignora (usa default)

    payload = {
        "contents": [
            {"role": "user", "parts": [{"text": prompt}]}
        ],
        "generationConfig": generation_config
    }

    if system_prompt:
        payload["systemInstruction"] = {
            "parts": [{"text": system_prompt}]
        }

    return payload


def build_payload_with_images(
    prompt: str,
    images_base64: List[str],
    system_prompt: str = "",
    max_tokens: int = None,
    temperature: float = 0.3,
    thinking_level: str = None,
    model: str = None
) -> Dict[str, Any]:
    """
    Monta o payload para chamada com imagens.

    Args:
        thinking_level: Nível de raciocínio do Gemini 3. Valores válidos:
            - None: Usa padrão do modelo (high/dynamic)
            - "minimal": Quase sem thinking (melhor para chat/alta vazão) - só Flash
            - "low": Mínimo thinking (bom para classificação simples)
            - "medium": Balanceado - só Flash
            - "high": Máximo raciocínio (padrão)
        model: Nome do modelo (usado para validar thinking_level)
    """
    parts = []

    # Adiciona imagens
    for img_base64 in images_base64:
        if img_base64.startswith("data:"):
            # Formato: data:image/png;base64,<dados>
            header, data = img_base64.split(",", 1)
            mime_type = header.split(":")[1].split(";")[0]
        else:
            mime_type = "image/png"
            data = img_base64

        parts.append({
            "inline_data": {
                "mime_type": mime_type,
                "data": data
            }
        })

    # Adiciona prompt
    parts.append({"text": prompt})

    generation_config = {"temperature": temperature}
    if max_tokens is not None:
        generation_config["maxOutputTokens"] = max_tokens

    # Configura nível de thinking para Gemini 3
    # - Gemini 3 Flash: suporta "minimal", "low", "medium", "high"
    # - Gemini 3 Pro: suporta apenas "low", "high"
    # - Gemini 2.x: não suporta thinkingConfig
    if thinking_level and model:
        model_lower = model.lower()
        if "gemini-3" in model_lower:
            if "flash" in model_lower:
                # Flash aceita todos os níveis
                valid_levels = ("minimal", "low", "medium", "high")
            else:
                # Pro aceita apenas low e high
                valid_levels = ("low", "high")

            if thinking_level in valid_levels:
                generation_config["thinkingConfig"] = {
                    "thinkingLevel": thinking_level
                }
            # Se nível inválido para o modelo, simplesmente ignora (usa default)

    payload = {
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": generation_config
    }

    if system_prompt:
        payload["systemInstruction"] = {
            "parts": [{"text": system_prompt}]
        }

    return payload


__all__ = [
    "build_payload",
    "build_payload_with_images",
]
