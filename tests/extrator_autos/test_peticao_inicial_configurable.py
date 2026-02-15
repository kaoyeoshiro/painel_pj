# tests/test_peticao_inicial_configurable.py
"""
Testes para validar que Petição Inicial é totalmente config-driven.

Cenários cobertos:
1. Processo antigo com código não-padrão configurado no admin
2. Múltiplos candidatos — apenas o primeiro cronológico vence
3. Primeiro documento NÃO é candidato — nada retornado pelo PrimeiroDocumentoResolver
4. Fallback quando DB indisponível
5. Cache invalidado quando admin salva config
6. Regressão: processos modernos com 9500 continuam funcionando
7. Consistência front-back: API retorna exatamente os códigos usados pelo backend
8. PI override sobre "ignorados" (requer config explícita no DB)
9. Código removido do admin PI → volta a ser ignorado
10. extrair_dados_peticao_inicial respeita codigos_pi config-driven
11. Sem hardcodes de PI em constants.py
12. REGRA DE FRONTEIRA — Código 10 (Termo) é preparatório, não PI
"""

import unittest
import sys
import os
from datetime import datetime
from unittest.mock import MagicMock, patch
from dataclasses import dataclass
from typing import Optional

# Adiciona diretório raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database.connection import Base
from sistemas.gerador_pecas.services_source_resolver import (
    SourceResolver,
    DocumentoInfo,
    SourceResolutionResult,
    get_source_resolver,
    invalidar_cache_source_resolver,
)


# =============================================================================
# Fixtures
# =============================================================================

def _make_doc(id: str, codigo: int, data: datetime, ordem: int = 0) -> DocumentoInfo:
    return DocumentoInfo(id=id, codigo=codigo, data=data, ordem=ordem)


# =============================================================================
# TestBase com banco SQLite em memória
# =============================================================================

class _DBTestCase(unittest.TestCase):
    """Base com banco SQLite em memória para testes que precisam de DB."""

    @classmethod
    def setUpClass(cls):
        # Importa model ANTES de create_all para registrar na metadata
        from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento  # noqa: F811
        cls.engine = create_engine(
            "sqlite:///:memory:",
            connect_args={"check_same_thread": False},
        )
        cls.SessionLocal = sessionmaker(bind=cls.engine)
        Base.metadata.create_all(bind=cls.engine)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=cls.engine)

    def setUp(self):
        self.db = self.SessionLocal()
        from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento
        self.db.query(CategoriaDocumento).delete()
        self.db.commit()
        # Reset global resolver entre testes
        from sistemas.gerador_pecas import services_source_resolver
        services_source_resolver._resolver_instance = None

    def tearDown(self):
        self.db.rollback()
        self.db.close()

    def _criar_categoria_pi(self, codigos: list) -> "CategoriaDocumento":
        from sistemas.gerador_pecas.models_config_pecas import CategoriaDocumento
        cat = CategoriaDocumento(
            nome="peticao_inicial",
            titulo="Petição Inicial",
            descricao="Primeiro documento do processo",
            codigos_documento=codigos,
            ativo=True,
            is_primeiro_documento=True,
            ordem=1,
        )
        self.db.add(cat)
        self.db.commit()
        return cat


# =============================================================================
# 1. Processo antigo com código não-padrão configurado no admin
# =============================================================================

class TestCodigoNaoPadrao(_DBTestCase):

    def test_codigo_8326_configurado_no_admin(self):
        """Admin configura PI com códigos [9500, 500, 10, 8326].
        Processo tem primeiro doc com código 8326 → reconhecido como PI."""
        self._criar_categoria_pi([9500, 500, 10, 8326])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 8326, datetime(2015, 1, 1)),
            _make_doc("d2", 500, datetime(2015, 3, 1)),
            _make_doc("d3", 9500, datetime(2015, 6, 1)),
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d1")
        self.assertEqual(result.documento_info.codigo, 8326)
        self.assertIn(8326, result.codigos_usados)


