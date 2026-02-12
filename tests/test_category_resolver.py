# tests/test_category_resolver.py
"""
Testes para a arquitetura de resolucao de categorias de documentos.

Cobre: SimpleCodeResolver, PrimeiroDocumentoResolver,
BertClassificationResolver, CategoryResolverFactory, resolve_all_categories.
"""

import pytest

pytestmark = pytest.mark.unit

from datetime import datetime

from sistemas.extrator_autos.services_category_resolver import (
    DocumentoCandidate,
    ResolutionResult,
    SimpleCodeResolver,
    PrimeiroDocumentoResolver,
    BertClassificationResolver,
    CategoryResolverFactory,
    resolve_all_categories,
    _normalizar_label,
)


# =============================================================================
# Mocks
# =============================================================================


class MockBertService:
    """Servico BERT simulado que retorna label configuravel."""

    def __init__(self, result_label="contestacao", confidence=0.95):
        self.result_label = result_label
        self.confidence = confidence
        self.calls = []

    async def classify(self, text, model_name=None):
        self.calls.append({"text": text, "model_name": model_name})
        return {
            "predicted_label": self.result_label,
            "confidence": self.confidence,
            "source": "bert_classifier",
        }


class FailingBertService:
    """Servico BERT que sempre falha com ConnectionError."""

    async def classify(self, text, model_name=None):
        raise ConnectionError("BERT service unavailable")


class MockCategoria:
    """Categoria de documento simulada (substitui modelo SQLAlchemy)."""

    def __init__(
        self,
        id,
        nome,
        codigos,
        is_primeiro=False,
        resolver_config=None,
        ativo=True,
    ):
        self.id = id
        self.nome = nome
        self.titulo = nome.title()
        self.codigos_documento = codigos
        self.is_primeiro_documento = is_primeiro
        self.resolver_config = resolver_config
        self.ativo = ativo

    def get_codigos(self):
        return self.codigos_documento or []


# =============================================================================
# Helpers
# =============================================================================


def _doc(id, codigo, data=None, ordem=0, texto=None):
    """Atalho para criar DocumentoCandidate."""
    return DocumentoCandidate(
        id=id,
        tipo_codigo=codigo,
        data_juntada=data,
        ordem=ordem,
        descricao=f"Documento {id}",
        texto=texto,
    )


# =============================================================================
# SimpleCodeResolver
# =============================================================================


class TestSimpleCodeResolver:
    """Testes do resolver padrao por codigo de documento."""

    @pytest.mark.asyncio
    async def test_match_por_codigo(self):
        """Documento com codigo presente na lista deve ser selecionado."""
        resolver = SimpleCodeResolver()
        docs = [_doc("d1", 500), _doc("d2", 9500)]

        result = await resolver.resolve(
            docs, [500], categoria_id=1, categoria_nome="Peticao"
        )

        assert result.documento_ids == ["d1"]
        assert result.metodo == "codigo"
        assert result.detalhes["total_matched"] == 1

    @pytest.mark.asyncio
    async def test_sem_match_quando_codigo_ausente(self):
        """Documento cujo codigo nao esta na lista nao deve ser selecionado."""
        resolver = SimpleCodeResolver()
        docs = [_doc("d1", 999)]

        result = await resolver.resolve(
            docs, [500, 9500], categoria_id=1, categoria_nome="Peticao"
        )

        assert result.documento_ids == []
        assert result.detalhes["total_matched"] == 0

    @pytest.mark.asyncio
    async def test_lista_documentos_vazia(self):
        """Lista vazia de documentos retorna resultado vazio."""
        resolver = SimpleCodeResolver()

        result = await resolver.resolve(
            [], [500], categoria_id=1, categoria_nome="Peticao"
        )

        assert result.documento_ids == []

    @pytest.mark.asyncio
    async def test_lista_codigos_vazia(self):
        """Lista vazia de codigos nao seleciona nenhum documento."""
        resolver = SimpleCodeResolver()
        docs = [_doc("d1", 500)]

        result = await resolver.resolve(
            docs, [], categoria_id=1, categoria_nome="Peticao"
        )

        assert result.documento_ids == []

    @pytest.mark.asyncio
    async def test_multiplos_documentos_com_match(self):
        """Varios documentos com codigos validos devem ser todos selecionados."""
        resolver = SimpleCodeResolver()
        docs = [
            _doc("d1", 500),
            _doc("d2", 9500),
            _doc("d3", 357),
            _doc("d4", 500),
        ]

        result = await resolver.resolve(
            docs, [500, 9500], categoria_id=1, categoria_nome="Peticao"
        )

        assert result.documento_ids == ["d1", "d2", "d4"]
        assert result.detalhes["total_matched"] == 3


