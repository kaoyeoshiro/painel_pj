#!/usr/bin/env python
"""
Seed do PromptConfig para o chat de edicao de minutas.

Cria o registro na tabela prompt_configs para que o prompt
do editor de pecas apareca editavel em /admin/prompts.

Tambem remove o registro antigo de configuracoes_ia (se existir)
para evitar duplicidade.

Uso:
    python scripts/data-fix/seed_prompt_chat_edicao.py            # Cria se nao existir
    python scripts/data-fix/seed_prompt_chat_edicao.py --force     # Sobrescreve se existir
    python scripts/data-fix/seed_prompt_chat_edicao.py --dry-run   # Apenas mostra o que faria
"""

import os
import sys
import argparse

# Adiciona o diretorio raiz ao path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from dotenv import load_dotenv
load_dotenv()

from database.connection import get_db_context
from admin.models import PromptConfig, ConfiguracaoIA
from sistemas.gerador_pecas.services import PROMPT_CHAT_EDICAO_PADRAO


def main():
    parser = argparse.ArgumentParser(description='Seed do prompt de edicao no prompt_configs')
    parser.add_argument('--dry-run', action='store_true', help='Apenas mostra o que seria feito')
    parser.add_argument('--force', action='store_true', help='Sobrescreve conteudo se ja existir')
    args = parser.parse_args()

    print("=" * 60)
    print("  SEED - PROMPT CHAT EDICAO DE MINUTAS")
    print("=" * 60)

    with get_db_context() as db:
        # 1. Verificar se ja existe em prompt_configs
        existente = db.query(PromptConfig).filter(
            PromptConfig.sistema == "gerador_pecas",
            PromptConfig.tipo == "chat_edicao"
        ).first()

        if existente:
            print(f"\n[INFO] Ja existe PromptConfig id={existente.id}")
            print(f"  Nome: {existente.nome}")
            print(f"  Ativo: {existente.is_active}")
            print(f"  Tamanho: {len(existente.conteudo)} chars")
            if args.force:
                if not args.dry_run:
                    existente.conteudo = PROMPT_CHAT_EDICAO_PADRAO
                    print("[OK] Conteudo atualizado com --force!")
                else:
                    print("[DRY-RUN] Atualizaria o conteudo")
            else:
                print("[SKIP] Ja existe. Use --force para sobrescrever.")
        else:
            print("\n[INFO] Nenhum PromptConfig encontrado. Criando...")
            novo = PromptConfig(
                sistema="gerador_pecas",
                tipo="chat_edicao",
                nome="Chat de Edição de Minutas",
                descricao="System prompt usado no chat de edição pós-geração de peças. Controla guardrails contra invenção de jurisprudência.",
                conteudo=PROMPT_CHAT_EDICAO_PADRAO,
                is_active=True,
                updated_by="seed_script"
            )
            if not args.dry_run:
                db.add(novo)
                print(f"[OK] PromptConfig criado!")
            else:
                print("[DRY-RUN] Criaria PromptConfig")

        # 2. Verificar e limpar registro antigo em configuracoes_ia
        config_antiga = db.query(ConfiguracaoIA).filter(
            ConfiguracaoIA.sistema == "gerador_pecas",
            ConfiguracaoIA.chave == "prompt_chat_edicao"
        ).first()

        if config_antiga:
            print(f"\n[INFO] Encontrado registro antigo em configuracoes_ia (id={config_antiga.id})")
            print(f"  Tamanho do valor: {len(config_antiga.valor)} chars")
            if not args.dry_run:
                db.delete(config_antiga)
                print("[OK] Registro antigo removido de configuracoes_ia")
            else:
                print("[DRY-RUN] Removeria registro antigo")
        else:
            print("\n[INFO] Nenhum registro antigo em configuracoes_ia (OK)")

    print("\n" + "=" * 60)
    print("  CONCLUIDO")
    print("=" * 60)


if __name__ == "__main__":
    main()