# =============================================================================
# 2. Múltiplos candidatos — apenas o primeiro cronológico vence
# =============================================================================

class TestPrimeiroCronologico(_DBTestCase):

    def test_multiplos_candidatos_primeiro_vence(self):
        """Três documentos PI candidatos. Apenas o mais antigo é retornado."""
        self._criar_categoria_pi([9500, 500, 10, 8326])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 8326, datetime(2015, 1, 1)),
            _make_doc("d2", 500, datetime(2015, 3, 1)),
            _make_doc("d3", 9500, datetime(2015, 6, 1)),
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d1",
                         "Deve retornar o 8326 (mais antigo)")
        self.assertEqual(result.candidatos_avaliados, 3)

    def test_sem_data_usa_ordem(self):
        """Docs sem data usam a ordem como fallback."""
        self._criar_categoria_pi([9500, 500])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 500, data=None, ordem=0),
            _make_doc("d2", 9500, data=None, ordem=1),
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d1",
                         "Sem data, d1 (ordem=0) é primeiro")


# =============================================================================
# 3. Primeiro documento NÃO é candidato — nada retornado
# =============================================================================

class TestPrimeiroNaoCandidato(_DBTestCase):

    def test_nenhum_codigo_candidato(self):
        """Processo sem documentos com código PI → resultado falha."""
        self._criar_categoria_pi([9500, 500, 10])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 357, datetime(2015, 1, 1)),
            _make_doc("d2", 8320, datetime(2015, 3, 1)),
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertFalse(result.sucesso)
        self.assertIsNone(result.documento_id)

    def test_source_resolver_pega_mais_antigo_entre_candidatos(self):
        """SourceResolver filtra candidatos E pega o mais antigo.
        Processo: 357 (Jan), 500 (Mar) → 500 é retornado."""
        self._criar_categoria_pi([9500, 500, 10])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 357, datetime(2015, 1, 1)),  # Não candidato
            _make_doc("d2", 500, datetime(2015, 3, 1)),   # Candidato
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d2")


# =============================================================================
# 4. Fallback quando DB indisponível
# =============================================================================

class TestFallbackSemDB(unittest.TestCase):

    def setUp(self):
        from sistemas.gerador_pecas import services_source_resolver
        services_source_resolver._resolver_instance = None

    def test_fallback_sem_db(self):
        """Sem DB, SourceResolver usa fallback [9500, 500] (sem código 10)."""
        resolver = SourceResolver(db=None)

        codigos = resolver.get_codigos_validos("peticao_inicial")

        self.assertEqual(
            set(codigos),
            {9500, 500},
            f"Fallback deve ser [9500, 500], got {codigos}",
        )

    def test_fallback_sem_db_codigo_10_ignorado(self):
        """Com fallback, código 10 (Termo) é preparatório e NÃO é selecionado como PI.
        A PI real (500) subsequente é retornada."""
        resolver = SourceResolver(db=None)

        docs = [
            _make_doc("d1", 10, datetime(2015, 1, 1)),
            _make_doc("d2", 500, datetime(2015, 3, 1)),
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d2",
                         "Código 10 é preparatório, PI = doc 500")


# =============================================================================
# 5. Cache invalidado quando admin salva config
# =============================================================================