# =============================================================================
# PrimeiroDocumentoResolver
# =============================================================================


class TestPrimeiroDocumentoResolver:
    """Testes do resolver que considera apenas o primeiro documento cronologico."""

    @pytest.mark.asyncio
    async def test_primeiro_doc_com_codigo_9500_match(self):
        """Primeiro documento cronologico com codigo 9500 deve ser selecionado."""
        resolver = PrimeiroDocumentoResolver()
        docs = [
            _doc("d1", 9500, datetime(2024, 1, 15)),
            _doc("d2", 357, datetime(2024, 1, 20)),
        ]

        result = await resolver.resolve(
            docs, [9500, 500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        assert result.documento_ids == ["d1"]
        assert result.metodo == "primeiro_cronologico"
        assert result.detalhes["match"] is True

    @pytest.mark.asyncio
    async def test_primeiro_doc_com_codigo_500_match(self):
        """Primeiro documento cronologico com codigo 500 deve ser selecionado."""
        resolver = PrimeiroDocumentoResolver()
        docs = [
            _doc("d1", 500, datetime(2024, 1, 10)),
            _doc("d2", 9500, datetime(2024, 2, 1)),
        ]

        result = await resolver.resolve(
            docs, [500, 9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        assert result.documento_ids == ["d1"]
        assert result.detalhes["primeiro_doc_elegivel_codigo"] == 500

    @pytest.mark.asyncio
    async def test_primeiro_doc_sem_codigo_valido_pula_para_segundo(self):
        """Se o primeiro documento nao tem codigo valido, itera ate encontrar elegivel."""
        resolver = PrimeiroDocumentoResolver()
        docs = [
            _doc("d1", 357, datetime(2024, 1, 1)),
            _doc("d2", 9500, datetime(2024, 1, 15)),
        ]

        result = await resolver.resolve(
            docs, [9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        # 357 nao e preparatorio nem elegivel — resolver itera e encontra 9500
        assert result.documento_ids == ["d2"]
        assert result.detalhes["match"] is True
        assert result.detalhes["primeiro_doc_absoluto_id"] == "d1"
        assert result.detalhes["primeiro_doc_elegivel_id"] == "d2"

    @pytest.mark.asyncio
    async def test_unico_documento_com_match(self):
        """Processo com um unico documento que tem codigo valido."""
        resolver = PrimeiroDocumentoResolver()
        docs = [_doc("d1", 9500, datetime(2024, 3, 1))]

        result = await resolver.resolve(
            docs, [9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        assert result.documento_ids == ["d1"]

    @pytest.mark.asyncio
    async def test_sem_documentos(self):
        """Processo sem documentos retorna vazio com motivo adequado."""
        resolver = PrimeiroDocumentoResolver()

        result = await resolver.resolve(
            [], [9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        assert result.documento_ids == []
        assert result.detalhes["motivo"] == "nenhum_documento_no_processo"

    @pytest.mark.asyncio
    async def test_documentos_com_data_none_usa_ordem(self):
        """Documentos sem data usam datetime.max, entao documentos com data vem antes."""
        resolver = PrimeiroDocumentoResolver()
        docs = [
            _doc("d_sem_data", 357, None, ordem=1),
            _doc("d_com_data", 9500, datetime(2024, 1, 1), ordem=2),
        ]

        result = await resolver.resolve(
            docs, [9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        # d_com_data vem primeiro (tem data real vs datetime.max)
        assert result.documento_ids == ["d_com_data"]
        assert result.detalhes["primeiro_doc_elegivel_id"] == "d_com_data"

    @pytest.mark.asyncio
    async def test_mesma_data_desempata_por_ordem(self):
        """Documentos com mesma data sao desempatados pela ordem."""
        resolver = PrimeiroDocumentoResolver()
        data = datetime(2024, 1, 15)
        docs = [
            _doc("d2", 357, data, ordem=5),
            _doc("d1", 9500, data, ordem=1),
        ]

        result = await resolver.resolve(
            docs, [9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        # d1 tem ordem=1, menor que d2 com ordem=5
        assert result.documento_ids == ["d1"]
        assert result.detalhes["primeiro_doc_elegivel_id"] == "d1"

    @pytest.mark.asyncio
    async def test_codigo_10_preparatorio_pula_para_500(self):
        """Codigo 10 (Termo) e preparatorio e deve ser pulado.
        Mesmo na lista de codigos, CODIGOS_PREPARATORIOS filtra.
        A PI real (500) subsequente e retornada."""
        resolver = PrimeiroDocumentoResolver()
        docs = [
            _doc("d1", 10, datetime(2024, 1, 1)),
            _doc("d2", 500, datetime(2024, 2, 1)),
        ]

        result = await resolver.resolve(
            docs, [10, 500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        assert result.documento_ids == ["d2"]
        assert result.detalhes["primeiro_doc_absoluto_id"] == "d1"
        assert result.detalhes["primeiro_doc_absoluto_codigo"] == 10
        assert result.detalhes["primeiro_doc_elegivel_id"] == "d2"
        assert result.detalhes["primeiro_doc_elegivel_codigo"] == 500
        assert result.detalhes["codigos_preparatorios_pulados"] == 1


    @pytest.mark.asyncio
    async def test_multiplos_codigo_10_pula_todos(self):
        """Multiplos documentos preparatorios (codigo 10) sao todos pulados."""
        resolver = PrimeiroDocumentoResolver()
        docs = [
            _doc("d1", 10, datetime(2024, 1, 1)),
            _doc("d2", 10, datetime(2024, 1, 5)),
            _doc("d3", 10, datetime(2024, 1, 10)),
            _doc("d4", 500, datetime(2024, 2, 1)),
        ]

        result = await resolver.resolve(
            docs, [500, 9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        assert result.documento_ids == ["d4"]
        assert result.detalhes["codigos_preparatorios_pulados"] == 3
        assert result.detalhes["primeiro_doc_absoluto_codigo"] == 10
        assert result.detalhes["primeiro_doc_elegivel_codigo"] == 500

    @pytest.mark.asyncio
    async def test_somente_codigo_10_sem_elegivel(self):
        """Processo com apenas documentos preparatorios retorna vazio."""
        resolver = PrimeiroDocumentoResolver()
        docs = [
            _doc("d1", 10, datetime(2024, 1, 1)),
            _doc("d2", 10, datetime(2024, 1, 5)),
        ]

        result = await resolver.resolve(
            docs, [500, 9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        assert result.documento_ids == []
        assert result.detalhes["match"] is False
        assert result.detalhes["codigos_preparatorios_pulados"] == 2

    @pytest.mark.asyncio
    async def test_sem_codigo_10_comportamento_normal(self):
        """Sequencia sem codigo 10 — primeiro doc elegivel e retornado."""
        resolver = PrimeiroDocumentoResolver()
        docs = [
            _doc("d1", 9500, datetime(2024, 1, 1)),
            _doc("d2", 500, datetime(2024, 2, 1)),
        ]

        result = await resolver.resolve(
            docs, [500, 9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        assert result.documento_ids == ["d1"]
        assert result.detalhes["codigos_preparatorios_pulados"] == 0
        assert result.detalhes["primeiro_doc_absoluto_id"] == "d1"
        assert result.detalhes["primeiro_doc_elegivel_id"] == "d1"

    @pytest.mark.asyncio
    async def test_doc_nao_candidato_nao_preparatorio_continua_iterando(self):
        """Documento com codigo nao-candidato e nao-preparatorio e ignorado
        mas nao conta como preparatorio pulado."""
        resolver = PrimeiroDocumentoResolver()
        docs = [
            _doc("d1", 357, datetime(2024, 1, 1)),   # Nao candidato, nao preparatorio
            _doc("d2", 9500, datetime(2024, 1, 15)),  # Elegivel
        ]

        result = await resolver.resolve(
            docs, [500, 9500], categoria_id=1, categoria_nome="Peticao Inicial"
        )

        assert result.documento_ids == ["d2"]
        assert result.detalhes["codigos_preparatorios_pulados"] == 0


# =============================================================================
# BertClassificationResolver
# =============================================================================


class TestBertClassificationResolver:
    """Testes do resolver que usa classificacao BERT para documentos ambiguos."""

    @pytest.mark.asyncio
    async def test_codigo_direto_sempre_match_sem_bert(self):
        """Codigos diretos sao incluidos imediatamente, sem necessidade de BERT."""
        resolver = BertClassificationResolver()
        docs = [_doc("d1", 8320, texto="texto qualquer")]
        config = {
            "type": "bert",
            "codigos_diretos": [8320],
            "codigos_bert": [8326],
            "label_match": "contestacao",
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
        )

        assert "d1" in result.documento_ids
        assert result.metodo == "bert"
        assert result.detalhes["total_diretos"] == 1

    @pytest.mark.asyncio
    async def test_codigo_bert_com_label_match(self):
        """Codigo BERT que recebe label correta deve ser selecionado."""
        bert = MockBertService(result_label="contestacao", confidence=0.95)
        resolver = BertClassificationResolver()
        docs = [_doc("d1", 8326, texto="Texto da contestacao")]
        config = {
            "type": "bert",
            "codigos_diretos": [8320],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            "model_run_id": 5,
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=bert,
        )

        assert "d1" in result.documento_ids
        assert result.bert_predictions is not None
        assert result.bert_predictions[0]["match"] is True
        assert len(bert.calls) == 1
        assert bert.calls[0]["text"] == "Texto da contestacao"

    @pytest.mark.asyncio
    async def test_codigo_bert_com_label_diferente_nao_match(self):
        """Codigo BERT com label diferente da esperada nao deve ser selecionado."""
        bert = MockBertService(result_label="peticao", confidence=0.90)
        resolver = BertClassificationResolver()
        docs = [_doc("d1", 500, texto="Texto de peticao")]
        config = {
            "type": "bert",
            "codigos_diretos": [],
            "codigos_bert": [500],
            "label_match": "contestacao",
            "model_run_id": 5,
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=bert,
        )

        assert result.documento_ids == []
        assert result.bert_predictions[0]["match"] is False

    @pytest.mark.asyncio
    async def test_label_com_acento_normaliza_para_match(self):
        """Label 'Contestacao' (com cedilha) normaliza para 'contestacao'."""
        bert = MockBertService(result_label="Contestação", confidence=0.92)
        resolver = BertClassificationResolver()
        docs = [_doc("d1", 8326, texto="Texto")]
        config = {
            "type": "bert",
            "codigos_diretos": [],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            "model_run_id": 5,
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=bert,
        )

        assert "d1" in result.documento_ids
        assert result.bert_predictions[0]["label_normalizada"] == "contestacao"

    @pytest.mark.asyncio
    async def test_label_uppercase_normaliza_para_match(self):
        """Label 'CONTESTACAO' (uppercase) normaliza para 'contestacao'."""
        bert = MockBertService(result_label="CONTESTACAO", confidence=0.88)
        resolver = BertClassificationResolver()
        docs = [_doc("d1", 8326, texto="Texto")]
        config = {
            "type": "bert",
            "codigos_diretos": [],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            "model_run_id": 5,
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=bert,
        )

        assert "d1" in result.documento_ids

    @pytest.mark.asyncio
    async def test_bert_service_none_retorna_apenas_diretos(self):
        """Sem servico BERT, retorna apenas matches diretos sem erro."""
        resolver = BertClassificationResolver()
        docs = [
            _doc("d1", 8320, texto="Texto direto"),
            _doc("d2", 8326, texto="Texto que precisaria de BERT"),
        ]
        config = {
            "type": "bert",
            "codigos_diretos": [8320],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            "model_run_id": 5,
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=None,
        )

        assert result.documento_ids == ["d1"]
        assert result.detalhes["bert_status"] == "servico_indisponivel"
        assert result.bert_predictions is None

    @pytest.mark.asyncio
    async def test_bert_service_com_excecao_nao_quebra(self):
        """Erro no servico BERT nao deve propagar excecao; retorna diretos."""
        bert = FailingBertService()
        resolver = BertClassificationResolver()
        docs = [
            _doc("d1", 8320, texto="Direto"),
            _doc("d2", 8326, texto="Candidato BERT"),
        ]
        config = {
            "type": "bert",
            "codigos_diretos": [8320],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            "model_run_id": 5,
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=bert,
        )

        # Match direto mantido; candidato BERT falhou sem crash
        assert "d1" in result.documento_ids
        assert "d2" not in result.documento_ids
        assert result.bert_predictions is not None
        assert result.bert_predictions[0]["match"] is False
        assert "bert_erro" in result.bert_predictions[0]

    @pytest.mark.asyncio
    async def test_candidato_sem_texto_incluso_como_pendente(self):
        """Candidato BERT sem texto (preview mode) deve ser incluido como pendente."""
        bert = MockBertService(result_label="contestacao", confidence=0.95)
        resolver = BertClassificationResolver()
        docs = [
            _doc("d1", 8320, texto="Direto"),
            _doc("d2", 8326),  # texto=None (preview mode)
            _doc("d3", 500),   # texto=None (preview mode)
        ]
        config = {
            "type": "bert",
            "codigos_diretos": [8320],
            "codigos_bert": [8326, 500],
            "label_match": "contestacao",
            "model_run_id": 5,
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=bert,
        )

        # Direto + 2 candidatos pendentes = 3 docs
        assert "d1" in result.documento_ids
        assert "d2" in result.documento_ids
        assert "d3" in result.documento_ids
        assert result.detalhes["total_diretos"] == 1
        # BERT nao deve ter sido chamado (texto=None → candidato_pendente)
        assert len(bert.calls) == 0
        # Predictions devem indicar candidato_pendente_bert
        assert result.bert_predictions is not None
        for pred in result.bert_predictions:
            assert pred["motivo"] == "candidato_pendente_bert"
            assert pred["match"] is True

    @pytest.mark.asyncio
    async def test_codigo_fora_das_listas_ignorado(self):
        """Documento com codigo que nao esta em diretos nem em bert e ignorado."""
        bert = MockBertService()
        resolver = BertClassificationResolver()
        docs = [_doc("d1", 999, texto="Texto qualquer")]
        config = {
            "type": "bert",
            "codigos_diretos": [8320],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            "model_run_id": 5,
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=bert,
        )

        assert result.documento_ids == []
        assert len(bert.calls) == 0

    @pytest.mark.asyncio
    async def test_bert_resolver_usa_model_name_da_config(self):
        """model_run_id na resolver_config e convertido para model_name e passado ao classify."""
        bert = MockBertService(result_label="contestacao", confidence=0.95)
        resolver = BertClassificationResolver()
        docs = [_doc("d1", 8326, texto="Texto de contestacao")]
        config = {
            "type": "bert",
            "codigos_diretos": [8320],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            "model_run_id": 5,
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=bert,
        )

        assert "d1" in result.documento_ids
        assert len(bert.calls) == 1
        assert bert.calls[0]["model_name"] == "model_run_5"
        assert result.detalhes["model_run_id"] == 5
        assert result.detalhes["model_name"] == "model_run_5"

    @pytest.mark.asyncio
    async def test_bert_resolver_sem_model_run_id_warning(self):
        """Sem model_run_id na config, candidatos sao pendentes e bert_status = modelo_nao_configurado."""
        bert = MockBertService()
        resolver = BertClassificationResolver()
        docs = [
            _doc("d1", 8320, texto="Direto"),
            _doc("d2", 8326, texto="Candidato"),
        ]
        config = {
            "type": "bert",
            "codigos_diretos": [8320],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            # model_run_id ausente!
        }

        result = await resolver.resolve(
            docs,
            [],
            categoria_id=10,
            categoria_nome="Contestacao",
            resolver_config=config,
            bert_service=bert,
        )

        assert result.detalhes["bert_status"] == "modelo_nao_configurado"
        # Direto (d1) + candidato pendente (d2)
        assert "d1" in result.documento_ids
        assert "d2" in result.documento_ids
        # BERT nao foi chamado
        assert len(bert.calls) == 0
        # Predictions indicam pendente
        assert result.bert_predictions is not None
        assert result.bert_predictions[0]["motivo"] == "candidato_pendente_bert"

    @pytest.mark.asyncio
    async def test_bert_resolver_coexistencia_modelos(self):
        """Duas categorias BERT com modelos diferentes resolvem com model_name correto."""
        bert = MockBertService(result_label="contestacao", confidence=0.95)
        resolver = BertClassificationResolver()
        docs = [_doc("d1", 8326, texto="Texto")]

        # Categoria 1: modelo run 5
        config_1 = {
            "type": "bert",
            "codigos_diretos": [],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            "model_run_id": 5,
        }
        result_1 = await resolver.resolve(
            docs, [], categoria_id=10, categoria_nome="Contestacao",
            resolver_config=config_1, bert_service=bert,
        )

        # Categoria 2: modelo run 12
        config_2 = {
            "type": "bert",
            "codigos_diretos": [],
            "codigos_bert": [8326],
            "label_match": "contestacao",
            "model_run_id": 12,
        }
        result_2 = await resolver.resolve(
            docs, [], categoria_id=20, categoria_nome="Contestacao v2",
            resolver_config=config_2, bert_service=bert,
        )

        assert bert.calls[0]["model_name"] == "model_run_5"
        assert bert.calls[1]["model_name"] == "model_run_12"
        assert result_1.detalhes["model_name"] == "model_run_5"
        assert result_2.detalhes["model_name"] == "model_run_12"


# =============================================================================
# CategoryResolverFactory
# =============================================================================


class TestCategoryResolverFactory:
    """Testes da factory que seleciona o resolver correto por categoria."""

    def test_categoria_com_resolver_config_bert(self):
        """Categoria com resolver_config type=bert retorna BertClassificationResolver."""
        cat = MockCategoria(
            id=10,
            nome="Contestacao",
            codigos=[8320, 8326],
            resolver_config={"type": "bert", "codigos_diretos": [8320]},
        )

        resolver = CategoryResolverFactory.create(cat)

        assert isinstance(resolver, BertClassificationResolver)

    def test_categoria_com_is_primeiro_documento(self):
        """Categoria com is_primeiro_documento=True retorna PrimeiroDocumentoResolver."""
        cat = MockCategoria(
            id=1,
            nome="Peticao Inicial",
            codigos=[500, 9500],
            is_primeiro=True,
        )

        resolver = CategoryResolverFactory.create(cat)

        assert isinstance(resolver, PrimeiroDocumentoResolver)

    def test_categoria_sem_configuracao_especial(self):
        """Categoria sem config especial retorna SimpleCodeResolver (padrao)."""
        cat = MockCategoria(
            id=5,
            nome="Sentenca",
            codigos=[3000],
        )

        resolver = CategoryResolverFactory.create(cat)

        assert isinstance(resolver, SimpleCodeResolver)

    def test_categoria_com_resolver_config_tipo_desconhecido(self):
        """Categoria com type desconhecido em resolver_config usa SimpleCodeResolver."""
        cat = MockCategoria(
            id=99,
            nome="Experimental",
            codigos=[1234],
            resolver_config={"type": "tipo_inexistente"},
        )

        resolver = CategoryResolverFactory.create(cat)

        assert isinstance(resolver, SimpleCodeResolver)


# =============================================================================
# resolve_all_categories
# =============================================================================


class TestResolveAllCategories:
    """Testes da funcao que resolve todas as categorias de uma vez."""

    @pytest.mark.asyncio
    async def test_multiplas_categorias_uniao_de_ids(self):
        """Resultado final deve conter uniao dos IDs de todas as categorias."""
        docs = [
            _doc("d1", 500, datetime(2024, 1, 1)),
            _doc("d2", 3000, datetime(2024, 1, 5)),
            _doc("d3", 500, datetime(2024, 1, 10)),
        ]
        categorias = [
            MockCategoria(id=1, nome="Peticao", codigos=[500]),
            MockCategoria(id=2, nome="Sentenca", codigos=[3000]),
        ]

        all_ids, results = await resolve_all_categories(docs, categorias)

        assert all_ids == {"d1", "d2", "d3"}
        assert len(results) == 2
        assert results[0].categoria_nome == "Peticao"
        assert results[1].categoria_nome == "Sentenca"

    @pytest.mark.asyncio
    async def test_mix_simple_e_primeiro_documento(self):
        """Combinacao de SimpleCodeResolver e PrimeiroDocumentoResolver."""
        docs = [
            _doc("d1", 9500, datetime(2024, 1, 1)),
            _doc("d2", 3000, datetime(2024, 1, 5)),
        ]
        categorias = [
            MockCategoria(
                id=1,
                nome="Peticao Inicial",
                codigos=[9500, 500],
                is_primeiro=True,
            ),
            MockCategoria(id=2, nome="Sentenca", codigos=[3000]),
        ]

        all_ids, results = await resolve_all_categories(docs, categorias)

        # PrimeiroDocumentoResolver: d1 e o primeiro e tem codigo 9500
        assert "d1" in all_ids
        # SimpleCodeResolver: d2 tem codigo 3000
        assert "d2" in all_ids
        assert len(results) == 2

    @pytest.mark.asyncio
    async def test_lista_categorias_vazia(self):
        """Lista vazia de categorias retorna conjunto vazio e lista vazia."""
        docs = [_doc("d1", 500)]

        all_ids, results = await resolve_all_categories(docs, [])

        assert all_ids == set()
        assert results == []


# =============================================================================
# _normalizar_label (funcao utilitaria)
# =============================================================================


class TestNormalizarLabel:
    """Testes da funcao auxiliar de normalizacao de labels BERT."""

    def test_remove_acentos(self):
        assert _normalizar_label("Contestação") == "contestacao"

    def test_converte_para_lowercase(self):
        assert _normalizar_label("CONTESTACAO") == "contestacao"

    def test_remove_espacos_laterais(self):
        assert _normalizar_label("  contestacao  ") == "contestacao"

    def test_string_vazia(self):
        assert _normalizar_label("") == ""

    def test_label_ja_normalizada(self):
        assert _normalizar_label("contestacao") == "contestacao"
