#!/usr/bin/env python3
# scripts/data-fix/corrigir_peca_contestacao_detran.py
"""
Corrige o conteudo do modulo de peca 'contestacao' do grupo DETRAN (group_id=3).

Problema: o modulo id=408 foi criado com o conteudo do prompt de saude (PS),
identico ao id=2 (group_id=1). Precisa ser substituido pelo prompt especifico
para acoes de transito (DETRAN).

Fonte do prompt correto: docs/prompts/detran/peca_contestacao.md
"""
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from dotenv import load_dotenv
load_dotenv(PROJECT_ROOT / ".env")

# Registrar models na ordem correta (FK dependencies)
import auth.models  # noqa: F401
import admin.models_prompt_groups  # noqa: F401
import admin.models_prompts  # noqa: F401
import admin.models  # noqa: F401

from database.connection import SessionLocal
from admin.models_prompts import PromptModulo


PROMPT_FILE = PROJECT_ROOT / "docs" / "prompts" / "detran" / "peca_contestacao.md"
DETRAN_GROUP_ID = 3
MODULO_NOME = "contestacao"


def main():
    if not PROMPT_FILE.exists():
        print(f"[ERRO] Arquivo de prompt nao encontrado: {PROMPT_FILE}")
        sys.exit(1)

    novo_conteudo = PROMPT_FILE.read_text(encoding="utf-8").strip()
    print(f"[INFO] Prompt carregado: {len(novo_conteudo)} chars de {PROMPT_FILE.name}")

    db = SessionLocal()
    try:
        modulo = db.query(PromptModulo).filter(
            PromptModulo.tipo == "peca",
            PromptModulo.nome == MODULO_NOME,
            PromptModulo.group_id == DETRAN_GROUP_ID,
        ).first()

        if not modulo:
            print(f"[ERRO] Modulo peca/{MODULO_NOME} para group_id={DETRAN_GROUP_ID} nao encontrado")
            sys.exit(1)

        print(f"[INFO] Modulo encontrado: id={modulo.id}, titulo='{modulo.titulo}'")
        print(f"[INFO] Conteudo atual: {len(modulo.conteudo)} chars")
        print(f"[INFO] Primeiros 80 chars: {modulo.conteudo[:80]}...")

        if "AÇÕES DE SAÚDE" in modulo.conteudo or "ACOES DE SAUDE" in modulo.conteudo:
            print("[WARN] Conteudo atual e o prompt de SAUDE (PS) — confirmando substituicao")
        elif "TRANSITO" in novo_conteudo.upper() or "DETRAN" in novo_conteudo.upper():
            print("[INFO] Conteudo atual ja parece ser DETRAN, verificando se precisa atualizar...")

        if modulo.conteudo.strip() == novo_conteudo:
            print("[OK] Conteudo ja esta atualizado. Nada a fazer.")
            return

        # Aplicar correcao
        modulo.conteudo = novo_conteudo
        db.commit()
        print(f"[OK] Modulo id={modulo.id} atualizado com sucesso ({len(novo_conteudo)} chars)")
        print(f"[INFO] Primeiros 80 chars agora: {modulo.conteudo[:80]}...")

    finally:
        db.close()


if __name__ == "__main__":
    main()
