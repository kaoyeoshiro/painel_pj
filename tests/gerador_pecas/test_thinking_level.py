# tests/test_thinking_level.py
"""
Testes para normalização e validação de thinking levels.

Cobre:
- Normalização PT-BR → EN
- Tratamento de "none"
- Validação de valores inválidos
- build_payload com diferentes modelos e níveis
"""

import pytest
from unittest.mock import MagicMock, patch

from services.ia_params_resolver import (
    THINKING_LEVEL_NORMALIZE,
    DEFAULTS,
    get_ia_params,
)
from services.gemini.payloads import build_payload, build_payload_with_images


# ============================================
# Testes de normalização PT-BR → EN
# ============================================


class TestThinkingLevelNormalize:
    """Testa o mapa de normalização de valores legados PT-BR."""

    def test_baixo_normaliza_para_low(self):
        assert THINKING_LEVEL_NORMALIZE["baixo"] == "low"

    def test_medio_normaliza_para_medium(self):
        assert THINKING_LEVEL_NORMALIZE["médio"] == "medium"
        assert THINKING_LEVEL_NORMALIZE["medio"] == "medium"  # sem acento

    def test_alto_normaliza_para_high(self):
        assert THINKING_LEVEL_NORMALIZE["alto"] == "high"

    def test_nenhum_normaliza_para_none(self):
        assert THINKING_LEVEL_NORMALIZE["nenhum"] == "none"

    def test_minimo_normaliza_para_minimal(self):
        assert THINKING_LEVEL_NORMALIZE["mínimo"] == "minimal"
        assert THINKING_LEVEL_NORMALIZE["minimo"] == "minimal"  # sem acento

    def test_mapa_tem_7_entradas(self):
        """Garante que o mapa cobre todas as variantes (com e sem acento)."""
        assert len(THINKING_LEVEL_NORMALIZE) == 7

    def test_valores_alvo_sao_validos(self):
        """Todos os valores alvo devem ser none/minimal/low/medium/high."""
        valid_targets = {"none", "minimal", "low", "medium", "high"}
        for target in THINKING_LEVEL_NORMALIZE.values():
            assert target in valid_targets, f"Valor alvo '{target}' não é válido"


# ============================================
# Testes de get_ia_params com thinking_level
# ============================================


class TestGetIaParamsThinkingLevel:
    """Testa resolução e normalização de thinking_level em get_ia_params."""

    def _mock_db(self, configs: dict):
        """Cria mock do DB retornando valores específicos."""
        db = MagicMock()

        def fake_query(*args, **kwargs):
            chain = MagicMock()

            def fake_filter(*filter_args):
                inner = MagicMock()

                def fake_first():
                    # Extrai sistema e chave dos filtros
                    for cfg_key, cfg_val in configs.items():
                        sistema_key, chave_key = cfg_key
                        # Testa se bate (simplificado)
                        result = MagicMock()
                        result.valor = cfg_val
                        return result
                    return None

                inner.first = fake_first
                return inner

            chain.filter = fake_filter
            return chain

        db.query = fake_query
        return db

    def test_default_thinking_level_is_low(self):
        """Sem nenhum valor no DB, default deve ser 'low'."""
        assert DEFAULTS["thinking_level"] == "low"

    @patch("services.ia_params_resolver._get_config_value")
    def test_none_value_becomes_python_none(self, mock_get):
        """Quando thinking_level='none', deve virar None (sem thinkingConfig)."""
        mock_get.side_effect = lambda db, sistema, chave: {
            ("gerador_pecas", "thinking_level_geracao"): "none",
        }.get((sistema, chave))

        params = get_ia_params(MagicMock(), "gerador_pecas", "geracao")
        assert params.thinking_level is None

    @patch("services.ia_params_resolver._get_config_value")
    def test_ptbr_baixo_normalized_to_low(self, mock_get):
        """Valor legado 'baixo' deve ser normalizado para 'low'."""
        mock_get.side_effect = lambda db, sistema, chave: {
            ("gerador_pecas", "thinking_level_geracao"): "Baixo",
        }.get((sistema, chave))

        params = get_ia_params(MagicMock(), "gerador_pecas", "geracao")
        assert params.thinking_level == "low"

    @patch("services.ia_params_resolver._get_config_value")
    def test_ptbr_medio_normalized_to_medium(self, mock_get):
        """Valor legado 'médio' deve ser normalizado para 'medium'."""
        mock_get.side_effect = lambda db, sistema, chave: {
            ("gerador_pecas", "thinking_level_geracao"): "Médio",
        }.get((sistema, chave))

        params = get_ia_params(MagicMock(), "gerador_pecas", "geracao")
        assert params.thinking_level == "medium"

    @patch("services.ia_params_resolver._get_config_value")
    def test_ptbr_alto_normalized_to_high(self, mock_get):
        """Valor legado 'alto' deve ser normalizado para 'high'."""
        mock_get.side_effect = lambda db, sistema, chave: {
            ("gerador_pecas", "thinking_level_geracao"): "Alto",
        }.get((sistema, chave))

        params = get_ia_params(MagicMock(), "gerador_pecas", "geracao")
        assert params.thinking_level == "high"

    @patch("services.ia_params_resolver._get_config_value")
    def test_ptbr_nenhum_becomes_none(self, mock_get):
        """Valor legado 'nenhum' deve normalizar para 'none' e então virar None."""
        mock_get.side_effect = lambda db, sistema, chave: {
            ("gerador_pecas", "thinking_level_geracao"): "Nenhum",
        }.get((sistema, chave))

        params = get_ia_params(MagicMock(), "gerador_pecas", "geracao")
        assert params.thinking_level is None

    @patch("services.ia_params_resolver._get_config_value")
    def test_invalid_value_becomes_none(self, mock_get):
        """Valor inválido (ex: 'super') deve ser rejeitado e virar None."""
        mock_get.side_effect = lambda db, sistema, chave: {
            ("gerador_pecas", "thinking_level_geracao"): "super",
        }.get((sistema, chave))

        params = get_ia_params(MagicMock(), "gerador_pecas", "geracao")
        assert params.thinking_level is None

    @patch("services.ia_params_resolver._get_config_value")
    def test_valid_en_values_pass_through(self, mock_get):
        """Valores EN válidos passam sem alteração."""
        for level in ("minimal", "low", "medium", "high"):
            mock_get.side_effect = lambda db, sistema, chave, lev=level: {
                ("gerador_pecas", "thinking_level_geracao"): lev,
            }.get((sistema, chave))

            params = get_ia_params(MagicMock(), "gerador_pecas", "geracao")
            assert params.thinking_level == level, f"Expected {level}, got {params.thinking_level}"