class TestCacheInvalidation(_DBTestCase):

    def test_cache_invalidado_novos_codigos(self):
        """Alterar códigos → invalidar cache → novos códigos usados."""
        cat = self._criar_categoria_pi([500, 9500])
        resolver = get_source_resolver(self.db)

        # Popula cache
        v1 = resolver.get_codigos_validos("peticao_inicial")
        self.assertEqual(set(v1), {500, 9500})

        # Admin adiciona código 10 e 8326
        cat.codigos_documento = [500, 9500, 10, 8326]
        self.db.commit()

        # Sem invalidar: cache antigo
        v_cached = resolver.get_codigos_validos("peticao_inicial")
        self.assertEqual(set(v_cached), {500, 9500})

        # Invalida cache (simulando o que o router faz após salvar)
        invalidar_cache_source_resolver("peticao_inicial")

        # Agora retorna novos códigos
        v2 = resolver.get_codigos_validos("peticao_inicial")
        self.assertEqual(set(v2), {500, 9500, 10, 8326})

    def test_invalidar_tudo(self):
        """invalidar_cache_source_resolver(None) limpa todo o cache."""
        self._criar_categoria_pi([500, 9500])
        resolver = get_source_resolver(self.db)

        # Popula cache
        resolver.get_codigos_validos("peticao_inicial")
        self.assertIn("peticao_inicial", resolver._codigos_cache)

        # Invalida tudo
        invalidar_cache_source_resolver(None)

        self.assertNotIn("peticao_inicial", resolver._codigos_cache)


# =============================================================================
# 6. Regressão: processos modernos com 9500 continuam funcionando
# =============================================================================

class TestRegressao9500(_DBTestCase):

    def test_processo_moderno_9500(self):
        """Processo moderno com 9500 como PI continua funcionando."""
        self._criar_categoria_pi([9500, 500, 10])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 9500, datetime(2024, 1, 15)),
            _make_doc("d2", 8320, datetime(2024, 2, 1)),
            _make_doc("d3", 500, datetime(2024, 3, 1)),
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d1")
        self.assertEqual(result.documento_info.codigo, 9500)


# =============================================================================
# 7. Consistência front-back: API retorna códigos usados pelo backend
# =============================================================================

class TestConsistenciaFrontBack(_DBTestCase):

    def test_get_source_info_retorna_codigos_do_banco(self):
        """API get_source_info retorna os mesmos códigos que o resolver usa."""
        self._criar_categoria_pi([9500, 500, 10, 8326])
        resolver = get_source_resolver(self.db)

        info = resolver.get_source_info("peticao_inicial")
        codigos_info = set(info["codigos_validos"])

        codigos_resolver = set(resolver.get_codigos_validos("peticao_inicial"))

        self.assertEqual(codigos_info, codigos_resolver)
        self.assertEqual(codigos_info, {9500, 500, 10, 8326})

    def test_router_schema_aceita_is_primeiro_documento(self):
        """Schema CategoriaDocumentoBase aceita is_primeiro_documento."""
        from sistemas.gerador_pecas.router_config_pecas import CategoriaDocumentoBase

        dados = CategoriaDocumentoBase(
            nome="test",
            titulo="Test",
            codigos_documento=[100],
            is_primeiro_documento=True,
        )
        self.assertTrue(dados.is_primeiro_documento)

    def test_router_importa_invalidar_cache(self):
        """Router de config importa a função de invalidação de cache."""
        from sistemas.gerador_pecas.router_config_pecas import invalidar_cache_source_resolver
        self.assertIsNotNone(invalidar_cache_source_resolver)


# =============================================================================
# 8. PI override sobre "ignorados" — Requer config explícita no DB
# =============================================================================

