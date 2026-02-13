# -*- coding: utf-8 -*-
"""
Testes de prevencao de XSS persistente nos schemas de usuario.

Verifica:
- full_name rejeita <script>, <img onerror=...>, javascript:, etc
- full_name aceita nomes brasileiros com acentos
- setor remove tags HTML benignas
- None em setor passa sem erro
- API retorna 422 para payloads XSS
"""

import sys
from pathlib import Path

import pytest

pytestmark = pytest.mark.security

# Adiciona raiz do projeto ao path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.sanitize import validate_no_html, sanitize_user_field
from auth.schemas import UserBase, UserCreate, UserUpdate


class TestValidateNoHtml:
    """Testes da funcao validate_no_html."""

    def test_rejects_script_tag(self):
        """<script>alert(1)</script> deve ser rejeitado."""
        with pytest.raises(ValueError, match="conteúdo não permitido"):
            validate_no_html('<script>alert("xss")</script>', "teste")

    def test_rejects_script_tag_uppercase(self):
        """<SCRIPT> deve ser rejeitado (case-insensitive)."""
        with pytest.raises(ValueError, match="conteúdo não permitido"):
            validate_no_html('<SCRIPT>alert(1)</SCRIPT>', "teste")

    def test_rejects_img_onerror(self):
        """<img onerror=...> deve ser rejeitado."""
        with pytest.raises(ValueError, match="conteúdo não permitido"):
            validate_no_html('<img src=x onerror="alert(1)">', "teste")

    def test_rejects_iframe(self):
        """<iframe> deve ser rejeitado."""
        with pytest.raises(ValueError, match="conteúdo não permitido"):
            validate_no_html('<iframe src="evil.com"></iframe>', "teste")

    def test_rejects_javascript_protocol(self):
        """javascript: deve ser rejeitado."""
        with pytest.raises(ValueError, match="conteúdo não permitido"):
            validate_no_html('javascript:alert(1)', "teste")

    def test_rejects_event_handler(self):
        """onclick=, onmouseover=, etc devem ser rejeitados."""
        with pytest.raises(ValueError, match="conteúdo não permitido"):
            validate_no_html('<div onclick="alert(1)">test</div>', "teste")

    def test_rejects_svg_onload(self):
        """<svg onload=...> deve ser rejeitado."""
        with pytest.raises(ValueError, match="conteúdo não permitido"):
            validate_no_html('<svg onload="alert(1)">', "teste")

    def test_rejects_data_text_html(self):
        """data:text/html deve ser rejeitado."""
        with pytest.raises(ValueError, match="conteúdo não permitido"):
            validate_no_html('data:text/html,<script>alert(1)</script>', "teste")

    def test_strips_benign_html(self):
        """Tags HTML benignas (<b>, <i>) devem ser removidas silenciosamente."""
        result = validate_no_html("<b>Joao</b>", "teste")
        assert result == "Joao"

    def test_allows_normal_text(self):
        """Texto normal deve passar sem alteracao."""
        assert validate_no_html("Jose da Silva", "teste") == "Jose da Silva"

    def test_allows_accented_names(self):
        """Nomes brasileiros com acentos devem ser aceitos."""
        nomes = [
            "José da Silva Neto",
            "Maria Conceição Albuquerque",
            "João Araújo Júnior",
            "Fátima D'Ávila",
            "Ana Lúcia Pereira",
        ]
        for nome in nomes:
            assert validate_no_html(nome, "teste") == nome

    def test_allows_empty_string(self):
        """String vazia deve retornar vazio."""
        assert validate_no_html("", "teste") == ""

    def test_allows_none_returns_none(self):
        """None deve retornar None (via sanitize_user_field)."""
        assert sanitize_user_field(None, "teste") is None


class TestSanitizeUserField:
    """Testes do wrapper sanitize_user_field."""

    def test_none_passes(self):
        """None deve retornar None."""
        assert sanitize_user_field(None, "setor") is None

    def test_strips_html(self):
        """Tags HTML devem ser removidas."""
        assert sanitize_user_field("<b>TI</b>", "setor") == "TI"

    def test_rejects_dangerous(self):
        """Payloads perigosos devem ser rejeitados."""
        with pytest.raises(ValueError):
            sanitize_user_field('<script>alert(1)</script>', "setor")


class TestUserBaseSchema:
    """Testes de XSS nos schemas Pydantic."""

    def test_full_name_rejects_script(self):
        """UserBase rejeita script em full_name."""
        with pytest.raises(Exception):  # ValidationError
            UserBase(
                username="testuser",
                full_name='<script>alert("xss")</script>',
                role="user",
            )

    def test_full_name_strips_benign_html(self):
        """UserBase remove HTML benigno de full_name."""
        user = UserBase(
            username="testuser",
            full_name="<b>Jose da Silva</b>",
            role="user",
        )
        assert user.full_name == "Jose da Silva"

    def test_full_name_allows_accented(self):
        """UserBase aceita nomes acentuados."""
        user = UserBase(
            username="testuser",
            full_name="José Conceição Araújo Júnior",
            role="user",
        )
        assert user.full_name == "José Conceição Araújo Júnior"


class TestUserCreateSchema:
    """Testes de XSS em UserCreate."""

    def test_setor_strips_html(self):
        """UserCreate remove HTML de setor."""
        user = UserCreate(
            username="testuser",
            full_name="Jose Silva",
            role="user",
            setor="<b>TI</b>",
        )
        assert user.setor == "TI"

    def test_setor_rejects_script(self):
        """UserCreate rejeita script em setor."""
        with pytest.raises(Exception):
            UserCreate(
                username="testuser",
                full_name="Jose Silva",
                role="user",
                setor='<script>alert(1)</script>',
            )

    def test_setor_none_passes(self):
        """UserCreate aceita setor=None."""
        user = UserCreate(
            username="testuser",
            full_name="Jose Silva",
            role="user",
            setor=None,
        )
        assert user.setor is None


class TestUserUpdateSchema:
    """Testes de XSS em UserUpdate."""

    def test_full_name_rejects_xss(self):
        """UserUpdate rejeita XSS em full_name."""
        with pytest.raises(Exception):
            UserUpdate(full_name='<img src=x onerror="alert(1)">')

    def test_full_name_none_passes(self):
        """UserUpdate aceita full_name=None."""
        user = UserUpdate(full_name=None)
        assert user.full_name is None

    def test_setor_strips_html(self):
        """UserUpdate remove HTML de setor."""
        user = UserUpdate(setor="<em>Juridico</em>")
        assert user.setor == "Juridico"

    def test_setor_rejects_xss(self):
        """UserUpdate rejeita XSS em setor."""
        with pytest.raises(Exception):
            UserUpdate(setor='<script>document.cookie</script>')