# ============================================
# Testes de build_payload
# ============================================


class TestBuildPayloadThinkingLevel:
    """Testa construção do payload com thinkingConfig para diferentes modelos."""

    def test_gemini3_flash_all_levels_valid(self):
        """Gemini 3 Flash aceita minimal, low, medium, high."""
        for level in ("minimal", "low", "medium", "high"):
            payload = build_payload(
                prompt="test",
                thinking_level=level,
                model="gemini-3.7-flash",
            )
            config = payload["generationConfig"]
            assert "thinkingConfig" in config, f"Level '{level}' should be valid for Flash"
            assert config["thinkingConfig"]["thinkingLevel"] == level

    def test_gemini3_flash_lite_all_levels_valid(self):
        """Gemini 3.5 Flash Lite aceita minimal, low, medium, high."""
        for level in ("minimal", "low", "medium", "high"):
            payload = build_payload(
                prompt="test",
                thinking_level=level,
                model="gemini-3.5-flash-lite",
            )
            config = payload["generationConfig"]
            assert "thinkingConfig" in config, f"Level '{level}' should be valid for Flash Lite"
            assert config["thinkingConfig"]["thinkingLevel"] == level

    def test_gemini3_non_flash_only_low_high(self):
        """Modelo Gemini 3 nao-flash aceita apenas low e high."""
        for level in ("low", "high"):
            payload = build_payload(
                prompt="test",
                thinking_level=level,
                model="gemini-3-ultra",
            )
            assert "thinkingConfig" in payload["generationConfig"]

        for level in ("minimal", "medium"):
            payload = build_payload(
                prompt="test",
                thinking_level=level,
                model="gemini-3-ultra",
            )
            assert "thinkingConfig" not in payload["generationConfig"], \
                f"Level '{level}' should NOT be valid for non-flash"

    def test_none_thinking_level_no_config(self):
        """thinking_level=None não deve adicionar thinkingConfig."""
        payload = build_payload(
            prompt="test",
            thinking_level=None,
            model="gemini-3.7-flash",
        )
        assert "thinkingConfig" not in payload["generationConfig"]

    def test_empty_string_thinking_level_no_config(self):
        """thinking_level='' (falsy) não deve adicionar thinkingConfig."""
        payload = build_payload(
            prompt="test",
            thinking_level="",
            model="gemini-3.7-flash",
        )
        assert "thinkingConfig" not in payload["generationConfig"]

    def test_gemini25_flash_lite_no_thinking_config(self):
        """Gemini 2.5 Flash Lite usa thinkingBudget, não thinkingLevel."""
        for level in ("minimal", "low", "medium", "high"):
            payload = build_payload(
                prompt="test",
                thinking_level=level,
                model="gemini-2.5-flash-lite",
            )
            assert "thinkingConfig" not in payload["generationConfig"]

    def test_no_model_no_thinking_config(self):
        """Sem modelo especificado, não deve adicionar thinkingConfig."""
        payload = build_payload(
            prompt="test",
            thinking_level="high",
            model=None,
        )
        assert "thinkingConfig" not in payload["generationConfig"]


class TestBuildPayloadWithImagesThinkingLevel:
    """Testa que build_payload_with_images tem o mesmo comportamento de thinking."""

    def test_gemini3_flash_with_images(self):
        """thinkingConfig deve funcionar com payload de imagens."""
        payload = build_payload_with_images(
            prompt="test",
            images_base64=["data:image/png;base64,abc123"],
            thinking_level="low",
            model="gemini-3.7-flash",
        )
        assert "thinkingConfig" in payload["generationConfig"]
        assert payload["generationConfig"]["thinkingConfig"]["thinkingLevel"] == "low"

    def test_gemini25_flash_lite_with_images_no_thinking(self):
        """Gemini 2.5 Flash Lite com imagens não deve ter thinkingConfig."""
        payload = build_payload_with_images(
            prompt="test",
            images_base64=["data:image/png;base64,abc123"],
            thinking_level="high",
            model="gemini-2.5-flash-lite",
        )
        assert "thinkingConfig" not in payload["generationConfig"]