class TestPIOverrideIgnorados(_DBTestCase):

    def test_codigo_10_na_blacklist_mas_configurado_no_db_como_pi(self):
        """Código 10 na blacklist de ignorados MAS explicitamente configurado
        como PI no DB → SourceResolver lista o código, mas CODIGOS_PREPARATORIOS_PI
        o filtra como safety net. A PI real (500) subsequente é retornada.

        A prioridade PI > ignorados é tratada em GerenciadorFormatosJSON.obter_formato()
        que verifica _doc_fonte_especial PRIMEIRO, depois blacklist.
        """
        # Admin configura PI com código 10 explicitamente
        self._criar_categoria_pi([9500, 500, 10])
        resolver = get_source_resolver(self.db)

        # Código 10 está nos codigos_validos do DB...
        codigos = resolver.get_codigos_validos("peticao_inicial")
        self.assertIn(10, set(codigos))

        # ...mas CODIGOS_PREPARATORIOS_PI filtra na resolução
        docs = [
            _make_doc("d1", 10, datetime(2015, 1, 1)),
            _make_doc("d2", 500, datetime(2015, 3, 1)),
        ]
        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d2",
                         "Código 10 é preparatório (safety net). PI = doc 500")

    def test_fallback_sem_db_codigo_10_filtrado(self):
        """Sem DB, fallback é [9500, 500]. Código 10 não está no fallback
        e também é preparatório — duplamente excluído."""
        from sistemas.gerador_pecas import services_source_resolver
        services_source_resolver._resolver_instance = None

        resolver = SourceResolver(db=None)

        docs = [
            _make_doc("d1", 10, datetime(2015, 1, 1)),
            _make_doc("d2", 500, datetime(2015, 3, 1)),
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d2",
                         "Fallback [9500,500] não inclui 10. PI = doc 500")


# =============================================================================
# 9. Código removido do admin PI → volta a ser ignorado
# =============================================================================

class TestCodigoRemovidoDoPI(_DBTestCase):

    def test_remover_codigo_para_de_aceitar(self):
        """Admin remove código 10 da PI. SourceResolver para de aceitá-lo."""
        cat = self._criar_categoria_pi([9500, 500, 10])
        resolver = get_source_resolver(self.db)

        # Verifica que 10 é aceito
        codigos_v1 = set(resolver.get_codigos_validos("peticao_inicial"))
        self.assertIn(10, codigos_v1)

        # Admin remove código 10
        cat.codigos_documento = [9500, 500]
        self.db.commit()
        invalidar_cache_source_resolver("peticao_inicial")

        # Verifica que 10 NÃO é mais aceito
        codigos_v2 = set(resolver.get_codigos_validos("peticao_inicial"))
        self.assertNotIn(10, codigos_v2)

        # Confirma que resolve sem aceitar 10
        docs = [
            _make_doc("d1", 10, datetime(2015, 1, 1)),
            _make_doc("d2", 500, datetime(2015, 3, 1)),
        ]
        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d2",
                         "Código 10 removido, deve pegar o 500")


# =============================================================================
# 10. extrair_dados_peticao_inicial respeita codigos_pi config-driven
# =============================================================================

@dataclass
class _MockDoc:
    id: str
    tipo_documento: str
    resumo: Optional[str] = None


@dataclass
class _MockResultado:
    numero_processo: str
    documentos: list


class TestExtrairDadosConfigDriven(unittest.TestCase):

    def test_codigos_custom_aceitos(self):
        """extrair_dados_peticao_inicial com codigos_pi={500, 8326} aceita 8326."""
        from sistemas.gerador_pecas.services_nat_origem import extrair_dados_peticao_inicial

        doc = _MockDoc(
            id="d1",
            tipo_documento="8326",
            resumo='{"peticao_inicial_agravo": true}',
        )
        resultado = _MockResultado("123", [doc])

        dados = extrair_dados_peticao_inicial(resultado, codigos_pi={500, 8326})

        self.assertTrue(dados.get("peticao_inicial_agravo"))

    def test_codigos_custom_rejeita_nao_listados(self):
        """extrair_dados_peticao_inicial com codigos_pi={500} rejeita código 10."""
        from sistemas.gerador_pecas.services_nat_origem import extrair_dados_peticao_inicial

        doc = _MockDoc(
            id="d1",
            tipo_documento="10",
            resumo='{"peticao_inicial_agravo": true}',
        )
        resultado = _MockResultado("123", [doc])

        dados = extrair_dados_peticao_inicial(resultado, codigos_pi={500})

        self.assertEqual(dados, {},
                         "Código 10 não está em codigos_pi={500}, deve retornar vazio")

    def test_fallback_sem_codigos_pi(self):
        """Sem codigos_pi, usa fallback e aceita código 500."""
        from sistemas.gerador_pecas.services_nat_origem import extrair_dados_peticao_inicial

        doc = _MockDoc(
            id="d1",
            tipo_documento="500",
            resumo='{"peticao_inicial_agravo": true}',
        )
        resultado = _MockResultado("123", [doc])

        # Passa codigos_pi=None → usará fallback interno
        dados = extrair_dados_peticao_inicial(resultado, codigos_pi=None)

        self.assertTrue(dados.get("peticao_inicial_agravo"))


