# sistemas/extrator_autos/services_category_resolver.py
"""
Arquitetura extensivel de resolucao de categorias de documentos.

Cada CategoriaDocumento pode ter um resolver diferente:
- SimpleCodeResolver: match direto por tipo_codigo (padrao)
- PrimeiroDocumentoResolver: primeiro documento cronologico do processo
- BertClassificationResolver: classificacao BERT para documentos ambiguos

O CategoryResolverFactory seleciona o resolver correto baseado na
configuracao da categoria (resolver_config, is_primeiro_documento).
"""

import logging
import unicodedata
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)


# =============================================================================
# Dataclasses
# =============================================================================

@dataclass
class DocumentoCandidate:
    """Documento candidato para resolucao de categoria."""

    id: str
    tipo_codigo: int
    data_juntada: Optional[datetime] = None
    ordem: int = 0
    descricao: Optional[str] = None
    texto: Optional[str] = None  # Populado sob demanda para BERT


@dataclass
class ResolutionResult:
    """Resultado da resolucao de uma categoria."""

    categoria_id: int
    categoria_nome: str
    documento_ids: List[str]
    metodo: str  # "codigo", "primeiro_cronologico", "bert"
    detalhes: Dict[str, Any] = field(default_factory=dict)
    bert_predictions: Optional[List[Dict[str, Any]]] = None


# =============================================================================
# Base abstrata
# =============================================================================

class BaseCategoryResolver(ABC):
    """Classe base para resolvers de categoria de documento."""

    @abstractmethod
    async def resolve(
        self,
        documentos: List[DocumentoCandidate],
        codigos: List[int],
        **kwargs,
    ) -> ResolutionResult:
        """Resolve quais documentos pertencem a uma categoria.

        Args:
            documentos: Lista de todos os documentos do processo.
            codigos: Codigos de documento da categoria.
            **kwargs: Parametros adicionais (categoria_id, categoria_nome, etc).

        Returns:
            ResolutionResult com os documentos selecionados.
        """

    @property
    @abstractmethod
    def resolver_type(self) -> str:
        """Identificador do tipo de resolver."""


# =============================================================================
# SimpleCodeResolver
# =============================================================================

class SimpleCodeResolver(BaseCategoryResolver):
    """Resolver padrao: seleciona documentos cujo tipo_codigo esta na lista."""

    @property
    def resolver_type(self) -> str:
        return "codigo"

    async def resolve(
        self,
        documentos: List[DocumentoCandidate],
        codigos: List[int],
        **kwargs,
    ) -> ResolutionResult:
        codigos_set = set(codigos)
        matched_ids = [
            doc.id for doc in documentos
            if doc.tipo_codigo in codigos_set
        ]

        return ResolutionResult(
            categoria_id=kwargs.get("categoria_id", 0),
            categoria_nome=kwargs.get("categoria_nome", ""),
            documento_ids=matched_ids,
            metodo=self.resolver_type,
            detalhes={
                "codigos_usados": codigos,
                "total_matched": len(matched_ids),
            },
        )


# =============================================================================
# PrimeiroDocumentoResolver
# =============================================================================

