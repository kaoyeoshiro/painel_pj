"""
Adaptador para o classificador BERT - implementa DocumentClassifierProtocol.

Este adaptador wrappeia o BertClassifierClient legado e expõe uma interface
padronizada para uso pelos módulos de domínio.
"""

from typing import Optional, Dict, Any, List

from app.domain.shared.protocols import DocumentClassifierProtocol


class BertAdapter(DocumentClassifierProtocol):
    """
    Wrapper sobre BertClassifierClient que implementa a interface padrão.

    Permite que módulos de domínio dependam de DocumentClassifierProtocol
    em vez de importar diretamente o cliente BERT.

    Uso:
        adapter = BertAdapter()
        resultado = await adapter.classificar("Texto do documento...")
        # {"categoria": "contestacao", "confianca": 0.95, "alternativas": [...]}
    """

    def __init__(
        self,
        endpoint: Optional[str] = None,
        model_path: Optional[str] = None,
        model_name: Optional[str] = None
    ):
        """
        Inicializa o adaptador.

        Args:
            endpoint: URL do servidor BERT (opcional, usa BERT_ENDPOINT do ambiente)
            model_path: Caminho do modelo local (opcional, usa BERT_MODEL_PATH)
            model_name: Nome do modelo (opcional, usa BERT_MODEL_NAME)
        """
        # Import lazy para evitar ciclos e permitir testes
        from sistemas.extrator_autos.services_bert_client import BertClassifierClient

        self._client = BertClassifierClient(
            endpoint=endpoint,
            model_path=model_path,
            model_name=model_name
        )

    async def classificar(
        self,
        texto: str,
        model_name: Optional[str] = None,
        threshold: float = 0.5
    ) -> Dict[str, Any]:
        """
        Classifica um texto.

        Args:
            texto: Texto a classificar
            model_name: Nome do modelo (ex: "model_run_5")
            threshold: Limiar de confiança mínimo (0.0-1.0)

        Returns:
            {
                "categoria": str,
                "confianca": float,
                "alternativas": List[Dict] (opcional)
            }
        """
        # BertClassifierClient retorna:
        # {"predicted_label": str, "confidence": float, "source": str}
        result = await self._client.classify(texto, model_name=model_name)

        # Mapeia para formato do protocolo
        categoria = result.get("predicted_label", "")
        confianca = result.get("confidence", 0.0)

        # Se confiança abaixo do threshold, retorna categoria vazia
        if confianca < threshold:
            categoria = ""

        return {
            "categoria": categoria,
            "confianca": confianca,
            "alternativas": self._extrair_alternativas(result),
            "fonte": result.get("source", ""),
            "erro": result.get("error")
        }

    def _extrair_alternativas(self, result: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Extrai alternativas de classificação (se disponíveis).

        O BertClassifierClient atual não retorna alternativas,
        mas podemos adicionar suporte futuro aqui.
        """
        # Placeholder para futuras expansões
        # O cliente BERT pode ser estendido para retornar top-K classes
        return []