# =============================================================================
# 11. Sem hardcodes de PI em constants.py
# =============================================================================

class TestSemHardcodesConstants(unittest.TestCase):

    def test_codigos_primeiro_doc_removido(self):
        """CODIGOS_PRIMEIRO_DOC não deve existir em constants.py (dead code removido)."""
        from sistemas.gerador_pecas import constants

        self.assertFalse(
            hasattr(constants, "CODIGOS_PRIMEIRO_DOC"),
            "CODIGOS_PRIMEIRO_DOC deveria ter sido removido de constants.py"
        )

    def test_codigos_peticao_removido_de_source_resolver(self):
        """CODIGOS_PETICAO não deve existir em SourceResolver (dead code removido)."""
        self.assertFalse(
            hasattr(SourceResolver, "CODIGOS_PETICAO"),
            "CODIGOS_PETICAO deveria ter sido removido de SourceResolver"
        )

    def test_fallback_nao_inclui_codigo_10(self):
        """Fallback é [9500, 500] — código 10 é preparatório, não petição."""
        self.assertEqual(
            set(SourceResolver.CODIGOS_PETICAO_INICIAL_FALLBACK),
            {9500, 500},
        )

    def test_codigos_preparatorios_pi_existe(self):
        """CODIGOS_PREPARATORIOS_PI deve existir e conter código 10."""
        self.assertTrue(
            hasattr(SourceResolver, "CODIGOS_PREPARATORIOS_PI"),
            "SourceResolver deve ter CODIGOS_PREPARATORIOS_PI",
        )
        self.assertIn(10, SourceResolver.CODIGOS_PREPARATORIOS_PI)


# =============================================================================
# 12. REGRA DE FRONTEIRA — Código 10 (Termo) é preparatório
# =============================================================================