class PrimeiroDocumentoResolver(BaseCategoryResolver):
    """Resolver para categorias que consideram apenas o primeiro documento ELEGIVEL.

    Logica: entre TODOS os documentos do processo (ordenados cronologicamente),
    encontra o PRIMEIRO cujo tipo_codigo esteja na lista da categoria,
    desconsiderando documentos preparatorios (ex: codigo 10/Termo).

    REGRA DE FRONTEIRA (documentos preparatorios):
        Sequencia comum em processos antigos:
            [10 (Termo)] -> [500 (Peticao)] -> [outros docs]

        O codigo 10 e um documento formal/preparatorio. Ele NAO e a
        Peticao Inicial. A primeira peticao SUBSTANCIAL subsequente e a PI real.

        Documentos preparatorios sao definidos em CODIGOS_PREPARATORIOS e podem
        ser estendidos no futuro se outros codigos similares forem identificados.

    Usado para "Peticao Inicial" onde o interesse e encontrar o primeiro
    documento substancial elegivel do processo.
    """

    # Codigos de documentos preparatorios/formais que precedem a peticao
    # real e devem ser ignorados na busca pelo "primeiro documento".
    # Facilmente extensivel: basta adicionar novos codigos aqui.
    CODIGOS_PREPARATORIOS: frozenset = frozenset({10})

    @property
    def resolver_type(self) -> str:
        return "primeiro_cronologico"

    async def resolve(
        self,
        documentos: List[DocumentoCandidate],
        codigos: List[int],
        **kwargs,
    ) -> ResolutionResult:
        categoria_id = kwargs.get("categoria_id", 0)
        categoria_nome = kwargs.get("categoria_nome", "")

        if not documentos:
            return ResolutionResult(
                categoria_id=categoria_id,
                categoria_nome=categoria_nome,
                documento_ids=[],
                metodo=self.resolver_type,
                detalhes={"motivo": "nenhum_documento_no_processo"},
            )

        # Ordena por data_juntada ASC (None vai para o final), depois ordem ASC
        def sort_key(doc: DocumentoCandidate):
            dt = doc.data_juntada if doc.data_juntada else datetime.max
            return (dt, doc.ordem)

        docs_ordenados = sorted(documentos, key=sort_key)

        # Codigos elegiveis = codigos da categoria MENOS preparatorios.
        # Safety net: mesmo que codigo 10 esteja na config por engano,
        # sera filtrado aqui.
        codigos_elegiveis = set(codigos) - self.CODIGOS_PREPARATORIOS

        # Itera em ordem cronologica ate encontrar o primeiro doc elegivel.
        # Documentos preparatorios (ex: codigo 10) sao pulados.
        primeiro_elegivel = None
        primeiro_doc_absoluto = docs_ordenados[0]
        docs_preparatorios_pulados = 0

        for doc in docs_ordenados:
            if doc.tipo_codigo in codigos_elegiveis:
                primeiro_elegivel = doc
                break
            if doc.tipo_codigo in self.CODIGOS_PREPARATORIOS:
                docs_preparatorios_pulados += 1

        matched = primeiro_elegivel is not None
        matched_ids = [primeiro_elegivel.id] if matched else []

        return ResolutionResult(
            categoria_id=categoria_id,
            categoria_nome=categoria_nome,
            documento_ids=matched_ids,
            metodo=self.resolver_type,
            detalhes={
                "primeiro_doc_absoluto_id": primeiro_doc_absoluto.id,
                "primeiro_doc_absoluto_codigo": primeiro_doc_absoluto.tipo_codigo,
                "primeiro_doc_elegivel_id": (
                    primeiro_elegivel.id if primeiro_elegivel else None
                ),
                "primeiro_doc_elegivel_codigo": (
                    primeiro_elegivel.tipo_codigo if primeiro_elegivel else None
                ),
                "primeiro_doc_elegivel_data": (
                    primeiro_elegivel.data_juntada.isoformat()
                    if primeiro_elegivel and primeiro_elegivel.data_juntada
                    else None
                ),
                "codigos_esperados": codigos,
                "codigos_preparatorios_pulados": docs_preparatorios_pulados,
                "match": matched,
            },
        )


# =============================================================================
# BertClassificationResolver
# =============================================================================

def _normalizar_label(label: str) -> str:
    """Normaliza label BERT removendo acentos e convertendo para lowercase."""
    normalizado = unicodedata.normalize("NFKD", label)
    ascii_only = normalizado.encode("ASCII", "ignore").decode("ASCII")
    return ascii_only.lower().strip()


