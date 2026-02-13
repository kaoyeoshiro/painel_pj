# -*- coding: utf-8 -*-
"""
Script de validacao - Admin Repositories Refactor

Verifica o estado atual da refatoracao e reporta metricas.
"""

import re
import sys
from pathlib import Path
from collections import defaultdict

# Adiciona root ao path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))


def count_db_query_occurrences(file_path: Path) -> dict:
    """Conta ocorrencias de db.query, db.add, etc em um arquivo."""
    content = file_path.read_text(encoding="utf-8")

    return {
        "db.query(": content.count("db.query("),
        "db.execute(": content.count("db.execute("),
        "db.add(": content.count("db.add("),
        "db.delete(": content.count("db.delete("),
        "db.commit()": content.count("db.commit()"),
        "db.rollback()": content.count("db.rollback()"),
    }


def check_repository_exists() -> bool:
    """Verifica se arquivo de repositories existe."""
    repo_file = ROOT_DIR / "admin" / "repositories.py"
    return repo_file.exists()


def count_repository_classes() -> int:
    """Conta classes de repository no arquivo."""
    repo_file = ROOT_DIR / "admin" / "repositories.py"
    if not repo_file.exists():
        return 0

    content = repo_file.read_text(encoding="utf-8")
    return len(re.findall(r"^class \w+Repository", content, re.MULTILINE))


def check_tests_exist() -> bool:
    """Verifica se arquivo de testes existe."""
    test_file = ROOT_DIR / "tests" / "test_admin_repositories.py"
    return test_file.exists()


def count_test_methods() -> int:
    """Conta metodos de teste no arquivo."""
    test_file = ROOT_DIR / "tests" / "test_admin_repositories.py"
    if not test_file.exists():
        return 0

    content = test_file.read_text(encoding="utf-8")
    return len(re.findall(r"^\s+def test_", content, re.MULTILINE))


def check_documentation_exists() -> dict:
    """Verifica existencia dos arquivos de documentacao."""
    docs_dir = ROOT_DIR / "docs" / "refactoring"
    return {
        "SUMARIO_T6_ADMIN_REPOS.md": (docs_dir / "SUMARIO_T6_ADMIN_REPOS.md").exists(),
        "ADMIN_REPOSITORIES_REFACTOR.md": (
            docs_dir / "ADMIN_REPOSITORIES_REFACTOR.md"
        ).exists(),
        "CHECKLIST_REFACTOR_ADMIN.md": (
            docs_dir / "CHECKLIST_REFACTOR_ADMIN.md"
        ).exists(),
        "README.md": (docs_dir / "README.md").exists(),
    }


def main():
    """Executa validacao e reporta resultados."""
    # Fix encoding for Windows
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

    print("=" * 70)
    print("🔍 VALIDAÇÃO - Admin Repositories Refactor")
    print("=" * 70)
    print()

    # 1. Verificar arquivos de código
    print("📁 Arquivos de Código")
    print("-" * 70)

    router_file = ROOT_DIR / "admin" / "router.py"
    router_prompts_file = ROOT_DIR / "admin" / "router_prompts.py"
    repo_file = ROOT_DIR / "admin" / "repositories.py"

    if not router_file.exists():
        print("❌ admin/router.py NÃO encontrado")
        return 1

    if not router_prompts_file.exists():
        print("❌ admin/router_prompts.py NÃO encontrado")
        return 1

    repo_exists = check_repository_exists()
    if repo_exists:
        print("✅ admin/repositories.py encontrado")
        num_repos = count_repository_classes()
        print(f"   └─ {num_repos} classes de repository encontradas")
    else:
        print("❌ admin/repositories.py NÃO encontrado")
        return 1

    print()

    # 2. Contar ocorrências de db.query
    print("📊 Ocorrências de db.query/db.add/db.commit")
    print("-" * 70)

    router_counts = count_db_query_occurrences(router_file)
    router_prompts_counts = count_db_query_occurrences(router_prompts_file)

    print(f"📄 admin/router.py ({router_file.stat().st_size // 1024} KB)")
    for pattern, count in router_counts.items():
        if count > 0:
            print(f"   └─ {pattern:20s} {count:3d} ocorrências")

    total_router = sum(router_counts.values())
    print(f"   └─ {'TOTAL':20s} {total_router:3d} ocorrências")
    print()

    print(f"📄 admin/router_prompts.py ({router_prompts_file.stat().st_size // 1024} KB)")
    for pattern, count in router_prompts_counts.items():
        if count > 0:
            print(f"   └─ {pattern:20s} {count:3d} ocorrências")

    total_router_prompts = sum(router_prompts_counts.values())
    print(f"   └─ {'TOTAL':20s} {total_router_prompts:3d} ocorrências")
    print()

    total_all = total_router + total_router_prompts
    print(f"🎯 TOTAL GERAL: {total_all} ocorrências")
    print()

    # 3. Verificar testes
    print("🧪 Testes")
    print("-" * 70)

    tests_exist = check_tests_exist()
    if tests_exist:
        print("✅ tests/test_admin_repositories.py encontrado")
        num_tests = count_test_methods()
        print(f"   └─ {num_tests} métodos de teste encontrados")
    else:
        print("⚠️  tests/test_admin_repositories.py NÃO encontrado")

    print()

    # 4. Verificar documentação
    print("📚 Documentação")
    print("-" * 70)

    docs_status = check_documentation_exists()
    for doc_name, exists in docs_status.items():
        status = "✅" if exists else "❌"
        print(f"{status} docs/refactoring/{doc_name}")

    print()

    # 5. Resumo e próximos passos
    print("=" * 70)
    print("📋 RESUMO")
    print("=" * 70)
    print()

    print(f"✅ Repositories criados: {num_repos if repo_exists else 0}")
    print(f"✅ Testes escritos: {num_tests if tests_exist else 0}")
    print(f"⏳ db.query() restantes: {total_all}")
    print(f"   └─ admin/router.py: {total_router}")
    print(f"   └─ admin/router_prompts.py: {total_router_prompts}")

    docs_completos = sum(1 for exists in docs_status.values() if exists)
    print(f"✅ Documentos criados: {docs_completos}/{len(docs_status)}")

    print()

    if total_all == 0:
        print("🎉 PARABÉNS! Refatoração 100% completa!")
        print()
        return 0

    # Calcular progresso estimado (baseline: 222 ocorrências)
    BASELINE = 222
    if total_all <= BASELINE:
        progresso = ((BASELINE - total_all) / BASELINE) * 100
        print(f"📈 Progresso estimado: {progresso:.1f}% completo")
        print(f"   (Baseline inicial: {BASELINE} ocorrências)")
    else:
        print(f"⚠️  Mais ocorrências que o baseline inicial ({BASELINE})")

    print()
    print("🚀 PRÓXIMOS PASSOS:")
    print("-" * 70)
    print("1. Ler documentação em docs/refactoring/")
    print("2. Escolher uma fase para refatorar (recomendado: Fase 1)")
    print("3. Seguir checklist em CHECKLIST_REFACTOR_ADMIN.md")
    print("4. Testar cada endpoint refatorado")
    print("5. Commitar mudanças incrementalmente")
    print()

    return 0


if __name__ == "__main__":
    sys.exit(main())