class TestRegraFronteiraCodigo10(_DBTestCase):
    """Testes da regra de fronteira: código 10 (Termo) é documento preparatório.

    Em processos antigos, a sequência é:
        [10 (Termo)] → [500 (Petição)] → [outros docs]
    O código 10 NÃO é petição inicial. A primeira petição SUBSTANCIAL
    subsequente (500 ou 9500) é a PI real.
    """

    def test_sequencia_10_500_pi_e_500(self):
        """Sequência [10 → 500] → Petição Inicial = 500."""
        self._criar_categoria_pi([9500, 500])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 10, datetime(2015, 1, 1)),   # Termo (preparatório)
            _make_doc("d2", 500, datetime(2015, 1, 15)),  # Petição real
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d2")
        self.assertEqual(result.documento_info.codigo, 500,
                         "PI deve ser 500, não o Termo (código 10)")

    def test_sequencia_10_9500_pi_e_9500(self):
        """Sequência [10 → 9500] → Petição Inicial = 9500."""
        self._criar_categoria_pi([9500, 500])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 10, datetime(2015, 1, 1)),    # Termo
            _make_doc("d2", 9500, datetime(2015, 1, 15)),  # Petição real
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d2")
        self.assertEqual(result.documento_info.codigo, 9500)

    def test_sequencia_10_outro_codigo_configurado(self):
        """Sequência [10 → código configurado] → código configurado vence."""
        self._criar_categoria_pi([9500, 500, 8326])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 10, datetime(2015, 1, 1)),     # Termo
            _make_doc("d2", 8326, datetime(2015, 1, 15)),   # Código custom configurado
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d2")
        self.assertEqual(result.documento_info.codigo, 8326,
                         "Código configurado (8326) deve ser a PI após o Termo")

    def test_sequencia_sem_codigo_10_comportamento_normal(self):
        """Sequência sem código 10 → comportamento normal (primeiro candidato)."""
        self._criar_categoria_pi([9500, 500])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 9500, datetime(2024, 1, 1)),
            _make_doc("d2", 500, datetime(2024, 2, 1)),
            _make_doc("d3", 8320, datetime(2024, 3, 1)),
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d1")
        self.assertEqual(result.documento_info.codigo, 9500,
                         "Sem código 10, primeiro candidato (9500) é PI")

    def test_multiplos_codigo_10_antes_da_peticao(self):
        """Múltiplos documentos código 10 antes da petição → ainda identifica corretamente."""
        self._criar_categoria_pi([9500, 500])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 10, datetime(2015, 1, 1)),    # Termo 1
            _make_doc("d2", 10, datetime(2015, 1, 5)),    # Termo 2
            _make_doc("d3", 10, datetime(2015, 1, 10)),   # Termo 3
            _make_doc("d4", 500, datetime(2015, 2, 1)),   # Petição real
            _make_doc("d5", 9500, datetime(2015, 3, 1)),  # Outra petição
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertTrue(result.sucesso)
        self.assertEqual(result.documento_id, "d4")
        self.assertEqual(result.documento_info.codigo, 500,
                         "Após 3 Termos, a PI deve ser o doc 500 (primeiro candidato real)")

    def test_somente_codigo_10_sem_candidatos_reais(self):
        """Processo com apenas código 10 e nenhum candidato real → sem PI."""
        self._criar_categoria_pi([9500, 500])
        resolver = get_source_resolver(self.db)

        docs = [
            _make_doc("d1", 10, datetime(2015, 1, 1)),
            _make_doc("d2", 10, datetime(2015, 1, 5)),
        ]

        result = resolver.resolve("peticao_inicial", docs)

        self.assertFalse(result.sucesso,
                         "Apenas Termos (código 10), sem petição real → sem PI")


# =============================================================================
# Runner
# =============================================================================

def run_tests():
    print("\n" + "=" * 70)
    print("TESTES: Petição Inicial - Config-Driven (Remoção de Hardcodes)")
    print("=" * 70 + "\n")

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    suite.addTests(loader.loadTestsFromTestCase(TestCodigoNaoPadrao))
    suite.addTests(loader.loadTestsFromTestCase(TestPrimeiroCronologico))
    suite.addTests(loader.loadTestsFromTestCase(TestPrimeiroNaoCandidato))
    suite.addTests(loader.loadTestsFromTestCase(TestFallbackSemDB))
    suite.addTests(loader.loadTestsFromTestCase(TestCacheInvalidation))
    suite.addTests(loader.loadTestsFromTestCase(TestRegressao9500))
    suite.addTests(loader.loadTestsFromTestCase(TestConsistenciaFrontBack))
    suite.addTests(loader.loadTestsFromTestCase(TestPIOverrideIgnorados))
    suite.addTests(loader.loadTestsFromTestCase(TestCodigoRemovidoDoPI))
    suite.addTests(loader.loadTestsFromTestCase(TestExtrairDadosConfigDriven))
    suite.addTests(loader.loadTestsFromTestCase(TestSemHardcodesConstants))
    suite.addTests(loader.loadTestsFromTestCase(TestRegraFronteiraCodigo10))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 70)
    if result.wasSuccessful():
        print(f"TODOS OS {result.testsRun} TESTES PASSARAM!")
    else:
        print(f"FALHAS: {len(result.failures)}, ERROS: {len(result.errors)}")
    print("=" * 70 + "\n")

    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
