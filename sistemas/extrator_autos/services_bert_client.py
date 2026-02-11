# sistemas/extrator_autos/services_bert_client.py
"""
Cliente BERT para classificacao de documentos processuais.

Suporta dois modos de operacao:
1. HTTP endpoint (BERT_ENDPOINT) - usa o inference_server.py existente
2. Modelo local (BERT_MODEL_PATH) - carrega modelo diretamente via torch

O modo HTTP e tentado primeiro; se indisponivel, usa fallback para modelo local.
"""

import asyncio
import logging
import os
import re
import unicodedata
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Constantes
DEFAULT_BERT_ENDPOINT = "http://127.0.0.1:8765"
HTTP_TIMEOUT_SECONDS = 30.0
MAX_TOKEN_LENGTH = 512

# Cache do modelo local (evita recarregar a cada chamada)
_local_model_cache: Dict[str, Any] = {}


class BertClassifierClient:
    """
    Cliente para classificacao de documentos via modelo BERT.

    Modos de operacao:
    - HTTP: envia texto ao inference_server.py (POST /predict)
    - Local: carrega modelo .pt diretamente com torch

    Uso:
        client = BertClassifierClient()
        result = await client.classify("texto do documento...")
        # {"predicted_label": "contestacao", "confidence": 0.95}
    """

    def __init__(
        self,
        endpoint: Optional[str] = None,
        model_path: Optional[str] = None,
        model_name: Optional[str] = None,
    ):
        self.endpoint = endpoint or os.getenv("BERT_ENDPOINT", DEFAULT_BERT_ENDPOINT)
        self.model_path = model_path or os.getenv("BERT_MODEL_PATH", "")
        self.model_name = model_name or os.getenv("BERT_MODEL_NAME", "")

    async def classify(self, text: str, model_name: Optional[str] = None) -> Dict[str, Any]:
        """
        Classifica um texto usando o modelo BERT.

        Tenta HTTP primeiro; se falhar, usa modelo local como fallback.

        Args:
            text: Texto do documento a classificar.
            model_name: Nome do modelo (ex: "model_run_5"). Se fornecido,
                        sobrepoe self.model_name para esta chamada.

        Returns:
            {"predicted_label": str, "confidence": float, "source": str}
            Em caso de erro, retorna {"predicted_label": "", "confidence": 0.0, "source": "error", "error": str}
        """
        if not text or not text.strip():
            return {
                "predicted_label": "",
                "confidence": 0.0,
                "source": "error",
                "error": "Texto vazio fornecido",
            }

        effective_model = model_name or self.model_name

        # Tenta HTTP primeiro
        http_result = await self._classify_http(text, effective_model)
        if http_result is not None:
            http_result["source"] = "http"
            return http_result

        # Fallback para modelo local
        local_result = await self._classify_local(text, effective_model)
        if local_result is not None:
            local_result["source"] = "local"
            return local_result

        return {
            "predicted_label": "",
            "confidence": 0.0,
            "source": "error",
            "error": "BERT indisponivel (HTTP e local falharam)",
        }

    async def check_health(self) -> Dict[str, Any]:
        """
        Verifica disponibilidade do servico BERT.

        Returns:
            {"available": bool, "mode": str, "error": str|None}
        """
        # Tenta HTTP
        http_health = await self._check_health_http()
        if http_health["available"]:
            return http_health

        # Tenta local
        local_health = self._check_health_local()
        if local_health["available"]:
            return local_health

        return {
            "available": False,
            "mode": "none",
            "error": http_health.get("error", "HTTP e local indisponiveis"),
        }

    @staticmethod
    def normalize_label(label: str) -> str:
        """
        Normaliza label para comparacao: remove acentos, lowercase, strip.

        Exemplos:
            "Contestacao" -> "contestacao"
            "Peticao Inicial" -> "peticao inicial"
            "SENTENCA"  -> "sentenca"
        """
        if not label:
            return ""
        # Remove acentos via decomposicao Unicode
        nfkd = unicodedata.normalize("NFKD", label)
        sem_acentos = "".join(c for c in nfkd if not unicodedata.combining(c))
        return sem_acentos.lower().strip()

    # ------------------------------------------------------------------
    # Metodos internos - HTTP
    # ------------------------------------------------------------------

    async def _classify_http(self, text: str, model_name: str = "") -> Optional[Dict[str, Any]]:
        """Classifica via endpoint HTTP. Retorna None se falhar."""
        try:
            import httpx
        except ImportError:
            logger.debug("httpx nao disponivel para classificacao HTTP")
            return None

        payload = {"text": text}
        if model_name:
            payload["model"] = model_name

        try:
            async with httpx.AsyncClient(timeout=HTTP_TIMEOUT_SECONDS) as client:
                response = await client.post(
                    f"{self.endpoint}/predict",
                    json=payload,
                )

            if response.status_code != 200:
                logger.warning(
                    "BERT HTTP retornou status %d: %s",
                    response.status_code,
                    response.text[:200],
                )
                return None

            data = response.json()
            return {
                "predicted_label": data.get("predicted_label", ""),
                "confidence": float(data.get("confidence", 0.0)),
            }

        except Exception as exc:
            logger.debug("BERT HTTP indisponivel: %s", exc)
            return None

    async def _check_health_http(self) -> Dict[str, Any]:
        """Verifica saude do endpoint HTTP via GET /models."""
        try:
            import httpx
        except ImportError:
            return {"available": False, "mode": "http", "error": "httpx nao instalado"}

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.endpoint}/models")

            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                return {
                    "available": True,
                    "mode": "http",
                    "endpoint": self.endpoint,
                    "models_count": len(models),
                    "error": None,
                }

            return {
                "available": False,
                "mode": "http",
                "error": f"Status {response.status_code}",
            }

        except Exception as exc:
            return {
                "available": False,
                "mode": "http",
                "error": str(exc),
            }

    # ------------------------------------------------------------------
    # Metodos internos - Modelo local
    # ------------------------------------------------------------------

    async def _classify_local(self, text: str, model_name: str = "") -> Optional[Dict[str, Any]]:
        """Classifica usando modelo carregado localmente. Retorna None se falhar."""
        # Se model_name fornecido, deriva model_path de bert_models/{model_name}/
        if model_name:
            model_dir = Path("bert_models") / model_name
        elif self.model_path:
            model_dir = Path(self.model_path)
        else:
            return None
        checkpoint_path = model_dir / "model.pt"

        if not checkpoint_path.exists():
            logger.debug("Checkpoint nao encontrado: %s", checkpoint_path)
            return None

        try:
            result = await asyncio.to_thread(
                self._predict_local_sync, model_dir, text
            )
            return result
        except Exception as exc:
            logger.error("Erro na classificacao local: %s", exc)
            return None

    def _predict_local_sync(self, model_dir: Path, text: str) -> Dict[str, Any]:
        """
        Execucao sincrona da predicao local. Chamado via to_thread.

        Carrega modelo com cache para evitar recarregamentos.
        """
        import torch
        from transformers import AutoTokenizer

        cache_key = str(model_dir)

        if cache_key not in _local_model_cache:
            _local_model_cache[cache_key] = self._load_model(model_dir)

        model_info = _local_model_cache[cache_key]
        if model_info is None:
            raise RuntimeError(f"Falha ao carregar modelo de {model_dir}")

        model = model_info["model"]
        tokenizer = model_info["tokenizer"]
        id_to_label = model_info["id_to_label"]
        device = model_info["device"]

        # Tokeniza
        encoding = tokenizer(
            text,
            max_length=MAX_TOKEN_LENGTH,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

        input_ids = encoding["input_ids"].to(device)
        attention_mask = encoding["attention_mask"].to(device)
        token_type_ids = encoding.get("token_type_ids")
        if token_type_ids is not None:
            token_type_ids = token_type_ids.to(device)

        # Predicao
        with torch.no_grad():
            logits = model(input_ids, attention_mask, token_type_ids)
            probabilities = torch.softmax(logits, dim=-1)
            predicted_id = torch.argmax(probabilities, dim=-1).item()
            confidence = probabilities[0][predicted_id].item()

        predicted_label = id_to_label.get(predicted_id, str(predicted_id))

        return {
            "predicted_label": predicted_label,
            "confidence": round(confidence, 4),
        }

    @staticmethod
    def _load_model(model_dir: Path) -> Optional[Dict[str, Any]]:
        """Carrega modelo BERT do disco. Retorna None em caso de erro."""
        try:
            import torch
            from transformers import AutoTokenizer
            from sistemas.bert_training.ml.classifier import BertClassifier

            checkpoint_path = model_dir / "model.pt"
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
            # SECURITY: Usa safe_torch_load para prevenir RCE via pickle deserialization
            from utils.safe_torch import safe_torch_load
            checkpoint = safe_torch_load(checkpoint_path, map_location=device)

            # Suporta ambos os formatos de checkpoint (legado e novo)
            base_model = (
                checkpoint.get("model_name")
                or checkpoint.get("base_model", "neuralmind/bert-base-portuguese-cased")
            )
            id_to_label = (
                checkpoint.get("label_map")
                or checkpoint.get("id_to_label")
            )

            if not id_to_label:
                logger.error("Checkpoint sem label_map nem id_to_label: %s", model_dir)
                return None

            num_labels = len(id_to_label)
            model = BertClassifier(base_model, num_labels)
            model.load_state_dict(checkpoint["model_state_dict"])
            model.to(device)
            model.eval()

            logger.info(
                "Modelo BERT local carregado: %s (%d labels)",
                model_dir.name,
                num_labels,
            )

            return {
                "model": model,
                "tokenizer": AutoTokenizer.from_pretrained(base_model),  # nosec B615 - modelo controlado internamente
                "id_to_label": id_to_label,
                "device": device,
            }

        except ImportError as exc:
            logger.warning("Dependencia ausente para modelo local: %s", exc)
            return None
        except Exception as exc:
            logger.error("Erro ao carregar modelo %s: %s", model_dir, exc)
            return None

    def _check_health_local(self) -> Dict[str, Any]:
        """Verifica se modelo local esta disponivel."""
        if not self.model_path:
            return {
                "available": False,
                "mode": "local",
                "error": "BERT_MODEL_PATH nao configurado",
            }

        model_dir = Path(self.model_path)
        checkpoint_path = model_dir / "model.pt"

        if not checkpoint_path.exists():
            return {
                "available": False,
                "mode": "local",
                "error": f"Arquivo nao encontrado: {checkpoint_path}",
            }

        return {
            "available": True,
            "mode": "local",
            "model_path": str(model_dir),
            "error": None,
        }