class BertClassificationResolver(BaseCategoryResolver):
    """Resolver que usa classificacao BERT para documentos ambiguos.

    Configuracao via resolver_config:
        - codigos_diretos: codigos que sempre sao incluidos (match imediato)
        - codigos_bert: codigos que precisam de classificacao BERT
        - label_match: label esperada na predicao BERT

    Se o servico BERT nao estiver disponivel ou falhar, retorna apenas
    os matches diretos e registra o erro nos detalhes.
    """

    @property
    def resolver_type(self) -> str:
        return "bert"

    async def resolve(
        self,
        documentos: List[DocumentoCandidate],
        codigos: List[int],
        **kwargs,
    ) -> ResolutionResult:
        categoria_id = kwargs.get("categoria_id", 0)
        categoria_nome = kwargs.get("categoria_nome", "")
        resolver_config = kwargs.get("resolver_config", {}) or {}
        bert_service = kwargs.get("bert_service")

        codigos_diretos = set(resolver_config.get("codigos_diretos", []))
        codigos_bert = set(resolver_config.get("codigos_bert", []))
        label_match = resolver_config.get("label_match", "")
        label_match_normalizado = _normalizar_label(label_match)

        # Extrair model_name da config (modelo BERT associado a esta categoria)
        model_run_id = resolver_config.get("model_run_id")
        model_name = f"model_run_{model_run_id}" if model_run_id else None

        # Fase 1: matches diretos
        matched_ids: List[str] = []
        candidatos_bert: List[DocumentoCandidate] = []

        for doc in documentos:
            if doc.tipo_codigo in codigos_diretos:
                matched_ids.append(doc.id)
            elif doc.tipo_codigo in codigos_bert:
                candidatos_bert.append(doc)

        detalhes: Dict[str, Any] = {
            "codigos_diretos": sorted(codigos_diretos),
            "codigos_bert": sorted(codigos_bert),
            "label_match": label_match,
            "model_run_id": model_run_id,
            "model_name": model_name,
            "total_diretos": len(matched_ids),
            "total_candidatos_bert": len(candidatos_bert),
        }
        predictions: List[Dict[str, Any]] = []

        # Fase 2: classificacao BERT
        if not candidatos_bert:
            detalhes["bert_status"] = "sem_candidatos"
        elif not model_run_id and candidatos_bert:
            logger.warning(
                "Categoria '%s' requer BERT mas nenhum modelo configurado "
                "(model_run_id ausente em resolver_config). "
                "Candidatos incluidos como pendentes.",
                categoria_nome,
            )
            detalhes["bert_status"] = "modelo_nao_configurado"
            # Inclui candidatos como pendentes para que aparecam no preview
            for doc in candidatos_bert:
                prediction = {
                    "doc_id": doc.id,
                    "tipo_codigo": doc.tipo_codigo,
                    "match": True,
                    "motivo": "candidato_pendente_bert",
                }
                predictions.append(prediction)
                matched_ids.append(doc.id)
        elif bert_service is None:
            logger.warning(
                "BERT service indisponivel para categoria '%s' - "
                "retornando apenas matches diretos (%d docs)",
                categoria_nome,
                len(matched_ids),
            )
            detalhes["bert_status"] = "servico_indisponivel"
        else:
            detalhes["bert_status"] = "executado"
            for doc in candidatos_bert:
                prediction = await self._classificar_documento(
                    doc, bert_service, label_match_normalizado,
                    model_name=model_name,
                )
                predictions.append(prediction)
                if prediction.get("match"):
                    matched_ids.append(doc.id)

        detalhes["total_final"] = len(matched_ids)

        return ResolutionResult(
            categoria_id=categoria_id,
            categoria_nome=categoria_nome,
            documento_ids=matched_ids,
            metodo=self.resolver_type,
            detalhes=detalhes,
            bert_predictions=predictions if predictions else None,
        )

    async def _classificar_documento(
        self,
        doc: DocumentoCandidate,
        bert_service: Any,
        label_esperada: str,
        model_name: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Classifica um documento individual via BERT.

        Retorna dict com resultado da predicao para audit trail.
        Nunca levanta excecao - erros sao registrados no resultado.
        """
        prediction: Dict[str, Any] = {
            "doc_id": doc.id,
            "tipo_codigo": doc.tipo_codigo,
        }

        if not doc.texto:
            # Preview mode: sem texto ainda (PDF nao baixado).
            # Inclui como candidato para que apareca no preview.
            # A classificacao real acontece no download (pos-download BERT).
            prediction.update({
                "match": True,
                "motivo": "candidato_pendente_bert",
            })
            return prediction

        try:
            resultado = await bert_service.classify(doc.texto, model_name=model_name)

            label_raw = resultado.get("predicted_label", "")
            confidence = resultado.get("confidence", 0.0)
            label_normalizada = _normalizar_label(label_raw)

            is_match = label_normalizada == label_esperada

            prediction.update({
                "label_raw": label_raw,
                "label_normalizada": label_normalizada,
                "confidence": confidence,
                "match": is_match,
                "label_esperada": label_esperada,
            })

        except Exception as e:
            logger.error(
                "Erro BERT para documento %s: %s", doc.id, str(e)
            )
            prediction.update({
                "match": False,
                "bert_erro": str(e),
            })

        return prediction


# =============================================================================
# Factory
# =============================================================================

# Registro de resolvers por tipo
_RESOLVER_REGISTRY: Dict[str, type] = {
    "codigo": SimpleCodeResolver,
    "primeiro_cronologico": PrimeiroDocumentoResolver,
    "bert": BertClassificationResolver,
}


class CategoryResolverFactory:
    """Factory que seleciona o resolver correto para cada CategoriaDocumento.

    Ordem de selecao:
    1. Se resolver_config tem chave "type" -> usa o resolver correspondente
    2. Se is_primeiro_documento=True -> PrimeiroDocumentoResolver
    3. Default -> SimpleCodeResolver
    """

    @staticmethod
    def create(categoria) -> BaseCategoryResolver:
        """Cria o resolver adequado para uma CategoriaDocumento.

        Args:
            categoria: Instancia de CategoriaDocumento (ou objeto com
                       resolver_config e is_primeiro_documento).

        Returns:
            Instancia do resolver apropriado.
        """
        resolver_config = getattr(categoria, "resolver_config", None)

        if resolver_config and isinstance(resolver_config, dict):
            resolver_type = resolver_config.get("type")
            if resolver_type and resolver_type in _RESOLVER_REGISTRY:
                logger.debug(
                    "Categoria '%s': resolver via config -> %s",
                    getattr(categoria, "nome", "?"),
                    resolver_type,
                )
                return _RESOLVER_REGISTRY[resolver_type]()

        is_primeiro = getattr(categoria, "is_primeiro_documento", False)
        if is_primeiro:
            logger.debug(
                "Categoria '%s': resolver -> primeiro_cronologico",
                getattr(categoria, "nome", "?"),
            )
            return PrimeiroDocumentoResolver()

        return SimpleCodeResolver()


# =============================================================================
# Funcao auxiliar para resolver todas as categorias
# =============================================================================

async def resolve_all_categories(
    documentos: List[DocumentoCandidate],
    categorias: list,
    bert_service=None,
) -> Tuple[Set[str], List[ResolutionResult]]:
    """Resolve todas as categorias e retorna uniao de IDs + resultados por categoria.

    Args:
        documentos: Lista de DocumentoCandidate do processo.
        categorias: Lista de CategoriaDocumento (ou objetos compatíveis).
        bert_service: Servico BERT opcional (com metodo async classify).

    Returns:
        Tupla com:
        - Set de IDs de documentos selecionados (uniao de todas as categorias)
        - Lista de ResolutionResult por categoria
    """
    all_doc_ids: Set[str] = set()
    results: List[ResolutionResult] = []

    for categoria in categorias:
        resolver = CategoryResolverFactory.create(categoria)
        codigos = (
            categoria.get_codigos()
            if hasattr(categoria, "get_codigos")
            else getattr(categoria, "codigos_documento", []) or []
        )

        categoria_id = getattr(categoria, "id", 0)
        categoria_nome = getattr(categoria, "nome", "")
        resolver_config = getattr(categoria, "resolver_config", None)

        logger.info(
            "Resolvendo categoria '%s' (id=%s) com %s",
            categoria_nome,
            categoria_id,
            resolver.resolver_type,
        )

        result = await resolver.resolve(
            documentos=documentos,
            codigos=codigos,
            categoria_id=categoria_id,
            categoria_nome=categoria_nome,
            resolver_config=resolver_config,
            bert_service=bert_service,
        )

        results.append(result)
        all_doc_ids.update(result.documento_ids)

        logger.info(
            "Categoria '%s': %d documento(s) selecionado(s) via %s",
            categoria_nome,
            len(result.documento_ids),
            result.metodo,
        )

    return all_doc_ids, results
